// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { allowed, blocked } from './guard-cases.mjs'
import { askAll, devflow, feed, guard, readJson, sandbox, tree, write } from './helpers.mjs'

const runtime = home => path.join(home, '.config', 'devflow', 'runtime', 'gemini', 'scripts')
const hook = (s, script, args, payload) => spawnSync(process.execPath, [script, ...args, '--agent', 'gemini'], { cwd: s.outside, env: s.env, encoding: 'utf8', input: JSON.stringify(payload) })

test('install --agent gemini puts every file where Gemini CLI reads it and records them', () => {
  const s = sandbox({ name: 'devflow-gemini' })
  const r = s.run('install', '--agent', 'gemini')
  assert.equal(r.status, 0, r.stderr)

  const skills = path.join(s.home, '.gemini', 'skills')
  for (const n of ['start', 'continue', 'setup', 'wrap']) {
    const text = fs.readFileSync(path.join(skills, `devflow-${n}`, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^name: devflow-${n}$`, 'm'))
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/)
    assert.doesNotMatch(text, /\/devflow:/)
  }
  assert.ok(fs.readFileSync(path.join(skills, 'devflow-start', 'SKILL.md'), 'utf8').includes('`/devflow-continue`'))

  const hooks = readJson(path.join(s.home, '.gemini', 'settings.json')).hooks
  const command = (event, i = 0) => hooks[event][i].hooks[0].command
  assert.equal(hooks.BeforeTool[0].matcher, 'run_shell_command')
  assert.equal(command('BeforeTool'), `node "${path.join(runtime(s.home), 'devflow-guard.mjs')}" --agent gemini`)
  assert.equal(hooks.AfterTool[0].matcher, 'run_shell_command')
  assert.equal(command('AfterTool'), `node "${path.join(runtime(s.home), 'devflow.mjs')}" track --agent gemini`)
  assert.equal(command('BeforeAgent'), `node "${path.join(runtime(s.home), 'devflow.mjs')}" active --agent gemini`)
  assert.equal(hooks.BeforeAgent[0].matcher, undefined)
  assert.deepEqual(hooks.SessionStart.map(g => [g.matcher, g.hooks[0].command.split(' ').slice(-3).join(' ')]), [
    ['startup|clear', 'reminder --agent gemini'],
    ['startup|clear|compact', 'rules --agent gemini']
  ])
  assert.ok(Object.values(hooks).flat().every(g => g.hooks.every(h => h.type === 'command')))
  assert.doesNotMatch(JSON.stringify(hooks), /\$\{/)
  assert.deepEqual(Object.keys(hooks).sort(), ['AfterTool', 'BeforeAgent', 'BeforeTool', 'SessionStart'])

  const policy = fs.readFileSync(path.join(s.home, '.gemini', 'policies', 'devflow.toml'), 'utf8')
  const rules = [...policy.matchAll(/\[\[rule\]\]([\s\S]*?)(?=\[\[rule\]\]|$)/g)].map(m => m[1])
  assert.ok(rules.length >= 1)
  for (const rule of rules) {
    assert.match(rule, /^\s*toolName = "run_shell_command"$/m)
    assert.match(rule, /^\s*decision = "deny"$/m)
    assert.match(rule, /^\s*priority = \d+$/m)
    assert.match(rule, /^\s*denyMessage = ".*git guard/m)
  }
  const prefixes = new Set(rules.flatMap(rule => [...(/commandPrefix = \[([^\]]*)\]/.exec(rule)?.[1] ?? '').matchAll(/"([^"]*)"/g)].map(m => m[1])))
  for (const p of ['git push', 'git reset --hard', 'git branch -D', 'git clean -f', 'git clean -fd', 'git clean -xdf', 'git clean --force', 'git checkout .', 'git checkout -f', 'git checkout --force', 'git switch -f', 'git switch --discard-changes', 'git restore .']) {
    assert.ok(prefixes.has(p), `policy should deny ${p}`)
  }

  const gemini = fs.readFileSync(path.join(s.home, '.gemini', 'GEMINI.md'), 'utf8')
  assert.match(gemini, /^<!-- devflow:begin gemini -->\n[\s\S]*\n<!-- devflow:end gemini -->\n$/)
  assert.match(gemini, /git push/)
  assert.match(gemini, /`devflow active`/)
  assert.ok(gemini.includes('/devflow-start'))
  assert.ok(gemini.includes(`node "${path.join(runtime(s.home), 'devflow.mjs')}"`))

  const record = readJson(s.userRecord)
  assert.equal(record.length, 1)
  const [entry] = record
  assert.equal(entry.agent, 'gemini')
  assert.equal(entry.scope, 'user')
  const recorded = new Set([...entry.files, ...entry.blocks.map(b => b.file)])
  const onDisk = new Set(Object.entries(tree(s.home)).filter(([, v]) => v !== null).map(([p]) => path.join(s.home, p)).filter(p => p !== s.userRecord))
  assert.deepEqual([...recorded].sort(), [...onDisk].sort())
  assert.ok(entry.files.includes(path.join(s.home, '.gemini', 'policies', 'devflow.toml')))
  assert.deepEqual(entry.blocks.map(b => b.file).sort(), [path.join(s.home, '.gemini', 'GEMINI.md'), path.join(s.home, '.gemini', 'settings.json')].sort())
})

test('install --agent gemini runs npx skills for gemini-cli with both sources', () => {
  const s = sandbox({ name: 'devflow-gemini' })
  assert.equal(s.run('install', '--agent', 'gemini').status, 0)
  const calls = s.calls()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].slice(0, 5), ['skills@1.7.4', 'add', 'mattpocock/skills', '-a', 'gemini-cli'])
  assert.deepEqual(calls[1].slice(0, 5), ['skills@1.7.4', 'add', 'backnotprop/pstack', '-a', 'gemini-cli'])
})

test('uninstall --agent gemini puts the home folder back, keeping the user\'s own settings, hooks and notes', () => {
  const s = sandbox({ name: 'devflow-gemini' })
  write(path.join(s.home, '.gemini', 'GEMINI.md'), '# Notes\n\nBe brief.\n')
  const mine = { matcher: 'run_shell_command', hooks: [{ type: 'command', command: 'node mine.js' }] }
  write(path.join(s.home, '.gemini', 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { BeforeTool: [mine] }, hooksConfig: { enabled: true } }, null, 2) + '\n')
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'gemini').status, 0)
  const settings = readJson(path.join(s.home, '.gemini', 'settings.json'))
  assert.equal(settings.theme, 'dark')
  assert.deepEqual(settings.hooksConfig, { enabled: true })
  assert.equal(settings.hooks.BeforeTool.length, 2)
  assert.deepEqual(settings.hooks.BeforeTool[0], mine)
  assert.match(fs.readFileSync(path.join(s.home, '.gemini', 'GEMINI.md'), 'utf8'), /^# Notes\n\nBe brief\.\n/)

  const r = s.run('uninstall', '--agent', 'gemini')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), before)
})

test('uninstall --agent gemini from a fresh home leaves the home empty, and installing twice does not double anything', () => {
  const s = sandbox({ name: 'devflow-gemini' })
  assert.equal(s.run('install', '--agent', 'gemini').status, 0)
  const first = tree(s.home)
  assert.equal(s.run('install', '--agent', 'gemini').status, 0)
  assert.deepEqual(tree(s.home), first)
  assert.equal(readJson(path.join(s.home, '.gemini', 'settings.json')).hooks.BeforeTool.length, 1)
  assert.equal(s.run('uninstall', '--agent', 'gemini').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

function flowSandbox () {
  const s = sandbox({ name: 'devflow-gemini' })
  s.link('gem-session-1', 'cart', { flow: 'feature', title: 'Cart totals', status: 'active', step: '2. Plan' })
  fs.mkdirSync(s.sub, { recursive: true })
  const base = event => ({ session_id: 'gem-session-1', transcript_path: path.join(s.home, '.gemini', 'tmp', 'x', 'chats', 'c.json'), cwd: s.sub, hook_event_name: event, timestamp: '2026-10-29T10:00:00.000Z' })
  return { ...s, base }
}

test('fed Gemini\'s BeforeTool payload, the guard blocks every case in the guard tests and allows the rest, in Gemini\'s reply format', async () => {
  const s = flowSandbox()
  const ask = (command, extra = {}) => feed(guard, ['--agent', 'gemini'], { ...s.base('BeforeTool'), tool_name: 'run_shell_command', tool_input: { command }, original_request_name: 'run_shell_command', ...extra }, { env: s.env, cwd: s.outside })

  const denied = await askAll(blocked, c => ask(c))
  denied.forEach((r, i) => {
    assert.equal(r.code, 0, `should exit 0: ${JSON.stringify(blocked[i])}`)
    const reply = JSON.parse(r.stdout || 'null')
    assert.equal(reply?.decision, 'deny', `should block: ${JSON.stringify(blocked[i])}`)
    assert.match(reply.reason, /^devflow git guard: .*\. Don't work around it; give the user the exact command to run\.$/)
    assert.equal(reply.hookSpecificOutput, undefined)
  })
  const passed = await askAll(allowed, c => ask(c))
  passed.forEach((r, i) => {
    assert.equal(r.code, 0)
    assert.equal(r.stdout, '', `should allow: ${JSON.stringify(allowed[i])}`)
  })
  assert.equal((await ask('git push', { tool_name: 'write_file' })).stdout, '')
  assert.equal((await ask('git push', { tool_name: 'Bash' })).stdout, '')
  assert.equal((await ask('git push', { session_id: 'someone-else' })).stdout, '')
  assert.equal((await ask('git push', { cwd: s.outside })).stdout, '')
})

test('the Gemini guard stays off when the git guard setting is off', () => {
  const s = flowSandbox()
  write(path.join(s.home, '.config', 'devflow', 'settings.json'), JSON.stringify({ git_guard: false }))
  const r = hook(s, guard, [], { ...s.base('BeforeTool'), tool_name: 'run_shell_command', tool_input: { command: 'git push' } })
  assert.equal(r.stdout, '')
})

test('Gemini\'s BeforeAgent, SessionStart and AfterTool payloads reach the reminder, rules, active and track hooks, in Gemini\'s reply format', () => {
  const s = flowSandbox()

  const active = hook(s, devflow, ['active'], { ...s.base('BeforeAgent'), prompt: 'go with B' })
  assert.equal(active.status, 0, active.stderr)
  const a = JSON.parse(active.stdout)
  assert.equal(a.hookSpecificOutput.hookEventName, 'BeforeAgent')
  assert.match(a.hookSpecificOutput.additionalContext, /on flow cart \(Feature: Cart totals\), step 2\. Plan/)
  assert.equal(hook(s, devflow, ['active'], { ...s.base('BeforeAgent'), session_id: 'other', prompt: 'hi' }).stdout, '')

  const reminder = hook(s, devflow, ['reminder'], { ...s.base('SessionStart'), source: 'startup' })
  const r = JSON.parse(reminder.stdout)
  assert.equal(r.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(r.hookSpecificOutput.additionalContext, /1 unfinished flow here \(Cart totals\)/)
  assert.match(r.systemMessage, /1 unfinished flow here/)

  const rules = JSON.parse(hook(s, devflow, ['rules'], { ...s.base('SessionStart'), source: 'startup' }).stdout)
  assert.equal(rules.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(rules.hookSpecificOutput.additionalContext, /Don't add comments/)

  const made = spawnSync(process.execPath, [devflow, 'flow', 'new', 'bug', 'Header overlaps'], { cwd: s.project, env: s.env, encoding: 'utf8' })
  assert.equal(made.status, 0, made.stderr)
  const id = made.stdout.split('\t')[0]
  const after = (command, response, session = 'gem-session-2') => hook(s, devflow, ['track'], {
    ...s.base('AfterTool'), session_id: session, tool_name: 'run_shell_command', tool_input: { command }, tool_response: response
  })
  const linked = session => {
    try { return fs.readFileSync(path.join(s.project, '.devflow', 'sessions', session), 'utf8').trim() } catch { return null }
  }
  assert.equal(linked('gem-session-2'), null)
  after(`node "${devflow}" flow new bug "Header overlaps"`, { llmContent: `Command: node devflow.mjs flow new bug "Header overlaps"\nDirectory: (root)\nOutput: ${id}\t.devflow/flows/${id}\nExit Code: 0`, returnDisplay: `${id}\t.devflow/flows/${id}` })
  assert.equal(linked('gem-session-2'), id)
  after(`node "${devflow}" flow done ${id}`, { llmContent: 'Output: ok', returnDisplay: 'ok' })
  assert.equal(linked('gem-session-2'), null)
  after(`node "${devflow}" flow set cart step=3`, { llmContent: 'Output: ok' }, 'gem-session-3')
  assert.equal(linked('gem-session-3'), 'cart')
})

test('a --project install of gemini writes .gemini/settings.json, .gemini/skills and the repo GEMINI.md with repo-relative paths; uninstall restores the repo', () => {
  const s = sandbox({ name: 'devflow-gemini' })
  const p = (...x) => path.join(s.project, ...x)
  const homeBefore = tree(s.home)
  write(p('GEMINI.md'), '# Team notes\n')
  const before = tree(s.project)
  const r = s.runProject('install', '--agent', 'gemini', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeBefore)
  for (const n of ['start', 'continue', 'setup', 'wrap']) assert.match(fs.readFileSync(p('.gemini', 'skills', `devflow-${n}`, 'SKILL.md'), 'utf8'), new RegExp(`^name: devflow-${n}$`, 'm'))
  const hooks = readJson(p('.gemini', 'settings.json')).hooks
  assert.match(hooks.BeforeTool[0].hooks[0].command, /^node -e ".*" devflow-guard\.mjs --agent gemini$/)
  const notes = fs.readFileSync(p('GEMINI.md'), 'utf8')
  assert.ok(notes.startsWith('# Team notes\n'))
  assert.match(notes, /<!-- devflow:begin gemini -->\n[\s\S]*\n<!-- devflow:end gemini -->\n$/)
  assert.ok(notes.includes('node ".devflow/runtime/gemini/scripts/devflow.mjs"'))
  assert.ok(!fs.existsSync(p('.gemini', 'policies')))
  const [entry] = readJson(path.join(s.project, '.devflow', 'installs.json'))
  assert.ok(entry.files.every(f => !f.includes('policies')))

  assert.equal(s.runProject('uninstall', '--agent', 'gemini', '--project').status, 0)
  assert.deepEqual(tree(s.project), before)
  assert.deepEqual(tree(s.home), homeBefore)
})
