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

const HOST_ONLY = /AskUserQuestion|TodoWrite|Skill tool|\/clear|\/plugin|\/devflow:|\/setup-pstack|\/create-verification-skill|\/poteto-mode|restarts Claude Code/

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

test("each entry point keeps $ARGUMENTS as a hint and takes the task from the user's message when it is empty or unfilled", () => {
  const all = texts()
  for (const entry of ['start', 'continue', 'wrap']) {
    const text = all[`${entry}/SKILL.md`]
    assert.match(text, /\$ARGUMENTS/, entry)
    assert.match(text, /user's message/, entry)
  }
  assert.doesNotMatch(all['setup/SKILL.md'], /\$ARGUMENTS/)
})

test('the Big flow names the configured other-family reviewer, and says when no other model family was available', () => {
  const big = texts()['start/flows/big.md']
  assert.match(big, /other model family/)
  assert.match(big, /no other model family was available/)
  assert.doesNotMatch(big, /Claude Code has no other model family/)
})

test('the Big flow and the feature flow tell the agent how to learn whether another model family is available', () => {
  const all = texts()
  for (const name of ['start/flows/big.md', 'start/flows/feature.md']) {
    assert.match(all[name], /devflow pstack-models/, name)
    assert.match(all[name], /other model family: (not )?available/, name)
  }
  assert.match(all['start/flows/big.md'], /other model family\)/)
  assert.match(all['start/flows/big.md'], /no other model family was available\)/)
})

test('the wrap skill handles a handoff-only session review without reading a transcript', () => {
  const wrap = texts()['wrap/SKILL.md']
  assert.match(wrap, /`retro`, `reflect` or `handoff`/)
  assert.match(wrap, /`handoff`[^\n]*no transcript review/)
})
