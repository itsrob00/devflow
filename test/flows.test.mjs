// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { devflow as script, write } from './helpers.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-flows-'))
const run = (root, ...args) => execFileSync('node', [script, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root } })

const ticket = (n, { blocked = 'none', status = 'open' } = {}) => `# ${n}: ticket ${n}\n\n**What it makes work:** something\n**Blocked by:** ${blocked}\n**Size:** simple\n**Status:** ${status}\n\n- [ ] it works\n`

test('a saved flow lists with its step and ready tickets, and show reads only that flow', () => {
  const root = tmp()
  assert.equal(run(root, 'flows'), 'none\n')
  assert.match(run(root, 'flow', 'new', 'big', 'CSV export on reports'), /^csv-export-on-reports\t\.devflow\/flows\/csv-export-on-reports\n$/)
  assert.equal(fs.readFileSync(path.join(root, '.devflow', '.gitignore'), 'utf8'), '*\n')
  run(root, 'flow', 'new', 'bug', 'Cart total ignores quantity')
  const dir = path.join(root, '.devflow', 'flows', 'csv-export-on-reports')
  write(path.join(dir, 'tickets', '01-a.md'), ticket('01', { status: 'done' }))
  write(path.join(dir, 'tickets', '02-b.md'), ticket('02', { blocked: '01' }))
  write(path.join(dir, 'tickets', '03-c.md'), ticket('03', { blocked: '01, 02' }))
  write(path.join(dir, 'tickets', '04-d.md'), ticket('04'))
  write(path.join(dir, 'plan.md'), '# Plan\n')
  write(path.join(dir, 'decisions.md'), '- utf-8: because\n')
  assert.match(run(root, 'flow', 'set', 'csv-export-on-reports', 'step=5. Build', 'branch=csv-export'), /step=5\. Build, branch=csv-export/)

  const ready = 'ready tickets: 02-b.md, 04-d.md in .devflow/flows/csv-export-on-reports/tickets (3 of 4 open)'
  const list = run(root, 'flows')
  assert.ok(list.includes(`1. csv-export-on-reports · Big · step 5. Build · ${new Date().toISOString().slice(0, 10)} · CSV export on reports\n   ${ready}\n`), list)
  assert.match(list, /^2\. cart-total-ignores-quantity · Bug · step 1\. Diagnose /m)

  const show = run(root, 'flow', 'show', 'csv-export-on-reports')
  assert.match(show, /this flow only/)
  assert.ok(show.includes(ready))
  assert.match(show, /^branch: csv-export$/m)
  assert.match(show, /^plan: \.devflow\/flows\/csv-export-on-reports\/plan\.md$/m)
  assert.match(show, /^decisions: \.devflow\/flows\/csv-export-on-reports\/decisions\.md$/m)
  assert.doesNotMatch(show, /cart/i)
  assert.doesNotMatch(run(root, 'flow', 'show', 'cart-total-ignores-quantity'), /tickets|plan:|decisions:/)

  run(root, 'flow', 'done', 'cart-total-ignores-quantity')
  assert.doesNotMatch(run(root, 'flows'), /cart/)
})

test('tickets that all wait on each other, are all done, or live on the tracker each get their own line', () => {
  const root = tmp()
  run(root, 'flow', 'new', 'big', 'Stuck')
  const dir = path.join(root, '.devflow', 'flows', 'stuck', 'tickets')
  write(path.join(dir, '01-a.md'), ticket('01', { blocked: '#2' }))
  write(path.join(dir, '02-b.md'), ticket('02', { blocked: '1' }))
  assert.match(run(root, 'flow', 'show', 'stuck'), /^tickets: the 2 open in \.devflow\/flows\/stuck\/tickets all wait on another open ticket$/m)
  write(path.join(dir, '01-a.md'), ticket('01', { status: 'done' }))
  write(path.join(dir, '02-b.md'), ticket('02', { blocked: '1', status: 'done' }))
  assert.match(run(root, 'flow', 'show', 'stuck'), /^tickets: all 2 in \.devflow\/flows\/stuck\/tickets are done$/m)

  run(root, 'flow', 'new', 'big', 'Tracked')
  run(root, 'flow', 'set', 'tracked', 'tickets=#41')
  assert.match(run(root, 'flow', 'show', 'tracked'), /^tickets: #41 on the issue tracker; its open tickets with no open blocker are ready$/m)

  run(root, 'flow', 'new', 'big', 'Elsewhere')
  write(path.join(root, 'work', '10-x.md'), ticket('10'))
  write(path.join(root, 'work', '2-y.md'), ticket('2', { blocked: '10' }))
  run(root, 'flow', 'set', 'elsewhere', 'tickets=work')
  assert.match(run(root, 'flow', 'show', 'elsewhere'), /^ready tickets: 10-x\.md in work \(2 of 2 open\)$/m)
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
  assert.match(out, /^\d\. old · Bug · step 1\. Diagnose · \d{4}-\d\d-\d\d · old$/m)
  assert.match(out, /unreadable: bad: .*isn't valid JSON/)
  assert.match(out, /unreadable: odd: .*doesn't name a flow/)

  run(root, 'flow', 'set', 'copy', 'step=2', 'flow=feature', 'next=a=b')
  const copy = JSON.parse(fs.readFileSync(path.join(dir, 'copy', 'state.json'), 'utf8'))
  assert.equal(copy.step, '2')
  assert.equal(copy.flow, 'feature')
  assert.equal(copy.next, 'a=b')
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'rename-tab', 'state.json'), 'utf8')).step, '1. Change')

  assert.throws(() => run(root, 'flow', 'show', '../../outside'), /no saved flow/)
  assert.throws(() => run(root, 'flow', 'set', 'copy', 'flow=huge'), /flow must be one of/)
  assert.throws(() => run(root, 'flow', 'set', 'copy'), /usage/)
  assert.throws(() => run(root, 'flow', 'handoff', 'copy', 'x.md'), /usage/)
  for (const gone of ['show', 'doctor', 'pstack-models']) assert.throws(() => run(root, gone), /usage: devflow settings \| flows \| flow/)
})

