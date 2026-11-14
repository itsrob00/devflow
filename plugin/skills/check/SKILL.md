---
name: check
description: Find what a change could break somewhere else, beyond its diff, and prove the one fact it is safe because of by running real code. For "what could this break" and any diff not yet trusted.
argument-hint: "[diff, branch or change]"
disable-model-invocation: true
---

# Check

Listing the callers is not the job. A search does that in a second. The job is the breakage a search won't show, and proof instead of a convincing writeup.

## How sure are you

For each fact the change's safety rests on, get as far down this list as is cheap, and say where you stopped.

1. You said so. Worth nothing alone.
2. You pointed at the line: a real `file:line`, or the library's own source.
3. You walked the failure step by step and it can't happen.
4. You ran it: a script or test that calls the real code and fails loudly if you are wrong.
5. You reproduced it in the running app.

Step 4 is usually one small script that imports what the app ships and calls the exact function in question.

## Steps

1. **Read the change.** The diff, the symbols it adds, changes and removes, and what it now does differently, including what the diff doesn't spell out.
2. **Find the one fact it is safe because of.** Most changes that look risky are safe because of a single fact, such as "this call only drops cache entries that are already dead". If it holds, most risks clear at once. Spend your time here.
3. **Look where search stops.** The source and pinned version of a library you call. When things run: async ordering, teardown, startup. What a symbol search misses: the JSON an API returns, a database column, a wire format, another program reading the same bytes, a feature flag, code three calls downstream.
4. **Be honest about each risk.** Give it a real likelihood and a real cost. Keep confirmed risks apart from ones you checked and cleared. Cite real lines. Never invent a caller or an API.
5. **Prove the one fact.** Write the script or test, run it, and keep the output.

## Hand back

- **What it does.** Including the part that isn't obvious.
- **The one fact it is safe because of.** Which step you got it to, with the proof. If you couldn't prove it, write "unproven".
- **Risks.** How each breaks, where, how likely, how bad, and how to check.
- **Cleared.** What you checked and why it is fine.
- **Before merging.** The cheapest test that would catch the real bug.

**Done when** the safety fact is stated with either the output of a run that proves it or the word "unproven".
