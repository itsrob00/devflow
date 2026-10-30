// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { check } from '../plugin/scripts/devflow-guard.mjs'
import { allowed, blocked } from './guard-cases.mjs'
import { askAll, feed, guard, sandbox, write } from './helpers.mjs'

test('blocks commands that lose work or leave the machine', () => {
  for (const c of blocked) assert.ok(check(c), `should block: ${JSON.stringify(c)}`)
})

test('allows everything else', () => {
  for (const c of allowed) assert.equal(check(c), null, `should allow: ${JSON.stringify(c)}`)
})

test('the hook only blocks in a conversation on an unfinished flow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-guard-'))
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: root }
  delete env.DEVFLOW_GUARD
  const push = session => execFileSync('node', [guard], { env, encoding: 'utf8', input: JSON.stringify({ session_id: session, cwd: root, tool_name: 'Bash', tool_input: { command: 'git push' } }) })

  assert.equal(push('s1'), '')
  write(path.join(root, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active' }))
  assert.equal(push('s1'), '')
  write(path.join(root, '.devflow', 'sessions', 's1'), 'cart\n')
  assert.match(push('s1'), /"permissionDecision":"deny"/)
  assert.equal(push('s2'), '')
  write(path.join(root, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'done' }))
  assert.equal(push('s1'), '')
})

function flowSandbox (session) {
  const s = sandbox({ name: 'devflow-guard' })
  s.link(session, 'cart', { flow: 'feature', status: 'active' })
  fs.mkdirSync(s.sub, { recursive: true })
  return s
}

test('fed Codex\'s hook payload with no Claude env vars, the guard blocks every case above and allows the rest, in Codex\'s reply format', async () => {
  const s = flowSandbox('019a-codex-thread')
  const ask = (command, extra = {}) => feed(guard, ['--agent', 'codex'], {
    session_id: '019a-codex-thread',
    turn_id: 'turn-1',
    transcript_path: path.join(s.home, '.codex', 'sessions', 'rollout.jsonl'),
    cwd: s.sub,
    hook_event_name: 'PreToolUse',
    model: 'gpt-5.6',
    permission_mode: 'default',
    tool_name: 'Bash',
    tool_input: { command },
    tool_use_id: 'call_1',
    ...extra
  }, { env: s.env })

  const denied = await askAll(blocked, c => ask(c))
  denied.forEach((r, i) => {
    assert.equal(r.code, 0, `should exit 0: ${JSON.stringify(blocked[i])}`)
    const out = JSON.parse(r.stdout || 'null')
    assert.equal(out?.hookSpecificOutput?.hookEventName, 'PreToolUse', `should block: ${JSON.stringify(blocked[i])}`)
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny')
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /^devflow git guard: .*\. Don't work around it; give the user the exact command to run\.$/)
  })
  const passed = await askAll(allowed, c => ask(c))
  passed.forEach((r, i) => {
    assert.equal(r.code, 0)
    assert.equal(r.stdout, '', `should allow: ${JSON.stringify(allowed[i])}`)
  })

  assert.equal((await ask('git push', { tool_name: 'apply_patch' })).stdout, '')
  assert.equal((await ask('git push', { session_id: 'someone-else' })).stdout, '')
  assert.equal((await ask('git push', { cwd: s.root })).stdout, '')
})

test('Pi\'s powershell tool is guarded like bash, with every blocked case and none of the allowed ones', async () => {
  const s = flowSandbox('pi-session')
  const ask = (tool, command) => feed(guard, ['--agent', 'pi'], { session_id: 'pi-session', cwd: s.sub, hook_event_name: 'tool_call', tool_name: tool, tool_input: { command } }, { env: s.env })

  for (const tool of ['bash', 'powershell']) {
    const denied = await askAll(blocked, c => ask(tool, c))
    denied.forEach((r, i) => {
      const reply = JSON.parse(r.stdout || 'null')
      assert.equal(reply?.block, true, `${tool} should block: ${JSON.stringify(blocked[i])}`)
      assert.match(reply.reason, /^devflow git guard: /)
    })
    const passed = await askAll(allowed, c => ask(tool, c))
    passed.forEach((r, i) => assert.equal(r.stdout, '', `${tool} should allow: ${JSON.stringify(allowed[i])}`))
  }
  assert.equal((await ask('Bash', 'git push')).stdout, '')
  assert.equal((await ask('read', 'git push')).stdout, '')
})
