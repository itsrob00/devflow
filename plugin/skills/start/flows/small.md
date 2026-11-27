# Small change

No plan and no stop.

Everything this flow writes for people, such as the plan, commit messages and the pull request body, follows `write`.

1. **Change.** Make the change. Add or update a test when the behaviour changes.
2. **Check.** Run the type check and the nearest tests. When a user can see the change, run it once and keep the output.
3. **Show.** Show the diff with one line on what it does. Commit only if the user asked for a commit.

If the change grows past two files, or makes you choose behaviour the task didn't specify, it is a Feature: save it with `devflow flow new feature <short title>` and continue with `feature.md` in this folder.
