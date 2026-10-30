// Shared by devflow.mjs and the guard hook: plugin settings, and where the skills devflow runs are installed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADAPTERS } from './devflow-adapters.mjs'

export const DEFAULTS = {
  git_guard: true,
  no_comments: true,
  adversarial_review: 'risky changes',
  small_changes: 'poteto-mode',
  after_session: 'reflect'
}

const CHOICES = {
  adversarial_review: ['risky changes', 'always', 'never'],
  small_changes: ['poteto-mode', 'direct'],
  after_session: ['retro', 'reflect', 'handoff']
}

const ALL_FAMILIES = ['claude', 'gpt', 'gemini', 'grok']

export const CLAUDE_CODE = 'claude-code'

const claudeStyle = {
  payload: input => input,
  deny: text => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: text } }),
  allow: null,
  context: (event, additionalContext, systemMessage) => ({
    ...(systemMessage ? { systemMessage } : {}),
    hookSpecificOutput: { hookEventName: event, additionalContext }
  })
}

function jsonOrNull (text) {
  try { return JSON.parse(text) } catch { return null }
}

export const AGENTS = {
  [CLAUDE_CODE]: {
    ...claudeStyle,
    label: 'Claude Code',
    transcripts: true,
    otherFamilies: false,
    families: ['claude'],
    closest: { strong: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' },
    pstackFile: ['.claude', 'rules', 'pstack-models.md']
  },
  codex: {
    ...claudeStyle,
    label: 'Codex CLI',
    transcripts: true,
    otherFamilies: false,
    families: ['gpt'],
    closest: { strong: 'gpt-6-astra', fast: 'gpt-6.1-terra' },
    pstackFile: ['.agents', 'pstack-models.md']
  },
  cursor: {
    label: 'Cursor',
    transcripts: true,
    otherFamilies: true,
    families: [...ALL_FAMILIES, 'composer'],
    closest: { strong: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' },
    pstackFile: ['.cursor', 'rules', 'pstack-models.mdc'],
    payload (input) {
      const out = { ...input }
      if (!out.session_id) out.session_id = out.conversation_id
      if (!out.cwd && Array.isArray(out.workspace_roots)) out.cwd = out.workspace_roots[0]
      if (out.tool_name === 'Shell') out.tool_name = 'Bash'
      if (!out.tool_response && typeof out.tool_output === 'string') out.tool_response = jsonOrNull(out.tool_output) ?? out.tool_output
      return out
    },
    deny: text => ({ permission: 'deny', user_message: text, agent_message: text }),
    allow: { permission: 'allow' },
    context: (event, additionalContext) => ({ additional_context: additionalContext })
  },
  opencode: {
    ...claudeStyle,
    label: 'OpenCode',
    transcripts: false,
    otherFamilies: true,
    families: ALL_FAMILIES,
    closest: { strong: 'anthropic/claude-opus-5-5', fast: 'anthropic/claude-sonnet-5-5' },
    pstackFile: ['.agents', 'pstack-models.md']
  }
}

export function agentFor (name) {
  return AGENTS[name] ?? AGENTS[CLAUDE_CODE]
}

export function currentAgent () {
  const named = process.env.DEVFLOW_AGENT
  if (named && Object.hasOwn(AGENTS, named)) return named
  const here = path.dirname(fileURLToPath(import.meta.url))
  const agent = readJson(path.join(path.dirname(here), 'agent.json'))?.agent
  return typeof agent === 'string' && Object.hasOwn(AGENTS, agent) ? agent : CLAUDE_CODE
}

export function modelFamily (model) {
  const id = model.toLowerCase().split('/').pop()
  if (id === 'auto' || id === 'inherit-parent') return 'alias'
  if (/^(cursor-)?grok/.test(id)) return 'grok'
  if (/^composer/.test(id)) return 'composer'
  if (/^claude/.test(id)) return 'claude'
  if (/^(gpt|o\d|codex)/.test(id)) return 'gpt'
  if (/^gemini/.test(id)) return 'gemini'
  return 'other'
}

export function hookAgent (argv = process.argv) {
  const i = argv.indexOf('--agent')
  return i >= 0 && argv[i + 1] ? argv[i + 1] : CLAUDE_CODE
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

// The project a command or hook works on. A host that names the folder is trusted as-is; otherwise
// walk up from where we are to the git root, so a run from a subfolder finds the same project.
export function projectRoot (hook) {
  if (hook && process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR)
  const start = path.resolve((hook && typeof hook.cwd === 'string' && hook.cwd) || process.cwd())
  for (let dir = start; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    if (path.dirname(dir) === dir) return start
  }
}

export function hookPayload (input, name) {
  return input && typeof input === 'object' ? agentFor(name).payload(input) : input
}

function settingsFile (file) {
  const s = readJson(file)
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {}
}

export function loadSettings (root) {
  const agent = currentAgent()
  const s = { ...DEFAULTS }
  if (!AGENTS[agent].transcripts) s.after_session = 'handoff'
  const project = settingsFile(path.join(root, '.devflow', 'settings.json'))
  // A repo carries its own settings, but can't turn the git guard off: cloning one would disarm it.
  delete project.git_guard
  const layers = [
    settingsFile(path.join(os.homedir(), '.config', 'devflow', 'settings.json')),
    project,
    agent === CLAUDE_CODE ? pluginOptions() : {}
  ]
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (!(k in DEFAULTS) || v === '' || v === null || v === undefined) continue
      if (typeof DEFAULTS[k] === 'boolean') s[k] = !(v === false || v === 'false')
      else if (CHOICES[k].includes(v)) s[k] = v
    }
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
    install: '/plugin install devflow-matt@devflow',
    source: 'mattpocock/skills',
    extra: []
  },
  [PSTACK]: {
    title: 'pstack (devflow-pstack)',
    install: '/plugin install devflow-pstack@devflow',
    source: 'backnotprop/pstack',
    extra: ['swarm', 'no-comments', 'benchmark-checklist', 'technical-writing', 'principle-attack-the-premise', 'principle-boundary-discipline',
      'principle-build-the-lever', 'principle-encode-lessons-in-structure', 'principle-exhaust-the-design-space', 'principle-experience-first',
      'principle-explain-the-number', 'principle-fix-root-causes', 'principle-foundational-thinking', 'principle-guard-the-context-window',
      'principle-laziness-protocol', 'principle-make-operations-idempotent', 'principle-migrate-callers-then-delete-legacy-apis',
      'principle-minimize-reader-load', 'principle-model-the-domain', 'principle-never-block-on-the-human', 'principle-outcome-oriented-execution',
      'principle-prove-it-works', 'principle-redesign-from-first-principles', 'principle-separate-before-serializing-shared-state',
      'principle-sequence-verifiable-units', 'principle-subtract-before-you-add', 'principle-test-behavior-not-implementation',
      'principle-type-system-discipline']
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
  'implement-spec': MATT,
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
  wizard: MATT,
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

export function installAdvice (pack, agent) {
  return agent === CLAUDE_CODE ? PACKS[pack].install : `npx github:itsrob00/devflow install --agent ${agent}`
}

export function packSkills (pack) {
  return [...Object.keys(SKILLS).filter(n => SKILLS[n] === pack), ...PACKS[pack].extra]
}

export const FLOWS = {
  setup: ['setup-matt-pocock-skills', 'setup-pstack', 'create-verification-skill', 'maintain-verification-skill'],
  feature: ['how', 'grill-with-docs', 'grilling', 'domain-modeling', 'prototype', 'to-spec', 'to-tickets', 'architect', 'arena',
    'implement', 'implement-spec', 'tdd', 'codebase-design', 'code-review', 'blast-radius', 'why', 'unslop', 'interrogate', 'pr', 'wizard'],
  bug: ['why', 'how', 'diagnosing-bugs', 'blast-radius', 'arena', 'unslop'],
  big: ['wayfinder', 'research', 'figure-it-out', 'show-me-your-work', 'handoff', 'to-spec', 'to-tickets', 'implement-spec', 'wizard'],
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

// devflow's marketplace.json. The plugin is installed without it, so read the marketplace's own checkout,
// or the repo root when running from a clone.
function marketplace (installed) {
  const local = readJson(fileURLToPath(new URL('../../.claude-plugin/marketplace.json', import.meta.url)))
  if (local) return local
  const id = Object.keys(installed?.plugins || {}).find(k => k.startsWith('devflow@'))
  const known = readJson(path.join(claudeDir(), 'plugins', 'known_marketplaces.json'))
  const dir = id && known?.[id.slice('devflow@'.length)]?.installLocation
  return dir ? readJson(path.join(dir, '.claude-plugin', 'marketplace.json')) : null
}

// Installed plugins, from installed_plugins.json. For the dependencies devflow's marketplace defines,
// `skills` lists the folders Claude Code registers; the rest of their checkout is ignored.
function pluginRoots () {
  const listed = {}
  const installed = readJson(path.join(claudeDir(), 'plugins', 'installed_plugins.json'))
  for (const p of marketplace(installed)?.plugins || []) if (p.skills) listed[p.name] = new Set(p.skills.map(d => path.normalize(d)))
  const roots = []
  for (const [id, entries] of Object.entries(installed?.plugins || {})) {
    const plugin = id.split('@')[0]
    for (const e of [].concat(entries)) if (e?.installPath) roots.push({ dir: e.installPath, plugin, only: listed[plugin] })
  }
  return roots
}

// Every installed SKILL.md: { name, pack, file, where }.
export function installedSkills (projectRoot = process.cwd()) {
  const found = []
  const add = (file, where, plugin, lock) => {
    let text
    try { text = fs.readFileSync(file, 'utf8') } catch { return }
    const name = frontmatterName(text) || path.basename(path.dirname(file))
    let pack = FINGERPRINT.find(([, re]) => re.test(text))?.[0]
    if (!pack && lock) pack = packOfSource(lock[name]?.source)
    if (!pack && (plugin === 'devflow-matt' || plugin === 'mattpocock-skills')) pack = MATT
    if (!pack && (plugin === 'devflow-pstack' || plugin === 'pstack')) pack = PSTACK
    if (!pack) pack = plugin && plugin !== 'devflow' ? plugin : SKILLS[name] || 'other'
    found.push({ name, pack, file, where: plugin ? `plugin ${plugin}` : where })
  }
  const home = os.homedir()
  const folders = [...new Set(Object.values(ADAPTERS).flatMap(a => a.reads))].filter(r => r !== '.agents/skills')
  const dirs = []
  for (const d of ancestors(projectRoot)) {
    dirs.push([path.join(d, '.claude', 'skills'), 'project'])
    dirs.push([path.join(d, '.agents', 'skills'), 'project', readLock(path.join(d, 'skills-lock.json'))])
    for (const rel of folders) dirs.push([path.join(d, ...rel.split('/')), 'project'])
  }
  dirs.push([path.join(claudeDir(), 'skills'), 'user'])
  dirs.push([path.join(home, '.agents', 'skills'), 'user', readLock(path.join(home, '.agents', '.skill-lock.json'))])
  for (const rel of folders) dirs.push([path.join(home, ...rel.split('/')), 'user'])
  const seen = new Set()
  for (const [dir, where, lock] of dirs) {
    const files = []
    walk(dir, 3, files)
    for (const f of files) {
      const real = safeReal(f)
      if (seen.has(real)) continue
      seen.add(real)
      add(f, where, undefined, lock)
    }
  }
  for (const { dir, plugin, only } of pluginRoots()) {
    const files = []
    walk(dir, 4, files)
    for (const f of files) if (!only || only.has(path.normalize(path.relative(dir, path.dirname(f))))) add(f, 'plugin', plugin)
  }
  return found
}

function ancestors (root) {
  const here = path.resolve(process.cwd())
  const rel = path.relative(root, here)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return [root]
  const dirs = []
  for (let d = here; ; d = path.dirname(d)) {
    dirs.push(d)
    if (d === root || path.dirname(d) === d) return dirs
  }
}

function readLock (file) {
  const skills = readJson(file)?.skills
  return skills && typeof skills === 'object' && !Array.isArray(skills) ? skills : null
}

function packOfSource (source) {
  if (typeof source !== 'string') return undefined
  const id = source.toLowerCase().replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '')
  return Object.keys(PACKS).find(k => PACKS[k].source === id)
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
