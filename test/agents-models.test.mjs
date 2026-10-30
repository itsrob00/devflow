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

const review = out => /^session review: (.*)$/m.exec(out)[1]

test('session review defaults to a handoff only on OpenCode, and an explicit setting wins', () => {
  const s = sandbox()
  assert.equal(review(s.run({ DEVFLOW_AGENT: 'opencode' }, 'settings')), 'handoff')
  for (const agent of ['codex', 'cursor', 'claude-code']) assert.equal(review(s.run({ DEVFLOW_AGENT: agent }, 'settings')), 'reflect', agent)
  assert.equal(review(s.run({}, 'settings')), 'reflect')

  const user = path.join(s.home, '.config', 'devflow', 'settings.json')
  write(user, JSON.stringify({ after_session: 'retro' }))
  assert.equal(review(s.run({ DEVFLOW_AGENT: 'opencode' }, 'settings')), 'retro')
  write(user, JSON.stringify({ after_session: 'reflect' }))
  assert.equal(review(s.run({ DEVFLOW_AGENT: 'opencode' }, 'settings')), 'reflect')
  write(path.join(s.project, '.devflow', 'settings.json'), JSON.stringify({ after_session: 'handoff' }))
  assert.equal(review(s.run({ DEVFLOW_AGENT: 'codex' }, 'settings')), 'handoff')
  assert.equal(review(s.run({}, 'settings')), 'handoff')
})

test('the host plugin options set the session review only on the host', () => {
  const s = sandbox()
  const opts = { CLAUDE_PLUGIN_OPTION_AFTER_SESSION: 'retro' }
  assert.equal(review(s.run({ ...opts, DEVFLOW_AGENT: 'opencode' }, 'settings')), 'handoff')
  assert.equal(review(s.run(opts, 'settings')), 'retro')
})

