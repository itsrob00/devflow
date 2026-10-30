import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { ADAPTERS, at } from './devflow-adapters.mjs'
import { AGENTS, PACKS, packSkills, projectRoot } from './devflow-lib.mjs'

const SKILLS_PIN = 'skills@1.7.4'

function beginMarker (agent) {
  return `<!-- devflow:begin ${agent} -->`
}

function endMarker (agent) {
  return `<!-- devflow:end ${agent} -->`
}

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url))
const PLUGIN = path.dirname(SCRIPTS)
const PACKAGE = path.dirname(PLUGIN)

const GUARDED = [
  ['git', 'push'],
  ['git', 'reset', '--hard'],
  ['git', 'branch', '-D'],
  ['git', 'clean', ['-f', '-fd', '-df', '-fx', '-xf', '-fdx', '-fxd', '-dfx', '-dxf', '-xfd', '-xdf', '--force']],
  ['git', 'checkout', '.'],
  ['git', 'checkout', '-f'],
  ['git', 'checkout', '--force'],
  ['git', 'switch', '-f'],
  ['git', 'switch', '--discard-changes'],
  ['git', 'restore', '.']
]

const HOOK_FORMATS = { 'claude-json': claudeJson, 'cursor-json': cursorJson, 'opencode-plugin': opencodePlugin }
const BACKSTOP_FORMATS = { 'codex-rules': codexRules }
const RULE_FORMATS = { 'cursor-mdc': cursorMdc }

export function agentNames () {
  return Object.keys(ADAPTERS)
}

function packageVersion () {
  return readJson(path.join(PACKAGE, 'package.json')).version
}

