// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readJson, sandbox, tree, write } from './helpers.mjs'

const commandsIn = json => {
  if (Array.isArray(json)) return json.flatMap(commandsIn)
  if (!json || typeof json !== 'object') return []
  return Object.entries(json).flatMap(([k, v]) => (k === 'command' && typeof v === 'string' ? [v] : commandsIn(v)))
}

const FORMATS = {
  codex: {
    file: ['.codex', 'hooks.json'],
    payload: (s, command, session) => ({ session_id: session, cwd: s.sub, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
    denied: out => out.hookSpecificOutput?.permissionDecision === 'deny',
    allowed: out => out === null
  },
  cursor: {
    file: ['.cursor', 'hooks.json'],
    payload: (s, command, session) => ({ conversation_id: session, workspace_roots: [s.project], cwd: s.sub, hook_event_name: 'preToolUse', tool_name: 'Shell', tool_input: { command } }),
    denied: out => out.permission === 'deny',
    allowed: out => out?.permission === 'allow'
  }
}

const isGuard = c => / devflow-guard\.mjs --agent \w+$/.test(c)
const guardCommand = commands => commands.find(isGuard)

function runHook (s, command, payload, cwd = s.sub) {
  const r = spawnSync(command, { shell: true, cwd, env: s.env, input: JSON.stringify(payload), encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim() ? JSON.parse(r.stdout) : null
}

for (const [agent, format] of Object.entries(FORMATS)) {
  test(`${agent}: every hook command for the agent ends with --agent ${agent}, in both scopes`, () => {
    const s = sandbox({ name: 'devflow-hooks' })
    assert.equal(s.run('install', '--agent', agent).status, 0)
    const user = commandsIn(readJson(path.join(s.home, ...format.file)))
    assert.ok(user.length >= 3)
    for (const c of user) assert.ok(c.endsWith(` --agent ${agent}`), c)
    assert.equal(s.runProject('install', '--agent', agent, '--project').status, 0)
    const project = commandsIn(readJson(path.join(s.project, ...format.file)))
    assert.equal(project.length, user.length)
    for (const c of project) assert.ok(c.endsWith(` --agent ${agent}`), c)
    for (const c of project) assert.match(c, /^node -e "[^"$`%\\]*" devflow(-guard)?\.mjs( [a-z-]+)* --agent \w+$/, c)
  })

  test(`${agent}: a project install's guard hook still blocks when the agent runs it from a subfolder`, () => {
    const s = sandbox({ name: 'devflow-hooks' })
    fs.mkdirSync(s.sub, { recursive: true })
    assert.equal(s.runProject('install', '--agent', agent, '--project').status, 0)
    s.link('sess-1')
    const command = guardCommand(commandsIn(readJson(path.join(s.project, ...format.file))))
    assert.ok(command)
    assert.ok(!command.includes(s.project), 'no absolute path in a project hook')
    assert.ok(format.denied(runHook(s, command, format.payload(s, 'git push', 'sess-1'))))
    assert.ok(format.denied(runHook(s, command, format.payload(s, 'cd x && git reset --hard', 'sess-1'))))
    assert.ok(format.allowed(runHook(s, command, format.payload(s, 'git status', 'sess-1'))))
    assert.ok(format.allowed(runHook(s, command, format.payload(s, 'git push', 'someone-else'))))
    assert.ok(format.denied(runHook(s, command, format.payload(s, 'git push', 'sess-1'), s.project)))
  })

  test(`${agent}: when the guard script cannot be found, the project hook denies instead of allowing, and other hooks do nothing`, () => {
    const s = sandbox({ name: 'devflow-hooks' })
    fs.mkdirSync(s.sub, { recursive: true })
    assert.equal(s.runProject('install', '--agent', agent, '--project').status, 0)
    const commands = commandsIn(readJson(path.join(s.project, ...format.file)))
    fs.rmSync(path.join(s.project, '.devflow', 'runtime'), { recursive: true })
    const out = runHook(s, guardCommand(commands), format.payload(s, 'ls', 'sess-1'))
    assert.ok(format.denied(out), JSON.stringify(out))
    assert.match(JSON.stringify(out), /devflow/)
    const others = commands.filter(c => !isGuard(c))
    assert.ok(others.length >= 2)
    for (const c of others) assert.equal(runHook(s, c, { session_id: 'sess-1', cwd: s.sub }), null, c)
  })

  test(`${agent}: a hook file that is not valid JSON is refused by name before anything is written`, () => {
    const s = sandbox({ name: 'devflow-hooks' })
    const file = path.join(s.home, ...format.file)
    write(file, '{ "hooks": ')
    const before = tree(s.home)
    const r = s.run('install', '--agent', agent)
    assert.notEqual(r.status, 0)
    assert.ok(r.stderr.includes(file), r.stderr)
    assert.match(r.stderr, /JSON/)
    assert.deepEqual(tree(s.home), before)
    assert.deepEqual(s.calls(), [])
  })
}

test('a project install of codex runs the other hooks from a subfolder too', () => {
  const s = sandbox({ name: 'devflow-hooks' })
  fs.mkdirSync(s.sub, { recursive: true })
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  s.link('sess-1', 'cart', { flow: 'feature', title: 'Cart totals', status: 'active', step: '2. Plan' })
  const hooks = readJson(path.join(s.project, '.codex', 'hooks.json')).hooks
  const active = hooks.UserPromptSubmit[0].hooks[0].command
  const out = runHook(s, active, { session_id: 'sess-1', cwd: s.sub, hook_event_name: 'UserPromptSubmit' })
  assert.match(out.hookSpecificOutput.additionalContext, /on flow cart \(Feature: Cart totals\), step 2\. Plan/)
})