test('the session-start reminder names unfinished flows, and stays quiet without any', () => {
  const root = tmp()
  assert.equal(run(root, 'reminder'), '')
  run(root, 'flow', 'new', 'bug', 'Cart total')
  run(root, 'flow', 'new', 'small', 'Rename tab')
  run(root, 'flow', 'done', 'rename-tab')
  const out = JSON.parse(run(root, 'reminder'))
  assert.equal(out.systemMessage, "devflow: 1 unfinished flow here (Cart total). Run devflow's continue skill to pick one up (/devflow:continue in Claude Code).")
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.match(out.hookSpecificOutput.additionalContext, /don't guess the flow or read flow folders yourself/)
})

test('every session gets devflow mode and the no-comments rule, each until its setting is turned off', () => {
  const root = tmp()
  const cfg = path.join(root, 'cfg')
  const env = opts => ({ ...process.env, HOME: root, USERPROFILE: root, CLAUDE_CONFIG_DIR: cfg, CLAUDE_PLUGIN_OPTION_NO_COMMENTS: '', CLAUDE_PLUGIN_OPTION_MODE: '', ...opts })
  const rules = (opts = {}) => execFileSync('node', [script, 'rules'], { cwd: root, encoding: 'utf8', env: env(opts) })
  const context = (opts = {}) => JSON.parse(rules(opts)).hookSpecificOutput.additionalContext
  const mode = fs.readFileSync(path.join(path.dirname(path.dirname(script)), 'mode.md'), 'utf8').trim()
  assert.equal(JSON.parse(rules()).hookSpecificOutput.hookEventName, 'SessionStart')
  assert.equal(context(), `${mode}\n\nDon't add comments or docstrings to code you write or edit, including ones explaining the change, unless the user asks. Leave existing comments alone unless your change makes them wrong.`)
  assert.match(context({ CLAUDE_PLUGIN_OPTION_MODE: 'false' }), /^Don't add comments/)
  assert.equal(context({ CLAUDE_PLUGIN_OPTION_NO_COMMENTS: 'false' }), mode)
  assert.equal(rules({ CLAUDE_PLUGIN_OPTION_NO_COMMENTS: 'false', CLAUDE_PLUGIN_OPTION_MODE: 'false' }), '')
  assert.ok(context({ DEVFLOW_AGENT: 'codex' }).startsWith(`${mode}\n\nDon't add comments`))
  write(path.join(cfg, 'settings.json'), JSON.stringify({ pluginConfigs: { 'devflow@devflow': { options: { no_comments: false, mode: false } } } }))
  assert.equal(rules(), '')
  assert.match(execFileSync('node', [script, 'settings'], { cwd: root, encoding: 'utf8', env: env() }), /^no code comments: off\ndevflow mode: off$/m)
})

test('devflow mode stays small, names no command or host, and keeps its seven rules and six steps', () => {
  const mode = fs.readFileSync(path.join(path.dirname(path.dirname(script)), 'mode.md'), 'utf8')
  assert.ok(mode.split(/\s+/).length <= 450, `${mode.split(/\s+/).length} words`)
  assert.doesNotMatch(mode, /Claude|\/devflow|CLAUDE_PLUGIN_ROOT|AskUserQuestion|TodoWrite/)
  assert.equal(mode.match(/^7\. \*\*/gm).length, 1)
  assert.equal(mode.match(/^6\. \*\*/gm).length, 2)
  assert.doesNotMatch(mode, /^8\. /m)
})

test('a conversation is linked to the flow its commands work on, reminded of it on every message, and let go when it is done', () => {
  const root = tmp()
  const hook = (cmd, input) => execFileSync('node', [script, cmd], { cwd: root, encoding: 'utf8', input: JSON.stringify(input), env: { ...process.env, CLAUDE_PROJECT_DIR: root } })
  const bash = (session, command, stdout = '') => hook('track', { session_id: session, tool_name: 'Bash', tool_input: { command }, tool_response: { stdout } })
  const prompt = session => hook('active', { session_id: session, hook_event_name: 'UserPromptSubmit', prompt: 'go with B' })
  const devflow = 'node "/plugins/devflow/scripts/devflow.mjs"'

  const created = run(root, 'flow', 'new', 'feature', 'CSV export')
  run(root, 'flow', 'new', 'bug', 'Cart total')
  assert.equal(prompt('s1'), '')

  bash('s1', `${devflow} flow new feature CSV export`, created)
  const out = JSON.parse(prompt('s1'))
  assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
  assert.match(out.hookSpecificOutput.additionalContext, /^devflow: on flow csv-export \(Feature: CSV export\), step 1\. Understand\./)
  assert.match(out.hookSpecificOutput.additionalContext, /skills[\\/]start[\\/]SKILL\.md/)
  assert.doesNotMatch(out.hookSpecificOutput.additionalContext, /cart/i)
  assert.equal(prompt('s2'), '')

  bash('s2', `cd app && ${devflow} flow show cart-total && echo ok`)
  run(root, 'flow', 'set', 'cart-total', 'step=3. Fix')
  assert.match(prompt('s2'), /flow cart-total \(Bug: Cart total\), step 3\. Fix/)
  const compact = JSON.parse(hook('active', { session_id: 's2', hook_event_name: 'SessionStart', source: 'compact' }))
  assert.equal(compact.hookSpecificOutput.hookEventName, 'SessionStart')

  bash('s2', `${devflow} flow show nope`)
  bash('s2', 'git status')
  bash('../x', `${devflow} flow show csv-export`)
  assert.match(prompt('s2'), /flow cart-total/)
  assert.ok(!fs.existsSync(path.join(root, '.devflow', 'x')))

  bash('s2', `${devflow} flow done csv-export`)
  assert.match(prompt('s2'), /flow cart-total/)
  run(root, 'flow', 'done', 'cart-total')
  assert.equal(prompt('s2'), '')
  bash('s2', `${devflow} flow done cart-total`)
  assert.ok(!fs.existsSync(path.join(root, '.devflow', 'sessions', 's2')))
  assert.equal(hook('active', {}), '')
})

test('a flow saved with its PR is marked done when the PR merges, and stays listed while it is open or closed', { skip: process.platform === 'win32' && 'the gh stub is a sh script, which Windows cannot run' }, () => {
  const root = tmp()
  const bin = path.join(root, 'bin')
  write(path.join(bin, 'gh'), '#!/bin/sh\ncase "$3" in merged) echo MERGED;; open) echo OPEN;; closed) echo CLOSED;; *) exit 1;; esac\n')
  fs.chmodSync(path.join(bin, 'gh'), 0o755)
  const env = { ...process.env, TMPDIR: root, TMP: root, TEMP: root, PATH: `${bin}${path.delimiter}${process.env.PATH}` }
  const list = () => execFileSync('node', [script, 'flows'], { cwd: root, encoding: 'utf8', env })

  for (const t of ['Shipped', 'Open', 'Closed', 'Unknown', 'Tickets left']) run(root, 'flow', 'new', 'feature', t)
  run(root, 'flow', 'set', 'shipped', 'pr=merged', 'step=8. Ship')
  run(root, 'flow', 'set', 'open', 'pr=open')
  run(root, 'flow', 'set', 'closed', 'pr=closed')
  run(root, 'flow', 'set', 'unknown', 'pr=nope')
  write(path.join(root, '.devflow', 'flows', 'tickets-left', 'tickets', '01-a.md'), ticket('01'))
  run(root, 'flow', 'set', 'tickets-left', 'pr=merged')
  assert.match(run(root, 'flow', 'show', 'shipped'), /^pr: merged$/m)

  const out = list()
  assert.match(out, /^done: shipped · Shipped \(PR merged merged\)$/m)
  assert.doesNotMatch(out, /^\d\. shipped/m)
  assert.match(out, /^\d\. open · .*\n {3}waiting on PR open to merge$/m)
  assert.match(out, /^\d\. closed · .*\n {3}PR closed was closed without merging$/m)
  assert.match(out, /^\d\. unknown · Feature · step 1\. Understand · [^\n]*$(?!\n {3})/m)
  assert.match(out, /^\d\. tickets-left · /m)
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.devflow', 'flows', 'shipped', 'state.json'), 'utf8')).status, 'done')
  assert.doesNotMatch(list(), /shipped/)
})
