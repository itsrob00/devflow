#!/usr/bin/env node
// PreToolUse hook: blocks git commands that lose work or leave the machine, so you run them yourself.
// Blocked: push, reset --hard, clean -f, branch -D, and discarding the whole working tree
// (checkout or restore of `.`, checkout -f, switch --discard-changes).
// Flags are checked wherever they appear, and compound commands, `bash -c`, `$(...)` and here-docs fed to a shell piece by piece.
// It only acts in a conversation linked to an unfinished devflow flow; everywhere else git runs as usual.
// Turn it off with the git_guard plugin option, or DEVFLOW_GUARD=off in the environment.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSettings } from './devflow-lib.mjs'

function deny (reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `devflow git guard: ${reason}. Don't work around it; give the user the exact command to run.`
    }
  }))
  process.exit(0)
}

// ---------- shell parsing ----------

// Splits a command line into segments of words. Handles quotes, escapes, the separators
// ; & && || | and newlines, and pulls `$(...)` / backtick bodies out as extra commands.
export function parse (cmd) {
  const segments = []
  const nested = []
  let words = []
  let word = null
  let redirect = null
  const redirects = []
  let heredocs = []
  let pending = []
  const push = () => {
    if (word === null) return
    if (redirect === true) redirects.push(word)
    else if (redirect && redirect.heredoc) pending.push({ delim: word, strip: redirect.strip, to: heredocs })
    else if (!redirect) words.push(word)
    redirect = null
    word = null
  }
  const end = () => {
    push()
    if (words.length || redirects.length) segments.push({ words, redirects: [...redirects], heredocs })
    words = []
    redirects.length = 0
    heredocs = []
  }
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    // a here-doc body starts on the next line; keep it as data, not commands
    if (c === '\n') push()
    if (c === '\n' && pending.length) {
      end()
      let at = i + 1
      for (const h of pending) {
        const body = []
        while (at < cmd.length) {
          const nl = cmd.indexOf('\n', at)
          const line = cmd.slice(at, nl < 0 ? cmd.length : nl)
          at = nl < 0 ? cmd.length : nl + 1
          if ((h.strip ? line.replace(/^\t+/, '') : line) === h.delim) break
          body.push(line)
        }
        h.to.push(body.join('\n'))
      }
      pending = []
      i = at - 1
      continue
    }
    if (c === '\\' && i + 1 < cmd.length) { word = (word ?? '') + cmd[++i]; continue }
    if (c === "'") {
      const j = cmd.indexOf("'", i + 1)
      word = (word ?? '') + cmd.slice(i + 1, j < 0 ? cmd.length : j)
      i = j < 0 ? cmd.length : j
      continue
    }
    if (c === '"') {
      let j = i + 1
      let s = ''
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\' && j + 1 < cmd.length) { s += cmd[j + 1]; j += 2; continue }
        if (cmd[j] === '$' && cmd[j + 1] === '(') { const k = matchParen(cmd, j + 1); nested.push(cmd.slice(j + 2, k)); s += cmd.slice(j, k + 1); j = k + 1; continue }
        if (cmd[j] === '`') { const k = cmd.indexOf('`', j + 1); nested.push(cmd.slice(j + 1, k < 0 ? cmd.length : k)); j = k < 0 ? cmd.length : k + 1; continue }
        s += cmd[j++]
      }
      word = (word ?? '') + s
      i = j
      continue
    }
    if (c === '$' && cmd[i + 1] === '(') { const k = matchParen(cmd, i + 1); nested.push(cmd.slice(i + 2, k)); word = (word ?? '') + '$()'; i = k; continue }
    if (c === '`') { const k = cmd.indexOf('`', i + 1); nested.push(cmd.slice(i + 1, k < 0 ? cmd.length : k)); i = k < 0 ? cmd.length : k; continue }
    if (c === '(' || c === ')' || c === '{' && word === null || c === '}' && word === null) { end(); continue }
    if (c === ';' || c === '\n' || c === '&' || c === '|') {
      if (c === '&' && cmd[i + 1] === '>') { push(); redirect = true; i++; if (cmd[i + 1] === '>') i++; continue }
      end(); continue
    }
    if (c === '>' || c === '<') {
      if (word !== null && /^\d+$/.test(word)) word = null
      else push()
      if (c === '>') {
        if (cmd[i + 1] === '>' || cmd[i + 1] === '|') i++
        if (cmd[i + 1] === '&') { i++; while (/[\d-]/.test(cmd[i + 1] || '')) i++; continue }
        redirect = true
      } else {
        // input redirects and here-strings are reads; drop their operand. A here-doc keeps its delimiter.
        if (cmd[i + 1] === '<' && cmd[i + 2] !== '<') {
          i++
          const strip = cmd[i + 1] === '-'
          if (strip) i++
          redirect = { heredoc: true, strip }
          continue
        }
        if (cmd[i + 1] === '<') i += 2
        redirect = 'in'
      }
      continue
    }
    if (/\s/.test(c)) { push(); continue }
    word = (word ?? '') + c
  }
  end()
  return { segments: segments.map(s => ({ words: s.words, heredocs: s.heredocs })), nested }
}

