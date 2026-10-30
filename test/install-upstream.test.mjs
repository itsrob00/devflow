// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { packSkills } from '../plugin/scripts/devflow-lib.mjs'
import { sandbox, tree, write } from './helpers.mjs'

const addedNames = args => args.slice(args.indexOf('-s') + 1, args.indexOf('-y'))
const removedNames = args => args.slice(2, args.indexOf('-g') >= 0 ? -2 : -1)

const lockOf = (names, source) => Object.fromEntries(names.map(n => [n, { source, sourceType: 'github', skillPath: `skills/${n}/SKILL.md` }]))

test('uninstall asks npx skills to remove only the skills devflow added, leaving copies the user already had', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  const mine = ['tdd', 'grilling', 'principle-prove-it-works']
  write(path.join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: { ...lockOf(['tdd', 'grilling'], 'mattpocock/skills'), ...lockOf(['principle-prove-it-works'], 'backnotprop/pstack') } }))
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const [addMatt, addPstack] = s.calls()
  assert.ok(addedNames(addMatt).includes('tdd'))

  const r = s.run('uninstall', '--agent', 'codex')
  assert.equal(r.status, 0, r.stderr)
  const [, , removeMatt, removePstack] = s.calls()
  assert.deepEqual(removeMatt.slice(0, 2), ['skills@1.7.4', 'remove'])
  assert.deepEqual(removeMatt.slice(-2), ['-g', '-y'])
  assert.deepEqual(removedNames(removeMatt), addedNames(addMatt).filter(n => !mine.includes(n)))
  assert.deepEqual(removedNames(removePstack), addedNames(addPstack).filter(n => !mine.includes(n)))
  for (const call of [removeMatt, removePstack]) {
    assert.ok(!call.includes('mattpocock/skills') && !call.includes('backnotprop/pstack'))
    for (const n of mine) assert.ok(!call.includes(n), n)
  }
  assert.equal(removedNames(removeMatt).length, 18)
  assert.equal(removedNames(removePstack).length, 42)
  assert.deepEqual(tree(s.home), before)
})

test('uninstall skips a pack entirely when the user already had every one of its skills', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  write(path.join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: lockOf(packSkills('matt'), 'mattpocock/skills') }))
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  const calls = s.calls()
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[2].slice(0, 2), ['skills@1.7.4', 'remove'])
  assert.deepEqual(removedNames(calls[2]), addedNames(calls[1]))
})

test('a project install reads skills-lock.json and a pre-existing skills folder, and removes only what it added', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  write(path.join(s.project, 'skills-lock.json'), JSON.stringify({ version: 1, skills: lockOf(['wizard'], 'mattpocock/skills') }))
  write(path.join(s.project, '.agents', 'skills', 'swarm', 'SKILL.md'), '---\nname: swarm\n---\n')
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  const [addMatt, addPstack] = s.calls()
  assert.equal(s.runProject('uninstall', '--agent', 'codex', '--project').status, 0)
  const [, , removeMatt, removePstack] = s.calls()
  assert.deepEqual(removeMatt.slice(0, 2), ['skills@1.7.4', 'remove'])
  assert.equal(removeMatt.at(-1), '-y')
  assert.ok(!removeMatt.includes('-g'))
  assert.deepEqual(removedNames(removeMatt), addedNames(addMatt).filter(n => n !== 'wizard'))
  assert.deepEqual(removedNames(removePstack), addedNames(addPstack).filter(n => n !== 'swarm'))
  assert.ok(fs.existsSync(path.join(s.project, '.agents', 'skills', 'swarm', 'SKILL.md')))
})

test('two agents in one user scope: the skills the user already had stay out of the removal when the last agent goes', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  write(path.join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: lockOf(['tdd'], 'mattpocock/skills') }))
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const installs = s.calls().length
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.equal(s.calls().length, installs)
  assert.equal(s.run('uninstall', '--agent', 'opencode').status, 0)
  const removeMatt = s.calls()[installs]
  assert.ok(!removeMatt.includes('tdd'))
  assert.ok(removeMatt.includes('grilling'))
})
