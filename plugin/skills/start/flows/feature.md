# Feature flow

Steps 1 to 4 end at the one stop. Steps 5 to 9 run without waiting.

1. **Understand.** `understand`. Keep its three or four lines for the plan.
2. **Decide.** `decide`. When a decision needs a runnable answer, `prototype`. When it waits on docs or an API fact, `research` in the background.
3. **Shape.** `shape`, when the change adds types or crosses a module boundary. Otherwise skip it.
4. **Plan.** `plan`. Show the plan and wait for the user's go. If the plan says the work needs tickets, it is a big job: `devflow flow set <id> flow=big` and continue with `big.md` in this folder at its step 5.
5. **Build.** Create a branch for the feature unless you are already on one that isn't the default branch, and save it with `branch=`. Then `build`, on its direct path.
6. **Review.** `review`.
7. **Check.** `check` on the diff since the branch point. Then `challenge`, by the adversarial review setting: always, never, or with risky changes only when the diff touches auth, permissions, payments, data migration or deletion, concurrency, or a public API.
8. **Prove.** `prove`.
9. **Ship.** `ship`. Save `pr=`.
