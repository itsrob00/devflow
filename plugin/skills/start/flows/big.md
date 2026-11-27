# Big flow

Steps 1 to 4 end at the one stop. After the go, the tickets are built by subagents on one branch and the work goes up as one pull request.

Everything this flow writes for people, such as the plan, commit messages and the pull request body, follows `write`.

1. **Understand.** `understand`, on its wide path. Keep its three or four lines for the plan.
2. **Decide.** `decide`. When a decision needs a runnable answer, `prototype`. When it waits on docs or an API fact, `research` in the background.
3. **Shape.** `shape`, for the interfaces the tickets will share.
4. **Plan.** `plan`, with tickets. Show the plan and the ticket list and wait for the user's go. Save `tickets=` with the spec's issue, or nothing when the tickets are files in the flow's folder.
5. **Build.** `build`, on its delegated path, with the subagent settings from `devflow settings`. Save `branch=` when the job's branch exists. No pull request per ticket.
   - After each merged ticket, print the list from the tickets themselves, not from memory:

     ```
     Big: <job> · 3 of 7 done
     ✓ 1. <ticket>
     ✓ 2. <ticket>
     ✓ 3. <ticket>   (just merged)
     → 4. <ticket>   (building)
     → 5. <ticket>   (building)
       6. <ticket>   (blocked by 4)
     ? 7. <ticket>   (parked: <question>)
     ```

   - A later session continues here: `devflow flow show <id>` names the tickets that are ready.
6. **Review.** `review`, on the job's branch against the plan.
7. **Check.** `check` on the whole diff. Then `challenge`, by the adversarial review setting: always, never, or with risky changes only when the diff touches auth, permissions, payments, data migration or deletion, concurrency, or a public API.
8. **Prove.** `prove`, once for the whole job.
9. **Ship.** `ship`: one pull request for the job's branch. Save `pr=`.