function readJson (file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function names (template, name) {
  return template.replace('{name}', name)
}

function expandPluginRoot (text, { adapter, skillsDir, pluginDir = PLUGIN, ref = p => p }) {
  return text.replace(/\$\{CLAUDE_PLUGIN_ROOT\}((?:\/[A-Za-z0-9_.<>-]+)*)/g, (_, rest) => {
    const parts = rest.split('/').filter(Boolean)
    if (parts[0] === 'skills' && parts[1]) return ref(path.join(skillsDir, names(adapter.entrySkill, parts[1]), ...parts.slice(2)))
    return ref(path.join(pluginDir, ...parts))
  })
}

function renderSkill (text, { adapter, skillsDir, name, pluginDir, ref }) {
  let out = expandPluginRoot(text, { adapter, skillsDir, pluginDir, ref })
    .replace(/\/devflow:([a-z-]+)/g, (_, n) => names(adapter.invoke, n))
    .replace(/` in Claude Code\)/g, '`)')
    .replace(/; in Claude Code, `\/plugin`, under devflow, Configure options/, '')
    .replace(/^argument-hint:.*\r?\n/m, '')
    .replace(/^[^\n]*\(a hint the host fills in\): \$ARGUMENTS\r?\n\r?\n/m, '')
    .replace(/^If that line is empty or shows no text, (.)/m, (_, c) => c.toUpperCase())
  if (name) out = out.replace(/^(---\r?\n[\s\S]*?)^name:.*$/m, (_, head) => `${head}name: ${names(adapter.entrySkill, name)}`)
  return out
}

const HOOK_COMMAND = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([A-Za-z0-9.-]+)"((?: [A-Za-z0-9-]+)*)$/

function jsLiteral (value) {
  if (typeof value === 'string') return `'${value.replace(/[\\']/g, '\\$&')}'`
  return `{${Object.entries(value).map(([k, v]) => `${k}:${jsLiteral(v)}`).join(',')}}`
}

function launcherSource (agent) {
  const folders = ['.devflow', 'runtime', agent, 'scripts'].map(f => `'${f}'`).join(',')
  const missing = `devflow git guard: could not find .devflow/runtime/${agent}/scripts/devflow-guard.mjs in this folder or any folder above it, so this command is blocked. Run devflow install --agent ${agent} --project again, or give the user the exact command to run.`
  return [
    "const fs=require('fs'),path=require('path'),cp=require('child_process'),a=process.argv.slice(1)",
    'let d=process.cwd(),f',
    `for(;;){const c=path.join(d,${folders},a[0]);if(fs.existsSync(c)){f=c;break}const u=path.dirname(d);if(u===d)break;d=u}`,
    `if(f)process.exitCode=cp.spawnSync(process.execPath,[f,...a.slice(1)],{stdio:'inherit'}).status??1;else if(a[0]==='devflow-guard.mjs')process.stdout.write(JSON.stringify(${jsLiteral(AGENTS[agent].deny(missing))}))`
  ].join(';')
}

function hookCommand (ctx, template) {
  const [, script, rest] = HOOK_COMMAND.exec(template)
  const args = [...rest.split(' ').filter(Boolean), '--agent', ctx.agent].join(' ')
  if (ctx.scope === 'user') return `node "${ctx.ref(path.join(ctx.pluginDir, 'scripts', script))}" ${args}`
  return `node -e "${launcherSource(ctx.agent)}" ${script} ${args}`
}

function hookEntries (adapter, ctx) {
  const template = readJson(path.join(PLUGIN, 'hooks', 'hooks.json')).hooks
  const out = []
  for (const [event, groups] of Object.entries(template)) {
    const to = adapter.hooks.events[event]
    if (!to) continue
    for (const g of groups) {
      out.push({ event, to, matcher: g.matcher, tool: adapter.hooks.tools[g.matcher], hooks: g.hooks.map(h => ({ ...h, command: hookCommand(ctx, h.command) })) })
    }
  }
  return out
}

function claudeJson (adapter, ctx) {
  const out = {}
  for (const g of hookEntries(adapter, ctx)) {
    const group = {}
    if (g.matcher !== undefined) group.matcher = g.tool ?? g.matcher
    group.hooks = g.hooks
    ;(out[g.to] ||= []).push(group)
  }
  return { hooks: out }
}

function cursorJson (adapter, ctx) {
  const out = {}
  for (const g of hookEntries(adapter, ctx)) {
    if (g.event === 'SessionStart' && g.matcher !== undefined && !g.matcher.split('|').includes('startup')) continue
    for (const h of g.hooks) {
      const entry = { command: h.command }
      if (g.tool) entry.matcher = g.tool
      if (adapter.hooks.failClosed.includes(g.to)) entry.failClosed = true
      ;(out[g.to] ||= []).push(entry)
    }
  }
  return { hooks: out, top: { version: 1 } }
}

function cursorMdc (adapter, ctx) {
  return ['---', 'description: devflow flows and git guard', 'alwaysApply: true', '---', '', instructionsBody(adapter, ctx), ''].join('\n')
}

function opencodePlugin (adapter, ctx) {
  const dir = ctx.where(adapter.hooks.file)
  const configDir = ctx.where(adapter.hooks.config)
  const existing = ['opencode.jsonc', 'opencode.json'].find(n => fs.existsSync(path.join(configDir, n)))
  const register = { file: path.join(configDir, existing || 'opencode.jsonc'), key: 'plugins', value: `./${relative(configDir, dir)}` }
  readConfig(register.file, register.key, register.value)
  const source = fs.readFileSync(path.join(PLUGIN, 'opencode', 'plugin.js'), 'utf8')
    .replace("const PLUGIN_DIR = ''", `const PLUGIN_DIR = ${JSON.stringify(ctx.ref(ctx.pluginDir))}`)
  const pkg = { name: 'devflow-opencode', version: packageVersion(), type: 'module', exports: { '.': './index.js' } }
  return { files: { 'index.js': source, 'package.json': JSON.stringify(pkg, null, 2) + '\n' }, register }
}

function readConfig (file, key, value) {
  if (!fs.existsSync(file)) return {}
  let json
  try { json = readJson(file) } catch {
    throw new Error(`${file} has comments or isn't plain JSON, and devflow won't rewrite a file it could corrupt. Remove the comments and run install again; install adds "${value}" to its "${key}" list.`)
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || (key in json && !Array.isArray(json[key]))) {
    throw new Error(`${file} doesn't hold an object with a "${key}" list, so devflow won't edit it. Fix that and run install again; install adds "${value}" to the list.`)
  }
  return json
}

function readHooksFile (file) {
  if (!fs.existsSync(file)) return {}
  let json
  try { json = readJson(file) } catch {
    throw new Error(`${file} isn't valid JSON, so devflow won't edit it. Fix or remove it and run install again; install adds devflow's hooks to it.`)
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || (json.hooks !== undefined && (!json.hooks || typeof json.hooks !== 'object' || Array.isArray(json.hooks)))) {
    throw new Error(`${file} doesn't hold a JSON object with a "hooks" object, so devflow won't edit it. Fix that and run install again; install adds devflow's hooks to it.`)
  }
  return json
}

function starlark (x) {
  return Array.isArray(x) ? `[${x.map(starlark).join(', ')}]` : JSON.stringify(x)
}

function codexRules () {
  const header = '# devflow git guard backstop. Written by devflow install; devflow uninstall removes this file.\n'
  return header + GUARDED.map(p => `\nprefix_rule(\n    pattern=${starlark(p)},\n    decision="forbidden",\n    justification="devflow git guard: this command loses work or leaves the machine. Give the user the exact command to run.",\n)\n`).join('')
}

const GUARDED_TEXT = "don't run `git push`, `git reset --hard`, `git clean -f`, `git branch -D`, or any command that discards the whole working tree (`git checkout .`, `git checkout -f`, `git restore .`, `git switch --discard-changes`). Give the user the exact command to run instead."

function instructionsBody (adapter, { pluginDir, ref, backstop }) {
  const devflow = `node "${ref(path.join(pluginDir, 'scripts', 'devflow.mjs'))}"`
  return [
    '## devflow',
    '',
    `devflow runs development work as flows: ${names(adapter.invoke, 'start')} starts one and ${names(adapter.invoke, 'continue')} picks one up. \`devflow\` means ${'`' + devflow + '`'}, run from the project root.`,
    '',
    '- While a devflow flow is running, check `devflow active` before replying to each message and treat the message as part of that flow unless it is unrelated. If it prints nothing, `devflow flows` lists any unfinished flows.',
    `- Git guard, ${backstop ? 'in every session' : 'while a flow is running'}: ${GUARDED_TEXT}`
  ].join('\n')
}

function launcher (envVar) {
  const cmd = process.env[envVar]
  if (!cmd) return process.platform === 'win32' ? { shell: true, cmd: 'npx', lead: [] } : { cmd: 'npx', lead: [] }
  return /\.[cm]?js$/.test(cmd) ? { cmd: process.execPath, lead: [cmd] } : { cmd, lead: [] }
}

function launch ({ cmd, lead, shell }, args, cwd) {
  const all = [...lead, ...args]
  return shell ? spawnSync([cmd, ...all].join(' '), { stdio: 'inherit', shell: true, cwd }) : spawnSync(cmd, all, { stdio: 'inherit', cwd })
}

function runSkills (args, cwd) {
  const r = launch(launcher('DEVFLOW_SKILLS_CMD'), [SKILLS_PIN, ...args], cwd)
  if (r.error || r.status !== 0) throw new Error(`npx skills ${args[0]} failed${r.error ? `: ${r.error.message}` : ` (exit ${r.status})`}`)
}

function upstreamAddArgs (agent, pack, scope) {
  return ['add', PACKS[pack].source, '-a', agent, '-s', ...packSkills(pack), '-y', ...(scope === 'user' ? ['-g'] : [])]
}

function upstreamRemoveArgs (names, scope) {
  return ['remove', ...names, ...(scope === 'user' ? ['-g'] : []), '-y']
}

function recordFile (scope, base) {
  return scope === 'user' ? path.join(base, '.config', 'devflow', 'installs.json') : path.join(base, '.devflow', 'installs.json')
}

function mapPaths (entry, f) {
  const out = { ...entry, files: entry.files.map(f), blocks: entry.blocks.map(b => ({ ...b, file: f(b.file) })), dirs: entry.dirs.map(f) }
  if (entry.upstream) out.upstream = { ...entry.upstream, dirs: entry.upstream.dirs.map(f), files: entry.upstream.files.map(f) }
  return out
}

function readRecord (scope, base) {
  let list
  try { list = readJson(recordFile(scope, base)) } catch { return [] }
  if (!Array.isArray(list)) return []
  return scope === 'user' ? list : list.map(e => mapPaths(e, f => path.join(base, ...f.split('/'))))
}

function ensureDir (dir, made) {
  const missing = []
  for (let d = dir; !fs.existsSync(d) && !missing.includes(d); d = path.dirname(d)) missing.push(d)
  fs.mkdirSync(dir, { recursive: true })
  made.push(...missing.reverse())
}

function writeRecord (scope, base, list, made) {
  const file = recordFile(scope, base)
  if (!list.length) { fs.rmSync(file, { force: true }); return }
  ensureDir(path.dirname(file), made)
  const stored = scope === 'user' ? list : list.map(e => mapPaths(e, f => relative(base, f)))
  fs.writeFileSync(file, JSON.stringify(stored, null, 2) + '\n')
}

function pruneDirs (dirs) {
  for (const d of [...new Set(dirs)].sort((a, b) => b.length - a.length)) {
    try { fs.rmdirSync(d) } catch {}
  }
}

function listFiles (dir, rel = []) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? listFiles(path.join(dir, e.name), [...rel, e.name]) : [[...rel, e.name]])
}

