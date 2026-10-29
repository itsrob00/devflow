// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../plugin/scripts/devflow.mjs', import.meta.url))
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const bare = home => {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) if (!/^CLAUDE/.test(k) && k !== 'DEVFLOW_GUARD') env[k] = v
  return { ...env, HOME: home, USERPROFILE: home, TMPDIR: home, TMP: home, TEMP: home }
}
const settings = (cwd, env) => execFileSync('node', [script, 'settings'], { cwd, env, encoding: 'utf8' })

const DEFAULTS = 'git guard: on\nno code comments: on\nmulti-model review: risky changes\nsmall changes: poteto-mode\nsession review: reflect\n'

test('a user settings file changes the settings in use', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-settings-'))
  const project = path.join(home, 'project')
  fs.mkdirSync(project)
  assert.equal(settings(project, bare(home)), DEFAULTS)
  write(path.join(home, '.config', 'devflow', 'settings.json'), JSON.stringify({ adversarial_review: 'always', small_changes: 'direct', no_comments: false }))
  assert.equal(settings(project, bare(home)), 'git guard: on\nno code comments: off\nmulti-model review: always\nsmall changes: direct\nsession review: reflect\n')
})

test('a project settings file overrides the user file, and the host plugin options override both on the host', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-settings-'))
  const project = path.join(home, 'project')
  fs.mkdirSync(project)
  write(path.join(home, '.config', 'devflow', 'settings.json'), JSON.stringify({ adversarial_review: 'always', small_changes: 'direct' }))
  write(path.join(project, '.devflow', 'settings.json'), JSON.stringify({ adversarial_review: 'never', after_session: 'retro' }))
  assert.equal(settings(project, bare(home)), 'git guard: on\nno code comments: on\nmulti-model review: never\nsmall changes: direct\nsession review: retro\n')

  write(path.join(home, '.claude', 'settings.json'), JSON.stringify({ pluginConfigs: { 'devflow@devflow': { options: { adversarial_review: 'always' } } } }))
  assert.match(settings(project, bare(home)), /^multi-model review: always$/m)
  assert.match(settings(project, { ...bare(home), CLAUDE_PLUGIN_OPTION_AFTER_SESSION: 'reflect' }), /^session review: reflect$/m)
  assert.match(settings(project, { ...bare(home), CLAUDE_PLUGIN_OPTION_AFTER_SESSION: '' }), /^session review: retro$/m)
})

test('a malformed settings file or value falls back to the layer below without an error', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-settings-'))
  const project = path.join(home, 'project')
  const user = path.join(home, '.config', 'devflow', 'settings.json')
  const local = path.join(project, '.devflow', 'settings.json')
  write(user, '{bad')
  write(local, '[]')
  assert.equal(settings(project, bare(home)), DEFAULTS)
  write(local, 'null')
  assert.equal(settings(project, bare(home)), DEFAULTS)
  write(user, JSON.stringify({ small_changes: 'direct' }))
  write(local, JSON.stringify({ small_changes: 'sometimes', adversarial_review: 3, unknown: 'x' }))
  const r = spawnSync('node', [script, 'settings'], { cwd: project, env: bare(home), encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.equal(r.stderr, '')
  assert.equal(r.stdout, 'git guard: on\nno code comments: on\nmulti-model review: risky changes\nsmall changes: direct\nsession review: reflect\n')
})

test('settings, doctor, flows and the hooks give the same results from a project subfolder with no host env vars', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-root-'))
  const project = path.join(home, 'project')
  const sub = path.join(project, 'src', 'deep')
  fs.mkdirSync(sub, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: project })
  const env = bare(home)
  const run = (cwd, args, input) => execFileSync('node', [script, ...args], { cwd, env, encoding: 'utf8', input: input === undefined ? '' : JSON.stringify(input) })
  write(path.join(project, '.devflow', 'settings.json'), JSON.stringify({ adversarial_review: 'never', no_comments: false }))
  run(project, ['flow', 'new', 'feature', 'CSV export'])

  for (const args of [['settings'], ['doctor'], ['doctor', 'feature'], ['flows'], ['reminder'], ['rules']]) {
    assert.equal(run(sub, args), run(project, args), `devflow ${args.join(' ')}`)
  }
  assert.match(run(sub, ['settings']), /^multi-model review: never$/m)
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
  const guard = fileURLToPath(new URL('../plugin/scripts/devflow-guard.mjs', import.meta.url))
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
