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
  test(`the reminder on ${agent} names that agent's own way to run continue`, () => {
    const out = reminder(agent, how)
    assert.ok(out.includes(`(${wording})`), out)
    assert.ok(!out.includes('Claude Code'), out)
    assert.ok(!out.includes('/devflow:continue'), out)
  })
}

test('the reminder on the original host still names /devflow:continue in Claude Code', () => {
  assert.ok(reminder('claude-code', 'env').includes('(/devflow:continue in Claude Code)'))
})