function putFile (entry, file, text) {
  ensureDir(path.dirname(file), entry.dirs)
  fs.writeFileSync(file, text)
  if (!entry.files.includes(file)) entry.files.push(file)
}

function skillFiles (ctx) {
  const out = []
  for (const name of fs.readdirSync(path.join(PLUGIN, 'skills')).sort()) {
    const from = path.join(PLUGIN, 'skills', name)
    for (const rel of listFiles(from)) {
      const file = path.join(ctx.skillsDir, names(ctx.adapter.entrySkill, name), ...rel)
      const text = fs.readFileSync(path.join(from, ...rel), 'utf8')
      out.push([file, renderSkill(text, { ...ctx, name: rel.join('/') === 'SKILL.md' ? name : null })])
    }
  }
  return out
}

const BLOCKS = {
  markdown: {
    add (entry, file, body) {
      const existed = fs.existsSync(file)
      const old = existed ? stripMarkdown(fs.readFileSync(file, 'utf8'), entry.agent) : ''
      const block = `${beginMarker(entry.agent)}\n${body}\n${endMarker(entry.agent)}\n`
      ensureDir(path.dirname(file), entry.dirs)
      fs.writeFileSync(file, old ? `${old}${old.endsWith('\n') ? '' : '\n'}\n${block}` : block)
      entry.blocks.push({ file, type: 'markdown', agent: entry.agent, created: !existed })
    },
    remove (block) {
      let text
      try { text = fs.readFileSync(block.file, 'utf8') } catch { return }
      const out = stripMarkdown(text, block.agent)
      if (block.created && !out.trim()) fs.rmSync(block.file, { force: true })
      else fs.writeFileSync(block.file, out)
    }
  },
  'json-list': {
    add (entry, file, { key, value }) {
      const existed = fs.existsSync(file)
      const json = readConfig(file, key, value)
      const createdKey = !(key in json)
      json[key] = json[key] || []
      if (!json[key].includes(value)) json[key].push(value)
      ensureDir(path.dirname(file), entry.dirs)
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
      entry.blocks.push({ file, type: 'json-list', created: !existed, key, value, createdKey })
    },
    remove (block) {
      if (!fs.existsSync(block.file)) return
      let json
      try { json = readConfig(block.file, block.key, block.value) } catch {
        console.error(`${block.file} has comments or isn't plain JSON now, so devflow left it alone. Remove "${block.value}" from its "${block.key}" list yourself.`)
        return
      }
      json[block.key] = json[block.key].filter(v => v !== block.value)
      if (block.createdKey && !json[block.key].length) delete json[block.key]
      if (block.created && !Object.keys(json).length) fs.rmSync(block.file, { force: true })
      else fs.writeFileSync(block.file, JSON.stringify(json, null, 2) + '\n')
    }
  },
  'json-hooks': {
    add (entry, file, hooks, top = {}) {
      const existed = fs.existsSync(file)
      const json = readHooksFile(file)
      const added = {}
      for (const [k, v] of Object.entries(top)) if (!(k in json)) { json[k] = v; added[k] = v }
      json.hooks ||= {}
      for (const [event, groups] of Object.entries(hooks)) json.hooks[event] = [...(json.hooks[event] || []), ...groups]
      ensureDir(path.dirname(file), entry.dirs)
      fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n')
      entry.blocks.push({ file, type: 'json-hooks', created: !existed, hooks, ...(Object.keys(added).length ? { top: added } : {}) })
    },
    remove (block) {
      if (!fs.existsSync(block.file)) return
      let json
      try { json = readJson(block.file) } catch {
        console.error(`${block.file} isn't valid JSON now, so devflow left it alone. Remove devflow's hooks from it yourself.`)
        return
      }
      for (const [event, groups] of Object.entries(block.hooks)) {
        const mine = groups.map(g => JSON.stringify(g))
        const kept = (json.hooks?.[event] || []).filter(g => !mine.includes(JSON.stringify(g)))
        if (kept.length) json.hooks[event] = kept
        else if (json.hooks) delete json.hooks[event]
      }
      if (json.hooks && !Object.keys(json.hooks).length) delete json.hooks
      for (const [k, v] of Object.entries(block.top || {})) if (JSON.stringify(json[k]) === JSON.stringify(v)) delete json[k]
      if (block.created && !Object.keys(json).length) fs.rmSync(block.file, { force: true })
      else fs.writeFileSync(block.file, JSON.stringify(json, null, 2) + '\n')
    }
  }
}

