// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../plugin/scripts/devflow.mjs', import.meta.url))
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-flows-'))
const run = (root, ...args) => execFileSync('node', [script, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root } })
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

test('a saved flow lists with its step and next ticket, and show reads only that flow', () => {
  const root = tmp()
  assert.equal(run(root, 'flows'), 'none\n')
  assert.match(run(root, 'flow', 'new', 'feature', 'CSV export on reports'), /^csv-export-on-reports\t\.devflow\/flows\/csv-export-on-reports\n$/)
  assert.equal(fs.readFileSync(path.join(root, '.devflow', '.gitignore'), 'utf8'), '*\n')
  run(root, 'flow', 'new', 'bug', 'Cart total ignores quantity')
  write(path.join(root, '.scratch', 'csv', 'issues', '01-a.md'), '# 01: a\n\n**Status:** done\n')
  write(path.join(root, '.scratch', 'csv', 'issues', '02-b.md'), '# 02: b\n\n**Status:** ready-for-agent\n')
  run(root, 'flow', 'set', 'csv-export-on-reports', 'tickets=.scratch/csv/issues', 'step=4. Shape')
  write(path.join(root, '.devflow', 'flows', 'csv-export-on-reports', 'handoff.md'), '# CSV\n\nfilters next\n')

  const list = run(root, 'flows')
  assert.match(list, /^1\. csv-export-on-reports · Feature · step 4\. Shape · .* · CSV export on reports\n {3}next ticket: \.scratch\/csv\/issues\/02-b\.md \(1 of 2 open; check its blockers\)$/m)
  assert.match(list, /^2\. cart-total-ignores-quantity · Bug · step 1\. History /m)
  assert.doesNotMatch(list, /Not saved/)

  const show = run(root, 'flow', 'show', 'csv-export-on-reports')
  assert.match(show, /this flow only/)
  assert.match(show, /next ticket: \.scratch\/csv\/issues\/02-b\.md/)
  assert.match(show, /filters next/)
  assert.doesNotMatch(show, /cart/i)

  run(root, 'flow', 'done', 'cart-total-ignores-quantity')
  assert.doesNotMatch(run(root, 'flows'), /cart/)
})

test('ticket folders no flow points at are listed with the command that continues them', () => {
  const root = tmp()
  write(path.join(root, '.scratch', 'old', 'issues', '01-x.md'), '# 01: x\n\nStatus: ready-for-agent\n')
  write(path.join(root, '.scratch', 'shipped', 'issues', '01-y.md'), '# 01: y\n\nStatus: resolved\n')
  const out = run(root, 'flows')
  assert.match(out, /Not saved as flows/)
  assert.match(out, /^1\. tickets · .* old: 1 of 1 open\n {3}\/devflow:start ticket \.scratch\/old\/issues\/01-x\.md$/m)
  assert.doesNotMatch(out, /shipped/)
})

test('flows survives broken state, keeps ids to their folders, and refuses paths outside .devflow/flows', () => {
  const root = tmp()
  run(root, 'flow', 'new', 'small', 'Rename tab')
  const dir = path.join(root, '.devflow', 'flows')
  fs.cpSync(path.join(dir, 'rename-tab'), path.join(dir, 'copy'), { recursive: true })
  write(path.join(dir, 'bad', 'state.json'), '{bad')
  write(path.join(dir, 'odd', 'state.json'), '[]')
  write(path.join(dir, 'old', 'state.json'), '{"flow":"bug"}')
  write(path.join(root, 'outside', 'state.json'), '{"flow":"bug"}')

  const out = run(root, 'flows')
  assert.match(out, /^\d\. copy · Small/m)
  assert.match(out, /^\d\. old · Bug · step 1\. History · \d{4}-\d\d-\d\d · old$/m)
  assert.match(out, /unreadable: bad: .*isn't valid JSON/)
  assert.match(out, /unreadable: odd: .*doesn't name a flow/)

  run(root, 'flow', 'set', 'copy', 'step=2', 'flow=feature', 'next=a=b')
  const copy = JSON.parse(fs.readFileSync(path.join(dir, 'copy', 'state.json'), 'utf8'))
  assert.equal(copy.step, '2')
  assert.equal(copy.flow, 'feature')
  assert.equal(copy.next, 'a=b')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'rename-tab', 'state.json'), 'utf8')).step, '1. Small')

  assert.throws(() => run(root, 'flow', 'show', '../../outside'), /no saved flow/)
  assert.throws(() => run(root, 'flow', 'set', 'copy', 'flow=huge'), /flow must be one of/)
  assert.throws(() => run(root, 'flow', 'set', 'copy'), /usage/)
})

test('a ticket file saves as its folder, and blocked or numbered tickets come in the right order', () => {
  const root = tmp()
  run(root, 'flow', 'new', 'feature', 'Ünïcode café export')
  const issues = path.join(root, '.scratch', 'u', 'issues')
  write(path.join(issues, '1-a.md'), '# a\n\n- **Status:** `done`\n')
  write(path.join(issues, '2-b.md'), '# b\n\nStatus: blocked by 10\n')
  write(path.join(issues, '10-c.md'), '# c\n\n**Status:** ready-for-agent\n\nDone when it ships.\n')
  run(root, 'flow', 'set', 'unicode-cafe-export', 'tickets=.scratch/u/issues/1-a.md')
  const out = run(root, 'flows')
  assert.match(out, /next ticket: \.scratch\/u\/issues\/10-c\.md \(2 of 3 open; check its blockers\)/)
  assert.doesNotMatch(out, /Not saved/)
})

test('temp-folder handoffs count only when they name this project, and move into a flow', () => {
  const root = tmp()
  write(path.join(root, 'h1.md'), `# Mine\n\nhandoff for ${root}/src\n`)
  write(path.join(root, 'h2.md'), `# Sibling\n\nhandoff for ${root}-other/src\n`)
  const out = run(root, 'flows')
  assert.match(out, /handoff in the temp folder · .* · Mine/)
  assert.doesNotMatch(out, /Sibling/)
  run(root, 'flow', 'new', 'big', 'Mine')
  run(root, 'flow', 'handoff', 'mine', path.join(root, 'h1.md'))
  assert.doesNotMatch(run(root, 'flows'), /temp folder/)
  assert.match(run(root, 'flow', 'show', 'mine'), /# Handoff from the last session[\s\S]*handoff for/)
})

test('the session-start reminder names unfinished flows, and stays quiet without any', () => {
  const root = tmp()
  assert.equal(run(root, 'reminder'), '')
  run(root, 'flow', 'new', 'bug', 'Cart total')
  run(root, 'flow', 'new', 'small', 'Rename tab')
  run(root, 'flow', 'done', 'rename-tab')
  const out = JSON.parse(run(root, 'reminder'))
  assert.equal(out.systemMessage, 'devflow: 1 unfinished flow here (Cart total). Run /devflow:continue to pick one up.')
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(out.hookSpecificOutput.additionalContext, /\/devflow:continue/)
})
