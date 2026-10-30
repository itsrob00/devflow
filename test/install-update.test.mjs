// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readJson, repo, sandbox, tree, write } from './helpers.mjs'

test('a --project install writes only inside the repo, with paths relative to it, and leaves the home folder alone', () => {
  const s = sandbox({ name: 'devflow-update' })
  const sub = path.join(s.project, 'packages', 'app')
  fs.mkdirSync(sub, { recursive: true })
  const homeBefore = tree(s.home)
  const r = s.runIn(sub, 'install', '--agent', 'codex', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeBefore)

  const p = (...x) => path.join(s.project, ...x)
  const start = fs.readFileSync(p('.agents', 'skills', 'devflow-start', 'SKILL.md'), 'utf8')
  assert.match(start, /^name: devflow-start$/m)
  assert.ok(start.includes('node ".devflow/runtime/codex/scripts/devflow.mjs"'))
  assert.ok(start.includes('.agents/skills/devflow-continue/SKILL.md'))
  assert.deepEqual(readJson(p('.devflow', 'runtime', 'codex', 'agent.json')), { agent: 'codex', scope: 'project' })
  assert.ok(fs.existsSync(p('.devflow', 'runtime', 'codex', 'scripts', 'devflow-guard.mjs')))
  assert.ok(fs.existsSync(p('.devflow', 'runtime', 'codex', 'hooks', 'hooks.json')))
  assert.ok(fs.existsSync(p('.codex', 'rules', 'devflow.rules')))

  const hooks = readJson(p('.codex', 'hooks.json')).hooks
  assert.match(hooks.PreToolUse[0].hooks[0].command, /^node -e "[^"$`%\\]*" devflow-guard\.mjs --agent codex$/)
  assert.match(hooks.UserPromptSubmit[0].hooks[0].command, /^node -e "[^"$`%\\]*" devflow\.mjs active --agent codex$/)

  const agents = fs.readFileSync(p('AGENTS.md'), 'utf8')
  assert.match(agents, /^<!-- devflow:begin codex -->\n[\s\S]*\n<!-- devflow:end codex -->\n$/)
  assert.ok(agents.includes('node ".devflow/runtime/codex/scripts/devflow.mjs"'))

  for (const [file, text] of Object.entries(tree(s.project))) {
    if (text === null) continue
    assert.ok(!text.includes(s.project) && !text.includes(s.home) && !text.includes(repo), `${file} holds an absolute path`)
  }

  const [entry] = readJson(s.projectRecord)
  assert.equal(entry.scope, 'project')
  assert.ok(entry.files.includes('.agents/skills/devflow-start/SKILL.md'))
  assert.ok(entry.files.includes('.devflow/runtime/codex/agent.json'))
  assert.deepEqual(entry.blocks.map(b => b.file).sort(), ['.codex/hooks.json', 'AGENTS.md'])

  const calls = s.skillsCalls()
  assert.equal(calls.length, 2)
  for (const c of calls) {
    assert.ok(!c.args.includes('-g'))
    assert.equal(fs.realpathSync(c.cwd), fs.realpathSync(s.project))
  }
})

test('a --project uninstall removes only what it wrote, and not the repo\'s own files', () => {
  const s = sandbox({ name: 'devflow-update' })
  write(path.join(s.project, 'AGENTS.md'), '# Team rules\n')
  write(path.join(s.project, '.devflow', 'settings.json'), '{"git_guard":true}\n')
  write(path.join(s.project, '.agents', 'skills', 'mine', 'SKILL.md'), '---\nname: mine\n---\n')
  const before = tree(s.project)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.equal(s.skillsCalls().length, 2)
  const r = s.runProject('uninstall', '--agent', 'codex', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.project), before)
  assert.deepEqual(fs.readdirSync(s.home), [])
  const [addMatt, addPstack, ...removes] = s.skillsCalls()
  const names = c => c.args.slice(c.args.indexOf('-s') + 1, c.args.indexOf('-y'))
  assert.deepEqual(removes.map(c => c.args), [['skills@1.7.4', 'remove', ...names(addMatt), '-y'], ['skills@1.7.4', 'remove', ...names(addPstack), '-y']])
  assert.equal(fs.realpathSync(removes[0].cwd), fs.realpathSync(s.project))
})

