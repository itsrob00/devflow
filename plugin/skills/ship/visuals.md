# Summary visuals

Keep only the calls, files, states and boundaries needed to make the point. Put each visual next to the short text it supports.

- **Logic** as pseudocode:

```text
on(save)
  if content is unchanged
    return cached result
  write new content
```

- **Runtime control flow** as a call tree:

```text
submitForm
  createSession
    persistPrompt
  navigateToSession
```

- **UI structure** as a component tree, with the state and module boundaries that matter.
- **File responsibility or a broad refactor** as a shallow file tree with a comment per folder.
- **Interaction between parts** as a Mermaid sequence or flow diagram.
- **A change to an existing shape** as a `diff` of that shape: the call tree, the file tree, the component tree or the pseudocode, with `+` and `-` lines.

```diff
 on(save)
-  write content
+  if content is unchanged
+    return cached result
+  write new content
```

Show a whole block of real code only when most of it is new, or when the reader needs a target shape to copy.
