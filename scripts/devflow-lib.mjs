// Shared by devflow.mjs and the guard hook: plugin settings, and where the skills devflow runs are installed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULTS = {
  git_guard: true,
  adversarial_review: 'risky changes',
  small_changes: 'poteto-mode',
  after_session: 'reflect'
}

const CHOICES = {
  adversarial_review: ['risky changes', 'always', 'never'],
  small_changes: ['poteto-mode', 'direct'],
  after_session: ['retro', 'reflect']
}

export function claudeDir () {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude')
}

function readJson (file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

// The options saved by /plugin (Configure options). Read from the user settings file so a change applies
// without a restart; hooks also get them as CLAUDE_PLUGIN_OPTION_<KEY>.
export function pluginOptions () {
  const all = readJson(path.join(claudeDir(), 'settings.json'))?.pluginConfigs || {}
  const key = Object.keys(all).find(k => k === 'devflow' || k.startsWith('devflow@'))
  const opts = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_PLUGIN_OPTION_')) opts[k.slice('CLAUDE_PLUGIN_OPTION_'.length).toLowerCase()] = v
  }
  return { ...opts, ...(key ? all[key].options || {} : {}) }
}

export function loadSettings () {
  const s = { ...DEFAULTS }
  for (const [k, v] of Object.entries(pluginOptions())) {
    if (!(k in DEFAULTS) || v === '' || v === null || v === undefined) continue
    if (k === 'git_guard') s[k] = !(v === false || v === 'false')
    else if (CHOICES[k].includes(v)) s[k] = v
  }
  if (process.env.DEVFLOW_GUARD === 'off') s.git_guard = false
  return s
}

// ---------- skills ----------

const MATT = 'matt'
const PSTACK = 'pstack'

export const PACKS = {
  [MATT]: {
    title: "Matt Pocock's skills (devflow-matt)",
    install: '/plugin install devflow-matt@devflow'
  },
  [PSTACK]: {
    title: 'pstack (devflow-pstack)',
    install: '/plugin install devflow-pstack@devflow'
  }
}

// Every skill a flow runs, including the ones those skills call themselves.
export const SKILLS = {
  'setup-matt-pocock-skills': MATT,
  'grill-with-docs': MATT,
  grilling: MATT,
  'domain-modeling': MATT,
  prototype: MATT,
  'to-spec': MATT,
  'to-tickets': MATT,
  implement: MATT,
  tdd: MATT,
  'codebase-design': MATT,
  'code-review': MATT,
  pr: MATT,
  'diagnosing-bugs': MATT,
  wayfinder: MATT,
  research: MATT,
  handoff: MATT,
  retro: MATT,
  'writing-for-agents': MATT,
  how: PSTACK,
  why: PSTACK,
  architect: PSTACK,
  arena: PSTACK,
  'blast-radius': PSTACK,
  unslop: PSTACK,
  interrogate: PSTACK,
  'figure-it-out': PSTACK,
  'show-me-your-work': PSTACK,
  'poteto-mode': PSTACK,
  'setup-pstack': PSTACK,
  reflect: PSTACK,
  correct: PSTACK,
  'create-verification-skill': PSTACK,
  'maintain-verification-skill': PSTACK
}

export const FLOWS = {
  setup: ['setup-matt-pocock-skills', 'setup-pstack', 'create-verification-skill', 'maintain-verification-skill'],
  feature: ['how', 'grill-with-docs', 'grilling', 'domain-modeling', 'prototype', 'to-spec', 'to-tickets', 'architect', 'arena',
    'implement', 'tdd', 'codebase-design', 'code-review', 'blast-radius', 'why', 'unslop', 'interrogate', 'pr'],
  bug: ['why', 'how', 'diagnosing-bugs', 'blast-radius', 'arena', 'unslop'],
  big: ['wayfinder', 'research', 'figure-it-out', 'show-me-your-work', 'handoff', 'to-spec', 'to-tickets'],
  small: ['poteto-mode'],
  wrap: ['retro', 'writing-for-agents', 'reflect', 'correct', 'handoff']
}

