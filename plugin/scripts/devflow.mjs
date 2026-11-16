#!/usr/bin/env node
// devflow helper. Run from the project root.
//   devflow settings                   the settings in use
//   devflow flows                      unfinished flows, newest first; marks flows whose PR merged done
//   devflow flow new <flow> <title>    save a new flow; prints its id and folder
//   devflow flow set <id> key=value... update a saved flow: step, next, branch, tickets, pr, title, status, flow
//   devflow flow show <id>             everything a session needs to continue that flow, and nothing from the others
//   devflow flow done <id>             mark a flow finished
//   devflow reminder                   SessionStart hook: tells the user when there are flows to continue
//   devflow rules                      SessionStart hook: devflow mode and the no-comments rule, when their settings are on
//   devflow track                      PostToolUse hook: links this conversation to the flow its devflow flow commands work on
//   devflow active                     UserPromptSubmit and SessionStart hook: reminds the agent of the linked flow on every message
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ADAPTERS } from './devflow-adapters.mjs'
import { AGENTS, agentFor, currentAgent, hookAgent, hookPayload, loadSettings, projectRoot } from './devflow-lib.mjs'

// Hooks read their payload once here; the project folder comes from it, or from where the command runs.
const HOOKS = ['reminder', 'rules', 'track', 'active']
const hookFrom = hookAgent(process.argv)
const installedAgent = currentAgent()
const input = HOOKS.includes(process.argv[2]) ? hookPayload(hookInput(), hookFrom) : null
const root = projectRoot(input)

function settings () {
  const s = loadSettings(root)
  const { fast, strong } = AGENTS[installedAgent].closest
  console.log(`git guard: ${s.git_guard ? 'on' : 'off'}`)
  console.log(`no code comments: ${s.no_comments ? 'on' : 'off'}`)
  console.log(`devflow mode: ${s.mode ? 'on' : 'off'}`)
  console.log(`adversarial review: ${s.adversarial_review}`)
  console.log(`subagents at once: ${s.subagent_count}`)
  console.log(`subagent model: ${s.subagent_model === 'auto' ? `auto (simple tickets: ${fast}, complex tickets: ${strong})` : s.subagent_model}`)
  console.log(`strong model: ${strong}`)
  console.log(`tracker: ${s.tracker === 'auto' ? 'auto (from the git remote)' : s.tracker}`)
}

// Each flow is saved in the project under .devflow/flows/<id>/: state.json (where it stands), plan.md, decisions.md
// and, for a big job tracked in files, tickets/. A session continuing one flow reads only that folder.
const FLOWS_DIR = path.join(root, '.devflow', 'flows')
const FIRST_STEP = { feature: '1. Understand', bug: '1. Diagnose', big: '1. Understand', small: '1. Change' }
const FIELDS = ['step', 'next', 'branch', 'tickets', 'pr', 'title', 'status', 'flow']
const ID = /^[a-z0-9][a-z0-9-]*$/

const rel = p => path.relative(root, p).split(path.sep).join('/')
const day = ms => new Date(ms).toISOString().slice(0, 10)
const cap = s => s[0].toUpperCase() + s.slice(1)
const fail = msg => { console.error(msg); process.exit(2) }

// The folder name is the id, whatever state.json says, so a renamed or copied folder still reads and writes itself.
function readState (id) {
  if (!ID.test(id)) return null
  const file = path.join(FLOWS_DIR, id, 'state.json')
  let s, mtime
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); mtime = fs.statSync(file).mtimeMs } catch (e) {
    return fs.existsSync(path.join(FLOWS_DIR, id)) ? { id, broken: `${rel(file)} ${e.code === 'ENOENT' ? 'is missing' : "isn't valid JSON"}` } : null
  }
  if (!s || typeof s !== 'object' || Array.isArray(s) || !FIRST_STEP[s.flow]) return { id, broken: `${rel(file)} doesn't name a flow (feature, bug, big or small)` }
  return {
    ...s,
    id,
    title: s.title || id,
    step: s.step || FIRST_STEP[s.flow],
    status: s.status || 'active',
    updated: typeof s.updated === 'string' ? s.updated : new Date(mtime).toISOString()
  }
}

function writeState (state) {
  state.updated = new Date().toISOString()
  fs.writeFileSync(path.join(FLOWS_DIR, state.id, 'state.json'), JSON.stringify(state, null, 2) + '\n')
}

function savedFlows () {
  let ids = []
  try { ids = fs.readdirSync(FLOWS_DIR) } catch {}
  return ids.map(readState).filter(Boolean)
}

