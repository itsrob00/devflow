---
name: build
description: Build approved work test-first. Builds a plan directly in the session, or works a big job's tickets through fresh subagents on one branch. Runs after the user's go.
argument-hint: "[plan, spec or ticket]"
disable-model-invocation: true
---

# Build

Build what the plan describes. The plan and its sketch are the contract. Testing follows [testing.md](testing.md) on both paths.

Record every decision you take along the way in the decision list, including any deviation from the plan and why.

## Direct, for a plan with no tickets

1. **One slice at a time.** Write a failing test for the next behaviour at an agreed seam, then only the code that passes it. Don't write ahead of the tests.
2. **Check as you go.** Run the type check and the nearest tests after each slice. Don't start the next slice on a red one.
3. **Finish.** Run the full suite once at the end. Commit on the flow's branch.

**Done when** every acceptance criterion in the plan has a test that passed in a run you saw, and the full suite is green.

## Delegated, for a big job with tickets

You own one branch for the whole job. Tickets are a graph, not a list: at any moment some are unblocked.

1. **Branch.** Create the job's branch from the default branch.
2. **Hand out.** Give each unblocked ticket to a fresh subagent in its own worktree on its own branch, based on the job's branch. Run up to `subagent_count` at once. The brief holds the goal in one line and pointers to the plan, the ticket and this skill's testing reference. Don't copy their contents into it.
3. **Choose the model.** With `subagent_model` set to `auto`, a ticket marked simple gets the agent's fast model and one marked complex gets its strong model (Sonnet and Opus on Claude Code). Any other value is used for every ticket.
4. **Check before merging.** When a subagent reports, read its diff yourself and run its tests. A report is not evidence. Give it one of three verdicts:
   - **Verified:** merge it into the job's branch as one commit, mark the ticket done, and remove its worktree.
   - **Not verified:** send the ticket to a fresh subagent with the original brief plus what failed.
   - **Inconclusive:** treat it as not verified. It is never a pass.
5. **Keep going.** Start whatever the merge unblocked. A merge conflict goes to a fresh subagent.
6. **Park, don't stop.** A ticket that needs a decision from the user is parked with its question. The other tickets continue. Bring parked questions to the user together, when nothing else can move or when several have gathered.
7. **Finish.** When no tickets are left, run the full suite on the job's branch and remove any remaining worktrees.

Each ticket's own status is the record of progress. A later session resumes from the tickets, not from memory.

**Done when** every ticket is done or parked with its question, the job's branch holds one commit per ticket, and the full suite is green on it.
