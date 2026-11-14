---
name: review
description: Review a branch's changes on two separate axes, the repo's coding standards and the plan it was built from, with a fresh reviewer for each. For finished work before it ships, or any branch or diff the user wants reviewed.
argument-hint: "[branch, commit or nothing for the current branch]"
disable-model-invocation: true
---

# Review

Two reviews of the same diff, kept apart so neither hides the other. Code can follow every standard and build the wrong thing, or build the right thing and break the conventions.

## 1. Pin the diff

Compare against the point the user names. With none, use the point where the current branch left the default branch: `git diff <default>...HEAD`. Check that it resolves and that the diff is not empty before going further.

## 2. Find the sources

- **Plan.** The flow's `plan.md`, or the issue the commits reference. With neither, skip the plan reviewer and say so.
- **Standards.** Every file in the repo that says how code should be written, such as `CODING_STANDARDS.md` and `CONTRIBUTING.md`, plus the baseline in [smells.md](smells.md).

## 3. Run both reviewers at once

Start two subagents with fresh context, in parallel. Each gets the diff command and its sources, and reports in under 400 words.

- **Standards reviewer.** Reports every breach of a documented standard, citing the file and rule, and any baseline smell, naming it and quoting the hunk. A documented standard is a hard finding. A smell is always a judgement call, and a documented standard overrides the baseline. It skips anything the repo's tooling already enforces.
- **Plan reviewer.** Reports what the plan asked for that is missing or partial, behaviour in the diff that the plan did not ask for, and anything implemented that looks wrong. It quotes the plan line for each.

## 4. Report

Show the two reports under **Standards** and **Plan**. Don't merge or rank across them. End with one line: findings per axis and the worst in each.

## 5. Fix, inside a flow

Fix gaps against the plan and breaches of documented standards without asking, then rerun the tests. Leave the smells: list them in the final report as judgement calls for the user. Outside a flow, report only.

**Done when** both reports are shown, or the missing one is explained, and inside a flow every hard finding is fixed with the tests green.
