// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { allowed, blocked } from './guard-cases.mjs'
import { readJson, sandbox, tree, version, write } from './helpers.mjs'

const config = home => path.join(home, '.config', 'opencode')

test('install --agent opencode puts every file where OpenCode V2 reads it, registers the plugin and records them', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  const r = s.run('install', '--agent', 'opencode')
  assert.equal(r.status, 0, r.stderr)

  const skills = path.join(s.home, '.config', 'opencode', 'skills')
  for (const n of ['start', 'continue', 'setup', 'wrap']) {
    const text = fs.readFileSync(path.join(skills, `devflow-${n}`, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^name: devflow-${n}$`, 'm'))
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/)
    assert.doesNotMatch(text, /\/devflow:/)
  }
  const start = fs.readFileSync(path.join(skills, 'devflow-start', 'SKILL.md'), 'utf8')
  assert.ok(start.includes('`@devflow-continue`'))
  for (const f of ['feature', 'bug', 'big']) assert.ok(fs.existsSync(path.join(skills, 'devflow-start', 'flows', `${f}.md`)))

  const plugin = path.join(config(s.home), 'devflow-plugin')
  const pkg = readJson(path.join(plugin, 'package.json'))
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.exports['.'], './index.js')
  const source = fs.readFileSync(path.join(plugin, 'index.js'), 'utf8')
  assert.match(source, /execute\.before/)
  assert.match(source, /'context'/)
  assert.ok(source.includes(`const PLUGIN_DIR = ${JSON.stringify(path.join(s.home, '.config', 'devflow', 'runtime', 'opencode'))}`))
  assert.doesNotMatch(source, /CLAUDE_PLUGIN_ROOT/)

  assert.deepEqual(readJson(path.join(config(s.home), 'opencode.jsonc')), { plugins: ['./devflow-plugin'] })
  assert.ok(!fs.existsSync(path.join(config(s.home), 'opencode.json')))

  const agents = fs.readFileSync(path.join(config(s.home), 'AGENTS.md'), 'utf8')
  assert.match(agents, /^<!-- devflow:begin opencode -->\n[\s\S]*\n<!-- devflow:end opencode -->\n$/)
  assert.match(agents, /git push/)
  assert.match(agents, /`devflow active`/)
  assert.match(agents, /@devflow-start/)

  assert.ok(!fs.existsSync(path.join(s.home, '.codex')))

  const record = readJson(s.userRecord)
  assert.equal(record.length, 1)
  const [entry] = record
  assert.equal(entry.agent, 'opencode')
  assert.equal(entry.scope, 'user')
  assert.equal(entry.version, version)
  const recorded = new Set([...entry.files, ...entry.blocks.map(b => b.file)])
  const onDisk = new Set(Object.entries(tree(s.home)).filter(([, v]) => v !== null).map(([p]) => path.join(s.home, p)).filter(p => p !== s.userRecord))
  assert.deepEqual([...recorded].sort(), [...onDisk].sort())
  assert.ok(entry.files.includes(path.join(plugin, 'index.js')))
  assert.ok(entry.files.includes(path.join(plugin, 'package.json')))
  assert.deepEqual(entry.blocks.map(b => b.file).sort(), [path.join(config(s.home), 'AGENTS.md'), path.join(config(s.home), 'opencode.jsonc')].sort())

  const [matt, pstack] = s.calls()
  assert.deepEqual(matt.slice(0, 5), ['skills@1.7.4', 'add', 'mattpocock/skills', '-a', 'opencode'])
  assert.deepEqual(pstack.slice(0, 5), ['skills@1.7.4', 'add', 'backnotprop/pstack', '-a', 'opencode'])
})

test('install merges into an existing opencode.json and uninstall removes only its own entry', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  const mine = { $schema: 'https://opencode.ai/config.json', model: 'x/y', plugins: ['other-plugin', { package: 'p', options: { a: 1 } }] }
  write(path.join(config(s.home), 'opencode.json'), JSON.stringify(mine, null, 2) + '\n')
  write(path.join(config(s.home), 'AGENTS.md'), '# My rules\n\nBe brief.\n')
  write(path.join(s.home, '.config', 'opencode', 'skills', 'mine', 'SKILL.md'), '---\nname: mine\n---\n')
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const merged = readJson(path.join(config(s.home), 'opencode.json'))
  assert.deepEqual(merged, { ...mine, plugins: [...mine.plugins, './devflow-plugin'] })
  assert.ok(!fs.existsSync(path.join(config(s.home), 'opencode.jsonc')))
  assert.match(fs.readFileSync(path.join(config(s.home), 'AGENTS.md'), 'utf8'), /^# My rules\n\nBe brief\.\n/)

  const r = s.run('uninstall', '--agent', 'opencode')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), before)
  assert.deepEqual(readJson(path.join(config(s.home), 'opencode.json')), mine)
  assert.equal(s.calls().length, 4)
})

test('install writes into opencode.jsonc when that is the config that exists', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  write(path.join(config(s.home), 'opencode.jsonc'), '{"model": "x/y"}\n')
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  assert.deepEqual(readJson(path.join(config(s.home), 'opencode.jsonc')), { model: 'x/y', plugins: ['./devflow-plugin'] })
  assert.ok(!fs.existsSync(path.join(config(s.home), 'opencode.json')))
  assert.equal(s.run('uninstall', '--agent', 'opencode').status, 0)
  assert.deepEqual(readJson(path.join(config(s.home), 'opencode.jsonc')), { model: 'x/y' })
})

test('uninstall from a fresh home leaves the home empty', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'opencode').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

test('installing again replaces the earlier install instead of doubling it', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const first = tree(s.home)
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  assert.deepEqual(tree(s.home), first)
  assert.equal(readJson(s.userRecord).length, 1)
  assert.deepEqual(readJson(path.join(config(s.home), 'opencode.jsonc')).plugins, ['./devflow-plugin'])
})

test('a config with comments is refused with a clear message, before anything is written', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  const text = '{\n  // my model\n  "model": "x/y",\n}\n'
  write(path.join(config(s.home), 'opencode.jsonc'), text)
  const before = tree(s.home)
  const r = s.run('install', '--agent', 'opencode')
  assert.notEqual(r.status, 0)
  assert.ok(r.stderr.includes(path.join(config(s.home), 'opencode.jsonc')), r.stderr)
  assert.match(r.stderr, /comments/)
  assert.match(r.stderr, /"\.\/devflow-plugin"/)
  assert.deepEqual(tree(s.home), before)
  assert.deepEqual(s.calls(), [])
})

test('uninstall leaves a config the user has since filled with comments alone and says so', () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const file = path.join(config(s.home), 'opencode.jsonc')
  const text = '{\n  // mine\n  "plugins": ["./devflow-plugin"]\n}\n'
  write(file, text)
  const r = s.run('uninstall', '--agent', 'opencode')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(fs.readFileSync(file, 'utf8'), text)
  assert.match(r.stderr, /comments/)
  assert.ok(!fs.existsSync(path.join(config(s.home), 'devflow-plugin')))
})

async function loaded (s, { project = true, scope = 'user' } = {}) {
  fs.mkdirSync(s.sub, { recursive: true })
  process.env.HOME = s.home
  process.env.USERPROFILE = s.home
  for (const k of ['CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_CONFIG_DIR', 'DEVFLOW_GUARD']) delete process.env[k]
  const file = scope === 'user' ? path.join(config(s.home), 'devflow-plugin', 'index.js') : path.join(s.project, '.opencode', 'devflow-plugin', 'index.js')
  const mod = await import(pathToFileURL(file).href + `?${Math.random()}`)
  const hooks = { tool: {}, session: {} }
  const ctx = {
    location: { directory: s.sub, ...(project ? { project: { id: 'p', directory: s.project, canonical: s.project } } : {}) },
    options: {},
    tool: { hook: (name, fn) => { hooks.tool[name] = fn } },
    session: { hook: (name, fn) => { hooks.session[name] = fn } }
  }
  const cleanup = await mod.default.setup(ctx)
  return { mod: mod.default, hooks, proj: s.project, sub: s.sub, cleanup }
}

const tryRun = async (fn, event) => {
  try { await fn(event); return null } catch (e) { return e }
}

test('the installed plugin is an OpenCode V2 plugin that hooks tool execution and the session context', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { mod, hooks } = await loaded(s)
  assert.equal(typeof mod.id, 'string')
  assert.equal(typeof mod.setup, 'function')
  assert.deepEqual(Object.keys(hooks.tool).sort(), ['execute.after', 'execute.before'])
  assert.deepEqual(Object.keys(hooks.session), ['context'])
})

test('the plugin blocks every guard case in a conversation on a flow and allows the rest', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks, proj } = await loaded(s)
  s.link('ses_flow1')
  const event = (command, extra = {}) => ({ tool: 'shell', sessionID: 'ses_flow1', input: { command }, ...extra })
  for (const c of blocked) {
    const e = await tryRun(hooks.tool['execute.before'], event(c))
    assert.ok(e instanceof Error, `should block: ${JSON.stringify(c)}`)
    assert.match(e.message, /devflow git guard/)
  }
  for (const c of allowed) {
    const e = await tryRun(hooks.tool['execute.before'], event(c))
    assert.equal(e, null, `should allow: ${JSON.stringify(c)}: ${e && e.message}`)
  }
  assert.ok(await tryRun(hooks.tool['execute.before'], event('git push', { tool: 'bash' })))
})

test('the plugin lets everything through outside a flow, for other tools, and when the guard is off', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks, proj } = await loaded(s)
  s.link('ses_flow1')
  const before = hooks.tool['execute.before']
  assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_other', input: { command: 'git push' } }), null)
  assert.equal(await tryRun(before, { tool: 'read', sessionID: 'ses_flow1', input: { command: 'git push' } }), null)
  assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_flow1', input: {} }), null)
  assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_flow1' }), null)
  assert.ok(await tryRun(before, { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git push' } }))
  process.env.DEVFLOW_GUARD = 'off'
  try {
    assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git push' } }), null)
  } finally {
    delete process.env.DEVFLOW_GUARD
  }
  write(path.join(proj, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'done' }))
  assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git push' } }), null)
})

test('the plugin falls back to the session folder when OpenCode names no project', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks, proj } = await loaded(s, { project: false })
  s.link('ses_flow1')
  assert.ok(await tryRun(hooks.tool['execute.before'], { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git push' } }))
})

test('a devflow flow command run by the agent links its session to the flow, so the guard then holds', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks, proj } = await loaded(s)
  write(path.join(proj, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active', title: 'Cart' }))
  const push = { tool: 'shell', sessionID: 'ses_new', input: { command: 'git push' } }
  assert.equal(await tryRun(hooks.tool['execute.before'], push), null)
  const cmd = 'node "/x/devflow.mjs" flow set cart --step 2'
  await hooks.tool['execute.after']({ tool: 'shell', sessionID: 'ses_new', input: { command: cmd }, status: 'completed', result: { output: 'ok' } })
  assert.equal(fs.readFileSync(path.join(proj, '.devflow', 'sessions', 'ses_new'), 'utf8').trim(), 'cart')
  assert.ok(await tryRun(hooks.tool['execute.before'], push))
  await hooks.tool['execute.after']({ tool: 'read', sessionID: 'ses_x', input: { command: cmd }, status: 'completed', result: 'ok' })
  assert.ok(!fs.existsSync(path.join(proj, '.devflow', 'sessions', 'ses_x')))
  await hooks.tool['execute.after']({ tool: 'shell', sessionID: 'ses_err', input: { command: cmd }, status: 'error', error: { message: 'x' } })
  assert.ok(!fs.existsSync(path.join(proj, '.devflow', 'sessions', 'ses_err')))
})

const texts = event => event.system.map(p => p.text)
const settings = (s, json) => write(path.join(s.home, '.config', 'devflow', 'settings.json'), JSON.stringify(json))

test('the context hook gives the flow reminder when a flow is linked and nothing when none is', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  settings(s, { no_comments: false })
  const { hooks, proj } = await loaded(s)
  const ctx = (sessionID) => ({ sessionID, system: [{ type: 'text', text: 'base prompt' }], messages: [], tools: {}, options: {} })

  const none = ctx('ses_a')
  await hooks.session.context(none)
  assert.deepEqual(texts(none), ['base prompt'])

  s.link('ses_a')
  const linked = ctx('ses_a')
  await hooks.session.context(linked)
  assert.equal(linked.system.length, 2)
  assert.equal(linked.system[0].text, 'base prompt')
  assert.equal(linked.system[1].type, 'text')
  assert.match(linked.system[1].text, /devflow: on flow cart \(Feature: Cart\)/)

  const other = ctx('ses_b')
  await hooks.session.context(other)
  assert.ok(!texts(other).some(t => /on flow cart/.test(t)))

  write(path.join(proj, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'done' }))
  const done = ctx('ses_a')
  await hooks.session.context(done)
  assert.ok(!texts(done).some(t => /on flow cart/.test(t)))
})

test('the context hook carries the session-start reminder on every call of a session that is not on a flow', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  settings(s, { no_comments: false })
  const { hooks, proj } = await loaded(s)
  const ctx = (sessionID) => ({ sessionID, system: [], messages: [], tools: {}, options: {} })

  const quiet = ctx('ses_a')
  await hooks.session.context(quiet)
  assert.deepEqual(quiet.system, [])

  write(path.join(proj, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active', title: 'Cart' }))
  const first = ctx('ses_b')
  await hooks.session.context(first)
  assert.equal(first.system.length, 1)
  assert.match(first.system[0].text, /1 unfinished flow here \(Cart\)/)
  assert.match(first.system[0].text, /\(@devflow-continue in OpenCode\)/)
  const second = ctx('ses_b')
  await hooks.session.context(second)
  assert.deepEqual(texts(second), texts(first))

  s.link('ses_b')
  const linked = ctx('ses_b')
  await hooks.session.context(linked)
  assert.equal(linked.system.length, 1)
  assert.match(linked.system[0].text, /on flow cart/)
})

test('the context hook adds the no-comments rule when the setting is on and stays out of the way when it is off', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const ctx = (sessionID) => ({ sessionID, system: [], messages: [], tools: {}, options: {} })

  settings(s, { no_comments: false })
  const off = await loaded(s)
  const quiet = ctx('ses_a')
  await off.hooks.session.context(quiet)
  assert.equal(quiet.system.length, 0)

  settings(s, { no_comments: true })
  const on = await loaded(s)
  for (const id of ['ses_a', 'ses_a', 'ses_b']) {
    const e = ctx(id)
    await on.hooks.session.context(e)
    assert.equal(e.system.length, 1)
    assert.match(e.system[0].text, /comments or docstrings/)
  }
})

const GUARD_COULD_NOT_RUN = /devflow git guard.*couldn't run/

test('when the guard cannot run, the plugin blocks commands that mention git, with a reason, and lets the rest through', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks } = await loaded(s)
  const before = hooks.tool['execute.before']
  const guardFile = s.runtime('opencode', 'scripts', 'devflow-guard.mjs')
  const breakers = {
    'a missing script': () => fs.rmSync(guardFile),
    'a script that exits 3': () => write(guardFile, 'process.exit(3)\n'),
    'a script that throws': () => write(guardFile, "throw new Error('boom')\n"),
    'a script that prints something that is not JSON': () => write(guardFile, "process.stdout.write('not json')\n")
  }
  for (const [what, breakIt] of Object.entries(breakers)) {
    breakIt()
    for (const command of ['git status', 'cd x && git log', '/usr/bin/git push']) {
      const e = await tryRun(before, { tool: 'shell', sessionID: 'ses_any', input: { command } })
      assert.ok(e instanceof Error, `${what} should block: ${command}`)
      assert.match(e.message, GUARD_COULD_NOT_RUN)
    }
    for (const command of ['ls -la', 'npm test', 'gh pr view', 'cat .gitignore']) {
      assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_any', input: { command } }), null, `${what} should allow: ${command}`)
    }
  }
})

test('the plugin passes --agent opencode to every devflow script it runs', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const dir = s.runtime('opencode', 'scripts')
  const log = path.join(dir, 'argv.log')
  const stub = "import fs from 'node:fs'\nimport path from 'node:path'\nimport { fileURLToPath } from 'node:url'\nfs.appendFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'argv.log'), JSON.stringify(process.argv.slice(2)) + '\\n')\n"
  write(path.join(dir, 'devflow-guard.mjs'), stub)
  write(path.join(dir, 'devflow.mjs'), stub)
  const { hooks } = await loaded(s)
  await hooks.tool['execute.before']({ tool: 'shell', sessionID: 'ses_a', input: { command: 'git status' } })
  await hooks.tool['execute.after']({ tool: 'shell', sessionID: 'ses_a', input: { command: 'node devflow.mjs flow show x' }, status: 'completed', result: 'ok' })
  await hooks.session.context({ sessionID: 'ses_a', system: [] })
  const argv = fs.readFileSync(log, 'utf8').trim().split('\n').map(l => JSON.parse(l))
  assert.deepEqual(argv.map(a => a.filter(x => x !== '--agent' && x !== 'opencode')), [[], ['track'], ['rules'], ['reminder'], ['active']])
  for (const a of argv) assert.deepEqual(a.slice(-2), ['--agent', 'opencode'])
})

test('a project install of the plugin finds its scripts from a subfolder, whether or not OpenCode names the project', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  fs.mkdirSync(s.sub, { recursive: true })
  assert.equal(s.runProject('install', '--agent', 'opencode', '--project').status, 0)
  for (const project of [true, false]) {
    const { hooks } = await loaded(s, { scope: 'project', project })
    s.link('ses_flow1')
    const e = await tryRun(hooks.tool['execute.before'], { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git push' } })
    assert.ok(e instanceof Error, `project named: ${project}`)
    assert.match(e.message, /devflow git guard: git push is blocked/)
    assert.equal(await tryRun(hooks.tool['execute.before'], { tool: 'shell', sessionID: 'ses_flow1', input: { command: 'git status' } }), null)
  }
})

test('tool events without a session id use the session the context hook last saw, so the guard and linking still work', async () => {
  const s = sandbox({ name: 'devflow-opencode' })
  assert.equal(s.run('install', '--agent', 'opencode').status, 0)
  const { hooks, proj } = await loaded(s)
  write(path.join(proj, '.devflow', 'flows', 'cart', 'state.json'), JSON.stringify({ flow: 'feature', status: 'active', title: 'Cart' }))
  const before = hooks.tool['execute.before']
  assert.equal(await tryRun(before, { tool: 'shell', input: { command: 'git push' } }), null)
  await hooks.session.context({ sessionID: 'ses_ctx', system: [], messages: [], tools: {}, options: {} })
  await hooks.tool['execute.after']({ tool: 'shell', input: { command: 'node "/x/devflow.mjs" flow show cart' }, status: 'completed', result: { output: 'ok' } })
  assert.equal(fs.readFileSync(path.join(proj, '.devflow', 'sessions', 'ses_ctx'), 'utf8').trim(), 'cart')
  assert.ok(await tryRun(before, { tool: 'shell', input: { command: 'git push' } }))
  assert.equal(await tryRun(before, { tool: 'shell', sessionID: 'ses_other', input: { command: 'git push' } }), null)
})