function needFlow (id) {
  if (!id) fail('usage: devflow flow set|show|done <id> ...')
  const state = readState(id)
  if (!state) fail(`no saved flow ${id}. Run devflow flows to see them.`)
  if (state.broken) fail(`flow ${id}: ${state.broken}. Fix or delete that file.`)
  return state
}

// A Status line saying the ticket is finished, and the Blocked by line naming the tickets it waits on.
const CLOSED = /^[ \t]*(?:[-*>#]+[ \t]*)?\**status:?\**:?[ \t]*`?(resolved|done|closed|complete|completed|wontfix|wont-fix|won't fix)`?[ \t]*\.?[ \t]*$/im
const BLOCKED_BY = /^[ \t]*(?:[-*>#]+[ \t]*)?\**blocked by:?\**:?(.*)$/im

const ticketNumber = file => Number(/^\d+/.exec(path.basename(file))?.[0] ?? NaN)

// Ticket files in number order. A ticket is ready when it is open and none of its blockers is.
function ticketFiles (dir) {
  let names
  try { names = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name) } catch { return null }
  const all = names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(n => path.join(dir, n))
  const text = f => { try { return fs.readFileSync(f, 'utf8') } catch { return '' } }
  const open = all.filter(f => !CLOSED.test(text(f)))
  const waiting = new Set(open.map(ticketNumber))
  const blockers = f => (BLOCKED_BY.exec(text(f))?.[1].match(/\d+/g) || []).map(Number)
  return { all, open, ready: open.filter(f => !blockers(f).some(n => waiting.has(n))) }
}

// Tickets kept as files live in the flow's own tickets/ folder, unless its tickets ref names another folder.
function ticketDir (state) {
  const named = state.tickets && path.resolve(root, state.tickets)
  const isDir = d => { try { return fs.statSync(d).isDirectory() } catch { return false } }
  if (named && isDir(named)) return named
  const own = path.join(FLOWS_DIR, state.id, 'tickets')
  return isDir(own) ? own : null
}

function ticketLine (state) {
  const dir = ticketDir(state)
  const t = dir && ticketFiles(dir)
  if (!t || !t.all.length) return state.tickets ? `tickets: ${state.tickets} on the issue tracker; its open tickets with no open blocker are ready` : null
  if (!t.open.length) return `tickets: all ${t.all.length} in ${rel(dir)} are done`
  if (!t.ready.length) return `tickets: the ${t.open.length} open in ${rel(dir)} all wait on another open ticket`
  return `ready tickets: ${t.ready.map(f => path.basename(f)).join(', ')} in ${rel(dir)} (${t.open.length} of ${t.all.length} open)`
}

function slug (text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').split('-').slice(0, 5).join('-') || `flow-${day(Date.now())}`
}

function flow ([sub, id, ...rest]) {
  if (sub === 'new') {
    const kind = (id || '').toLowerCase()
    if (!FIRST_STEP[kind] || !rest.length) fail(`usage: devflow flow new <${Object.keys(FIRST_STEP).join('|')}> <title>`)
    const title = rest.join(' ')
    let newId = slug(title)
    for (let i = 2; fs.existsSync(path.join(FLOWS_DIR, newId)); i++) newId = `${slug(title)}-${i}`
    fs.mkdirSync(path.join(FLOWS_DIR, newId), { recursive: true })
    const ignore = path.join(root, '.devflow', '.gitignore')
    if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n')
    writeState({ id: newId, title, flow: kind, step: FIRST_STEP[kind], next: '', branch: '', tickets: '', status: 'active', created: new Date().toISOString() })
    console.log(`${newId}\t${rel(path.join(FLOWS_DIR, newId))}`)
  } else if (sub === 'set') {
    const state = needFlow(id)
    const usage = `usage: devflow flow set <id> ${FIELDS.map(f => f + '=...').join(' ')}`
    if (!rest.length) fail(usage)
    for (const kv of rest) {
      const i = kv.indexOf('=')
      const k = kv.slice(0, i)
      let v = kv.slice(i + 1)
      if (i < 1 || !FIELDS.includes(k)) fail(usage)
      if (k === 'flow' && !FIRST_STEP[v = v.toLowerCase()]) fail(`flow must be one of ${Object.keys(FIRST_STEP).join(', ')}`)
      state[k] = v
    }
    writeState(state)
    console.log(`${state.id}: ${FIELDS.filter(f => state[f]).map(f => `${f}=${state[f]}`).join(', ')}`)
  } else if (sub === 'show') {
    const state = needFlow(id)
    const dir = path.join(FLOWS_DIR, state.id)
    console.log(`# Flow ${state.id}: ${state.title}`)
    console.log(`# This session works on this flow only: don't read other folders in ${rel(FLOWS_DIR)} or take steps from them, and save progress only on this id.`)
    console.log(`flow: ${cap(state.flow)}`)
    if (state.status !== 'active') console.log(`status: ${state.status}`)
    console.log(`step: ${state.step}`)
    if (state.next) console.log(`next: ${state.next}`)
    if (state.branch) console.log(`branch: ${state.branch}`)
    if (state.pr) console.log(`pr: ${state.pr}`)
    const t = ticketLine(state)
    if (t) console.log(t)
    console.log(`folder: ${rel(dir)}`)
    for (const [name, what] of [['plan.md', 'plan'], ['decisions.md', 'decisions']]) {
      if (fs.existsSync(path.join(dir, name))) console.log(`${what}: ${rel(path.join(dir, name))}`)
    }
  } else if (sub === 'done') {
    const state = needFlow(id)
    state.status = 'done'
    writeState(state)
    console.log(`${state.id}: done`)
  } else {
    fail('usage: devflow flow new|set|show|done ...')
  }
}

// A flow that ships as a PR is finished when the PR merges, so no later session has to close it. gh answers for the
// PR; without gh, a login or the network, the flow stays as it is. Open local tickets keep the flow going.
function prState (ref) {
  try {
    return execFileSync('gh', ['pr', 'view', ref, '--json', 'state', '--jq', '.state'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch { return '' }
}

function closeMerged (flows) {
  const merged = []
  for (const f of flows) {
    if (f.status === 'done' || !f.pr) continue
    const dir = ticketDir(f)
    const t = dir && ticketFiles(dir)
    if (t && t.open.length) continue
    f.prState = prState(f.pr)
    if (f.prState !== 'MERGED') continue
    const { prState: _, ...state } = f
    writeState({ ...state, status: 'done' })
    f.status = 'done'
    merged.push(f)
  }
  return merged
}

function collect () {
  const saved = savedFlows()
  const ok = saved.filter(f => !f.broken)
  const merged = closeMerged(ok)
  return {
    active: ok.filter(f => f.status !== 'done').sort((a, b) => b.updated.localeCompare(a.updated)),
    merged,
    broken: saved.filter(f => f.broken)
  }
}

function flows () {
  const { active, merged, broken } = collect()
  for (const f of merged) console.log(`done: ${f.id} · ${f.title} (PR ${f.pr} merged)`)
  if (!active.length && !broken.length) { console.log('none'); return }
  active.forEach((f, i) => {
    const t = ticketLine(f)
    const pr = f.prState === 'OPEN' ? `waiting on PR ${f.pr} to merge` : f.prState === 'CLOSED' ? `PR ${f.pr} was closed without merging` : ''
    console.log(`${i + 1}. ${f.id} · ${cap(f.flow)} · step ${f.step} · ${f.updated.slice(0, 10)} · ${f.title}`)
    if (f.next || t || pr) console.log(`   ${[pr, f.next, t].filter(Boolean).join('; ')}`)
  })
  for (const f of broken) console.log(`unreadable: ${f.id}: ${f.broken}`)
}

function emit (event, additionalContext, systemMessage) {
  console.log(JSON.stringify(agentFor(hookFrom).context(event, additionalContext, systemMessage)))
}

const PLUGIN = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '')

// The agent a hook's message is worded for: the one the hook names, else the one devflow was installed for.
const wordedFor = ADAPTERS[hookFrom] ? hookFrom : installedAgent

// How a hook's message points at the start skill: by name on an agent devflow was installed for, else by its file
// in the plugin. That file is read directly, so the message also says what the plugin root is.
function startSkill () {
  if (ADAPTERS[wordedFor]) return `use the ${ADAPTERS[wordedFor].entrySkill.replace('{name}', 'start')} skill`
  return `read ${path.join(PLUGIN, 'skills', 'start', 'SKILL.md')} and follow it (in devflow's files, \${CLAUDE_PLUGIN_ROOT} means ${PLUGIN})`
}

// SessionStart hook: one line for the user, and the same for the agent, when this project has work to continue.
function reminder () {
  let found
  try { found = collect() } catch { return }
  const n = found.active.length
  if (!n) return
  const titles = found.active.slice(0, 3).map(f => f.title)
  const more = n - titles.length
  const how = ADAPTERS[wordedFor] ? `${ADAPTERS[wordedFor].invoke.replace('{name}', 'continue')} in ${AGENTS[wordedFor].label}` : '/devflow:continue in Claude Code'
  const line = `devflow: ${n} unfinished flow${n === 1 ? '' : 's'} here (${titles.join(', ')}${more ? `, ${more} more` : ''}). Run devflow's continue skill to pick one up (${how}).`
  emit('SessionStart', `${line} When the user asks to keep going without it, ${startSkill()} with that as the task; don't guess the flow or read flow folders yourself.`, line)
}

const NO_COMMENTS = "Don't add comments or docstrings to code you write or edit, including ones explaining the change, unless the user asks. Leave existing comments alone unless your change makes them wrong."

// SessionStart hook, also after compaction, so the mode and the rule outlive the summary.
function rules () {
  const s = loadSettings(root)
  const out = []
  if (s.mode) {
    try { out.push(fs.readFileSync(path.join(PLUGIN, 'mode.md'), 'utf8').trim()) } catch {}
  }
  if (s.no_comments) out.push(NO_COMMENTS)
  if (out.length) emit('SessionStart', out.join('\n\n'))
}

// A conversation's flow is kept in .devflow/sessions/<session id>, so the reminder needs no guessing among open flows.
// /clear starts a new session, which leaves the old link behind.
const SESSIONS_DIR = path.join(root, '.devflow', 'sessions')
const SESSION = /^[A-Za-z0-9_-]+$/

function hookInput () {
  if (process.stdin.isTTY) return {}
  try { return JSON.parse(fs.readFileSync(0, 'utf8')) || {} } catch { return {} }
}

function sessionFile (input) {
  return typeof input.session_id === 'string' && SESSION.test(input.session_id) ? path.join(SESSIONS_DIR, input.session_id) : null
}

// PostToolUse hook on Bash: a devflow flow command names the flow this conversation works on.
function track () {
  const file = sessionFile(input)
  const cmd = input.tool_input && input.tool_input.command
  if (!file || typeof cmd !== 'string') return
  const m = /devflow(?:\.mjs)?["']?\s+flow\s+(new|set|show|done)\b\s*([^\s;&|]*)/.exec(cmd)
  if (!m) return
  const res = input.tool_response
  const out = typeof res === 'string' ? res : (res && typeof res.stdout === 'string' ? res.stdout : '')
  const id = m[1] === 'new' ? (/(?:^|\s)([a-z0-9][a-z0-9-]*)\t\.devflow\/flows\//.exec(out)?.[1] ?? out.split('\t')[0].trim()) : m[2].replace(/^["']|["']$/g, '')
  const state = readState(id)
  if (!state || state.broken) return
  if (m[1] === 'done') {
    let linked = ''
    try { linked = fs.readFileSync(file, 'utf8').trim() } catch {}
    if (linked === id) fs.rmSync(file, { force: true })
    return
  }
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(file, id + '\n')
  const old = Date.now() - 30 * 864e5
  for (const n of fs.readdirSync(SESSIONS_DIR)) {
    try { if (fs.statSync(path.join(SESSIONS_DIR, n)).mtimeMs < old) fs.rmSync(path.join(SESSIONS_DIR, n)) } catch {}
  }
}

// UserPromptSubmit hook, and SessionStart after compaction: a skill's instructions arrive once, so without this a
// plain follow-up message ("go with B") gets answered as ordinary chat and the flow is dropped.
function active () {
  const file = sessionFile(input)
  if (!file) return
  let id
  try { id = fs.readFileSync(file, 'utf8').trim() } catch { return }
  const state = readState(id)
  if (!state || state.broken || state.status === 'done') return
  emit(input.hook_event_name === 'SessionStart' ? 'SessionStart' : 'UserPromptSubmit',
    `devflow: on flow ${state.id} (${cap(state.flow)}: ${state.title}), step ${state.step}. ` +
    `Treat this message as part of it unless it's unrelated, and save progress with devflow flow set ${state.id}. ` +
    `If the start skill isn't in context, ${startSkill()}, then run devflow flow show ${state.id}.`)
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'settings') settings()
else if (cmd === 'flows') flows()
else if (cmd === 'flow') flow(args)
else if (cmd === 'reminder') reminder()
else if (cmd === 'rules') rules()
else if (cmd === 'track') track()
else if (cmd === 'active') active()
else {
  console.error('usage: devflow settings | flows | flow new|set|show|done ...')
  process.exit(2)
}
