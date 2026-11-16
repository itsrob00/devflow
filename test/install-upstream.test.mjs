// node --test
// Before 1.3 devflow installed Matt Pocock's skills and pstack with npx skills and recorded what it added.
// These cover what 1.3 does with such a record.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { readJson, sandbox, tree, write } from './helpers.mjs'

function removingStub (s) {
  const stub = path.join(s.outside, 'removing-stub.mjs')
  write(stub, [
    "import fs from 'node:fs'",
    "import os from 'node:os'",
    "import path from 'node:path'",
    "fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n')",
    "const dir = path.join(os.homedir(), '.agents')",
    "const lockFile = path.join(dir, '.skill-lock.json')",
    "const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))",
    "for (const name of process.argv.slice(4).filter(a => !a.startsWith('-'))) {",
    "  fs.rmSync(path.join(dir, 'skills', name), { recursive: true, force: true })",
    "  delete lock.skills[name]",
    "}",
    "fs.writeFileSync(lockFile, JSON.stringify(lock))",
    ''
  ].join('\n'))
  s.env.DEVFLOW_SKILLS_CMD = stub
}

function asOlderInstall (s, added) {
  const dir = path.join(s.home, '.agents')
  const lockFile = path.join(dir, '.skill-lock.json')
  const lock = fs.existsSync(lockFile) ? readJson(lockFile) : { version: 3, skills: {} }
  const record = readJson(s.userRecord)
  record.forEach((entry, i) => {
    const names = added[entry.agent] || []
    for (const n of names) {
      write(path.join(dir, 'skills', n, 'SKILL.md'), 'upstream')
      lock.skills[n] = { source: 'mattpocock/skills' }
    }
    entry.version = '1.2.2'
    entry.upstream = { dirs: i === 0 ? [dir, path.join(dir, 'skills')] : [], files: i === 0 ? [lockFile] : [], names }
  })
  write(lockFile, JSON.stringify(lock))
  write(s.userRecord, JSON.stringify(record))
}

test('a fresh install calls npx skills for nothing and records no upstream skills', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.deepEqual(s.calls(), [])
  assert.ok(!('upstream' in readJson(s.userRecord)[0]))
  assert.ok(!fs.existsSync(path.join(s.home, '.agents')))
})

test('updating an install from before 1.3 removes the skills it added, and the folder and lock file they left', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  removingStub(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const clean = tree(s.home)
  asOlderInstall(s, { codex: ['tdd', 'how'] })
  const r = s.run('update', '--local')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /removed the 2 skills an older devflow installed from Matt Pocock's skills and pstack; devflow now ships its own/)
  assert.deepEqual(s.calls(), [['skills@1.7.4', 'remove', 'tdd', 'how', '-g', '-y']])
  assert.deepEqual(tree(s.home), clean)
  assert.equal(s.run('update', '--local').status, 0)
  assert.equal(s.calls().length, 1)
})

test('the lock file and folder stay while skills from elsewhere remain in them', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  removingStub(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  asOlderInstall(s, { codex: ['tdd'] })
  const lockFile = path.join(s.home, '.agents', '.skill-lock.json')
  const lock = readJson(lockFile)
  lock.skills.theirs = { source: 'someone/else' }
  write(lockFile, JSON.stringify(lock))
  write(path.join(s.home, '.agents', 'skills', 'theirs', 'SKILL.md'), 'theirs')
  assert.equal(s.run('update', '--local').status, 0)
  assert.deepEqual(Object.keys(readJson(lockFile).skills), ['theirs'])
  assert.ok(fs.existsSync(path.join(s.home, '.agents', 'skills', 'theirs', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(s.home, '.agents', 'skills', 'tdd')))
})

test('with two agents from before 1.3, the skills stay until the second one is updated too', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  removingStub(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  asOlderInstall(s, { codex: ['tdd', 'how'], opencode: ['why'] })

  assert.equal(s.run('update', '--local', '--agent', 'codex').status, 0)
  assert.deepEqual(s.calls(), [])
  assert.ok(fs.existsSync(path.join(s.home, '.agents', 'skills', 'tdd', 'SKILL.md')))
  const record = readJson(s.userRecord)
  assert.ok(!('upstream' in record.find(e => e.agent === 'codex')))
  assert.deepEqual(record.find(e => e.agent === 'opencode').upstream.names.sort(), ['how', 'tdd', 'why'])

  assert.equal(s.run('update', '--local', '--agent', 'opencode').status, 0)
  assert.deepEqual(s.calls().map(c => [...c.slice(0, 2), ...c.slice(2, -2).sort(), ...c.slice(-2)]), [['skills@1.7.4', 'remove', 'how', 'tdd', 'why', '-g', '-y']])
  assert.ok(!fs.existsSync(path.join(s.home, '.agents')))
  assert.ok(readJson(s.userRecord).every(e => !('upstream' in e)))
})

test('uninstalling an install from before 1.3 removes the skills it added, unless another older install still uses them', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  removingStub(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  asOlderInstall(s, { codex: ['tdd'], opencode: [] })
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.deepEqual(s.calls(), [])
  assert.deepEqual(readJson(s.userRecord)[0].upstream.names, ['tdd'])
  assert.equal(s.run('uninstall', '--agent', 'opencode').status, 0)
  assert.deepEqual(s.calls(), [['skills@1.7.4', 'remove', 'tdd', '-g', '-y']])
  assert.deepEqual(fs.readdirSync(s.home), [])
})

test('when npx skills fails, the update still finishes and gives the command to remove the old skills by hand', () => {
  const s = sandbox({ name: 'devflow-upstream' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  asOlderInstall(s, { codex: ['tdd', 'how'] })
  s.env.STUB_EXIT = '3'
  const r = s.run('update', '--local')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /couldn't remove the 2 skills an older devflow installed \(npx skills remove failed \(exit 3\)\)\. Remove them yourself with: npx skills@1\.7\.4 remove tdd how -g -y/)
  assert.ok(fs.existsSync(path.join(s.home, '.codex', 'skills', 'devflow-start', 'SKILL.md')))
  assert.ok(fs.existsSync(path.join(s.home, '.agents', 'skills', 'tdd', 'SKILL.md')))
})
