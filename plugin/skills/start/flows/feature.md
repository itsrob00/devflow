# Feature flow

1. **Understand.** `how`: where the feature should live and how the code around it works.
2. **Decide.** `grill-with-docs`: interview the user until the plan holds up, recording ADRs and glossary terms. When a question needs a runnable answer (a state model, a UI to look at), use `prototype`, then return to the grilling with what it showed.
3. **Write it down.** Only when the build needs more than this session: `to-spec`, then `to-tickets`. Save with `devflow flow set <id> tickets=<folder or tracker ref> step="4. Shape"`, then stop. Tell the user to `/clear` and run `/devflow:continue` for each ticket (it offers the first open, unblocked one), so each build starts with a clean context. Keep steps 1 to 3 in this one context.
   - A run that continues a ticket starts at step 4. Read the ticket and the spec it links. When the ticket ships, set or add a `Status: done` line in its file (or close it on the tracker) and save `step="4. Shape"`. If it is one of several from `to-tickets`, end the run with the remaining-tickets list (`big.md` step 3, in this folder), and run `devflow flow done <id>` when none are left.
4. **Shape.** `architect` when the change adds types or crosses a module boundary. Skip it for code that stays inside one function.
5. **Build.** `implement`. It drives `tdd`, runs `code-review`, and commits. Don't run `code-review` again.
6. **Check.**
   - `blast-radius` on the diff since the branch point, with its safety fact proven by running code or marked unproven.
   - `interrogate` per the multi-model review setting. With **risky changes**, run it when the diff touches auth, permissions, payments, data migrations or deletion, concurrency, or a public API. Fix what it puts under "Act on".
7. **Prove.** If the project has a `verify-*` skill (`devflow doctor feature` lists it), drive the feature with it as a user would and save the evidence. If not, say the change is unproven in the running app and suggest `/devflow:setup`.
8. **Ship.** `pr` to write the PR body, using the evidence from step 7. Pushing is the user's (see **Git** in the start skill): give them the push command, then `gh pr create --body-file <file>`.
