#!/usr/bin/env node
// devflow helper. Run from the project root.
//   devflow settings                   the plugin options in use
//   devflow find <skill>...            the SKILL.md devflow runs for each skill, or MISSING
//   devflow show <skill>               print that SKILL.md, with its folder for resolving relative links
//   devflow doctor [flow]              what is installed and set up, for one flow or all of them; runs git init if the folder isn't a repo
//   devflow flows                      unfinished flows to continue, newest first, then older work devflow didn't track
//   devflow flow new <flow> <title>    save a new flow; prints its id and folder
//   devflow flow set <id> key=value... update a saved flow: step, next, tickets, title, status, flow
//   devflow flow show <id>             everything a session needs to continue that flow, and nothing from the others
//   devflow flow done <id>             mark a flow finished
//   devflow flow handoff <id> <file>   move a handoff written elsewhere into the flow
//   devflow reminder                   SessionStart hook: tells the user when there are flows to continue
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { FLOWS, PACKS, SKILLS, findSkill, installedSkills, loadSettings } from './devflow-lib.mjs'

// Hooks get the project folder from Claude Code; commands run from it.
const root = (process.argv[2] === 'reminder' && process.env.CLAUDE_PROJECT_DIR) || process.cwd()

function settings () {
  const s = loadSettings()
  console.log(`git guard: ${s.git_guard ? 'on' : 'off'}`)
  console.log(`multi-model review: ${s.adversarial_review}`)
  console.log(`small changes: ${s.small_changes}`)
  console.log(`session review: ${s.after_session}`)
}

function find (names) {
  if (!names.length) { console.error('usage: devflow find <skill>...'); process.exit(2) }
  const all = installedSkills(root)
  for (const n of names) {
    const s = findSkill(n, all)
    if (s) console.log(`${n}\t${s.file}`)
    else console.log(`${n}\tMISSING${SKILLS[n] ? `, install ${PACKS[SKILLS[n]].title}: ${PACKS[SKILLS[n]].install}` : ''}`)
  }
}

function show (name) {
  if (!name) { console.error('usage: devflow show <skill>'); process.exit(2) }
  const s = findSkill(name, installedSkills(root))
  if (!s) { find([name]); process.exit(1) }
  const extra = fs.readdirSync(path.dirname(s.file)).filter(n => n !== 'SKILL.md')
  console.log(`# ${name}: ${s.file}${extra.length ? ` (its folder also has ${extra.join(', ')})` : ''}`)
  console.log(`# Read all of it and follow it as if the user typed /${name}, phases and completion checklist included. Relative links resolve against its folder. Run any skill it calls with devflow show too, not the Skill tool.`)
  console.log(fs.readFileSync(s.file, 'utf8'))
}

