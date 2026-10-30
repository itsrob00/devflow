import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const repo = fileURLToPath(new URL('..', import.meta.url))
export const scripts = path.join(repo, 'plugin', 'scripts')
export const installer = path.join(scripts, 'devflow-install.mjs')
export const guard = path.join(scripts, 'devflow-guard.mjs')
export const devflow = path.join(scripts, 'devflow.mjs')

export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

export const version = readJson(path.join(repo, 'package.json')).version
const marketplace = readJson(path.join(repo, '.claude-plugin', 'marketplace.json'))
export const listed = name => marketplace.plugins.find(p => p.name === name).skills.map(s => path.posix.basename(s))

export const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}

export function tree (dir) {
  const out = {}
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { out[path.relative(dir, p) + path.sep] = null; walk(p) } else out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8')
    }
  }
  walk(dir)
  return out
}

const LOG_STUB = "import fs from 'node:fs'\nfs.appendFileSync(process.env.%LOG%, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n')\nprocess.exit(Number(process.env.%EXIT% || 0))\n"

const HOST_ENV = ['CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_CONFIG_DIR', 'DEVFLOW_GUARD', 'DEVFLOW_AGENT']

function cleanEnv (env) {
  for (const k of HOST_ENV) delete env[k]
  for (const k of Object.keys(env)) if (k.startsWith('CLAUDE_PLUGIN_OPTION_')) delete env[k]
  return env
}

export function sandbox ({ name = 'devflow', source = repo } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`))
  const home = path.join(root, 'home')
  const outside = path.join(root, 'outside')
  const project = path.join(root, 'project')
  const sub = path.join(project, 'packages', 'app')
  fs.mkdirSync(home)
  fs.mkdirSync(outside)
  fs.mkdirSync(path.join(project, '.git'), { recursive: true })
  const skillsStub = path.join(outside, 'skills-stub.mjs')
  const skillsLog = path.join(outside, 'skills.log')
  const launchStub = path.join(outside, 'launch-stub.mjs')
  const launchLog = path.join(outside, 'launch.log')
  write(skillsStub, LOG_STUB.replace('%LOG%', 'STUB_LOG').replace('%EXIT%', 'STUB_EXIT'))
  write(launchStub, LOG_STUB.replace('%LOG%', 'LAUNCH_LOG').replace('%EXIT%', 'LAUNCH_EXIT'))
  const env = cleanEnv({ ...process.env, HOME: home, USERPROFILE: home, DEVFLOW_SKILLS_CMD: skillsStub, STUB_LOG: skillsLog, DEVFLOW_UPDATE_CMD: launchStub, LAUNCH_LOG: launchLog })
  const lines = file => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [])
  const runIn = (cwd, ...args) => spawnSync(process.execPath, [path.join(source, 'plugin', 'scripts', 'devflow-install.mjs'), ...args], { cwd, env, encoding: 'utf8' })
  return {
    root, home, outside, project, sub, env, runIn,
    run: (...args) => runIn(outside, ...args),
    runProject: (...args) => runIn(project, ...args),
    skillsCalls: () => lines(skillsLog),
    calls: () => lines(skillsLog).map(c => c.args),
    launches: () => lines(launchLog),
    userRecord: path.join(home, '.config', 'devflow', 'installs.json'),
    projectRecord: path.join(project, '.devflow', 'installs.json'),
    runtime: (agent, ...rest) => path.join(home, '.config', 'devflow', 'runtime', agent, ...rest),
    link (session, id = 'cart', flow = { flow: 'feature', title: 'Cart', status: 'active' }, at = project) {
      write(path.join(at, '.devflow', 'flows', id, 'state.json'), JSON.stringify(flow))
      write(path.join(at, '.devflow', 'sessions', session), id + '\n')
    }
  }
}

export function feed (script, args, payload, { env = process.env, cwd = os.tmpdir() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env, cwd })
    let stdout = ''
    child.stdout.on('data', d => { stdout += d })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout }))
    child.stdin.end(typeof payload === 'string' ? payload : JSON.stringify(payload))
  })
}

export async function askAll (commands, ask, width = 12) {
  const out = []
  for (let i = 0; i < commands.length; i += width) out.push(...await Promise.all(commands.slice(i, i + width).map(ask)))
  return out
}