test('a project install and a user install of one agent coexist, and each uninstall touches only its own scope', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const homeInstalled = tree(s.home)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.deepEqual(tree(s.home), homeInstalled)
  const projectInstalled = tree(s.project)

  const r = s.runProject('uninstall', '--agent', 'codex', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeInstalled)
  assert.deepEqual(Object.keys(tree(s.project)), ['.git' + path.sep])
  assert.equal(readJson(s.userRecord).length, 1)

  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.deepEqual(tree(s.project), projectInstalled)
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
  assert.deepEqual(tree(s.project), projectInstalled)
  assert.equal(readJson(s.projectRecord).length, 1)
})

test('uninstall --project says so when this repo has no install, even if the user has one', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const before = tree(s.home)
  const r = s.runProject('uninstall', '--agent', 'codex', '--project')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /devflow isn't installed for codex/)
  assert.deepEqual(tree(s.home), before)
})

function copySource () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-source-'))
  for (const f of ['plugin', '.claude-plugin', 'package.json']) fs.cpSync(path.join(repo, f), path.join(dir, f), { recursive: true })
  return dir
}

test('update --local rewrites the installed copy from the current source and moves the recorded version', () => {
  const src = copySource()
  const s = sandbox({ name: 'devflow-update', source: src })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const before = tree(s.home)
  const installedStart = path.join(s.home, '.codex', 'skills', 'devflow-start', 'SKILL.md')
  const runtimeScript = path.join(s.home, '.config', 'devflow', 'runtime', 'codex', 'scripts', 'devflow.mjs')
  assert.equal(readJson(s.userRecord)[0].version, readJson(path.join(repo, 'package.json')).version)

  const skillFile = path.join(src, 'plugin', 'skills', 'start', 'SKILL.md')
  fs.appendFileSync(skillFile, '\nA new line in the start skill.\n')
  fs.appendFileSync(path.join(src, 'plugin', 'scripts', 'devflow.mjs'), '\nvoid 0\n')
  const pkg = path.join(src, 'package.json')
  write(pkg, JSON.stringify({ ...readJson(pkg), version: '9.9.9' }))

  const r = s.run('update', '--local')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(fs.readFileSync(installedStart, 'utf8').includes('A new line in the start skill.'))
  assert.ok(fs.readFileSync(runtimeScript, 'utf8').endsWith('\nvoid 0\n'))
  assert.ok(!before[path.relative(s.home, installedStart)].includes('A new line'))
  const record = readJson(s.userRecord)
  assert.equal(record.length, 1)
  assert.equal(record[0].version, '9.9.9')
  assert.equal(readJson(path.join(s.home, '.codex', 'hooks.json')).hooks.PreToolUse.length, 1)
  assert.equal(fs.readFileSync(path.join(s.home, '.codex', 'AGENTS.md'), 'utf8').split('devflow:begin').length, 2)
  assert.deepEqual(s.launches(), [])
})

test('update --local re-runs npx skills add for each recorded agent with the current skill lists', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const first = s.skillsCalls().map(c => c.args)
  assert.equal(s.run('update', '--local').status, 0)
  const calls = s.skillsCalls().map(c => c.args)
  assert.equal(calls.length, 4)
  assert.deepEqual(calls.slice(2), first)
  assert.deepEqual(calls[2].slice(0, 5), ['skills@1.7.4', 'add', 'mattpocock/skills', '-a', 'codex'])
  assert.deepEqual(calls[3].slice(0, 5), ['skills@1.7.4', 'add', 'backnotprop/pstack', '-a', 'codex'])
  assert.equal(calls[2].length, 5 + 1 + 20 + 2)
  assert.equal(calls[3].length, 5 + 1 + 43 + 2)
})

test('update --local covers the user install and this repo\'s project install, and --project only the latter', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  const sub = path.join(s.project, 'deep', 'er')
  fs.mkdirSync(sub, { recursive: true })

  const mark = file => fs.appendFileSync(file, '\nstale\n')
  const userStart = path.join(s.home, '.codex', 'skills', 'devflow-start', 'SKILL.md')
  const projectStart = path.join(s.project, '.agents', 'skills', 'devflow-start', 'SKILL.md')
  mark(userStart)
  mark(projectStart)
  let r = s.runIn(sub, 'update', '--local', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!fs.readFileSync(projectStart, 'utf8').includes('stale'))
  assert.ok(fs.readFileSync(userStart, 'utf8').includes('stale'))
  assert.ok(s.skillsCalls().slice(4).every(c => !c.args.includes('-g')))

  mark(projectStart)
  r = s.runIn(sub, 'update', '--local')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!fs.readFileSync(userStart, 'utf8').includes('stale'))
  assert.ok(!fs.readFileSync(projectStart, 'utf8').includes('stale'))
  assert.equal(readJson(s.userRecord).length, 1)
  assert.equal(readJson(s.projectRecord).length, 1)
})

