# devflow

**A guided workflow for coding agents, built as a Claude Code plugin and installable on three more, that turns Matt Pocock's skills and pstack into one flow: describe a task, and devflow plans, builds, checks and proves it, step by step.**

```
/devflow:start <what you want done>
```

devflow sorts the task into a feature, a bug, a multi-session job or a small change. It then runs that flow's skills in order and stops to ask you whenever a step needs your decision. It's my customised setup on top of [Matt Pocock's skills](https://github.com/mattpocock/skills) and [Lauren Tan's pstack](https://github.com/backnotprop/pstack). Not on Claude Code? See [Other coding agents](#other-coding-agents).

## Quick start

You need Claude Code, Node 18 or later, and git.

1. **Install** the plugin, then restart Claude Code so its hooks load:

   ```
   /plugin marketplace add itsrob00/devflow
   /plugin install devflow@devflow
   ```

2. **Set up the repo.** Run this once in each repo, before your first `/devflow:start` there:

   ```
   /devflow:setup
   ```

   It checks that devflow's skills are installed and don't clash, then adds what the repo is missing. It takes about a minute:
   - Your issue tracker, written to `docs/agents/`. It uses GitHub or GitLab if the remote points there, and local markdown otherwise.
   - pstack's models, once per machine. `/setup-pstack` defaults to Grok, which Claude Code can't run, so setup writes Claude models at the large budget instead: Sonnet for the fast code roles, Opus for judgment.
   - `git init`, if the folder isn't a repo yet.

   Setup picks defaults and only asks when it can't decide, such as in a monorepo or when it finds a clashing `tdd` or `teach` skill. To change its choices, edit `docs/agents/*.md` or rerun `/setup-pstack`. Setup doesn't build the verification skill that drives your app to prove a change works; the first feature or bug flow that needs one offers to build it. If you skip setup, `/devflow:start` runs it when a flow needs something missing, in the middle of your task.

3. **Start work:**

   ```
   /devflow:start <what you want done>
   ```

4. **Pick it up later**, in a fresh session:

   ```
   /devflow:continue
   ```

Installing devflow also installs two dependencies, straight from the upstream repos:

- **devflow-matt**: the 20 of Matt Pocock's skills that devflow runs.
- **devflow-pstack**: the 43 pstack skills devflow runs, including `unslop`, `/poteto-mode` and its principles.

Skills devflow doesn't use stay out. That includes pstack's `tdd` and `teach`, which would clash with Matt's. The installed skills show in the slash menu under their plugin name, such as `/devflow-pstack:unslop` or `/devflow-matt:tdd`. devflow runs them for you.

## Use

```
/devflow:start add CSV export to the reports page        → Feature
/devflow:start the cart total ignores quantity           → Bug
/devflow:start migrate the API client from axios to fetch → Big
/devflow:start rename the Settings tab to Preferences     → Small
```

These four commands are all you need, in the order you'd use them:

| Run | What it does |
|---|---|
| `/devflow:setup` | Once per repo, before your first `/devflow:start` there. Adds whatever the repo is missing. |
| `/devflow:start <task>` | Starts a flow for the task, and sets the repo up first if it needs it. |
| `/devflow:continue` | Picks up unfinished work. `/devflow:start` with no task does the same. |
| `/devflow:wrap` | Reviews the session and saves a handoff. |

Once a flow is running, just talk to Claude. You don't retype `/devflow` with each message.

### The four flows

**Feature**: new behaviour that needs a design decision.
1. `how`, then `grill-with-docs` (and `prototype` if useful)
2. `to-spec` and `to-tickets` if it needs more than one session. `implement-spec` can then build the tickets in parallel in one run.
3. `architect`, then `implement`, which drives `tdd` and `code-review`
4. `blast-radius`, plus `interrogate` on risky changes
5. Prove it with your `verify-*` skill, then `pr`

**Bug**: something broken or slow.
1. `why` for regressions
2. `diagnosing-bugs`: regression test, fix, cleanup
3. `blast-radius`, then prove it

**Big**: more than one session.
- `wayfinder` when the path is unclear, `figure-it-out` when it's clear but long
- `show-me-your-work` throughout, and `handoff` at the end of each session

**Small**: one or two files, a clear change, no new behaviour.
- `poteto-mode`, or a direct edit (see [Settings](#settings))

### Picking up later

```
/devflow:continue
```

devflow saves every flow in the project under `.devflow/flows/` (git-ignored), with its step, tickets and last handoff. `/devflow:continue` lists the unfinished flows, asks which one to pick up, and continues it from where it stopped. `/devflow:continue <id>` skips the question.

- A session works on one flow and reads only its folder. Run `/clear` before switching.
- Once a conversation starts or continues a flow, devflow reminds Claude of it with every message you send, until the flow finishes or you `/clear`.
- A flow that ships as a PR is marked done when the PR merges (devflow checks with `gh`), so merged work drops off the list.
- When Claude Code starts in a project with unfinished flows, devflow says so in one line.
- A multi-session feature stops after the tickets. Run `/devflow:continue` in a fresh session for each one; it picks the next open ticket.
- A big job merges tickets that only need your answers into one session, shows the remaining tickets after each one it finishes, and ends each session with a handoff in its flow folder.

Each run that leaves work saves a short handoff. After a session that went sideways, run `/devflow:wrap`. It reviews the session (`/retro` or `/reflect`), runs `/correct` when the same mistake keeps coming back, and saves a fuller handoff if work is unfinished.

## Settings

Set these in `/plugin`, under devflow, Configure options. Saying otherwise in your request ("skip the adversarial review") wins for that run.

| Setting | Default | What it does |
|---|---|---|
| Git safety hook | on | While a devflow flow is running in the conversation, blocks `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree (`checkout .`, `restore .`, `checkout -f`, `switch --discard-changes`). Claude gives you the command to run instead. Conversations not on a flow aren't affected. |
| No code comments | on | Claude adds no comments or docstrings to code it writes or edits, unless you ask. It leaves existing comments alone unless a change makes them wrong. |
| Multi-model review | risky changes | When the feature flow adds `/interrogate`: on risky changes (auth, data, money, concurrency, migrations, public APIs), always, or never. |
| Small changes | poteto-mode | `poteto-mode`, which uses far more tokens, or `direct`: make the change, run the closest tests, show the diff. |
| Session review | reflect | Which review `/devflow:wrap` runs: `retro`, `reflect`, or `handoff` (the handoff only, no transcript review). On OpenCode, whose transcripts devflow can't read, it defaults to `handoff`. |

The project file overrides the user file, except that it can't turn the git guard off, so a cloned repo can't disarm it. In Claude Code, the `/plugin` options override both. devflow skips a missing or unreadable file and any value it doesn't know. `devflow settings` shows the result.

## Other coding agents

devflow also runs on Codex CLI, Cursor and OpenCode.

You need Node 18 or later and git. The installer runs through `npx`, which comes with Node.

**Install**, once per agent:

```
npx github:itsrob00/devflow install --agent <codex|cursor|opencode>
```

This puts devflow in your home folder. Add `--project` to put it in the current repo instead, under the git root, so a team can share one setup. The install:
- copies devflow's four entry skills (start, continue, setup, wrap) into the agent's skills folder, named the way that agent expects
- runs `npx skills` to install the same 20 Matt Pocock skills and 43 pstack skills the plugin uses
- writes the agent's hooks for the git guard and the flow reminders, plus the written fallbacks described below
- records every file it wrote in `~/.config/devflow/installs.json` (`.devflow/installs.json` with `--project`)

When it finishes, the install prints any step the agent still needs from you, such as trusting Codex's hooks.

**Update** re-runs every recorded install from the latest release. Name an agent to update only that one, and add `--project` to update only the installs in this repo:

```
npx github:itsrob00/devflow update [--agent <name>] [--project]
```

**Uninstall** removes exactly what the record lists. Of the skills `npx skills` installed, it removes only the ones devflow added, not copies you already had. While another agent's install still uses them, it leaves them all in place:

```
npx github:itsrob00/devflow uninstall --agent <name> [--project]
```

Run the entry skills the way your agent runs skills, with the task after them or in your next message:

| Agent | Start | Pick up later |
|---|---|---|
| Codex CLI | `$devflow-start <task>` | `$devflow-continue` |
| Cursor | `/devflow-start <task>` | `/devflow-continue` |
| OpenCode | `@devflow-start <task>` | `@devflow-continue` |

`setup` and `wrap` follow the same pattern. The flows, the skills they run and the four commands work as described above.

### Before the first run

- **Codex CLI** runs devflow's hooks only after you trust them. Run `/hooks` in Codex and trust each devflow hook. For a `--project` install, trust the project first. Codex skips a changed hook until you trust it again, so repeat this after each devflow update.
- **OpenCode** needs version 2 for devflow's plugin. If `opencode --version` shows 1.x, run `opencode upgrade --major`.
- **Cursor** needs nothing extra.

### Where the files go

Paths are for a user install, from your home folder. With `--project` they move into the repo, as noted. devflow's scripts go to `~/.config/devflow/runtime/<agent>/` (`.devflow/runtime/<agent>/` with `--project`).

| Agent | Skills | Always-on instructions | Hooks | Git guard backstop |
|---|---|---|---|---|
| Codex CLI | `.codex/skills` (project: `.agents/skills`) | `.codex/AGENTS.md` (project: `AGENTS.md`) | `.codex/hooks.json` | `.codex/rules/devflow.rules` |
| Cursor | `.cursor/skills` | rule `.cursor/rules/devflow.mdc`, always applied | `.cursor/hooks.json` | none |
| OpenCode | `.config/opencode/skills` (project: `.opencode/skills`) | `.config/opencode/AGENTS.md` (project: `AGENTS.md`) | plugin in `.config/opencode/devflow-plugin` (project: `.opencode/devflow-plugin`), added to the `plugins` list in `opencode.jsonc` | none |

- Codex's project skills go to `.agents/skills` because Codex reads no other project skills folder. Other agents read that folder too.
- With `--project`, the hook commands find `.devflow/runtime/<agent>` by walking up from the folder the agent runs in, so they work from any subfolder of the repo.
- The 63 upstream skills go wherever `npx skills` puts them for that agent.
- When devflow edits a file you already have (a hooks file, `opencode.jsonc`, `AGENTS.md`), it adds its own entries, or a block between `devflow:begin` and `devflow:end` markers. Uninstall takes out only those.
- `opencode.jsonc` must be plain JSON with no comments. Otherwise install stops and tells you what to add by hand.

The five settings work on every agent. There's no `/plugin` screen outside Claude Code, so use the settings files described under [Settings](#settings).

### What falls back to written instructions

Every install writes the git guard rules into the agent's always-on instructions, along with "check `devflow active` before replying", so devflow still behaves when hooks don't run. Beyond that:

- **Codex CLI**: hooks run only in trusted projects. Until a project is trusted, the written rules in `AGENTS.md` are all that guard it. The `.rules` file is a backstop that doesn't depend on hooks.
- **Cursor**: Cursor's prompt hook can't add context, so the per-message reminder comes from the always-applied rule instead. The guard hook fails closed: if it errors, the command is blocked. Cursor documents project rules (`.cursor/rules`) but not a home-folder one, so if the rule doesn't load, install with `--project`.
- **OpenCode**: there's no session-start hook, so the plugin's per-prompt context hook carries the session-start reminder. OpenCode's transcripts can't be read, so the session review defaults to `handoff`.

The Codex `.rules` file blocks the guarded git commands (`git push`, `reset --hard`, `clean -f`, `branch -D` and the whole-tree discards) in every session, not only during a flow, because it can't tell whether a flow is running. When you need one of those commands, run it yourself in a terminal. To lift the block, uninstall devflow for that agent.

Cursor and OpenCode can run the cross-model review on a different model family from your main model. Codex says plainly in the review that no other family was available. pstack keeps its own model defaults on every agent but Claude Code.

## Contributing

The plugin lives in `plugin/`, which is all that installing it copies. The tests stay at the repo root. `node --test` runs them for the git guard, the helper CLI, its hooks and the installer, and CI runs them on Ubuntu and Windows for every PR and push to main. Add a guard case for any command it should block or let through. To try a change to the installer or the plugin files, run `node plugin/scripts/devflow-install.mjs update --local`, which re-runs every recorded install from this checkout.

## Credits

devflow only orchestrates. The skills it runs are [Matt Pocock's](https://github.com/mattpocock/skills) ([MIT](https://github.com/mattpocock/skills/blob/main/LICENSE)) and Lauren Tan's pstack, originally in [cursor/plugins](https://github.com/cursor/plugins) and mirrored at [backnotprop/pstack](https://github.com/backnotprop/pstack) ([MIT](https://github.com/backnotprop/pstack/blob/main/LICENSE)). devflow doesn't copy them: its marketplace installs the ones it needs from their repos.

## License

MIT
