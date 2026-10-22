// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../plugin/scripts/devflow.mjs', import.meta.url))

test('show prints the skill with the rule for following it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-show-'))
  const dir = path.join(root, '.claude', 'skills', 'how')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: how\n---\nbody\n')
  const env = { ...process.env, HOME: root, USERPROFILE: root, CLAUDE_CONFIG_DIR: path.join(root, 'cfg') }
  const out = execFileSync('node', [script, 'show', 'how'], { cwd: root, env, encoding: 'utf8' })
  assert.match(out, /follow it as if the user typed \/how/)
  assert.match(out, /not the Skill tool/)
  assert.match(out, /body/)
})

test('doctor finds the pstack models file where /setup-pstack writes it in Claude Code, and the older one in ~/.agents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-models-'))
  const cfg = path.join(root, 'cfg')
  const env = { ...process.env, HOME: root, USERPROFILE: root, CLAUDE_CONFIG_DIR: cfg }
  const doctor = () => execFileSync('node', [script, 'doctor', 'big'], { cwd: root, env, encoding: 'utf8' })
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text) }
  assert.match(doctor(), /^pstack models: not set/m)
  write(path.join(root, '.agents', 'pstack-models.md'), 'judgment and prose: grok-4\n')
  assert.match(doctor(), /uses Grok for judgment and prose/)
  const rules = path.join(cfg, 'rules', 'pstack-models.md')
  write(rules, 'judgment and prose: claude-opus\n')
  assert.ok(doctor().includes(`pstack models: ${rules}\n`))
})

test('pstack-models writes Claude models once, and swaps Grok out of an existing file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'devflow-pstack-'))
  const cfg = path.join(root, 'cfg')
  const env = { ...process.env, HOME: root, USERPROFILE: root, CLAUDE_CONFIG_DIR: cfg }
  const run = (...a) => execFileSync('node', [script, ...a], { cwd: root, env, encoding: 'utf8' })
  const rules = path.join(cfg, 'rules', 'pstack-models.md')
  assert.match(run('pstack-models'), /at the large budget with Opus/)
  assert.match(fs.readFileSync(rules, 'utf8'), /^arena runners: claude-opus-5-5-xhigh, claude-opus-5-5-xhigh$/m)
  assert.doesNotMatch(fs.readFileSync(rules, 'utf8'), /grok/i)
  assert.match(run('pstack-models'), /already uses Claude models/)
  fs.writeFileSync(rules, '# budget: medium (high)\nfeature, refactoring: grok-4.7-high-fast\n')
  run('pstack-models')
  assert.equal(fs.readFileSync(rules, 'utf8'), '# budget: medium (high)\nfeature, refactoring: claude-opus-5-5-xhigh\n')
  assert.match(run('doctor', 'big'), /^pstack models: /m)
})
