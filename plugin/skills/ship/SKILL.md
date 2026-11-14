---
name: ship
description: Write the pull request body for finished work, with a visual summary, before-and-after evidence, the decisions taken for the user and the merge risk. Then open the pull request.
argument-hint: "[branch or nothing for the current branch]"
disable-model-invocation: true
---

# Ship

Write a body a reviewer can take in at a glance. Skip preambles, keep the prose brief, and use the glossary's terms. If the repo has a pull request template, keep its headings and fit these sections into them.

```markdown
## Summary

<one visual, with a line or two of text>

## Evidence

- **Before:** <output, screenshot or failing test>
  **After:** <output, screenshot or passing test>

## Decisions taken for you

- <decision>: <why>

## Merge danger

**Door:** <one-way or two-way>
**Blast radius:** <one word, then what could be affected>
```

## Summary

Pick the smallest view that makes the point, from [visuals.md](visuals.md). Usually one is enough.

## Evidence

Show before and after. A screenshot is best for a visible change. Otherwise show a run: the exact test that failed and now passes, or the command output. Use the evidence already gathered. Don't describe a check you didn't run.

## Decisions taken for you

List the decisions from the decision list that the agent made, each with its reason, so the user can overrule any of them in review. Leave out the ones the user answered. Drop the section when there are none.

## Merge danger

A two-way door can be walked back cheaply. A one-way door involves something destructive or hard to reverse, such as a data migration or a public interface. For blast radius, name what could be affected beyond the diff, and state the fact the change is safe because of, or that it is unproven.

## Open it

A commit message says what changed and, for a bug, the confirmed cause. Push the branch, or when pushing is blocked give the user the exact command, then open the pull request with the body from a file.

**Done when** the pull request is open with all four sections filled from real evidence, or the user has the push command and the body file.