// tdd and teach exist in both packs. These tell the copies apart.
const FINGERPRINT = [
  [MATT, /^description:\s*["']?Test-driven development\./m],
  [PSTACK, /^description:\s*["']?Use only when the user explicitly asks for TDD/m],
  [MATT, /^description:\s*["']?Teach the user a new skill or concept/m],
  [PSTACK, /^description:\s*["']?Explain a body of work plainly/m]
]

function frontmatterName (text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const n = m && /^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(m[1])
  return n ? n[1] : null
}

function walk (dir, depth, out) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.name === 'SKILL.md' && e.isFile()) out.push(p)
    else if (depth > 0 && (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith('.') && e.name !== 'node_modules') walk(p, depth - 1, out)
  }
}

// Installed plugins, from installed_plugins.json. For the dependencies this repo's marketplace defines,
// `skills` lists the folders Claude Code registers; the rest of their checkout is ignored.
function pluginRoots () {
  const listed = {}
  const mkt = readJson(fileURLToPath(new URL('../.claude-plugin/marketplace.json', import.meta.url)))
  for (const p of mkt?.plugins || []) if (p.skills) listed[p.name] = new Set(p.skills.map(d => path.normalize(d)))
  const roots = []
  const installed = readJson(path.join(claudeDir(), 'plugins', 'installed_plugins.json'))
  for (const [id, entries] of Object.entries(installed?.plugins || {})) {
    const plugin = id.split('@')[0]
    for (const e of [].concat(entries)) if (e?.installPath) roots.push({ dir: e.installPath, plugin, only: listed[plugin] })
  }
  return roots
}

// Every installed SKILL.md: { name, pack, file, where }.
export function installedSkills (projectRoot = process.cwd()) {
  const found = []
  const add = (file, where, plugin) => {
    let text
    try { text = fs.readFileSync(file, 'utf8') } catch { return }
    const name = frontmatterName(text) || path.basename(path.dirname(file))
    let pack = FINGERPRINT.find(([, re]) => re.test(text))?.[0]
    if (!pack && (plugin === 'devflow-matt' || plugin === 'mattpocock-skills')) pack = MATT
    if (!pack && (plugin === 'devflow-pstack' || plugin === 'pstack')) pack = PSTACK
    if (!pack) pack = plugin && plugin !== 'devflow' ? plugin : SKILLS[name] || 'other'
    found.push({ name, pack, file, where: plugin ? `plugin ${plugin}` : where })
  }
  const home = os.homedir()
  const dirs = [
    [path.join(projectRoot, '.claude', 'skills'), 'project'],
    [path.join(projectRoot, '.agents', 'skills'), 'project'],
    [path.join(claudeDir(), 'skills'), 'user'],
    [path.join(home, '.agents', 'skills'), 'user']
  ]
  const seen = new Set()
  for (const [dir, where] of dirs) {
    const files = []
    walk(dir, 3, files)
    for (const f of files) {
      const real = safeReal(f)
      if (seen.has(real)) continue
      seen.add(real)
      add(f, where)
    }
  }
  for (const { dir, plugin, only } of pluginRoots()) {
    const files = []
    walk(dir, 4, files)
    for (const f of files) if (!only || only.has(path.normalize(path.relative(dir, path.dirname(f))))) add(f, 'plugin', plugin)
  }
  return found
}

function safeReal (p) {
  try { return fs.realpathSync(p) } catch { return p }
}

// The SKILL.md devflow should run for a name: the copy from the pack devflow expects, project before user before plugin.
export function findSkill (name, all) {
  const want = SKILLS[name]
  const matches = all.filter(s => s.name === name || s.name.endsWith(':' + name))
  return matches.find(s => s.pack === want) || matches[0] || null
}