function stripMarkdown (text, agent) {
  const start = text.indexOf(beginMarker(agent))
  const end = text.indexOf(endMarker(agent), start)
  if (start < 0 || end < 0) return text
  let to = end + endMarker(agent).length
  if (text[to] === '\n') to++
  if (start === 0 && text[to] === '\n') to++
  const from = start > 0 && text[start - 1] === '\n' ? start - 1 : start
  return text.slice(0, from) + text.slice(to)
}

function removeLocal (entry) {
  for (const f of entry.files) fs.rmSync(f, { force: true })
  for (const b of entry.blocks) BLOCKS[b.type].remove(b)
}

function handOffCreated (entry, rest) {
  for (const b of entry.blocks) {
    if (!b.created) continue
    const other = rest.flatMap(e => e.blocks).find(o => o.file === b.file && o.type === b.type)
    if (other) other.created = true
  }
}

function upstreamPaths (scope, base) {
  const agents = path.join(base, '.agents')
  return { dirs: [agents, path.join(agents, 'skills')], lock: scope === 'user' ? path.join(agents, '.skill-lock.json') : path.join(base, 'skills-lock.json') }
}

function missingUpstream (scope, base) {
  const { dirs, lock } = upstreamPaths(scope, base)
  return { dirs: dirs.filter(d => !fs.existsSync(d)), files: fs.existsSync(lock) ? [] : [lock] }
}