test('update without --local re-invokes the latest release\'s installer for each recorded install', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  const homeBefore = tree(s.home)
  const projectBefore = tree(s.project)
  const skillsBefore = s.skillsCalls().length

  const r = s.runProject('update')
  assert.equal(r.status, 0, r.stderr)
  const launches = s.launches()
  assert.equal(launches.length, 2)
  assert.deepEqual(launches[0].args, ['github:itsrob00/devflow#semver:*', 'install', '--agent', 'codex'])
  assert.deepEqual(launches[1].args, ['github:itsrob00/devflow#semver:*', 'install', '--agent', 'codex', '--project'])
  assert.equal(fs.realpathSync(launches[1].cwd), fs.realpathSync(s.project))
  assert.deepEqual(tree(s.home), homeBefore)
  assert.deepEqual(tree(s.project), projectBefore)
  assert.equal(s.skillsCalls().length, skillsBefore)
})

test('update reports an install it could not refresh, and still refreshes the others', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  s.env.LAUNCH_EXIT = '3'
  const r = s.runProject('update')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /update failed for codex \(user\).*codex \(project\)/)
  assert.equal(s.launches().length, 2)
})

test('update says so when nothing is recorded, and changes nothing', () => {
  const s = sandbox({ name: 'devflow-update' })
  const r = s.run('update')
  assert.equal(r.status, 1)
  assert.match(r.stderr, /nothing to update/)
  assert.deepEqual(fs.readdirSync(s.home), [])
  assert.deepEqual(s.launches(), [])
  assert.deepEqual(s.skillsCalls(), [])
  assert.equal(s.run('install', '--agent', 'codex', '--local').status, 2)
})

function realisticSkills (s) {
  const stub = path.join(s.outside, 'real-skills-stub.mjs')
  write(stub, [
    "import fs from 'node:fs'",
    "import os from 'node:os'",
    "import path from 'node:path'",
    "const args = process.argv.slice(2)",
    "const dir = path.join(os.homedir(), '.agents')",
    "const lockFile = path.join(dir, '.skill-lock.json')",
    "let lock = { version: 3, skills: {} }",
    "try { lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')) } catch {}",
    "if (args[1] === 'add') {",
    "  for (const name of args.slice(args.indexOf('-s') + 1, args.indexOf('-y'))) {",
    "    fs.mkdirSync(path.join(dir, 'skills', name), { recursive: true })",
    "    fs.writeFileSync(path.join(dir, 'skills', name, 'SKILL.md'), 'upstream')",
    "    lock.skills[name] = { source: args[2] }",
    "  }",
    "} else {",
    "  for (const name of args.slice(2).filter(a => !a.startsWith('-'))) {",
    "    fs.rmSync(path.join(dir, 'skills', name), { recursive: true, force: true })",
    "    delete lock.skills[name]",
    "  }",
    "}",
    "fs.writeFileSync(lockFile, JSON.stringify(lock))",
    ''
  ].join('\n'))
  s.env.DEVFLOW_SKILLS_CMD = stub
}

