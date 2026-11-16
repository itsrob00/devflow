import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const skills = fileURLToPath(new URL('../plugin/skills/', import.meta.url))

function texts () {
  const out = {}
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name)
      if (e.isDirectory()) walk(file)
      else if (e.name.endsWith('.md')) out[path.relative(skills, file).split(path.sep).join('/')] = fs.readFileSync(file, 'utf8')
    }
  }
  walk(skills)
  return out
}

const HOST_ONLY = /AskUserQuestion|TodoWrite|Skill tool|\/clear|\/plugin|\/devflow:/

test('devflow skill texts name a host-only tool or command only beside the Claude Code way to do the step', () => {
  const all = texts()
  assert.ok(Object.keys(all).length >= 7)
  for (const [name, text] of Object.entries(all)) {
    text.split('\n').forEach((line, i) => {
      if (!HOST_ONLY.test(line)) return
      assert.match(line, /Claude Code/, `${name}:${i + 1} names a host-only tool or command: ${line.trim()}`)
    })
  }
})

test("the start skill keeps $ARGUMENTS as a hint and takes the task from the user's message when it is empty or unfilled", () => {
  const start = texts()['start/SKILL.md']
  assert.match(start, /\$ARGUMENTS/)
  assert.match(start, /user's message/)
})

test('only the start skill can start by itself, and every other skill waits to be named', () => {
  for (const [name, text] of Object.entries(texts())) {
    if (!name.endsWith('/SKILL.md')) continue
    if (name === 'start/SKILL.md') assert.doesNotMatch(text, /^disable-model-invocation:/m)
    else assert.match(text, /^disable-model-invocation: true$/m, name)
  }
})

test('every skill a flow names exists, and only flow files and the start skill name another skill by its file', () => {
  const all = texts()
  const skills = new Set(Object.keys(all).filter(n => n.endsWith('/SKILL.md')).map(n => n.split('/')[0]))
  for (const flow of ['small', 'feature', 'bug', 'big']) {
    const text = all[`start/flows/${flow}.md`]
    assert.ok(text, flow)
    for (const [, name] of text.matchAll(/`([a-z]+)`/g)) assert.ok(skills.has(name), `${flow}.md names ${name}`)
  }
  for (const [name, text] of Object.entries(all)) {
    if (name.startsWith('start/')) continue
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT|skills\/[a-z]+\/SKILL\.md/, name)
  }
})

test('each flow with a plan stops once for the go, and the small change has no stop', () => {
  const all = texts()
  for (const flow of ['feature', 'big']) assert.match(all[`start/flows/${flow}.md`], /wait for the user's go/, flow)
  assert.match(all['start/flows/bug.md'], /only for a fix that is more than a small change/)
  assert.match(all['start/flows/small.md'], /No plan and no stop/)
  assert.match(all['start/flows/big.md'], /No pull request per ticket/)
})
