#!/usr/bin/env node
import { agentNames, install, uninstall, update } from './devflow-installer.mjs'

const usage = () => `usage: devflow install --agent <${agentNames().join('|')}> [--project]\n       devflow update [--agent <name>] [--project] [--local]\n       devflow uninstall --agent <${agentNames().join('|')}> [--project]`

function fail (msg, code = 2) {
  console.error(msg)
  process.exit(code)
}

function parse (argv) {
  const [cmd, ...rest] = argv
  const opts = {}
  for (let i = 0; i < rest.length; i++) {
    const m = /^--agent(?:=(.*))?$/.exec(rest[i])
    if (m) opts.agent = m[1] ?? rest[++i]
    else if (rest[i] === '--project') opts.project = true
    else if (rest[i] === '--local') opts.local = true
    else fail(`unknown option ${rest[i]}\n${usage()}`)
  }
  return { cmd, opts }
}

const { cmd, opts } = parse(process.argv.slice(2))
if (!['install', 'uninstall', 'update'].includes(cmd)) fail(usage())
if (opts.local && cmd !== 'update') fail(`--local only goes with update\n${usage()}`)
if (cmd !== 'update' && !opts.agent) fail(`${cmd} needs --agent\n${usage()}`)
if (opts.agent && !agentNames().includes(opts.agent)) fail(`unknown agent ${opts.agent}; use one of ${agentNames().join(', ')}`)

try {
  const log = msg => console.log(msg)
  if (cmd === 'update') update({ agent: opts.agent, project: opts.project, local: opts.local, log })
  else (cmd === 'install' ? install : uninstall)({ agent: opts.agent, scope: opts.project ? 'project' : 'user', log })
} catch (e) {
  fail(e.message, 1)
}