function matchParen (s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')' && --depth === 0) return i
  }
  return s.length
}

// ---------- rules ----------

const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'])
const WHOLE_TREE = new Set(['.', './', ':/', ':', '*', ':/*'])

// Expands `-abc` into a, b, c.
function shortFlags (w) {
  if (!/^-[A-Za-z]/.test(w) || w.startsWith('--')) return []
  return [...w.slice(1)]
}

const has = (args, long, short) => args.some(a => a === long || a.startsWith(long + '=') || (short && shortFlags(a).includes(short)))

function checkGit (args) {
  let i = 0
  while (i < args.length && args[i].startsWith('-')) {
    i += GIT_GLOBAL_WITH_VALUE.has(args[i]) ? 2 : 1
  }
  const sub = args[i]
  const rest = args.slice(i + 1)
  const opts = rest.slice(0, rest.indexOf('--') < 0 ? rest.length : rest.indexOf('--'))
  const paths = rest.filter(a => !a.startsWith('-'))
  if (sub === 'push') return 'git push is blocked'
  if (sub === 'reset' && opts.includes('--hard')) return 'git reset --hard is blocked'
  if (sub === 'clean' && has(opts, '--force', 'f')) return 'git clean -f is blocked'
  if (sub === 'branch') {
    if (opts.some(a => shortFlags(a).includes('D'))) return 'git branch -D is blocked'
    if (has(opts, '--delete', 'd') && has(opts, '--force', 'f')) return 'force-deleting a branch is blocked'
  }
  if (sub === 'checkout') {
    if (has(opts, '--force', 'f')) return 'git checkout --force is blocked'
    if (paths.some(p => WHOLE_TREE.has(p))) return 'git checkout of the whole tree is blocked'
  }
  if (sub === 'switch' && (has(opts, '--force', 'f') || has(opts, '--discard-changes'))) return 'git switch --discard-changes is blocked'
  if (sub === 'restore') {
    const onlyStaged = has(opts, '--staged', 'S') && !has(opts, '--worktree', 'W')
    if (!onlyStaged && paths.some(p => WHOLE_TREE.has(p))) return 'git restore of the whole tree is blocked'
  }
  return null
}

function checkSegment ({ words, heredocs }, depth) {
  // drop leading env assignments and wrappers
  const w = words.slice()
  while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w.shift()
  while (w.length && ['sudo', 'env', 'command', 'exec', 'nohup', 'time', 'timeout', 'xargs', 'nice'].includes(w[0])) {
    w.shift()
    while (w.length && (w[0].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0]) || /^\d+[smhd]?$/.test(w[0]))) w.shift()
  }
  if (!w.length) return null
  const cmd = path.basename(w[0])
  const args = w.slice(1)
  if (['bash', 'sh', 'zsh', 'dash'].includes(cmd)) {
    const k = args.findIndex(a => a === '-c' || /^-[a-z]*c$/.test(a))
    if (k >= 0 && args[k + 1] !== undefined) return check(args[k + 1], depth + 1)
    // `bash <<EOF` runs its here-doc
    for (const h of heredocs) { const r = check(h, depth + 1); if (r) return r }
  }
  if (cmd === 'eval') return check(args.join(' '), depth + 1)
  if (cmd === 'git') return checkGit(args)
  return null
}

export function check (command, depth = 0) {
  if (depth > 5) return 'command nests too deeply to check'
  const { segments, nested } = parse(command)
  for (const s of segments) {
    const r = checkSegment(s, depth)
    if (r) return r
  }
  for (const n of nested) {
    const r = check(n, depth + 1)
    if (r) return r
  }
  return null
}

// ---------- main ----------

// The flow a conversation works on is linked in .devflow/sessions/<session id> by devflow's track hook.
export function inFlow (root, sessionId) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(sessionId)) return false
  try {
    const id = fs.readFileSync(path.join(root, '.devflow', 'sessions', sessionId), 'utf8').trim()
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return false
    const state = JSON.parse(fs.readFileSync(path.join(root, '.devflow', 'flows', id, 'state.json'), 'utf8'))
    return state?.status !== 'done'
  } catch {
    return false
  }
}

function main () {
  if (!loadSettings().git_guard) return
  let input
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8'))
  } catch {
    return
  }
  const command = input?.tool_input?.command
  if (input?.tool_name !== 'Bash' || typeof command !== 'string') return
  if (!inFlow(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd(), input.session_id)) return
  const r = check(command)
  if (r) deny(r)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
