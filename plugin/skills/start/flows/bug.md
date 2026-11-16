# Bug flow

1. **Diagnose.** `diagnose`, phases 1 to 4: the loop that goes red, the minimal reproduction, and the cause proven by a run. For a regression, or code that looks deliberate, read its history as `understand` step 3 says.
2. **Stop, only for a fix that is more than a small change.** A small fix touches one or two files and decides no behaviour. Anything larger: show the proven cause and the fix you propose, and wait for the user's go.
3. **Fix.** Create a branch for the fix unless you are already on one that isn't the default branch, and save it with `branch=`. Then `diagnose`, phases 5 and 6: the regression test, the fix and the cleanup.
4. **Check.** `check` on the fix.
5. **Prove.** For a bug a user can see, `prove`: replay the original scenario and show it now passes.
6. **Ship.** Commit with a message that names the cause. If the fix goes up as a pull request, `ship` and save `pr=`. Otherwise `devflow flow done <id>`.

If `diagnose` found no seam for a regression test, say so in the report: the code's structure keeps the bug from being locked down.
