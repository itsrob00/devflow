---
name: setup
description: Set up a repo for devflow, once per repo. Checks that Matt Pocock's skills and pstack are installed without clashing, then runs the setup steps that are still missing.
disable-model-invocation: true
---

`devflow` means `node "${CLAUDE_PLUGIN_ROOT}/scripts/devflow.mjs"`, run from the project root. Run each skill the way `/devflow:start` does: `devflow show <skill>`, then follow the SKILL.md it prints in full.

1. Run `devflow doctor`.
2. **Missing skills.** devflow installs its two dependencies, devflow-matt and devflow-pstack, with itself. If doctor prints `install` lines anyway (a dependency was disabled or removed), show them and stop. The user runs them, restarts Claude Code, and runs `/devflow:setup` again.
3. **Collisions.** A `collision:` line means pstack was also installed separately (for example with `npx skills add`), so its `tdd` or `teach` sits un-namespaced in a skills folder. Offer to delete that folder; devflow uses Matt's for both.
4. **Issue tracker.** If `issue tracker` says not set up: `setup-matt-pocock-skills`. It asks where tickets live and where docs go.
5. **pstack models.** If `pstack models` is not set or uses Grok: `setup-pstack`. In Claude Code, offer Claude models only, or `inherit-parent` to run every role on the session's model. Skip its last step, the verification-skill offer; step 6 covers it.
6. **Verification skill.** If `verification skill` says none: `create-verification-skill`. It writes `.claude/skills/verify-<app>/`, which the flows use to prove changes in the running app. Say that `/maintain-verification-skill` keeps it current as the app changes.
7. **Git guard.** It ships with devflow; there is nothing to install per repo. If a `.claude/hooks/block-dangerous-git.sh` from Matt's `git-guardrails-claude-code` is also set up, both run, which is harmless.
8. Run `devflow doctor` again and report what was set up and anything still open.