test('uninstall removes the empty skills folder and lock file that npx skills left behind, when devflow\'s install created them', () => {
  const s = sandbox({ name: 'devflow-update' })
  realisticSkills(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.ok(fs.existsSync(path.join(s.home, '.agents', '.skill-lock.json')))
  assert.equal(s.run('update', '--local').status, 0)
  const r = s.run('uninstall', '--agent', 'codex')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

test('uninstall leaves a skills folder and lock file that were there before devflow, even when empty', () => {
  const s = sandbox({ name: 'devflow-update' })
  realisticSkills(s)
  write(path.join(s.home, '.agents', '.skill-lock.json'), JSON.stringify({ version: 3, skills: {} }))
  fs.mkdirSync(path.join(s.home, '.agents', 'skills'), { recursive: true })
  const before = tree(s.home)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.deepEqual(tree(s.home), before)
})

test('uninstall keeps the lock file and folder while skills from elsewhere remain in them', () => {
  const s = sandbox({ name: 'devflow-update' })
  realisticSkills(s)
  assert.equal(s.run('install', '--agent', 'codex').status, 0)
  const lockFile = path.join(s.home, '.agents', '.skill-lock.json')
  const lock = readJson(lockFile)
  lock.skills['someone/else'] = { source: 'someone/else' }
  write(lockFile, JSON.stringify(lock))
  write(path.join(s.home, '.agents', 'skills', 'theirs', 'SKILL.md'), 'theirs')
  assert.equal(s.run('uninstall', '--agent', 'codex').status, 0)
  assert.deepEqual(Object.keys(readJson(lockFile).skills), ['someone/else'])
  assert.ok(fs.existsSync(path.join(s.home, '.agents', 'skills', 'theirs', 'SKILL.md')))
})

const SKILL_HOMES = { codex: ['.codex', 'skills'], opencode: ['.config', 'opencode', 'skills'] }
const INVOKES = { codex: '$devflow-continue', opencode: '@devflow-continue' }

for (const [first, second] of [['codex', 'opencode'], ['opencode', 'codex']]) {
  test(`${first} and ${second} installed in one user scope: each keeps its own skills when the other is uninstalled, and the upstream skills stay until the last one goes`, () => {
    const s = sandbox({ name: 'devflow-update' })
    realisticSkills(s)
    assert.equal(s.run('install', '--agent', first).status, 0)
    assert.equal(s.run('install', '--agent', second).status, 0)
    const upstream = path.join(s.home, '.agents', 'skills')
    const lockFile = path.join(s.home, '.agents', '.skill-lock.json')
    const own = agent => path.join(s.home, ...SKILL_HOMES[agent])
    assert.deepEqual(readJson(s.userRecord).map(e => e.agent), [first, second])
    assert.ok(fs.readFileSync(path.join(own(first), 'devflow-start', 'SKILL.md'), 'utf8').includes(INVOKES[first]))
    assert.ok(fs.readFileSync(path.join(own(second), 'devflow-start', 'SKILL.md'), 'utf8').includes(INVOKES[second]))
    assert.ok(!fs.existsSync(path.join(upstream, 'devflow-start')))
    const secondSkills = tree(own(second))

    const r = s.run('uninstall', '--agent', first)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /another agent installed here still uses them/)
    assert.ok(!fs.existsSync(own(first)))
    assert.deepEqual(tree(own(second)), secondSkills)
    assert.ok(fs.existsSync(path.join(upstream, 'tdd', 'SKILL.md')))
    assert.ok(Object.keys(readJson(lockFile).skills).length > 0)
    const record = readJson(s.userRecord)
    assert.deepEqual(record.map(e => e.agent), [second])
    assert.ok(record[0].upstream.dirs.length > 0)
    assert.ok(record[0].upstream.files.length > 0)
    assert.ok(fs.existsSync(path.join(s.home, '.config', 'devflow', 'runtime', second, 'agent.json')))
    assert.ok(!fs.existsSync(path.join(s.home, '.config', 'devflow', 'runtime', first)))

    const last = s.run('uninstall', '--agent', second)
    assert.equal(last.status, 0, last.stderr)
    assert.deepEqual(fs.readdirSync(s.home), [])
  })
}

test('codex and opencode installed in one project share AGENTS.md: each keeps and removes only its own marked block', () => {
  const s = sandbox({ name: 'devflow-update' })
  const p = (...x) => path.join(s.project, ...x)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.equal(s.runProject('install', '--agent', 'opencode', '--project').status, 0)
  const both = fs.readFileSync(p('AGENTS.md'), 'utf8')
  for (const agent of ['codex', 'opencode']) {
    assert.equal(both.split(`<!-- devflow:begin ${agent} -->`).length, 2)
    assert.equal(both.split(`<!-- devflow:end ${agent} -->`).length, 2)
    assert.ok(both.includes(`node ".devflow/runtime/${agent}/scripts/devflow.mjs"`))
  }
  assert.ok(fs.existsSync(p('.agents', 'skills', 'devflow-start', 'SKILL.md')))
  assert.ok(fs.existsSync(p('.opencode', 'skills', 'devflow-start', 'SKILL.md')))
  const opencodeSkills = tree(p('.opencode', 'skills'))

  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.equal(fs.readFileSync(p('AGENTS.md'), 'utf8').split('devflow:begin').length, 3)

  assert.equal(s.runProject('uninstall', '--agent', 'codex', '--project').status, 0)
  const left = fs.readFileSync(p('AGENTS.md'), 'utf8')
  assert.ok(!left.includes('devflow:begin codex'))
  assert.match(left, /^<!-- devflow:begin opencode -->\n[\s\S]*\n<!-- devflow:end opencode -->\n$/)
  assert.ok(!fs.existsSync(p('.agents', 'skills', 'devflow-start')))
  assert.deepEqual(tree(p('.opencode', 'skills')), opencodeSkills)
  assert.ok(fs.existsSync(p('.devflow', 'runtime', 'opencode', 'agent.json')))

  assert.equal(s.runProject('uninstall', '--agent', 'opencode', '--project').status, 0)
  assert.deepEqual(fs.readdirSync(s.project), ['.git'])
})

test('two project installs sharing a team AGENTS.md leave the team text and nothing else behind', () => {
  const s = sandbox({ name: 'devflow-update' })
  write(path.join(s.project, 'AGENTS.md'), '# Team rules\n')
  assert.equal(s.runProject('install', '--agent', 'opencode', '--project').status, 0)
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.equal(s.runProject('uninstall', '--agent', 'opencode', '--project').status, 0)
  assert.equal(s.runProject('uninstall', '--agent', 'codex', '--project').status, 0)
  assert.equal(fs.readFileSync(path.join(s.project, 'AGENTS.md'), 'utf8'), '# Team rules\n')
  assert.deepEqual(fs.readdirSync(s.project).sort(), ['.git', 'AGENTS.md'])
})

test('opencode installs per project into the repo: AGENTS.md, ./opencode.jsonc, a plugin under .opencode and a repo-relative runtime', () => {
  const s = sandbox({ name: 'devflow-update' })
  const homeBefore = tree(s.home)
  const r = s.runProject('install', '--agent', 'opencode', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeBefore)

  const p = (...x) => path.join(s.project, ...x)
  assert.deepEqual(readJson(p('opencode.jsonc')), { plugins: ['./.opencode/devflow-plugin'] })
  const source = fs.readFileSync(p('.opencode', 'devflow-plugin', 'index.js'), 'utf8')
  assert.ok(source.includes('const PLUGIN_DIR = ".devflow/runtime/opencode"'))
  assert.deepEqual(readJson(p('.devflow', 'runtime', 'opencode', 'agent.json')), { agent: 'opencode', scope: 'project' })
  const agents = fs.readFileSync(p('AGENTS.md'), 'utf8')
  assert.ok(agents.includes('node ".devflow/runtime/opencode/scripts/devflow.mjs"'))
  assert.ok(fs.existsSync(p('.opencode', 'skills', 'devflow-start', 'SKILL.md')))

  const entry = readJson(s.projectRecord)[0]
  assert.ok(entry.files.includes('.opencode/devflow-plugin/index.js'))
  assert.ok(entry.blocks.some(b => b.file === 'opencode.jsonc' && b.type === 'json-list'))

  assert.equal(s.runProject('uninstall', '--agent', 'opencode', '--project').status, 0)
  for (const f of ['opencode.jsonc', 'AGENTS.md', '.opencode', '.devflow/runtime', '.devflow/installs.json']) assert.ok(!fs.existsSync(p(...f.split('/'))), f)
})

test('a bad opencode.json is refused before npx skills runs or anything is written', () => {
  const s = sandbox({ name: 'devflow-update' })
  write(path.join(s.home, '.config', 'opencode', 'opencode.json'), '{ // note\n}')
  const before = tree(s.home)
  const r = s.run('install', '--agent', 'opencode')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /comments or isn't plain JSON/)
  assert.deepEqual(s.skillsCalls(), [])
  assert.deepEqual(tree(s.home), before)
})

test('devflow active works from an installed runtime copy, pointing at the installed start skill instead of a missing plugin path', () => {
  const s = sandbox({ name: 'devflow-update' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const script = path.join(s.home, '.config', 'devflow', 'runtime', 'opencode', 'scripts', 'devflow.mjs')
  const env = { ...s.env, TMPDIR: s.root, TMP: s.root, TEMP: s.root }
  const exec = (args, input) => spawnSync(process.execPath, [script, ...args], { cwd: s.project, env, encoding: 'utf8', input })
  const created = exec(['flow', 'new', 'feature', 'CSV export'])
  assert.equal(created.status, 0, created.stderr)
  const track = exec(['track'], JSON.stringify({ session_id: 's1', tool_name: 'Bash', tool_input: { command: 'devflow flow new feature CSV export' }, tool_response: { stdout: created.stdout } }))
  assert.equal(track.status, 0, track.stderr)
  const active = exec(['active'], JSON.stringify({ session_id: 's1', hook_event_name: 'UserPromptSubmit' }))
  assert.equal(active.status, 0, active.stderr)
  const text = JSON.parse(active.stdout).hookSpecificOutput.additionalContext
  assert.match(text, /^devflow: on flow csv-export \(Feature: CSV export\)/)
  assert.ok(text.includes('devflow show devflow-start'))
  assert.doesNotMatch(text, /SKILL\.md/)
})