function mergeUpstream (a, b) {
  const both = key => [...new Set([...(a?.[key] || []), ...(b?.[key] || [])])]
  return { dirs: both('dirs'), files: both('files'), names: both('names') }
}

function addedUpstream (scope, base) {
  const { dirs, lock } = upstreamPaths(scope, base)
  let had = []
  try { had = Object.keys(readJson(lock).skills) } catch {}
  try { had.push(...fs.readdirSync(dirs[1])) } catch {}
  const names = Object.keys(PACKS).flatMap(packSkills).filter(n => !had.includes(n))
  return { ...missingUpstream(scope, base), names }
}

function dropUpstream ({ dirs, files }) {
  for (const f of files) {
    let skills
    try { skills = readJson(f).skills } catch { continue }
    if (!skills || !Object.keys(skills).length) fs.rmSync(f, { force: true })
  }
  pruneDirs(dirs)
}

function plan (name, scope) {
  const adapter = ADAPTERS[name]
  if (!adapter) throw new Error(`unknown agent ${name}; use one of ${agentNames().join(', ')}`)
  if (!['user', 'project'].includes(scope)) throw new Error(`unknown scope ${scope}; use user or project`)
  const base = scope === 'user' ? os.homedir() : projectRoot()
  const where = spec => path.join(base, ...at(spec, scope).split('/'))
  const pluginDir = path.join(base, ...(scope === 'user' ? ['.config', 'devflow'] : ['.devflow']), 'runtime', name)
  const ref = scope === 'user' ? p => p : p => relative(base, p)
  return { adapter, base, where, pluginDir, ref }
}

function relative (base, file) {
  return path.relative(base, file).split(path.sep).join('/')
}

function putRuntime (entry, { pluginDir, agent, scope }) {
  for (const dir of ['scripts', 'hooks']) {
    for (const rel of listFiles(path.join(PLUGIN, dir))) putFile(entry, path.join(pluginDir, dir, ...rel), fs.readFileSync(path.join(PLUGIN, dir, ...rel)))
  }
  putFile(entry, path.join(pluginDir, 'agent.json'), JSON.stringify({ agent, scope }) + '\n')
}

