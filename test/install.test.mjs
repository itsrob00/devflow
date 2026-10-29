// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { installer, listed, readJson, repo, sandbox, tree, version, write } from './helpers.mjs'

const source = path.join(repo, 'plugin')

test('the root package carries the installer as its bin and the plugin version', () => {
  const pkg = readJson(path.join(repo, 'package.json'))
  assert.equal(pkg.version, readJson(path.join(repo, 'plugin', '.claude-plugin', 'plugin.json')).version)
  assert.ok(fs.existsSync(path.join(repo, pkg.bin.devflow)))
  assert.equal(path.resolve(repo, pkg.bin.devflow), installer)
})

test('install --agent codex puts every file where Codex reads it and records them', () => {
  const s = sandbox({ name: 'devflow-install' })
  const r = s.run('install', '--agent', 'codex')
  assert.equal(r.status, 0, r.stderr)

  const skills = path.join(s.home, '.codex', 'skills')
  const runtime = path.join(s.home, '.config', 'devflow', 'runtime', 'codex')
  const scripts = path.join(runtime, 'scripts')
  assert.deepEqual(readJson(path.join(runtime, 'agent.json')), { agent: 'codex', scope: 'user' })
  for (const dir of ['scripts', 'hooks']) {
    for (const f of fs.readdirSync(path.join(source, dir))) assert.equal(fs.readFileSync(path.join(runtime, dir, f), 'utf8'), fs.readFileSync(path.join(source, dir, f), 'utf8'))
  }
  for (const n of ['start', 'continue', 'setup', 'wrap']) {
    const text = fs.readFileSync(path.join(skills, `devflow-${n}`, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^name: devflow-${n}$`, 'm'))
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/)
    assert.doesNotMatch(text, /\/devflow:/)
  }
  const start = fs.readFileSync(path.join(skills, 'devflow-start', 'SKILL.md'), 'utf8')
  assert.ok(start.includes(`node "${path.join(scripts, 'devflow.mjs')}"`))
  assert.ok(start.includes(path.join(skills, 'devflow-continue', 'SKILL.md')))
  assert.ok(start.includes(path.join(skills, 'devflow-start', 'flows')))
  assert.ok(start.includes('`$devflow-continue`'))
  for (const f of ['feature', 'bug', 'big']) assert.ok(fs.existsSync(path.join(skills, 'devflow-start', 'flows', `${f}.md`)))

  const hooks = readJson(path.join(s.home, '.codex', 'hooks.json')).hooks
  const command = (event, i = 0) => hooks[event][i].hooks[0].command
  assert.equal(hooks.PreToolUse[0].matcher, 'Bash')
  assert.equal(command('PreToolUse'), `node "${path.join(scripts, 'devflow-guard.mjs')}" --agent codex`)
  assert.equal(hooks.PostToolUse[0].matcher, 'Bash')
  assert.equal(command('PostToolUse'), `node "${path.join(scripts, 'devflow.mjs')}" track --agent codex`)
  assert.equal(command('UserPromptSubmit'), `node "${path.join(scripts, 'devflow.mjs')}" active --agent codex`)
  assert.deepEqual(hooks.SessionStart.map(g => [g.matcher, g.hooks[0].command.split(' ').slice(-3).join(' ')]), [['startup|clear', 'reminder --agent codex'], ['startup|clear|compact', 'rules --agent codex'], ['compact', 'active --agent codex']])
  assert.doesNotMatch(JSON.stringify(hooks), /\$\{/)

  const rules = fs.readFileSync(path.join(s.home, '.codex', 'rules', 'devflow.rules'), 'utf8')
  assert.match(rules, /prefix_rule\(\s*pattern=\["git", "push"\],\s*decision="forbidden"/)
  assert.match(rules, /\["git", "reset", "--hard"\]/)
  assert.match(rules, /\["git", "branch", "-D"\]/)
  assert.match(rules, /\["git", "clean", \[[^\]]*"-fd"/)
  assert.match(rules, /\["git", "checkout", "\."\]/)

  const agents = fs.readFileSync(path.join(s.home, '.codex', 'AGENTS.md'), 'utf8')
  assert.match(agents, /^<!-- devflow:begin codex -->\n[\s\S]*\n<!-- devflow:end codex -->\n$/)
  assert.match(agents, /git push/)
  assert.match(agents, /`devflow active`/)
  assert.ok(agents.includes(`node "${path.join(scripts, 'devflow.mjs')}"`))

  const record = readJson(s.userRecord)
  assert.equal(record.length, 1)
  const [entry] = record
  assert.equal(entry.agent, 'codex')
  assert.equal(entry.scope, 'user')
  assert.equal(entry.version, version)
  const recorded = new Set([...entry.files, ...entry.blocks.map(b => b.file)])
  const onDisk = new Set(Object.entries(tree(s.home)).filter(([, v]) => v !== null).map(([p]) => path.join(s.home, p)).filter(p => p !== s.userRecord))
  assert.deepEqual([...recorded].sort(), [...onDisk].sort())
  assert.ok(entry.files.includes(path.join(s.home, '.codex', 'rules', 'devflow.rules')))
  assert.ok(entry.files.includes(path.join(skills, 'devflow-start', 'flows', 'big.md')))
  assert.deepEqual(entry.blocks.map(b => b.file).sort(), [path.join(s.home, '.codex', 'AGENTS.md'), path.join(s.home, '.codex', 'hooks.json')].sort())
})

test('install runs the pinned npx skills for both sources with the lists devflow runs, without pstack\'s tdd and teach', () => {
  const s = sandbox({ name: 'devflow-install' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const [matt, pstack] = s.calls()
  const split = (args, source) => {
    const head = args.slice(0, args.indexOf('-s'))
    const tail = args.slice(args.indexOf('-s') + 1)
    assert.deepEqual(head, ['skills@1.7.4', 'add', source, '-a', 'codex'])
    assert.deepEqual(tail.slice(-2), ['-y', '-g'])
    return tail.slice(0, -2)
  }
  const mattNames = split(matt, 'mattpocock/skills')
  const pstackNames = split(pstack, 'backnotprop/pstack')
  assert.equal(mattNames.length, 20)
  assert.equal(pstackNames.length, 43)
  assert.deepEqual([...mattNames].sort(), [...listed('devflow-matt')].sort())
  assert.deepEqual([...pstackNames].sort(), [...listed('devflow-pstack')].sort())
  assert.ok(mattNames.includes('tdd'))
  assert.ok(!pstackNames.includes('tdd') && !pstackNames.includes('teach'))
  assert.equal(s.calls().length, 2)
})

test('uninstall puts the home folder back as it was, keeping what devflow did not write', () => {
  const s = sandbox({ name: 'devflow-install' })
  write(path.join(s.home, '.codex', 'AGENTS.md'), '# My rules\n\nBe brief.\n')
  write(path.join(s.home, '.codex', 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node mine.js' }] }] } }, null, 2) + '\n')
  write(path.join(s.home, '.codex', 'skills', 'mine', 'SKILL.md'), '---\nname: mine\n---\n')
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.match(fs.readFileSync(path.join(s.home, '.codex', 'AGENTS.md'), 'utf8'), /^# My rules\n\nBe brief\.\n/)
  assert.equal(readJson(path.join(s.home, '.codex', 'hooks.json')).hooks.PreToolUse.length, 2)

  const r = s.run('uninstall', '--agent', 'codex')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), before)
  const [addMatt, addPstack, removeMatt, removePstack] = s.calls()
  const names = args => args.slice(args.indexOf('-s') + 1, args.indexOf('-y'))
  assert.deepEqual(removeMatt, ['skills@1.7.4', 'remove', ...names(addMatt), '-g', '-y'])
  assert.deepEqual(removePstack, ['skills@1.7.4', 'remove', ...names(addPstack), '-g', '-y'])
})

test('uninstall from a fresh home leaves the home empty', () => {
  const s = sandbox({ name: 'devflow-install' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

test('installing again replaces the earlier install instead of doubling it', () => {
  const s = sandbox({ name: 'devflow-install' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const first = tree(s.home)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.deepEqual(tree(s.home), first)
  assert.equal(readJson(s.userRecord).length, 1)
  assert.equal(s.calls().length, 4)
  assert.equal(readJson(path.join(s.home, '.codex', 'hooks.json')).hooks.PreToolUse.length, 1)
  assert.equal(fs.readFileSync(path.join(s.home, '.codex', 'AGENTS.md'), 'utf8').split('devflow:begin').length, 2)
})

test('uninstall says so when nothing is installed, and changes nothing', () => {
  const s = sandbox({ name: 'devflow-install' })
  const r = s.run('uninstall', '--agent', 'codex')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /devflow isn't installed for codex/)
  assert.deepEqual(fs.readdirSync(s.home), [])
  assert.deepEqual(s.calls(), [])
})

test('bad arguments get a usage line and change nothing', () => {
  const s = sandbox({ name: 'devflow-install' })
  assert.match(s.run().stderr, /usage: devflow install --agent/)
  assert.equal(s.run('install').status, 2)
  const unknown = s.run('install', '--agent', 'vim')
  assert.equal(unknown.status, 2)
  assert.match(unknown.stderr, /unknown agent vim; use one of codex/)
  assert.equal(s.run('install', '--agent', 'codex', '--bogus').status, 2)
  assert.deepEqual(fs.readdirSync(s.home), [])
  assert.deepEqual(s.calls(), [])
})

test('a failing npx skills stops the install before devflow writes anything', () => {
  const s = sandbox({ name: 'devflow-install' })
  s.env.STUB_EXIT = '3'
  const r = s.run('install', '--agent', 'codex')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /npx skills/)
  assert.deepEqual(fs.readdirSync(s.home), [])
})
