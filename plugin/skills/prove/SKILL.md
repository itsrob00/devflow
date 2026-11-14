---
name: prove
description: Prove a change works by driving the running app the way a user would and keeping the evidence. Builds the repo's verification skill the first time one is needed.
argument-hint: "[the change or feature to prove]"
disable-model-invocation: true
---

# Prove

Tests show the code does what the tests say. This shows the change works for a user.

## 1. Find the verification skill

Look in the project's skill folder for a `verify-*` skill with launch and drive sections. If there is none, build one with [verifier.md](verifier.md) before going on.

## 2. Drive the change

Follow the verification skill: launch the app, run its health check, then exercise the change along the real user path. Don't use internal setters or test-only endpoints. For a bug, replay the original scenario and show it now passes.

## 3. Keep the evidence

Capture the action and the state that results, not only the final screen: screenshots, terminal output, response bodies. Check side effects too, such as files written or rows inserted. Save the evidence where the verification skill says, and tear down only what you started.

## 4. Keep the map current

Add or correct the feature map entry for what you just drove: how to reach it, how to drive it, and what proves it works. If a step in the verification skill failed because the app has changed, fix the skill now.

If the change can't be driven, because there is no running surface or no access, say "unproven in the running app" and why.

**Done when** the evidence is saved and shows the change working along a user's path, or the change is reported as unproven with the reason.