export function install ({ agent, scope = 'user', log = () => {} }) {
  const { adapter, base, where, pluginDir, ref } = plan(agent, scope)
  const skillsDir = where(adapter.skills)
  const backstop = adapter.backstop
  const ctx = { adapter, skillsDir, where, pluginDir, ref, agent, scope, backstop }
  const rendered = adapter.hooks ? HOOK_FORMATS[adapter.hooks.format](adapter, ctx) : {}
  if (rendered.hooks) readHooksFile(where(adapter.hooks.file))
  const added = addedUpstream(scope, base)
  for (const pack of Object.keys(PACKS)) runSkills(upstreamAddArgs(agent, pack, scope), scope === 'project' ? base : undefined)

  const record = readRecord(scope, base)
  const prior = record.find(e => e.agent === agent && e.scope === scope)
  let rest = record.filter(e => e !== prior)
  if (prior) {
    removeLocal(prior)
    handOffCreated(prior, rest)
    writeRecord(scope, base, rest, [])
    pruneDirs(prior.dirs)
  }

  const entry = { agent, scope, version: packageVersion(), files: [], blocks: [], dirs: (prior?.dirs || []).filter(d => fs.existsSync(d)), upstream: mergeUpstream(prior?.upstream, added) }
  try {
    putRuntime(entry, { pluginDir, agent, scope })
    for (const [file, text] of skillFiles(ctx)) putFile(entry, file, text)
    if (rendered.hooks) BLOCKS['json-hooks'].add(entry, where(adapter.hooks.file), rendered.hooks, rendered.top)
    for (const [name, text] of Object.entries(rendered.files || {})) putFile(entry, path.join(where(adapter.hooks.file), name), text)
    if (rendered.register) BLOCKS['json-list'].add(entry, rendered.register.file, rendered.register)
    if (backstop) putFile(entry, where(backstop.file), BACKSTOP_FORMATS[backstop.format](adapter, ctx))
    if (adapter.rule) putFile(entry, where(adapter.rule.file), RULE_FORMATS[adapter.rule.format](adapter, ctx))
    if (adapter.instructions) BLOCKS.markdown.add(entry, where(adapter.instructions), instructionsBody(adapter, ctx))
  } finally {
    rest = [...rest, entry]
    writeRecord(scope, base, rest, entry.dirs)
  }
  log(`installed devflow for ${AGENTS[agent].label}: ${entry.files.length} files and ${entry.blocks.length} edited files, recorded in ${recordFile(scope, base)}`)
  return entry
}

export function uninstall ({ agent, scope = 'user', log = () => {} }) {
  const { base } = plan(agent, scope)
  const record = readRecord(scope, base)
  const entry = record.find(e => e.agent === agent && e.scope === scope)
  if (!entry) throw new Error(`devflow isn't installed for ${agent}`)
  const rest = record.filter(e => e !== entry)
  removeLocal(entry)
  handOffCreated(entry, rest)
  const keeper = rest[0]
  if (!keeper) writeRecord(scope, base, rest, [])
  pruneDirs(entry.dirs)
  if (keeper) {
    keeper.upstream = mergeUpstream(keeper.upstream, entry.upstream)
    keeper.dirs = [...new Set([...keeper.dirs, ...entry.dirs.filter(d => fs.existsSync(d))])]
    writeRecord(scope, base, rest, [])
  }
  log(`removed devflow's files for ${AGENTS[agent].label}`)
  if (keeper) {
    log('left the skills from npx skills in place: another agent installed here still uses them')
    return entry
  }
  for (const pack of Object.keys(PACKS)) {
    const names = packSkills(pack).filter(n => entry.upstream?.names?.includes(n))
    if (names.length) runSkills(upstreamRemoveArgs(names, scope), scope === 'project' ? base : undefined)
  }
  if (entry.upstream) dropUpstream(entry.upstream)
  return entry
}

const UPDATE_SPEC = 'github:itsrob00/devflow#semver:*'

export function update ({ agent, project = false, local = false, log = () => {} }) {
  const targets = []
  for (const scope of project ? ['project'] : ['user', 'project']) {
    const base = scope === 'user' ? os.homedir() : projectRoot()
    for (const e of readRecord(scope, base)) if (!agent || e.agent === agent) targets.push({ ...e, base })
  }
  if (!targets.length) throw new Error(`nothing to update: no devflow install is recorded${agent ? ` for ${agent}` : ''}`)
  const failed = []
  for (const { agent: name, scope, base } of targets) {
    log(`updating devflow for ${name} (${scope})`)
    try {
      if (local) {
        install({ agent: name, scope, log })
        continue
      }
      const r = launch(launcher('DEVFLOW_UPDATE_CMD'), [UPDATE_SPEC, 'install', '--agent', name, ...(scope === 'project' ? ['--project'] : [])], scope === 'project' ? base : undefined)
      if (r.error || r.status !== 0) throw new Error(r.error ? r.error.message : `the install exited ${r.status}`)
    } catch (e) {
      failed.push(`${name} (${scope}): ${e.message}`)
    }
  }
  if (failed.length) throw new Error(`update failed for ${failed.join('; ')}`)
}
