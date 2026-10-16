# devflow

**A Claude Code plugin that turns Matt Pocock's skills and pstack into one guided workflow: describe a task, and devflow plans, builds, checks and proves it, step by step.**

```
/devflow:start <what you want done>
```

devflow sorts the task into a feature, a bug, a multi-session job or a small change, then runs that flow's skills in order and stops to ask you whenever a step needs your decision. It's my customised setup on top of [Matt Pocock's skills](https://github.com/mattpocock/skills) and [Lauren Tan's pstack](https://github.com/backnotprop/pstack).

## Quick start

Requires Claude Code, Node 18 or later, and git.

```
/plugin marketplace add itsrob00/devflow
/plugin install devflow@devflow
/devflow:setup
```

`/devflow:setup` runs once per repo. It sets up your issue tracker (`/setup-matt-pocock-skills`), pstack's models (`/setup-pstack`; its defaults use Grok, which Claude Code can't run) and a verification skill that drives your app (`/create-verification-skill`), and runs `git init` if the folder isn't a repo. It asks all its questions at once, shows every draft for one review, then does the rest without stopping.

Installing devflow also installs two dependencies, straight from the upstream repos and kept in sync with them:

- **devflow-matt**: the 18 of Matt Pocock's skills that devflow runs.
- **devflow-pstack**: the 43 pstack skills devflow runs, including `unslop`, `/poteto-mode` and its principles.

Skills devflow doesn't use stay out, including pstack's `tdd` and `teach`, which would clash with Matt's. Their commands carry the plugin name, such as `/devflow-pstack:unslop` or `/devflow-matt:tdd`.

## Use

```
/devflow:start add CSV export to the reports page        → Feature
/devflow:start the cart total ignores quantity           → Bug
/devflow:start migrate the API client from axios to fetch → Big
/devflow:start rename the Settings tab to Preferences     → Small
```

### The four flows

**Feature**: new behaviour that needs a design decision.
1. `how`, then `grill-with-docs` (and `prototype` if useful)
2. `to-spec` and `to-tickets` if it needs more than one session
3. `architect`, then `implement` (which drives `tdd` and `code-review`)
4. `blast-radius`, plus `interrogate` on risky changes
5. Prove it with your `verify-*` skill, then `pr`

**Bug**: something broken or slow.
1. `why` for regressions
2. `diagnosing-bugs`: regression test, fix, cleanup
3. `blast-radius`, then prove it

**Big**: more than one session.
- `wayfinder` when the path is unclear, `figure-it-out` when it's clear but long
- `show-me-your-work` throughout, `handoff` at the end of each session

**Small**: one or two files, clear change, no new behaviour.
- `poteto-mode`, or a direct edit (see Settings)

### Picking up later

- A multi-session feature stops after the tickets. Run `/devflow:start ticket <ref>` for each one in a fresh session.
- A big job merges grilling-only tickets into one session, shows the remaining tickets after each one it finishes, and ends each session with a handoff file. Continue with `/devflow:start resume <path>`.
- After a session that went sideways, run `/devflow:wrap`. It reviews the session (`/retro` or `/reflect`), runs `/correct` when the same mistake keeps coming back, and writes a handoff if work is unfinished.

## Settings

Set these in `/plugin`, under devflow, Configure options. Saying otherwise in your request ("skip the adversarial review") wins for that run.

| Setting | Default | What it does |
|---|---|---|
| Git safety hook | on | Blocks `git push`, `reset --hard`, `clean -f`, `branch -D`, and commands that discard the whole working tree (`checkout .`, `restore .`, `checkout -f`, `switch --discard-changes`). Claude gives you the command to run instead. |
| Multi-model review | risky changes | When the feature flow adds `/interrogate`: on risky changes (auth, data, money, concurrency, migrations, public APIs), always, or never. |
| Small changes | poteto-mode | `poteto-mode` or `direct`. |
| Session review | retro | Which review `/devflow:wrap` runs: `retro` or `reflect`. |

## Contributing

`node --test` runs the git guard's tests. Add a case there for any command it should block or let through.

## Credits

devflow is an orchestration layer: the skills it runs are [Matt Pocock's](https://github.com/mattpocock/skills) ([MIT](https://github.com/mattpocock/skills/blob/main/LICENSE)) and Lauren Tan's pstack, originally in [cursor/plugins](https://github.com/cursor/plugins) and mirrored at [backnotprop/pstack](https://github.com/backnotprop/pstack) ([MIT](https://github.com/backnotprop/pstack/blob/main/LICENSE)). devflow doesn't copy them: its marketplace installs the ones it needs from their repos.

## License

MIT
