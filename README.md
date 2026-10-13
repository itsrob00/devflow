# devflow

devflow is a Claude Code plugin. Give `/devflow:start` a task, and it sorts the task into a feature, a bug, a multi-session job, or a small change. It then runs that flow's steps in order, each one a skill from Matt Pocock's skills or pstack, and asks you whenever a step needs your decision.

Matt Pocock's skills handle the planning and building: interviews, specs, tickets, and test-first code. pstack handles the checks: what else a change can break, review by several models, and driving the running app to confirm the change works.

## Install

In Claude Code:

    /plugin marketplace add itsrob00/devflow
    /plugin install devflow@devflow

That also installs two dependencies, straight from the upstream repos and kept up to date with them:

- **devflow-matt**: the 18 of [Matt Pocock's skills](https://github.com/mattpocock/skills) that devflow runs.
- **devflow-pstack**: the 43 [pstack](https://github.com/backnotprop/pstack) skills devflow runs, including `unslop`, `/poteto-mode` and its principles.

Skills devflow doesn't use stay out, including pstack's `tdd` and `teach`, which would clash with Matt's. Their commands carry the plugin name, such as `/devflow-pstack:unslop` or `/devflow-matt:tdd`.

Once per repo, run `/devflow:setup`. It checks the install and runs the setup steps you haven't done yet: your issue tracker (`/setup-matt-pocock-skills`), pstack's models (`/setup-pstack`; its defaults use Grok, which Claude Code can't run), and a verification skill that drives your app (`/create-verification-skill`).

## Use

    /devflow:start add CSV export to the reports page
    /devflow:start the cart total ignores quantity
    /devflow:start migrate the API client from axios to fetch
    /devflow:start rename the Settings tab to Preferences

| Flow | For | Steps |
|---|---|---|
| Feature | New behavior with a design decision | `how`, `grill-with-docs` (and `prototype`), `to-spec` and `to-tickets` if it needs more than one session, `architect`, `implement` (drives `tdd` and `code-review`), `blast-radius`, `interrogate` on risky changes, prove it with your `verify-*` skill, `pr` |
| Bug | Something broken or slow | `why` for regressions, `diagnosing-bugs` (regression test, fix, cleanup), `blast-radius`, prove it. |
| Big | More than one session | `wayfinder` when the path is unclear, `figure-it-out` when it's clear but long, `show-me-your-work` throughout, `handoff` at the end of each session |
| Small | One or two files, clear change | `poteto-mode`, or a direct edit (see Settings) |

A multi-session feature stops after the tickets. Run `/devflow:start ticket <ref>` for each one in a fresh session. A big job ends each session with a handoff file; continue with `/devflow:start resume <path>`.

After a session that went sideways, run `/devflow:wrap`. It reviews the session (`/retro` or `/reflect`), runs `/correct` when the same mistake keeps coming back, and writes a handoff if work is unfinished.

## Settings

Set these in `/plugin`, under devflow, Configure options. Saying otherwise in your request ("skip the adversarial review") wins for that run.

| Setting | Default | What it does |
|---|---|---|
| Git safety hook | on | Blocks `git push`, `reset --hard`, `clean -f`, `branch -D`, and checkout or restore of the whole tree. Claude gives you the command to run instead. |
| Multi-model review | risky changes | When the feature flow adds `/interrogate`: risky changes (auth, data, money, concurrency, migrations, public APIs), always, or never. |
| Small changes | poteto-mode | `poteto-mode` or `direct`. |
| Session review | retro | Which review `/devflow:wrap` runs: `retro` or `reflect`. |

## Requirements

Claude Code, Node 18 or later, and git.

## Credits

The skills devflow runs are Matt Pocock's ([MIT](https://github.com/mattpocock/skills/blob/main/LICENSE)) and Lauren Tan's pstack ([MIT](https://github.com/backnotprop/pstack/blob/main/LICENSE)). devflow doesn't copy them: its marketplace installs the ones it needs from their repos.

MIT license.