function pstackModels () {
  const file = path.join(os.homedir(), '.agents', 'pstack-models.md')
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { return { ok: false, line: 'pstack models: not set. Run /setup-pstack (its defaults use Grok, which Claude Code can\'t run).' } }
  const roles = text.split('\n').filter(l => /^[a-z][^:#]*:/.test(l.trim()))
  const grok = roles.filter(l => /grok/i.test(l)).map(l => l.split(':')[0].trim())
  if (grok.length) return { ok: false, line: `pstack models: ${file} uses Grok for ${grok.join(', ')}. Rerun /setup-pstack with Claude models or inherit-parent.` }
  return { ok: true, line: `pstack models: ${file}` }
}

function verifySkills () {
  const out = []
  for (const d of ['.claude/skills', '.agents/skills']) {
    try {
      for (const n of fs.readdirSync(path.join(root, d))) if (n.startsWith('verify-')) out.push(`${d}/${n}`)
    } catch {}
  }
  return out
}

// The flows commit and diff against a branch point, so a folder that isn't a repo yet gets one.
function ensureGit () {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    git(['rev-parse', '--is-inside-work-tree'])
  } catch (e) {
    if (e.code === 'ENOENT') return { ok: false, line: 'git: not installed. Install git.' }
    try { git(['init']) } catch { return { ok: false, line: `git: ${root} isn't a repository and git init failed there.` } }
    return { ok: true, line: `git: ran git init in ${root}; the first commit will be the branch point.` }
  }
  try { git(['rev-parse', '--verify', 'HEAD']) } catch { return { ok: true, line: 'git: no commits yet; the first commit will be the branch point.' } }
  return { ok: true, line: 'git: ok' }
}

function doctor (only) {
  if (only && !FLOWS[only]) { console.error(`unknown flow ${only}; use one of ${Object.keys(FLOWS).join(', ')}`); process.exit(2) }
  const s = loadSettings()
  const all = installedSkills(root)
  let ready = true
  const flows = only ? [only] : Object.keys(FLOWS)
  const missingByPack = {}
  const needed = {}
  for (const f of flows) {
    let names = FLOWS[f]
    if (f === 'small' && s.small_changes === 'direct') names = []
    if (f === 'wrap') names = names.filter(n => s.after_session === 'reflect' ? !['retro', 'writing-for-agents'].includes(n) : n !== 'reflect')
    needed[f] = names
    const missing = names.filter(n => !findSkill(n, all))
    console.log(`${f}: ${missing.length ? 'missing ' + missing.join(', ') : 'ok'}`)
    for (const n of missing) (missingByPack[SKILLS[n]] ||= []).push(n)
    if (missing.length) ready = false
  }
  for (const [pack, names] of Object.entries(missingByPack)) {
    console.log(`install ${PACKS[pack].title} (${[...new Set(names)].length} missing): ${PACKS[pack].install}`)
  }

  // tdd and teach ship in both packs. A loose pstack copy can shadow Matt's plugin copy.
  for (const n of ['tdd', 'teach']) {
    const loose = all.filter(x => x.name === n && x.pack === 'pstack' && !x.where.startsWith('plugin'))
    for (const x of loose) {
      console.log(`collision: pstack's ${n} at ${x.file} can shadow Matt's. Delete its folder.`)
      ready = false
    }
  }

  const needsPstack = flows.some(f => needed[f].some(n => SKILLS[n] === 'pstack'))
  if (needsPstack) {
    const m = pstackModels()
    console.log(m.line)
    if (!m.ok) ready = false
  }

  if (!only || only === 'setup' || only === 'feature' || only === 'big') {
    const tracker = fs.existsSync(path.join(root, 'docs', 'agents', 'issue-tracker.md'))
    console.log(`issue tracker: ${tracker ? 'docs/agents/issue-tracker.md' : 'not set up. Run /setup-matt-pocock-skills'}`)
    if (!tracker) ready = false
  }
  if (!only || only === 'setup' || only === 'feature' || only === 'bug') {
    const v = verifySkills()
    console.log(`verification skill: ${v.length ? v.join(', ') : 'none. Run /create-verification-skill'}`)
    if (!v.length && (!only || only === 'setup')) ready = false
  }
  const g = ensureGit()
  console.log(g.line)
  if (!g.ok) ready = false
  console.log(ready ? 'READY' : 'NOT READY')
}

// Each flow is saved in the project under .devflow/flows/<id>/: state.json (where it stands) and, once a session
// ends with work left, handoff.md. A session continuing one flow reads only that folder.
const FLOWS_DIR = path.join(root, '.devflow', 'flows')
const FIRST_STEP = { feature: '1. Understand', bug: '1. History', big: '1. Plan', small: '1. Small' }
const FIELDS = ['step', 'next', 'tickets', 'title', 'status', 'flow']
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
  if (!id) fail('usage: devflow flow set|show|done|handoff <id> ...')
  const state = readState(id)
  if (!state) fail(`no saved flow ${id}. Run devflow flows to see them.`)
  if (state.broken) fail(`flow ${id}: ${state.broken}. Fix or delete that file.`)
  return state
}

