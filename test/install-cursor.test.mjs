// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { readJson, sandbox, tree, version, write } from './helpers.mjs'

const runtime = home => path.join(home, '.config', 'devflow', 'runtime', 'cursor', 'scripts')

test('install --agent cursor puts every file where Cursor reads it and records them', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  const r = s.run('install', '--agent', 'cursor')
  assert.equal(r.status, 0, r.stderr)

  const skills = path.join(s.home, '.cursor', 'skills')
  for (const n of ['start', 'continue', 'setup', 'wrap']) {
    const text = fs.readFileSync(path.join(skills, `devflow-${n}`, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^name: devflow-${n}$`, 'm'))
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/)
    assert.doesNotMatch(text, /\/devflow:/)
  }
  const start = fs.readFileSync(path.join(skills, 'devflow-start', 'SKILL.md'), 'utf8')
  assert.ok(start.includes(`node "${path.join(runtime(s.home), 'devflow.mjs')}"`))
  assert.ok(start.includes(path.join(skills, 'devflow-continue', 'SKILL.md')))
  assert.ok(start.includes('`/devflow-continue`'))
  for (const f of ['feature', 'bug', 'big']) assert.ok(fs.existsSync(path.join(skills, 'devflow-start', 'flows', `${f}.md`)))

  const hooks = readJson(path.join(s.home, '.cursor', 'hooks.json'))
  assert.equal(hooks.version, 1)
  assert.deepEqual(Object.keys(hooks.hooks).sort(), ['postToolUse', 'preToolUse', 'sessionStart'])
  assert.deepEqual(hooks.hooks.preToolUse, [{ command: `node "${path.join(runtime(s.home), 'devflow-guard.mjs')}" --agent cursor`, matcher: 'Shell', failClosed: true }])
  assert.deepEqual(hooks.hooks.postToolUse, [{ command: `node "${path.join(runtime(s.home), 'devflow.mjs')}" track --agent cursor`, matcher: 'Shell' }])
  assert.deepEqual(hooks.hooks.sessionStart, [
    { command: `node "${path.join(runtime(s.home), 'devflow.mjs')}" reminder --agent cursor` },
    { command: `node "${path.join(runtime(s.home), 'devflow.mjs')}" rules --agent cursor` }
  ])
  assert.doesNotMatch(JSON.stringify(hooks), /\$\{/)

  const rule = fs.readFileSync(path.join(s.home, '.cursor', 'rules', 'devflow.mdc'), 'utf8')
  assert.match(rule, /^---\n(?:.*\n)*?alwaysApply: true\n(?:.*\n)*?---\n/)
  assert.match(rule, /git push/)
  assert.match(rule, /git reset --hard/)
  assert.match(rule, /git branch -D/)
  assert.match(rule, /`devflow active`/)
  assert.ok(rule.includes(`node "${path.join(runtime(s.home), 'devflow.mjs')}"`))
  assert.ok(!fs.existsSync(path.join(s.home, '.cursor', 'AGENTS.md')))
  assert.ok(!fs.existsSync(path.join(s.home, '.codex')))

  const [entry] = readJson(s.userRecord)
  assert.equal(entry.agent, 'cursor')
  assert.equal(entry.scope, 'user')
  assert.equal(entry.version, version)
  const recorded = new Set([...entry.files, ...entry.blocks.map(b => b.file)])
  const onDisk = new Set(Object.entries(tree(s.home)).filter(([, v]) => v !== null).map(([p]) => path.join(s.home, p)).filter(p => p !== s.userRecord))
  assert.deepEqual([...recorded].sort(), [...onDisk].sort())
  assert.ok(entry.files.includes(path.join(s.home, '.cursor', 'rules', 'devflow.mdc')))
  assert.deepEqual(entry.blocks.map(b => b.file), [path.join(s.home, '.cursor', 'hooks.json')])
})

test('install --agent cursor asks npx skills for both sources with -a cursor', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  const calls = s.calls()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(c => c.slice(0, 5)), [
    ['skills@1.7.4', 'add', 'mattpocock/skills', '-a', 'cursor'],
    ['skills@1.7.4', 'add', 'backnotprop/pstack', '-a', 'cursor']
  ])
  assert.deepEqual(calls[0].slice(-2), ['-y', '-g'])
})

test("uninstall puts the home folder back as it was, keeping the user's own hooks, rules and skills", () => {
  const s = sandbox({ name: 'devflow-cursor' })
  const mine = { version: 1, hooks: { preToolUse: [{ command: 'node mine.js', matcher: 'Shell' }] } }
  write(path.join(s.home, '.cursor', 'hooks.json'), JSON.stringify(mine, null, 2) + '\n')
  write(path.join(s.home, '.cursor', 'rules', 'mine.mdc'), '---\nalwaysApply: true\n---\nBe brief.\n')
  write(path.join(s.home, '.cursor', 'skills', 'mine', 'SKILL.md'), '---\nname: mine\n---\n')
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  const merged = readJson(path.join(s.home, '.cursor', 'hooks.json'))
  assert.equal(merged.hooks.preToolUse.length, 2)
  assert.equal(merged.hooks.preToolUse[0].command, 'node mine.js')

  const r = s.run('uninstall', '--agent', 'cursor')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), before)
  const [addMatt, addPstack, ...removes] = s.calls()
  const names = args => args.slice(args.indexOf('-s') + 1, args.indexOf('-y'))
  assert.deepEqual(removes, [['skills@1.7.4', 'remove', ...names(addMatt), '-g', '-y'], ['skills@1.7.4', 'remove', ...names(addPstack), '-g', '-y']])
})

test('uninstall from a fresh home leaves the home empty', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'cursor').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

test('installing again replaces the earlier install instead of doubling it', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  const first = tree(s.home)
  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  assert.deepEqual(tree(s.home), first)
  assert.equal(readJson(path.join(s.home, '.cursor', 'hooks.json')).hooks.preToolUse.length, 1)
})

test('Codex and Cursor installed together keep their own files, and removing one leaves the other whole', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const codexOnly = tree(s.home)
  assert.equal(s.run('install', '--agent', 'cursor').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'cursor').status, 0)
  const after = tree(s.home)
  delete after[path.join('.config', 'devflow', 'installs.json')]
  delete codexOnly[path.join('.config', 'devflow', 'installs.json')]
  assert.deepEqual(after, codexOnly)
})

test('a --project install of cursor writes .cursor/hooks.json, rules and skills inside the repo with repo-relative paths, and uninstall restores the repo', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  const p = (...x) => path.join(s.project, ...x)
  const homeBefore = tree(s.home)
  const mine = { version: 1, hooks: { preToolUse: [{ command: 'node mine.js', matcher: 'Shell' }] } }
  write(p('.cursor', 'hooks.json'), JSON.stringify(mine, null, 2) + '\n')
  write(p('.cursor', 'skills', 'mine', 'SKILL.md'), '---\nname: mine\n---\n')
  const before = tree(s.project)

  const r = s.runProject('install', '--agent', 'cursor', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeBefore)
  for (const n of ['start', 'continue', 'setup', 'wrap']) assert.match(fs.readFileSync(p('.cursor', 'skills', `devflow-${n}`, 'SKILL.md'), 'utf8'), new RegExp(`^name: devflow-${n}$`, 'm'))
  const start = fs.readFileSync(p('.cursor', 'skills', 'devflow-start', 'SKILL.md'), 'utf8')
  assert.ok(start.includes('node ".devflow/runtime/cursor/scripts/devflow.mjs"'))
  assert.ok(start.includes('.cursor/skills/devflow-continue/SKILL.md'))
  const hooks = readJson(p('.cursor', 'hooks.json'))
  assert.equal(hooks.hooks.preToolUse.length, 2)
  assert.equal(hooks.hooks.preToolUse[0].command, 'node mine.js')
  assert.match(hooks.hooks.preToolUse[1].command, /^node -e "[^"$`%\\]*" devflow-guard\.mjs --agent cursor$/)
  assert.ok(hooks.hooks.preToolUse[1].command.includes(".devflow','runtime','cursor','scripts'"))
  assert.equal(hooks.hooks.preToolUse[1].matcher, 'Shell')
  assert.equal(hooks.hooks.preToolUse[1].failClosed, true)
  assert.match(fs.readFileSync(p('.cursor', 'rules', 'devflow.mdc'), 'utf8'), /alwaysApply: true/)
  assert.deepEqual(readJson(p('.devflow', 'runtime', 'cursor', 'agent.json')), { agent: 'cursor', scope: 'project' })
  for (const [file, text] of Object.entries(tree(s.project))) {
    if (text !== null && file.startsWith('.cursor')) assert.ok(!text.includes(s.project) && !text.includes(s.home), `${file} holds an absolute path`)
  }
  const [entry] = readJson(path.join(s.project, '.devflow', 'installs.json'))
  assert.equal(entry.scope, 'project')
  assert.ok(entry.files.includes('.cursor/rules/devflow.mdc'))
  assert.deepEqual(entry.blocks.map(b => b.file), ['.cursor/hooks.json'])
  assert.ok(s.calls().every(c => !c.includes('-g')))

  assert.equal(s.runProject('uninstall', '--agent', 'cursor', '--project').status, 0)
  assert.deepEqual(tree(s.project), before)
  assert.deepEqual(tree(s.home), homeBefore)
})

test('the usage error lists cursor among the agents', () => {
  const s = sandbox({ name: 'devflow-cursor' })
  const r = s.run('install', '--agent', 'vim')
  assert.equal(r.status, 2)
  assert.match(r.stderr, /unknown agent vim; use one of codex, cursor/)
})
