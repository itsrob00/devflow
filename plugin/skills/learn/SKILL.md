---
name: learn
description: Look back over a session and turn what went wrong into changes that stop it happening again, preferring a check, a type or a test over another instruction. For the end of a session that went sideways, or when the agent keeps making the same mistake.
argument-hint: "[what went wrong, or nothing for the whole session]"
disable-model-invocation: true
---

# Learn

Improve the agent's environment so the next run goes better. A one-off is not a learning. A mistake counts once it has happened twice, in this session or across sessions.

## 1. Read what happened

Go through the session the user names, or this one. Read the primary record: the conversation, the commands and their output, the diff. Also read recent commits, reverts and review comments for mistakes that keep coming back.

## 2. Look for candidates

- **Navigation.** The agent took long to find something. Would a pointer in the agent file have got it there?
- **Automated checks.** The agent made a mistake a lint, a type or a test could have caught. Read the repo's own check command and CI first. A check that exists but isn't wired in is the finding. A repo with no check on commit or in CI is a finding too.
- **Coding standards.** A rule the reviewer should enforce is missing or unclear.
- **The agent file.** `CLAUDE.md` or `AGENTS.md` has grown. Which lines belong in a standard or a check, and which change nothing?
- **Tool cost.** A tool call was expensive for what it returned.
- **Missing information.** Something the agent needed was out of reach, such as server logs or read access to a service.

## 3. Fix at the highest level that works

For each candidate, take the first of these that fits:

1. **Architecture.** One owner per piece of state, one supported way per task, the wrong import fails. Delete old ways an agent would copy.
2. **Types or a lint.** Make the bad state impossible to write, or fail with an error that names what to use instead.
3. **A test** of the behaviour.
4. **Written instruction,** only for judgement calls. Nothing fails when an agent skips it.

A mechanical rule (a banned API, an import shape, a file location) always becomes a check. Only judgement calls go in a standards file, which the reviewer reads, not the implementer.

## 4. Propose, then apply

Show the candidates in order of severity, each with the level you chose and why a higher one doesn't fit. Apply only the ones the user picks, one commit each. Prove each new check fails on the real past mistake.

## 5. Keep the rule table

In the agent file, keep a table pairing each rule with what enforces it. A rule already in the table with nothing enforcing it, and broken again, gets fixed at a higher level now. Drop a rule once its mistake can't happen.

**Done when** each applied change is committed and its check has been seen to fail on the mistake it targets.
