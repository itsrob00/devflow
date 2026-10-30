import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PLUGIN_DIR = ''
const AGENT = 'opencode'
const SHELL_TOOLS = ['shell', 'bash']
const GUARD_DOWN = "devflow git guard: devflow's guard couldn't run, so this command is blocked because it mentions git. Give the user the exact command to run, and tell them to check the devflow install (devflow install --agent opencode)."

function locate (cwd, script) {
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const file = path.resolve(dir, PLUGIN_DIR, 'scripts', script)
    if (fs.existsSync(file) || path.dirname(dir) === dir) return file
  }
}

function run (cwd, script, args, payload) {
  const r = spawnSync('node', [locate(cwd, script), ...args, '--agent', AGENT], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true
  })
  if (r.error || r.status !== 0) return { failed: true, reply: null }
  if (!r.stdout) return { failed: false, reply: null }
  try { return { failed: false, reply: JSON.parse(r.stdout) } } catch { return { failed: true, reply: null } }
}

function folder (ctx) {
  return ctx.location?.project?.directory || ctx.location?.directory || process.cwd()
}

function commandOf (event) {
  if (!SHELL_TOOLS.includes(event.tool)) return null
  const command = event.input?.command
  return typeof command === 'string' ? command : null
}

function textOf (result) {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return ''
  for (const key of ['output', 'stdout', 'text']) if (typeof result[key] === 'string') return result[key]
  const parts = Array.isArray(result.content) ? result.content : Array.isArray(result) ? result : []
  return parts.map(p => (typeof p === 'string' ? p : typeof p?.text === 'string' ? p.text : '')).join('')
}

function contextOf (reply) {
  const text = reply?.hookSpecificOutput?.additionalContext
  return typeof text === 'string' ? text : ''
}

export default {
  id: 'devflow',
  async setup (ctx) {
    const cwd = folder(ctx)
    const starts = new Map()

    await ctx.tool.hook('execute.before', event => {
      const command = commandOf(event)
      if (command === null) return
      const { failed, reply } = run(cwd, 'devflow-guard.mjs', [], { session_id: event.sessionID, cwd, tool_name: 'Bash', tool_input: { command } })
      if (failed && /\bgit\b/i.test(command)) throw new Error(GUARD_DOWN)
      const out = reply?.hookSpecificOutput
      if (out?.permissionDecision === 'deny') throw new Error(out.permissionDecisionReason || 'devflow git guard: blocked')
    })

    await ctx.tool.hook('execute.after', event => {
      const command = commandOf(event)
      if (command === null || event.status !== 'completed' || !command.includes('devflow')) return
      run(cwd, 'devflow.mjs', ['track'], {
        session_id: event.sessionID,
        cwd,
        tool_name: 'Bash',
        tool_input: { command },
        tool_response: { stdout: textOf(event.result) }
      })
    })

    await ctx.session.hook('context', event => {
      const payload = { session_id: event.sessionID, cwd }
      let start = starts.get(event.sessionID)
      if (!start) {
        start = {
          rules: contextOf(run(cwd, 'devflow.mjs', ['rules'], { ...payload, hook_event_name: 'SessionStart' }).reply),
          reminder: contextOf(run(cwd, 'devflow.mjs', ['reminder'], { ...payload, hook_event_name: 'SessionStart' }).reply)
        }
        starts.set(event.sessionID, start)
      }
      const active = contextOf(run(cwd, 'devflow.mjs', ['active'], { ...payload, hook_event_name: 'UserPromptSubmit' }).reply)
      for (const text of [start.rules, active || start.reminder]) {
        if (text) event.system.push({ type: 'text', text })
      }
    })
  }
}
