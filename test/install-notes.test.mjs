// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sandbox } from './helpers.mjs'

test('a Codex install says its hooks run only once trusted in /hooks, and a project install also names trusting the project', () => {
  const s = sandbox({ name: 'devflow-notes' })
  const user = s.run('install', '--agent', 'codex')
  assert.equal(user.status, 0, user.stderr)
  assert.match(user.stdout, /\/hooks/)
  assert.match(user.stdout, /trust/)
  assert.match(user.stdout, /after each devflow update/)
  const project = s.runProject('install', '--agent', 'codex', '--project')
  assert.equal(project.status, 0, project.stderr)
  assert.match(project.stdout, /\/hooks/)
  assert.match(project.stdout, /trust this project/)
})

test('an OpenCode install says the plugin needs OpenCode 2 and how to upgrade', () => {
  const s = sandbox({ name: 'devflow-notes' })
  const r = s.run('install', '--agent', 'opencode')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /OpenCode 2/)
  assert.match(r.stdout, /opencode upgrade --major/)
})

test('a Cursor user install points to --project in case Cursor skips the home-folder rule, and a project install does not', () => {
  const s = sandbox({ name: 'devflow-notes' })
  const user = s.run('install', '--agent', 'cursor')
  assert.equal(user.status, 0, user.stderr)
  assert.match(user.stdout, /--project/)
  const project = s.runProject('install', '--agent', 'cursor', '--project')
  assert.equal(project.status, 0, project.stderr)
  assert.doesNotMatch(project.stdout, /--project/)
})
