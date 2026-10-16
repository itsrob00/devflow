#!/usr/bin/env node
// devflow helper. Run from the project root.
//   devflow settings          the plugin options in use
//   devflow find <skill>...   the SKILL.md devflow runs for each skill, or MISSING
//   devflow show <skill>      print that SKILL.md, with its folder for resolving relative links
//   devflow doctor [flow]     what is installed and set up, for one flow or all of them; runs git init if the folder isn't a repo
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { FLOWS, PACKS, SKILLS, findSkill, installedSkills, loadSettings } from './devflow-lib.mjs'

const root = process.cwd()

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
  const dir = path.dirname(s.file)
  const extra = fs.readdirSync(dir).filter(n => n !== 'SKILL.md')
  console.log(`# ${name}: ${s.file}`)
  console.log(`# Read all of it and follow it as if the user had typed /${name}, including its phases and its completion checklist.`)
  console.log(`# Relative links resolve against ${dir}${extra.length ? ` (also there: ${extra.join(', ')})` : ''}`)
  console.log('# When it calls another skill, run that one with devflow show too, not the Skill tool.')
  console.log(fs.readFileSync(s.file, 'utf8'))
}

function pstackModels () {
  const file = path.join(os.homedir(), '.agents', 'pstack-models.md')
  let text
  try { text = fs.readFileSync(file, 'utf8') } catch { return { ok: false, line: 'pstack models: not set. Run /setup-pstack; its defaults include Grok, which Claude Code cannot run.' } }
  const roles = text.split('\n').filter(l => /^[a-z][^:#]*:/.test(l.trim()))
  const grok = roles.filter(l => /grok/i.test(l)).map(l => l.split(':')[0].trim())
  if (grok.length) return { ok: false, line: `pstack models: ${file} uses Grok for ${grok.join(', ')}. Rerun /setup-pstack and pick Claude models or inherit-parent.` }
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
    if (e.code === 'ENOENT') return { ok: false, line: 'git: not installed. Install git; the flows commit and diff against a branch point.' }
    try { git(['init']) } catch { return { ok: false, line: `git: ${root} isn't a repository and git init failed there.` } }
    return { ok: true, line: `git: ran git init in ${root}. There are no commits yet, so the first commit is the branch point.` }
  }
  try { git(['rev-parse', '--verify', 'HEAD']) } catch { return { ok: true, line: 'git: no commits yet, so the first commit is the branch point.' } }
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
      console.log(`collision: pstack's ${n} at ${x.file} can answer /${n} instead of Matt's. Delete its folder; devflow uses Matt's.`)
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
    console.log(`verification skill: ${v.length ? v.join(', ') : 'none. Run /create-verification-skill so flows can prove changes in the running app'}`)
    if (!v.length && (!only || only === 'setup')) ready = false
  }
  const g = ensureGit()
  console.log(g.line)
  if (!g.ok) ready = false
  console.log(`git guard: ${s.git_guard ? 'on' : 'off'}`)
  console.log(ready ? 'READY' : 'NOT READY')
}

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'settings') settings()
else if (cmd === 'find') find(args)
else if (cmd === 'show') show(args[0])
else if (cmd === 'doctor') doctor(args[0])
else {
  console.error('usage: devflow settings | find <skill>... | show <skill> | doctor [flow]')
  process.exit(2)
}
