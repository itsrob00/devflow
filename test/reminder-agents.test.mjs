import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { devflow as script } from './helpers.mjs'

const WORDING = {
  codex: ['$devflow-continue in Codex CLI', 'env'],
  cursor: ['/devflow-continue in Cursor', 'flag'],
  opencode: ['@devflow-continue in OpenCode', 'env']
}

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

for (const [agent, [wording, how]] of Object.entries(WORDING)) {
  test(`the reminder on ${agent} names that agent's own way to run continue, and points at the installed start skill by name`, () => {
    const out = reminder(agent, how)
    const reply = JSON.parse(out)
    const context = reply.hookSpecificOutput?.additionalContext ?? reply.additional_context
    assert.ok(context.includes(`(${wording}). When the user asks to keep going without it, use the devflow-start skill `), out)
    assert.ok(!out.includes('Claude Code'), out)
    assert.ok(!out.includes('CLAUDE_PLUGIN_ROOT'), out)
  })
}

test('the reminder on the original host names /devflow:continue, and points at the start skill file with the plugin root', () => {
  const reply = JSON.parse(reminder('claude-code', 'env'))
  assert.equal(reply.systemMessage, "devflow: 1 unfinished flow here (Cart total). Run devflow's continue skill to pick one up (/devflow:continue in Claude Code).")
  const plugin = path.dirname(path.dirname(script))
  assert.ok(reply.hookSpecificOutput.additionalContext.includes(`read ${path.join(plugin, 'skills', 'start', 'SKILL.md')} and follow it (in devflow's files, \${CLAUDE_PLUGIN_ROOT} means ${plugin})`))
})
