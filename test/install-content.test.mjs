// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { sandbox, tree } from './helpers.mjs'

const AGENTS = ['codex', 'cursor', 'opencode']

const INSTRUCTIONS = {
  codex: { user: ['.codex', 'AGENTS.md'], project: ['AGENTS.md'] },
  cursor: { user: ['.cursor', 'rules', 'devflow.mdc'], project: ['.cursor', 'rules', 'devflow.mdc'] },
  opencode: { user: ['.config', 'opencode', 'AGENTS.md'], project: ['AGENTS.md'] }
}

const guardLine = text => text.split('\n').find(l => /^- Git guard/.test(l))

for (const agent of AGENTS) {
  const always = agent === 'codex'
  test(`the instructions installed for ${agent} say the git guard is ${always ? 'on in every session' : 'on while a flow is running'}`, () => {
    const s = sandbox({ name: 'devflow-content' })
    assert.equal(s.run('install', '--agent', agent).status, 0)
    const line = guardLine(fs.readFileSync(path.join(s.home, ...INSTRUCTIONS[agent].user), 'utf8'))
    assert.ok(line, 'a git guard bullet')
    assert.match(line, /git push/)
    if (always) {
      assert.match(line, /every session/)
      assert.doesNotMatch(line, /while a (devflow )?flow is running/)
    } else {
      assert.match(line, /^- Git guard, while a flow is running:/)
    }
  })
}

test('a project install of codex says every session, and one of cursor, which has no backstop, says while a flow is running', () => {
  const s = sandbox({ name: 'devflow-content' })
  assert.equal(s.runProject('install', '--agent', 'codex', '--project').status, 0)
  assert.match(guardLine(fs.readFileSync(path.join(s.project, 'AGENTS.md'), 'utf8')), /every session/)
  assert.equal(s.runProject('install', '--agent', 'cursor', '--project').status, 0)
  assert.match(guardLine(fs.readFileSync(path.join(s.project, '.cursor', 'rules', 'devflow.mdc'), 'utf8')), /^- Git guard, while a flow is running:/)
})

const SKILLS = { codex: '.codex/skills', cursor: '.cursor/skills', opencode: '.config/opencode/skills' }

for (const agent of AGENTS) {
  test(`no skill installed for ${agent} carries the Claude Code argument hint or names Claude Code as the way to run a step`, () => {
    const s = sandbox({ name: 'devflow-content' })
    assert.equal(s.run('install', '--agent', agent).status, 0)
    const dir = path.join(s.home, ...SKILLS[agent].split('/'))
    const files = Object.entries(tree(dir)).filter(([, text]) => text !== null)
    assert.equal(files.length, 7)
    for (const [file, text] of files) {
      assert.doesNotMatch(text, /\$ARGUMENTS/, file)
      assert.doesNotMatch(text, /argument-hint/, file)
      assert.doesNotMatch(text, /in Claude Code/, file)
    }
    for (const entry of ['start', 'continue', 'wrap']) {
      const text = fs.readFileSync(path.join(dir, `devflow-${entry}`, 'SKILL.md'), 'utf8')
      assert.match(text, /^---\r?\nname: devflow-/)
      assert.match(text, /^(The task is in|Take it from|Take the request from) the user's message/m, entry)
    }
  })
}