// A Status line saying the ticket is finished, in the shapes to-tickets and wayfinder write it.
const CLOSED = /^[ \t]*(?:[-*>#]+[ \t]*)?\**status:?\**:?[ \t]*`?(resolved|done|closed|complete|completed|wontfix|wont-fix|won't fix)`?[ \t]*\.?[ \t]*$/im
const BLOCKED = /^[ \t]*(?:[-*>#]+[ \t]*)?\**status:?\**:?[ \t]*`?blocked/im

// Local ticket files (to-tickets or wayfinder) in number order, with the open ones.
function ticketFiles (dir) {
  let names
  try { names = fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name) } catch { return null }
  const all = names.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(n => path.join(dir, n))
  const text = f => { try { return fs.readFileSync(f, 'utf8') } catch { return '' } }
  const open = all.filter(f => !CLOSED.test(text(f)))
  return { all, open, ready: open.filter(f => !BLOCKED.test(text(f))) }
}

function nextTicket (state) {
  if (!state.tickets) return null
  const dir = path.resolve(root, state.tickets)
  const t = ticketFiles(dir)
  if (!t) return fs.existsSync(dir) ? null : `next ticket: the first open one in ${state.tickets} on the issue tracker; check its blockers`
  if (!t.open.length) return `tickets: all ${t.all.length} in ${state.tickets} are done`
  if (!t.ready.length) return `tickets: the ${t.open.length} open in ${state.tickets} are all blocked`
  return `next ticket: ${rel(t.ready[0])} (${t.open.length} of ${t.all.length} open; check its blockers)`
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
    writeState({ id: newId, title, flow: kind, step: FIRST_STEP[kind], next: '', tickets: '', status: 'active', created: new Date().toISOString() })
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
      // A ticket file stands for its folder.
      if (k === 'tickets' && v.endsWith('.md') && fs.existsSync(path.resolve(root, v))) v = rel(path.dirname(path.resolve(root, v)))
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
    const t = nextTicket(state)
    if (t) console.log(t)
    console.log(`folder: ${rel(dir)}`)
    const handoff = path.join(dir, 'handoff.md')
    if (fs.existsSync(handoff)) console.log(`\n# Handoff from the last session (${rel(handoff)})\n${fs.readFileSync(handoff, 'utf8')}`)
  } else if (sub === 'done') {
    const state = needFlow(id)
    state.status = 'done'
    writeState(state)
    console.log(`${state.id}: done`)
  } else if (sub === 'handoff') {
    // Moves a handoff written elsewhere (an older one in the temp folder) into the flow, replacing its last one.
    const state = needFlow(id)
    if (!rest[0]) fail('usage: devflow flow handoff <id> <file>')
    const dest = path.join(FLOWS_DIR, state.id, 'handoff.md')
    fs.copyFileSync(path.resolve(root, rest[0]), dest)
    fs.rmSync(path.resolve(root, rest[0]))
    writeState(state)
    console.log(`${state.id}: handoff saved to ${rel(dest)}`)
  } else {
    fail('usage: devflow flow new|set|show|done|handoff ...')
  }
}

// Whether a temp-folder handoff names this project: its path as written on this OS, with forward slashes, or
// JSON-escaped, followed by a path separator, quote, space or the end, so a sibling like <root>-other doesn't count.
function namesProject (text) {
  if (path.dirname(root) === root) return false
  const forms = [root, root.split(path.sep).join('/'), root.split(path.sep).join('\\\\')]
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?:${[...new Set(forms)].map(esc).join('|')})(?=[\\\\/"'\`\\s)\\]]|$)`, process.platform === 'win32' ? 'i' : '')
  return re.test(text)
}

// Work from before devflow saved flows: handoffs in the OS temp folder that name this project, and local ticket
// folders no saved flow points at.
function untracked (flows) {
  const out = []
  let names = []
  try { names = fs.readdirSync(os.tmpdir()) } catch {}
  for (const n of names) {
    if (!n.endsWith('.md')) continue
    const file = path.join(os.tmpdir(), n)
    try {
      const { mtimeMs, size } = fs.statSync(file)
      if (Date.now() - mtimeMs > 30 * 864e5 || size > 512 * 1024) continue
      const text = fs.readFileSync(file, 'utf8')
      if (!/handoff|devflow/i.test(n + text.slice(0, 2000)) || !namesProject(text)) continue
      const h = /^#\s+(.+)$/m.exec(text)
      out.push({ time: mtimeMs, head: `handoff in the temp folder · ${day(mtimeMs)} · ${h ? h[1].trim() : n}`, next: `/devflow:start resume ${file}` })
    } catch {}
  }
  const linked = new Set(flows.filter(f => f.tickets).map(f => path.resolve(root, f.tickets)))
  let efforts = []
  try { efforts = fs.readdirSync(path.join(root, '.scratch'), { withFileTypes: true }).filter(e => e.isDirectory()) } catch {}
  for (const e of efforts) {
    const dir = path.join(root, '.scratch', e.name, 'issues')
    const t = !linked.has(dir) && ticketFiles(dir)
    if (!t || !t.open.length) continue
    const time = Math.max(...t.all.map(f => fs.statSync(f).mtimeMs))
    out.push({ time, head: `tickets · ${day(time)} · ${e.name}: ${t.open.length} of ${t.all.length} open`, next: `/devflow:start ticket ${rel((t.ready[0] || t.open[0]))}` })
  }
  return out.sort((a, b) => b.time - a.time)
}

function collect () {
  const saved = savedFlows()
  const ok = saved.filter(f => !f.broken)
  return {
    active: ok.filter(f => f.status !== 'done').sort((a, b) => b.updated.localeCompare(a.updated)),
    broken: saved.filter(f => f.broken),
    old: untracked(ok)
  }
}

function flows () {
  const { active, broken, old } = collect()
  if (!active.length && !old.length && !broken.length) { console.log('none'); return }
  active.forEach((f, i) => {
    const t = nextTicket(f)
    console.log(`${i + 1}. ${f.id} · ${cap(f.flow)} · step ${f.step} · ${f.updated.slice(0, 10)} · ${f.title}`)
    if (f.next || t) console.log(`   ${[f.next, t].filter(Boolean).join('; ')}`)
  })
  for (const f of broken) console.log(`unreadable: ${f.id}: ${f.broken}`)
  if (old.length) {
    console.log('\nNot saved as flows:')
    old.forEach((f, i) => console.log(`${active.length + i + 1}. ${f.head}\n   ${f.next}`))
  }
}

// SessionStart hook: one line for the user, and the same for Claude, when this project has work to continue.
function reminder () {
  let found
  try { found = collect() } catch { return }
  const n = found.active.length + found.old.length
  if (!n) return
  const titles = found.active.slice(0, 3).map(f => f.title)
  const more = n - titles.length
  const list = titles.length ? ` (${titles.join(', ')}${more ? `, ${more} more` : ''})` : ''
  const line = `devflow: ${n} unfinished flow${n === 1 ? '' : 's'} here${list}. Run /devflow:continue to pick one up.`
  console.log(JSON.stringify({
    systemMessage: line,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: `${line} To pick up earlier work, point the user to /devflow:continue; don't guess the flow or read flow folders yourself.`
    }
  }))
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'settings') settings()
else if (cmd === 'find') find(args)
else if (cmd === 'show') show(args[0])
else if (cmd === 'doctor') doctor(args[0])
else if (cmd === 'flows') flows()
else if (cmd === 'flow') flow(args)
else if (cmd === 'reminder') reminder()
else {
  console.error('usage: devflow settings | find <skill>... | show <skill> | doctor [flow] | flows | flow new|set|show|done|handoff ...')
  process.exit(2)
}
