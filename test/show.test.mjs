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
