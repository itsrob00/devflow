// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { scripts, write } from './helpers.mjs'

function sandbox () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-agents-'))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(home)
  fs.mkdirSync(path.join(project, '.git'), { recursive: true })
  const base = {}
  for (const [k, v] of Object.entries(process.env)) if (!/^CLAUDE/.test(k) && !/^DEVFLOW_/.test(k)) base[k] = v
  const env = { ...base, HOME: home, USERPROFILE: home, TMPDIR: home, TMP: home, TEMP: home }
  const run = (extra, ...args) => {
    const r = spawnSync(process.execPath, [path.join(scripts, 'devflow.mjs'), ...args], { cwd: project, env: { ...env, ...extra }, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout
  }
  return { root, home, project, env, run }
}

const model = out => /^subagent model: (.*)$/m.exec(out)[1]

test('auto names the fast and strong model of the agent devflow runs on, and a set model is used as it is', () => {
  const s = sandbox()
  assert.equal(model(s.run({}, 'settings')), 'auto (simple tickets: claude-sonnet-5-5, complex tickets: claude-opus-5-5)')
  assert.equal(model(s.run({ DEVFLOW_AGENT: 'codex' }, 'settings')), 'auto (simple tickets: gpt-6.1-terra, complex tickets: gpt-6-astra)')
  assert.equal(model(s.run({ DEVFLOW_AGENT: 'opencode' }, 'settings')), 'auto (simple tickets: anthropic/claude-sonnet-5-5, complex tickets: anthropic/claude-opus-5-5)')
  assert.match(s.run({ DEVFLOW_AGENT: 'codex' }, 'settings'), /^strong model: gpt-6-astra$/m)
  write(path.join(s.home, '.config', 'devflow', 'settings.json'), JSON.stringify({ subagent_model: 'haiku' }))
  assert.equal(model(s.run({ DEVFLOW_AGENT: 'cursor' }, 'settings')), 'haiku')
})

test('the host plugin options apply only on the host', () => {
  const s = sandbox()
  const opts = { CLAUDE_PLUGIN_OPTION_SUBAGENT_MODEL: 'opus' }
  assert.match(model(s.run({ ...opts, DEVFLOW_AGENT: 'opencode' }, 'settings')), /^auto /)
  assert.equal(model(s.run(opts, 'settings')), 'opus')
})

test('a script copied into a runtime folder takes its agent from the agent.json one folder above', () => {
  const s = sandbox()
  const runtime = path.join(s.root, 'runtime')
  fs.cpSync(scripts, path.join(runtime, 'scripts'), { recursive: true })
  const run = (env = s.env) => {
    const r = spawnSync(process.execPath, [path.join(runtime, 'scripts', 'devflow.mjs'), 'settings'], { cwd: s.project, env, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return model(r.stdout)
  }
  assert.match(run(), /claude-opus-5-5\)$/)
  write(path.join(runtime, 'agent.json'), JSON.stringify({ agent: 'codex', scope: 'user' }))
  assert.match(run(), /gpt-6-astra\)$/)
  write(path.join(runtime, 'agent.json'), '{bad')
  assert.match(run(), /claude-opus-5-5\)$/)
  write(path.join(runtime, 'agent.json'), JSON.stringify({ agent: 'opencode', scope: 'user' }))
  assert.match(run(), /anthropic\/claude-opus-5-5\)$/)
  assert.match(run({ ...s.env, DEVFLOW_AGENT: 'codex' }), /gpt-6-astra\)$/)
})
