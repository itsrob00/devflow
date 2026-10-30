// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { allowed, blocked } from './guard-cases.mjs'
import { askAll, devflow, feed, guard, sandbox, write } from './helpers.mjs'

function setup () {
  const s = sandbox({ name: 'devflow-cursor-hooks' })
  fs.mkdirSync(s.sub, { recursive: true })
  return { ...s, write, feed: (script, args, payload, extraEnv = {}, cwd) => feed(script, args, payload, { env: { ...s.env, ...extraEnv }, cwd }) }
}

const common = (conversation, cwd, project) => ({
  conversation_id: conversation,
  generation_id: 'gen-1',
  model: 'claude-opus-4-7',
  cursor_version: '2.5.0',
  workspace_roots: [project],
  user_email: 'dev@example.com',
  transcript_path: null,
  cwd
})

test("fed Cursor's hook payload, the guard blocks every case and allows the rest, in Cursor's reply format", async () => {
  const s = setup()
  s.write(path.join(s.project, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active' }))
  s.write(path.join(s.project, '.devflow', 'sessions', 'conv-1'), 'cart\n')
  const payload = (command, extra = {}) => ({
    ...common('conv-1', s.sub, s.project),
    hook_event_name: 'preToolUse',
    tool_name: 'Shell',
    tool_input: { command, working_directory: s.sub },
    tool_use_id: 'call-1',
    agent_message: 'Running a command',
    ...extra
  })
  const ask = p => s.feed(guard, ['--agent', 'cursor'], p)

  const denied = await askAll(blocked, c => ask(payload(c)))
  denied.forEach((r, i) => {
    assert.equal(r.code, 0, `should exit 0: ${JSON.stringify(blocked[i])}`)
    const out = JSON.parse(r.stdout || 'null')
    assert.equal(out?.permission, 'deny', `should block: ${JSON.stringify(blocked[i])}`)
    assert.match(out.user_message, /^devflow git guard: /)
    assert.match(out.agent_message, /^devflow git guard: .*\. Don't work around it; give the user the exact command to run\.$/)
    assert.equal(out.hookSpecificOutput, undefined)
  })
  const passed = await askAll(allowed, c => ask(payload(c)))
  passed.forEach((r, i) => {
    assert.equal(r.code, 0)
    assert.deepEqual(JSON.parse(r.stdout), { permission: 'allow' }, `should allow: ${JSON.stringify(allowed[i])}`)
  })

  const allow = { permission: 'allow' }
  assert.deepEqual(JSON.parse((await ask(payload('git push', { tool_name: 'Read' }))).stdout), allow)
  assert.deepEqual(JSON.parse((await ask(payload('git push', { conversation_id: 'someone-else' }))).stdout), allow)
  assert.deepEqual(JSON.parse((await ask(payload('git push', { cwd: s.root, workspace_roots: [s.root] }))).stdout), allow)
  assert.equal(JSON.parse((await ask(payload('git push', { cwd: undefined }))).stdout).permission, 'deny')
  assert.deepEqual(JSON.parse((await ask('not json')).stdout), allow)
})

test("without the --agent flag the guard keeps Claude Code's reply format", async () => {
  const s = setup()
  s.write(path.join(s.project, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active' }))
  s.write(path.join(s.project, '.devflow', 'sessions', 'conv-1'), 'cart\n')
  const r = await s.feed(guard, [], { session_id: 'conv-1', cwd: s.project, tool_name: 'Bash', tool_input: { command: 'git push' } })
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny')
  const empty = await s.feed(guard, [], { session_id: 'conv-2', cwd: s.project, tool_name: 'Bash', tool_input: { command: 'git push' } })
  assert.equal(empty.stdout, '')
})

test('the session-start reminder and rules answer with additional_context for Cursor', async () => {
  const s = setup()
  const start = { ...common('conv-1', undefined, s.project), session_id: 'conv-1', hook_event_name: 'sessionStart', is_background_agent: false, composer_mode: 'agent' }
  delete start.cwd

  assert.equal((await s.feed(devflow, ['reminder', '--agent', 'cursor'], start)).stdout, '')
  await s.feed(devflow, ['flow', 'new', 'bug', 'Cart total'], '', {}, s.project)
  const reminder = JSON.parse((await s.feed(devflow, ['reminder', '--agent', 'cursor'], start)).stdout)
  assert.deepEqual(Object.keys(reminder), ['additional_context'])
  assert.match(reminder.additional_context, /^devflow: 1 unfinished flow here \(Cart total\)\. Run devflow's continue skill to pick one up \(\/devflow-continue in Cursor\)\./)
  assert.doesNotMatch(reminder.additional_context, /Claude Code/)
  assert.match(reminder.additional_context, /point the user to devflow's continue skill/)

  const rules = JSON.parse((await s.feed(devflow, ['rules', '--agent', 'cursor'], start)).stdout)
  assert.deepEqual(Object.keys(rules), ['additional_context'])
  assert.match(rules.additional_context, /^Don't add comments or docstrings/)
  assert.equal((await s.feed(devflow, ['rules', '--agent', 'cursor'], start, { CLAUDE_PLUGIN_OPTION_NO_COMMENTS: 'false' })).stdout, '')
})

test("a Cursor conversation is linked to its flow by postToolUse, and the guard then holds in it", async () => {
  const s = setup()
  const ran = (await s.feed(devflow, ['flow', 'new', 'feature', 'CSV export'], '', {}, s.project)).stdout
  assert.match(ran, /^csv-export\t/)
  const command = 'node "/runtime/scripts/devflow.mjs" flow new feature CSV export'
  const post = (conversation, c, output) => s.feed(devflow, ['track', '--agent', 'cursor'], {
    ...common(conversation, s.sub, s.project),
    hook_event_name: 'postToolUse',
    tool_name: 'Shell',
    tool_input: { command: c },
    tool_output: JSON.stringify({ exitCode: 0, stdout: output }),
    tool_use_id: 'call-2',
    duration: 120
  })
  const push = conversation => s.feed(guard, ['--agent', 'cursor'], {
    ...common(conversation, s.sub, s.project),
    hook_event_name: 'preToolUse',
    tool_name: 'Shell',
    tool_input: { command: 'git push' }
  })

  assert.equal(JSON.parse((await push('conv-9')).stdout).permission, 'allow')
  const tracked = await post('conv-9', command, ran)
  assert.equal(tracked.code, 0)
  assert.equal(fs.readFileSync(path.join(s.project, '.devflow', 'sessions', 'conv-9'), 'utf8'), 'csv-export\n')
  assert.equal(JSON.parse((await push('conv-9')).stdout).permission, 'deny')
  assert.equal(JSON.parse((await push('conv-10')).stdout).permission, 'allow')

  await post('conv-11', 'git status', '')
  assert.ok(!fs.existsSync(path.join(s.project, '.devflow', 'sessions', 'conv-11')))
})
