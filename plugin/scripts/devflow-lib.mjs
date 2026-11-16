// Shared by devflow.mjs, the installer and the guard hook: the settings, and what differs between agents.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULTS = {
  git_guard: true,
  no_comments: true,
  auto_flows: true,
  adversarial_review: 'risky changes',
  subagent_count: 3,
  subagent_model: 'auto',
  tracker: 'auto'
}

const CHOICES = {
  adversarial_review: ['risky changes', 'always', 'never'],
  tracker: ['auto', 'github', 'gitlab', 'files']
}

const MAX_SUBAGENTS = 10

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
    closest: { strong: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' }
  },
  codex: {
    ...claudeStyle,
    label: 'Codex CLI',
    closest: { strong: 'gpt-6-astra', fast: 'gpt-6.1-terra' }
  },
  cursor: {
    label: 'Cursor',
    closest: { strong: 'claude-opus-5-5', fast: 'claude-sonnet-5-5' },
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
    closest: { strong: 'anthropic/claude-opus-5-5', fast: 'anthropic/claude-sonnet-5-5' }
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
      else if (typeof DEFAULTS[k] === 'number') {
        const n = typeof v === 'boolean' ? NaN : Number(v)
        if (Number.isInteger(n) && n >= 1) s[k] = Math.min(n, MAX_SUBAGENTS)
      } else if (CHOICES[k]) {
        if (CHOICES[k].includes(v)) s[k] = v
      } else if (typeof v === 'string' && v.trim()) s[k] = v.trim()
    }
  }
  if (process.env.DEVFLOW_GUARD === 'off') s.git_guard = false
  return s
}
