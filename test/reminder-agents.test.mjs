import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { devflow as script } from './helpers.mjs'

const HOW = { codex: 'env', cursor: 'flag', opencode: 'env' }

function reminder (agent, how) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-reminder-'))
  fs.mkdirSync(path.join(root, '.devflow', 'flows', 'cart'), { recursive: true })
  fs.writeFileSync(path.join(root, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'bug', status: 'active', title: 'Cart total' }))
  const args = [script, 'reminder', ...(how === 'flag' ? ['--agent', agent] : [])]
  const env = { ...process.env, HOME: root, USERPROFILE: root, DEVFLOW_AGENT: how === 'env' ? agent : '' }
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env, input: JSON.stringify({ cwd: root }) })
  assert.equal(r.status, 0)
  return r.stdout
}

for (const [agent, how] of Object.entries(HOW)) {
  test(`the reminder on ${agent} points at the installed start skill by name`, () => {
    const out = reminder(agent, how)
    const reply = JSON.parse(out)
    const context = reply.hookSpecificOutput?.additionalContext ?? reply.additional_context
    assert.match(context, /Say "keep going" to pick one up\. When the user asks to keep going, use the devflow-start skill /)
    assert.ok(!out.includes('Claude Code'), out)
    assert.ok(!out.includes('CLAUDE_PLUGIN_ROOT'), out)
  })
}

test('the reminder on the original host points at the start skill file and says what the plugin root is', () => {
  const reply = JSON.parse(reminder('claude-code', 'env'))
  assert.equal(reply.systemMessage, 'devflow: 1 unfinished flow here (Cart total). Say "keep going" to pick one up.')
  const plugin = path.dirname(path.dirname(script))
  assert.ok(reply.hookSpecificOutput.additionalContext.includes(`read ${path.join(plugin, 'skills', 'start', 'SKILL.md')} and follow it (in devflow's files, \${CLAUDE_PLUGIN_ROOT} means ${plugin})`))
})
