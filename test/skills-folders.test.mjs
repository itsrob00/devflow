// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { devflow as script, listed, write } from './helpers.mjs'

function sandbox () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-skills-'))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(home)
  fs.mkdirSync(path.join(project, '.git'), { recursive: true })
  const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: path.join(home, '.claude') }
  delete env.CLAUDE_PROJECT_DIR
  const run = (cwd, ...args) => execFileSync(process.execPath, [script, ...args], { cwd, env, encoding: 'utf8' })
  return { home, project, run }
}

const skill = (dir, name, body = 'body') => write(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${body}\n---\n${body}\n`)
const lock = (names, source) => Object.fromEntries(names.map(n => [n, { source, sourceType: 'github', skillPath: `skills/${n}/SKILL.md` }]))

test('doctor reports both packs as installed from the skills lock file alone', () => {
  const s = sandbox()
  const matt = listed('devflow-matt')
  const pstack = listed('devflow-pstack')
  for (const n of [...matt, ...pstack]) skill(path.join(s.home, '.agents', 'skills'), n, `plain ${n}`)
  write(path.join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { ...lock(matt, 'mattpocock/skills'), ...lock(pstack, 'backnotprop/pstack') } }))
  const out = s.run(s.project, 'doctor')
  assert.match(out, /^Matt Pocock's skills \(devflow-matt\): 20 of 20 installed$/m)
  assert.match(out, /^pstack \(devflow-pstack\): 43 of 43 installed$/m)
})

test('without a lock file the skills devflow never runs itself are not credited to a pack', () => {
  const s = sandbox()
  for (const n of listed('devflow-pstack')) skill(path.join(s.home, '.agents', 'skills'), n, `plain ${n}`)
  assert.match(s.run(s.project, 'doctor'), /^pstack \(devflow-pstack\): 15 of 43 installed$/m)
})

test('the project lock file names the pack of the skills beside it, and tells Matt\'s tdd from pstack\'s', () => {
  const s = sandbox()
  skill(path.join(s.project, '.agents', 'skills'), 'tdd', 'plain tdd')
  write(path.join(s.project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: lock(['tdd'], 'backnotprop/pstack') }))
  assert.match(s.run(s.project, 'doctor'), /^collision: pstack's tdd at .*tdd[\\/]SKILL\.md can shadow Matt's/m)
  write(path.join(s.project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: lock(['tdd'], 'mattpocock/skills') }))
  assert.doesNotMatch(s.run(s.project, 'doctor'), /collision/)
})

test('a lock file only speaks for the skills folder beside it', () => {
  const s = sandbox()
  skill(path.join(s.project, '.cursor', 'skills'), 'tdd', 'plain tdd')
  write(path.join(s.project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: lock(['tdd'], 'backnotprop/pstack') }))
  assert.doesNotMatch(s.run(s.project, 'doctor'), /collision/)
})

test('show looks in each agent\'s own skills folders, from a subfolder up to the repository root', () => {
  const s = sandbox()
  const sub = path.join(s.project, 'packages', 'app')
  fs.mkdirSync(sub, { recursive: true })
  skill(path.join(s.project, '.agents', 'skills'), 'how')
  skill(path.join(s.project, 'packages', '.agents', 'skills'), 'why')
  skill(path.join(s.home, '.codex', 'skills'), 'arena')
  assert.match(s.run(sub, 'show', 'how'), /^# how: .*project[\\/]\.agents[\\/]skills[\\/]how[\\/]SKILL\.md/)
  assert.match(s.run(sub, 'show', 'why'), /^# why: .*packages[\\/]\.agents[\\/]skills[\\/]why[\\/]SKILL\.md/)
  assert.match(s.run(sub, 'show', 'arena'), /^# arena: .*home[\\/]\.codex[\\/]skills[\\/]arena[\\/]SKILL\.md/)
  assert.throws(() => s.run(sub, 'show', 'unslop'), err => /MISSING/.test(err.stdout))
})
