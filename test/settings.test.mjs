// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { devflow as script, guard, write } from './helpers.mjs'

const bare = home => {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!/^CLAUDE/.test(k) && k !== 'DEVFLOW_GUARD') env[k] = v
  return { ...env, HOME: home, USERPROFILE: home, TMPDIR: home, TMP: home, TEMP: home }
}
const settings = (cwd, env) => execFileSync('node', [script, 'settings'], { cwd, env, encoding: 'utf8' })

const out = ({ comments = 'on', auto = 'on', review = 'risky changes', count = 3, model = 'auto (simple tickets: claude-sonnet-5-5, complex tickets: claude-opus-5-5)', tracker = 'auto (from the git remote)' } = {}) =>
  `git guard: on\nno code comments: ${comments}\nautomatic flows: ${auto}\nadversarial review: ${review}\nsubagents at once: ${count}\nsubagent model: ${model}\nstrong model: claude-opus-5-5\ntracker: ${tracker}\n`

const fresh = () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-settings-'))
  const project = path.join(home, 'project')
  fs.mkdirSync(project)
  return { home, project, user: path.join(home, '.config', 'devflow', 'settings.json'), local: path.join(project, '.devflow', 'settings.json') }
}

test('a user settings file changes the settings in use', () => {
  const { home, project, user } = fresh()
  assert.equal(settings(project, bare(home)), out())
  write(user, JSON.stringify({ adversarial_review: 'always', no_comments: false, auto_flows: false, subagent_count: 5, subagent_model: 'haiku', tracker: 'files' }))
  assert.equal(settings(project, bare(home)), out({ comments: 'off', auto: 'off', review: 'always', count: 5, model: 'haiku', tracker: 'files' }))
})

test('the subagent count takes whole numbers from 1, as a number or text, and stops at 10', () => {
  const { home, project, user, local } = fresh()
  write(user, JSON.stringify({ subagent_count: '4' }))
  assert.match(settings(project, bare(home)), /^subagents at once: 4$/m)
  for (const bad of [0, -2, 1.5, 'many', true]) {
    write(local, JSON.stringify({ subagent_count: bad }))
    assert.match(settings(project, bare(home)), /^subagents at once: 4$/m, String(bad))
  }
  write(local, JSON.stringify({ subagent_count: 50 }))
  assert.match(settings(project, bare(home)), /^subagents at once: 10$/m)
  assert.match(settings(project, { ...bare(home), CLAUDE_PLUGIN_OPTION_SUBAGENT_COUNT: '2' }), /^subagents at once: 2$/m)
})

test('a project settings file overrides the user file, and the host plugin options override both on the host', () => {
  const { home, project, user, local } = fresh()
  write(user, JSON.stringify({ adversarial_review: 'always', subagent_model: 'haiku' }))
  write(local, JSON.stringify({ adversarial_review: 'never', tracker: 'gitlab' }))
  assert.equal(settings(project, bare(home)), out({ review: 'never', model: 'haiku', tracker: 'gitlab' }))

  write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ pluginConfigs: { 'devflow@devflow': { options: { adversarial_review: 'always' } } } }))
  assert.match(settings(project, bare(home)), /^adversarial review: always$/m)
  assert.match(settings(project, { ...bare(home), CLAUDE_PLUGIN_OPTION_TRACKER: 'files' }), /^tracker: files$/m)
  assert.match(settings(project, { ...bare(home), CLAUDE_PLUGIN_OPTION_TRACKER: '' }), /^tracker: gitlab$/m)
})

test('a malformed settings file or value falls back to the layer below without an error', () => {
  const { home, project, user, local } = fresh()
  write(user, '{bad')
  write(local, '[]')
  assert.equal(settings(project, bare(home)), out())
  write(local, 'null')
  assert.equal(settings(project, bare(home)), out())
  write(user, JSON.stringify({ tracker: 'files' }))
  write(local, JSON.stringify({ tracker: 'jira', adversarial_review: 3, subagent_model: '  ', unknown: 'x', grilling: 'full' }))
  const r = spawnSync('node', [script, 'settings'], { cwd: project, env: bare(home), encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(r.stderr, '')
  assert.equal(r.stdout, out({ tracker: 'files' }))
})

test('settings, flows and the hooks give the same results from a project subfolder with no host env vars', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-root-'))
  const project = path.join(home, 'project')
  const sub = path.join(project, 'src', 'deep')
  fs.mkdirSync(sub, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: project })
  const env = bare(home)
  const run = (cwd, args, input) => execFileSync('node', [script, ...args], { cwd, env, encoding: 'utf8', input: input === undefined ? '' : JSON.stringify(input) })
  write(path.join(project, '.devflow', 'settings.json'), JSON.stringify({ adversarial_review: 'never', no_comments: false, auto_flows: false }))
  run(project, ['flow', 'new', 'feature', 'CSV export'])

  for (const args of [['settings'], ['flows'], ['reminder'], ['rules']]) {
    assert.equal(run(sub, args), run(project, args), `devflow ${args.join(' ')}`)
  }
  assert.match(run(sub, ['settings']), /^adversarial review: never$/m)
  assert.match(run(sub, ['flows']), /^1\. csv-export · Feature/m)
  assert.match(JSON.parse(run(sub, ['reminder'])).systemMessage, /1 unfinished flow here \(CSV export\)/)
  assert.equal(run(sub, ['rules']), '')

  run(sub, ['track'], { session_id: 's1', cwd: sub, tool_name: 'Bash', tool_input: { command: 'node devflow.mjs flow show csv-export' }, tool_response: { stdout: '' } })
  assert.ok(fs.existsSync(path.join(project, '.devflow', 'sessions', 's1')))
  assert.match(run(sub, ['active'], { session_id: 's1', cwd: sub, hook_event_name: 'UserPromptSubmit' }), /on flow csv-export/)
  assert.match(run(home, ['active'], { session_id: 's1', cwd: sub, hook_event_name: 'UserPromptSubmit' }), /on flow csv-export/)
  assert.equal(run(home, ['active'], { session_id: 's1', hook_event_name: 'UserPromptSubmit' }), '')
})

test('a repo cannot turn the git guard off, but the user file can, and the guard reads the project its payload names', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-guard-'))
  const project = path.join(home, 'project')
  const sub = path.join(project, 'src')
  fs.mkdirSync(sub, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: project })
  for (const root of [project, home]) {
    write(path.join(root, '.devflow', 'sessions', 's1'), 'cart\n')
    write(path.join(root, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ status: 'active' }))
  }
  const push = cwd => execFileSync('node', [guard], { cwd: home, env: bare(home), encoding: 'utf8', input: JSON.stringify({ cwd, session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push' } }) })
  assert.equal(JSON.parse(push(sub)).hookSpecificOutput.permissionDecision, 'deny')
  write(path.join(project, '.devflow', 'settings.json'), JSON.stringify({ git_guard: false, no_comments: false }))
  assert.equal(JSON.parse(push(sub)).hookSpecificOutput.permissionDecision, 'deny')
  assert.match(execFileSync('node', [script, 'settings'], { cwd: project, env: bare(home), encoding: 'utf8' }), /^git guard: on\nno code comments: off$/m)
  assert.match(execFileSync('node', [script, 'settings'], { cwd: home, env: bare(home), encoding: 'utf8' }), /^no code comments: on$/m)
  write(path.join(home, '.config', 'devflow', 'settings.json'), JSON.stringify({ git_guard: false }))
  assert.equal(push(sub), '')
  assert.equal(push(home), '')
})