test('a script copied into a runtime folder takes its agent from the agent.json one folder above', () => {
  const s = sandbox()
  const runtime = path.join(s.root, 'runtime')
  fs.cpSync(scripts, path.join(runtime, 'scripts'), { recursive: true })
  const run = (...args) => {
    const r = spawnSync(process.execPath, [path.join(runtime, 'scripts', 'devflow.mjs'), ...args], { cwd: s.project, env: s.env, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    return r.stdout
  }
  assert.equal(review(run('settings')), 'reflect')
  write(path.join(runtime, 'agent.json'), JSON.stringify({ agent: 'codex', scope: 'user' }))
  assert.equal(review(run('settings')), 'reflect')
  write(path.join(runtime, 'agent.json'), '{bad')
  assert.equal(review(run('settings')), 'reflect')
  write(path.join(runtime, 'agent.json'), JSON.stringify({ agent: 'opencode', scope: 'user' }))
  assert.equal(review(run('settings')), 'handoff')
  const override = spawnSync(process.execPath, [path.join(runtime, 'scripts', 'devflow.mjs'), 'settings'], { cwd: s.project, env: { ...s.env, DEVFLOW_AGENT: 'codex' }, encoding: 'utf8' })
  assert.equal(review(override.stdout), 'reflect')
})

test('doctor expects only the skills the session review needs, and none of the reviews for a handoff', () => {
  const s = sandbox()
  const wrap = extra => /^wrap: (.*)$/m.exec(s.run(extra, 'doctor', 'wrap'))[1]
  assert.equal(wrap({}), 'missing reflect, correct, handoff')
  assert.equal(wrap({ DEVFLOW_AGENT: 'opencode' }), 'missing correct, handoff')
  write(path.join(s.project, '.devflow', 'settings.json'), JSON.stringify({ after_session: 'retro' }))
  assert.equal(wrap({ DEVFLOW_AGENT: 'opencode' }), 'missing retro, writing-for-agents, correct, handoff')
})

test('pstack-models writes nothing outside the host and reports per role what runs and what a role maps to', () => {
  const s = sandbox()
  const cursor = s.run({ DEVFLOW_AGENT: 'cursor' }, 'pstack-models')
  assert.match(cursor, /^feature, refactoring: grok-4\.7-xhigh-fast runs on Cursor$/m)
  assert.match(cursor, /^judgment and prose: claude-opus-5-5-xhigh runs on Cursor$/m)
  assert.match(cursor, /^arena runners: claude-opus-5-5-xhigh runs on Cursor; grok-4\.7-xhigh-fast runs on Cursor$/m)
  assert.match(cursor, /^other model family: available$/m)
  assert.doesNotMatch(cursor, /can't run/)

  const codex = s.run({ DEVFLOW_AGENT: 'codex' }, 'pstack-models')
  assert.match(codex, /^feature, refactoring: grok-4\.7-xhigh-fast can't run on Codex CLI; use gpt-6\.1-terra$/m)
  assert.match(codex, /^judgment and prose: claude-opus-5-5-xhigh can't run on Codex CLI; use gpt-6-astra$/m)
  assert.match(codex, /^interrogate reviewers: claude-opus-5-5-xhigh can't run on Codex CLI; use gpt-6-astra; grok-4\.7-xhigh-fast can't run on Codex CLI; use gpt-6\.1-terra$/m)
  assert.match(codex, /^other model family: not available$/m)

  for (const agent of ['cursor', 'codex', 'opencode']) s.run({ DEVFLOW_AGENT: agent }, 'pstack-models')
  assert.deepEqual(fs.readdirSync(s.home), [])
  assert.match(s.run({ DEVFLOW_AGENT: 'opencode' }, 'pstack-models'), /^other model family: available$/m)
})

test("on OpenCode, a model it can't run maps to a provider/model id OpenCode accepts", () => {
  const s = sandbox()
  write(path.join(s.home, '.agents', 'pstack-models.md'), 'bug-fix: composer-2.5\njudgment and prose: composer-2.5-opus\n')
  const out = s.run({ DEVFLOW_AGENT: 'opencode' }, 'pstack-models')
  assert.match(out, /^bug-fix: composer-2\.5 can't run on OpenCode; use anthropic\/claude-sonnet-5-5$/m)
  assert.match(out, /^judgment and prose: composer-2\.5-opus can't run on OpenCode; use anthropic\/claude-opus-5-5$/m)
})

test('pstack-models checks the settings file the agent reads, and keeps aliases as they are', () => {
  const s = sandbox()
  write(path.join(s.home, '.agents', 'pstack-models.md'), '# budget: large (xhigh)\nfeature, refactoring: claude-sonnet-5-5-xhigh\nhow explainer: inherit-parent\narena runners: gemini-3-pro-preview, auto\nbug-fix: grok-4.7-xhigh-fast\n')
  const codex = s.run({ DEVFLOW_AGENT: 'codex' }, 'pstack-models')
  assert.match(codex, /\.agents[\\/]pstack-models\.md/)
  assert.match(codex, /^feature, refactoring: claude-sonnet-5-5-xhigh can't run on Codex CLI; use gpt-6\.1-terra$/m)
  assert.match(codex, /^how explainer: inherit-parent runs on Codex CLI$/m)
  assert.match(codex, /^arena runners: gemini-3-pro-preview can't run on Codex CLI; use gpt-6\.1-terra; auto runs on Codex CLI$/m)
  assert.match(codex, /^bug-fix: grok-4\.7-xhigh-fast can't run on Codex CLI; use gpt-6\.1-terra$/m)
  assert.doesNotMatch(codex, /^judgment and prose/m)
  assert.equal(fs.readFileSync(path.join(s.home, '.agents', 'pstack-models.md'), 'utf8').includes('claude-sonnet-5-5-xhigh'), true)

  write(path.join(s.home, '.cursor', 'rules', 'pstack-models.mdc'), '---\nalwaysApply: true\n---\nbug-fix: grok-4.7-xhigh-fast\n')
  const cursor = s.run({ DEVFLOW_AGENT: 'cursor' }, 'pstack-models')
  assert.match(cursor, /pstack-models\.mdc/)
  assert.match(cursor, /^bug-fix: grok-4\.7-xhigh-fast runs on Cursor$/m)
  assert.doesNotMatch(cursor, /^feature, refactoring/m)
})

test('doctor does not report pstack models as missing outside the host, and still does on the host', () => {
  const s = sandbox()
  const models = out => /^pstack models: .*$/m.exec(out)[0]
  assert.match(models(s.run({}, 'doctor', 'big')), /not set/)
  for (const agent of ['cursor', 'opencode', 'codex']) {
    const line = models(s.run({ DEVFLOW_AGENT: agent }, 'doctor', 'big'))
    assert.doesNotMatch(line, /not set|uses Grok|Run devflow pstack-models/, agent)
    assert.match(line, /pstack's defaults/, agent)
  }
  assert.match(models(s.run({ DEVFLOW_AGENT: 'cursor' }, 'doctor', 'big')), /all run on Cursor/)
  assert.match(models(s.run({ DEVFLOW_AGENT: 'codex' }, 'doctor', 'big')), /can't run on Codex CLI/)
  write(path.join(s.home, '.agents', 'pstack-models.md'), 'judgment and prose: grok-4\n')
  assert.doesNotMatch(models(s.run({ DEVFLOW_AGENT: 'opencode' }, 'doctor', 'big')), /Run devflow pstack-models/)
})

test('off the host, doctor and show name the installer for a missing pack, and on the host they still name /plugin install', () => {
  const s = sandbox()
  const missing = extra => s.run(extra, 'doctor', 'feature')
  for (const agent of ['codex', 'cursor', 'opencode']) {
    const out = missing({ DEVFLOW_AGENT: agent })
    assert.match(out, new RegExp(`install Matt Pocock's skills \\(devflow-matt\\) \\(\\d+ missing\\): npx github:itsrob00/devflow install --agent ${agent}$`, 'm'), agent)
    assert.match(out, new RegExp(`install pstack \\(devflow-pstack\\) \\(\\d+ missing\\): npx github:itsrob00/devflow install --agent ${agent}$`, 'm'), agent)
    assert.doesNotMatch(out, /\/plugin install/, agent)
    const shown = spawnSync(process.execPath, [path.join(scripts, 'devflow.mjs'), 'show', 'tdd'], { cwd: s.project, env: { ...s.env, DEVFLOW_AGENT: agent }, encoding: 'utf8' })
    assert.equal(shown.status, 1)
    assert.match(shown.stdout, new RegExp(`tdd\\tMISSING, install Matt Pocock's skills \\(devflow-matt\\): npx github:itsrob00/devflow install --agent ${agent}`), agent)
  }
  const host = missing({})
  assert.match(host, /: \/plugin install devflow-matt@devflow$/m)
  assert.match(host, /: \/plugin install devflow-pstack@devflow$/m)
  assert.doesNotMatch(host, /npx github/)
})
