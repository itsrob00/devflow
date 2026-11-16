# Contributing

`node --test` runs the tests. CI runs them on Ubuntu and Windows for every PR and push to main. Every PR bumps the patch version in `plugin/.claude-plugin/plugin.json` and `package.json`.

## How the skills are laid out

- **One job per skill.** A skill is one short file that does one step of the work: understand, decide, plan, build and so on.
- **Skills name no other skill.** Only the flow files say what runs and in what order. Changing a flow never means editing a skill, and changing a skill never means editing a flow.
- **The rules are shared.** `plugin/mode.md` holds the seven rules every flow follows, and how a request with no flow is worked. It is loaded into every session, so each word there has to earn its place. A skill says how a rule applies to its step. It does not restate the rule.
- **Credit what you adapt.** When a skill takes from Matt Pocock's skills or pstack, add it to the table in `plugin/CREDITS.md`.

## Writing a skill

- **Keep always-loaded text tiny.** A skill's description and anything a hook prints are read in every session. Each word there has to change what the agent does.
- **Front-load the description.** Say what the skill does and when to reach for it. One trigger per case, no synonyms.
- **Steps first, reference behind a pointer.** The main file holds what the agent does, in order. Material only some runs need goes in a sibling file that the step points to.
- **End every step on a check.** State the condition that tells the agent the step is done, and make it something it can verify: "one command that goes red on this bug", not "the bug is understood".
- **Ask for the thorough version in the wording.** "Every ticket has its blockers listed" drives more work than "list the tickets".
- **Keep a concept in one place.** Its definition, rules and caveats sit under one heading.
- **Cut what does nothing.** If removing a line would not change a run, remove it.
- **Split only when it earns it.** Split a file when a later step tempts the agent to rush the one in front of it, or when a branch is rarely taken.
- **Write for every agent.** Name a Claude Code tool or command only beside the plain description of the step, so Codex, Cursor and OpenCode can follow the same text.
- **Plain words.** Short sentences, the everyday word, no long dashes.
