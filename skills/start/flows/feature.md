# Feature flow

1. **Understand.** `how`: where the feature should live and how the code around it works.
2. **Decide.** `grill-with-docs`: interview the user until the plan holds up, recording ADRs and glossary terms. When a question needs a runnable answer (a state model, a UI to look at), use `prototype`, then come back to the grilling with what it showed.
3. **Write it down.** Only when the build needs more than this session: `to-spec`, then `to-tickets`. Then stop. Tell the user to `/clear` and run `/devflow:start ticket <ref>` for each ticket, blockers first, so each build starts with a clean context. Keep steps 1 to 3 in this one context.
   - A task that names a ticket (`ticket <ref>`) starts here at step 4. Read the ticket and the spec it links. When it is one of several from `to-tickets`, end the run with the remaining-tickets list from step 3 of `big.md` in this folder.
4. **Shape.** `architect` when the change adds types or crosses a module boundary. Skip it for code that stays inside one function.
5. **Build.** `implement`. It drives `tdd` at seams agreed with the user, runs `code-review` on the result, and commits. Don't run `code-review` again afterwards.
6. **Check.**
   - `blast-radius` on the diff since the branch point, with its safety fact proven by running code or marked unproven.
   - `interrogate` per the multi-model review setting. With **risky changes**, run it when the diff touches auth, permissions, payments, data migrations or deletion, concurrency, or a public API. Fix what it puts under "Act on".
7. **Prove.** If the project has a `verify-*` skill (`devflow doctor feature` lists it), use it to drive the feature as a user would and save the evidence. If there is none, say the change is unproven in the running app and suggest `/devflow:setup`.
8. **Ship.** `pr` to write the PR body, using the evidence from step 7. Pushing is the user's (see **Git** in the start skill). Give them the push command, then `gh pr create --body-file <file>`.
