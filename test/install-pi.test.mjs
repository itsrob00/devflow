// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { allowed, blocked } from './guard-cases.mjs'
import { askAll, devflow, feed, guard, readJson, sandbox, tree, write } from './helpers.mjs'

const runtime = home => path.join(home, '.config', 'devflow', 'runtime', 'pi', 'scripts')

test('install --agent pi puts every file where Pi reads it and records them', () => {
  const s = sandbox({ name: 'devflow-pi' })
  const r = s.run('install', '--agent', 'pi')
  assert.equal(r.status, 0, r.stderr)

  const skills = path.join(s.home, '.pi', 'agent', 'skills')
  for (const n of ['start', 'continue', 'setup', 'wrap']) {
    const text = fs.readFileSync(path.join(skills, `devflow-${n}`, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^name: devflow-${n}$`, 'm'))
    assert.doesNotMatch(text, /CLAUDE_PLUGIN_ROOT/)
    assert.doesNotMatch(text, /\/devflow:/)
  }
  assert.ok(fs.readFileSync(path.join(skills, 'devflow-start', 'SKILL.md'), 'utf8').includes('`/skill:devflow-continue`'))

  const extension = fs.readFileSync(path.join(s.home, '.pi', 'agent', 'extensions', 'devflow.ts'), 'utf8')
  assert.match(extension, /export default function \(pi\)/)
  for (const event of ['tool_call', 'tool_result', 'before_agent_start', 'session_start']) assert.ok(extension.includes(`pi.on('${event}'`), event)
  assert.ok(extension.includes(JSON.stringify(runtime(s.home))))
  assert.ok(extension.includes('devflow-guard.mjs'))
  assert.doesNotMatch(extension, /CLAUDE_PLUGIN_ROOT|\$\{/)

  const agents = fs.readFileSync(path.join(s.home, '.pi', 'agent', 'AGENTS.md'), 'utf8')
  assert.match(agents, /^<!-- devflow:begin pi -->\n[\s\S]*\n<!-- devflow:end pi -->\n$/)
  assert.match(agents, /git push/)
  assert.match(agents, /`devflow active`/)
  assert.ok(agents.includes('/skill:devflow-start'))
  assert.ok(agents.includes(`node "${path.join(runtime(s.home), 'devflow.mjs')}"`))

  const [entry, ...others] = readJson(s.userRecord)
  assert.equal(others.length, 0)
  assert.equal(entry.agent, 'pi')
  assert.equal(entry.scope, 'user')
  const recorded = new Set([...entry.files, ...entry.blocks.map(b => b.file)])
  const onDisk = new Set(Object.entries(tree(s.home)).filter(([, v]) => v !== null).map(([p]) => path.join(s.home, p)).filter(p => p !== s.userRecord))
  assert.deepEqual([...recorded].sort(), [...onDisk].sort())
  assert.ok(entry.files.includes(path.join(s.home, '.pi', 'agent', 'extensions', 'devflow.ts')))
  assert.deepEqual(entry.blocks.map(b => b.file), [path.join(s.home, '.pi', 'agent', 'AGENTS.md')])

  const calls = s.calls()
  assert.deepEqual(calls[0].slice(0, 5), ['skills@1.7.4', 'add', 'mattpocock/skills', '-a', 'pi'])
  assert.deepEqual(calls[1].slice(0, 5), ['skills@1.7.4', 'add', 'backnotprop/pstack', '-a', 'pi'])
})

test('uninstall --agent pi puts the home folder back, keeping the user\'s own extensions and notes', () => {
  const s = sandbox({ name: 'devflow-pi' })
  write(path.join(s.home, '.pi', 'agent', 'AGENTS.md'), '# Notes\n\nBe brief.\n')
  write(path.join(s.home, '.pi', 'agent', 'extensions', 'mine.ts'), 'export default function (pi) {}\n')
  const before = tree(s.home)

  assert.equal(s.run('install', '--agent', 'pi').status, 0)
  assert.match(fs.readFileSync(path.join(s.home, '.pi', 'agent', 'AGENTS.md'), 'utf8'), /^# Notes\n\nBe brief\.\n/)
  const first = tree(s.home)
  assert.equal(s.run('install', '--agent', 'pi').status, 0)
  assert.deepEqual(tree(s.home), first)

  const r = s.run('uninstall', '--agent', 'pi')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), before)
})

test('uninstall --agent pi from a fresh home leaves the home empty', () => {
  const s = sandbox({ name: 'devflow-pi' })
  assert.equal(s.run('install', '--agent', 'pi').status, 0)
  assert.equal(s.run('uninstall', '--agent', 'pi').status, 0)
  assert.deepEqual(fs.readdirSync(s.home), [])
})

function flowSandbox () {
  const s = sandbox({ name: 'devflow-pi' })
  s.link('019f-pi-session', 'cart', { flow: 'feature', title: 'Cart totals', status: 'active', step: '2. Plan' })
  fs.mkdirSync(s.sub, { recursive: true })
  return s
}

test('fed Pi\'s tool_call as the extension sends it, the guard blocks every case in the guard tests and allows the rest, in Pi\'s reply format', async () => {
  const s = flowSandbox()
  const ask = (command, extra = {}) => feed(guard, ['--agent', 'pi'], { session_id: '019f-pi-session', cwd: s.sub, hook_event_name: 'tool_call', tool_name: 'bash', tool_input: { command }, ...extra }, { env: s.env, cwd: s.outside })

  const denied = await askAll(blocked, c => ask(c))
  denied.forEach((r, i) => {
    assert.equal(r.code, 0, `should exit 0: ${JSON.stringify(blocked[i])}`)
    const reply = JSON.parse(r.stdout || 'null')
    assert.equal(reply?.block, true, `should block: ${JSON.stringify(blocked[i])}`)
    assert.match(reply.reason, /^devflow git guard: .*\. Don't work around it; give the user the exact command to run\.$/)
    assert.equal(reply.hookSpecificOutput, undefined)
  })
  const passed = await askAll(allowed, c => ask(c))
  passed.forEach((r, i) => {
    assert.equal(r.code, 0)
    assert.equal(r.stdout, '', `should allow: ${JSON.stringify(allowed[i])}`)
  })
  assert.equal(JSON.parse((await ask('git push', { tool_name: 'powershell' })).stdout).block, true)
  assert.equal((await ask('git push', { tool_name: 'write' })).stdout, '')
  assert.equal((await ask('git push', { session_id: 'someone-else' })).stdout, '')
  assert.equal((await ask('git push', { cwd: s.outside })).stdout, '')
})

async function loadExtension (s) {
  assert.equal(s.run('install', '--agent', 'pi').status, 0)
  const text = fs.readFileSync(path.join(s.home, '.pi', 'agent', 'extensions', 'devflow.ts'), 'utf8')
  const file = path.join(s.outside, 'devflow-extension.mjs')
  fs.writeFileSync(file, text)
  const handlers = {}
  const mod = await import(pathToFileURL(file).href + '?' + Math.random())
  mod.default({ on: (event, fn) => { handlers[event] = fn } })
  return handlers
}

async function withHome (s, fn) {
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }
  process.env.HOME = s.home
  process.env.USERPROFILE = s.home
  for (const k of ['CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'CLAUDE_CONFIG_DIR', 'DEVFLOW_GUARD', 'DEVFLOW_AGENT']) delete process.env[k]
  try { return await fn() } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

test('the installed Pi extension blocks guarded bash calls, lets others through, and adds the reminder before the agent starts', async () => {
  const s = flowSandbox()
  await withHome(s, async () => {
    const h = await loadExtension(s)
    const ctx = (id = '019f-pi-session') => ({ cwd: s.sub, sessionManager: { getSessionId: () => id }, ui: { notify: (m) => notes.push(m) } })
    const notes = []
    const call = (toolName, command, id) => h.tool_call({ type: 'tool_call', toolCallId: 'c1', toolName, input: { command } }, ctx(id))

    for (const c of blocked) {
      const r = await call('bash', c)
      assert.equal(r.block, true, `should block: ${JSON.stringify(c)}`)
      assert.match(r.reason, /git guard/)
    }
    for (const c of allowed) assert.equal(await call('bash', c), undefined, `should allow: ${JSON.stringify(c)}`)
    assert.equal(await call('read', 'git push'), undefined)
    assert.equal(await call('bash', 'git push', 'other-session'), undefined)

    const first = await h.before_agent_start({ type: 'before_agent_start', messageType: 'user', prompt: 'go with B', systemPrompt: '' }, ctx())
    assert.equal(first.message.customType, 'devflow')
    assert.equal(first.message.display, false)
    assert.match(first.message.content, /1 unfinished flow here \(Cart totals\)/)
    assert.match(first.message.content, /Don't add comments/)
    assert.match(first.message.content, /on flow cart \(Feature: Cart totals\), step 2\. Plan/)
    assert.ok(notes.some(n => /1 unfinished flow here/.test(n)))

    const second = await h.before_agent_start({ type: 'before_agent_start', messageType: 'user', prompt: 'ok', systemPrompt: '' }, ctx())
    assert.doesNotMatch(second.message.content, /Don't add comments|unfinished flow/)
    assert.match(second.message.content, /on flow cart/)
    assert.equal(await h.before_agent_start({ type: 'before_agent_start', messageType: 'user', prompt: 'ok', systemPrompt: '' }, ctx('nobody')), undefined)

    await h.session_start({ type: 'session_start', reason: 'new' }, ctx())
    const third = await h.before_agent_start({ type: 'before_agent_start', messageType: 'user', prompt: 'again', systemPrompt: '' }, ctx())
    assert.match(third.message.content, /Don't add comments/)
  })
})

test('the installed Pi extension links a conversation to the flow its devflow commands name, so the guard starts to act', async () => {
  const s = flowSandbox()
  await withHome(s, async () => {
    const h = await loadExtension(s)
    const ctx = id => ({ cwd: s.sub, sessionManager: { getSessionId: () => id } })
    const made = spawnSync(process.execPath, [devflow, 'flow', 'new', 'bug', 'Header overlaps'], { cwd: s.project, env: s.env, encoding: 'utf8' })
    assert.equal(made.status, 0, made.stderr)
    const id = made.stdout.split('\t')[0]
    const command = `node "${devflow}" flow new bug "Header overlaps"`

    assert.equal(await h.tool_call({ type: 'tool_call', toolCallId: 'a', toolName: 'bash', input: { command: 'git push' } }, ctx('pi-new')), undefined)
    await h.tool_result({ type: 'tool_result', toolCallId: 'a', toolName: 'bash', input: { command }, content: [{ type: 'text', text: `${id}\t.devflow/flows/${id}\n` }], isError: false }, ctx('pi-new'))
    assert.equal(fs.readFileSync(path.join(s.project, '.devflow', 'sessions', 'pi-new'), 'utf8').trim(), id)
    const r = await h.tool_call({ type: 'tool_call', toolCallId: 'b', toolName: 'bash', input: { command: 'git push' } }, ctx('pi-new'))
    assert.equal(r.block, true)
  })
})

test('a --project install of pi writes .pi/extensions, .pi/skills and the repo AGENTS.md with repo-relative paths, and the extension still guards; uninstall restores the repo', async () => {
  const s = flowSandbox()
  const p = (...x) => path.join(s.project, ...x)
  const homeBefore = tree(s.home)
  const before = tree(s.project)
  const r = s.runProject('install', '--agent', 'pi', '--project')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(tree(s.home), homeBefore)
  for (const n of ['start', 'continue', 'setup', 'wrap']) assert.match(fs.readFileSync(p('.pi', 'skills', `devflow-${n}`, 'SKILL.md'), 'utf8'), new RegExp(`^name: devflow-${n}$`, 'm'))
  const text = fs.readFileSync(p('.pi', 'extensions', 'devflow.ts'), 'utf8')
  assert.ok(text.includes('".devflow/runtime/pi/scripts"'))
  const agents = fs.readFileSync(p('AGENTS.md'), 'utf8')
  assert.match(agents, /^<!-- devflow:begin pi -->\n[\s\S]*\n<!-- devflow:end pi -->\n$/)
  assert.ok(agents.includes('node ".devflow/runtime/pi/scripts/devflow.mjs"'))
  assert.ok(!fs.existsSync(p('.pi', 'agent')))

  await withHome(s, async () => {
    const file = path.join(s.outside, 'devflow-project-extension.mjs')
    fs.writeFileSync(file, text)
    const handlers = {}
    const mod = await import(pathToFileURL(file).href + '?' + Math.random())
    mod.default({ on: (event, fn) => { handlers[event] = fn } })
    const ctx = { cwd: s.project, sessionManager: { getSessionId: () => '019f-pi-session' } }
    const call = command => handlers.tool_call({ type: 'tool_call', toolCallId: 'c1', toolName: 'bash', input: { command } }, ctx)
    assert.equal((await call('git push')).block, true)
    assert.equal(await call('git status'), undefined)
  })

  assert.equal(s.runProject('uninstall', '--agent', 'pi', '--project').status, 0)
  assert.deepEqual(tree(s.project), before)
  assert.deepEqual(tree(s.home), homeBefore)
})

test('when the guard cannot run, the Pi extension blocks bash and powershell commands that mention git, with a reason, and lets the rest through', async () => {
  const s = flowSandbox()
  await withHome(s, async () => {
    const h = await loadExtension(s)
    const ctx = { cwd: s.sub, sessionManager: { getSessionId: () => 'someone-else' } }
    const call = (toolName, command) => h.tool_call({ type: 'tool_call', toolCallId: 'c', toolName, input: { command } }, ctx)
    const guardFile = path.join(runtime(s.home), 'devflow-guard.mjs')
    const breakers = {
      'a missing script': () => fs.rmSync(guardFile),
      'a script that exits 3': () => write(guardFile, 'process.exit(3)\n'),
      'a script that prints something that is not JSON': () => write(guardFile, "process.stdout.write('not json')\n")
    }
    for (const [what, breakIt] of Object.entries(breakers)) {
      breakIt()
      for (const toolName of ['bash', 'powershell']) {
        for (const command of ['git status', 'cd x && git log']) {
          const r = await call(toolName, command)
          assert.equal(r?.block, true, `${what} should block ${toolName}: ${command}`)
          assert.match(r.reason, /devflow git guard.*couldn't run/)
        }
        for (const command of ['ls -la', 'gh pr view', 'cat .gitignore']) assert.equal(await call(toolName, command), undefined, `${what} should allow ${toolName}: ${command}`)
      }
      assert.equal(await call('read', 'git status'), undefined)
    }
  })
})

test('a project install of the Pi extension finds its scripts from a subfolder of the project', async () => {
  const s = flowSandbox()
  assert.equal(s.runProject('install', '--agent', 'pi', '--project').status, 0)
  await withHome(s, async () => {
    const file = path.join(s.outside, 'devflow-subfolder-extension.mjs')
    fs.writeFileSync(file, fs.readFileSync(path.join(s.project, '.pi', 'extensions', 'devflow.ts'), 'utf8'))
    const handlers = {}
    const mod = await import(pathToFileURL(file).href + '?' + Math.random())
    mod.default({ on: (event, fn) => { handlers[event] = fn } })
    const ctx = { cwd: s.sub, sessionManager: { getSessionId: () => '019f-pi-session' } }
    const call = command => handlers.tool_call({ type: 'tool_call', toolCallId: 'c1', toolName: 'bash', input: { command } }, ctx)
    const r = await call('git push')
    assert.equal(r?.block, true)
    assert.match(r.reason, /git push is blocked/)
    assert.equal(await call('git status'), undefined)
  })
})
