export const ADAPTERS = {
  codex: {
    entrySkill: 'devflow-{name}',
    invoke: '$devflow-{name}',
    skills: { user: '.codex/skills', project: '.agents/skills' },
    reads: ['.agents/skills', '.codex/skills'],
    instructions: { user: '.codex/AGENTS.md', project: 'AGENTS.md' },
    hooks: {
      format: 'claude-json',
      file: '.codex/hooks.json',
      events: { PreToolUse: 'PreToolUse', PostToolUse: 'PostToolUse', SessionStart: 'SessionStart', UserPromptSubmit: 'UserPromptSubmit' },
      tools: { Bash: 'Bash' }
    },
    backstop: { format: 'codex-rules', file: '.codex/rules/devflow.rules' },
    note: {
      user: "Codex runs devflow's hooks only after you trust them: run /hooks in Codex and trust each devflow hook. Do it again after each devflow update, because Codex skips a changed hook until you trust it again.",
      project: "Codex runs devflow's hooks only after you trust them: trust this project in Codex, then run /hooks and trust each devflow hook. Do it again after each devflow update, because Codex skips a changed hook until you trust it again."
    }
  },
  cursor: {
    entrySkill: 'devflow-{name}',
    invoke: '/devflow-{name}',
    skills: { user: '.cursor/skills', project: '.cursor/skills' },
    reads: ['.cursor/skills', '.agents/skills'],
    rule: { format: 'cursor-mdc', file: { user: '.cursor/rules/devflow.mdc', project: '.cursor/rules/devflow.mdc' } },
    hooks: {
      format: 'cursor-json',
      file: { user: '.cursor/hooks.json', project: '.cursor/hooks.json' },
      events: { PreToolUse: 'preToolUse', PostToolUse: 'postToolUse', SessionStart: 'sessionStart' },
      tools: { Bash: 'Shell' },
      failClosed: ['preToolUse']
    },
    note: { user: "Cursor doesn't promise to load an always-on rule from your home folder. If devflow's rule doesn't show up in Cursor's rules, install in each repo with --project instead." }
  },
  opencode: {
    entrySkill: 'devflow-{name}',
    invoke: '@devflow-{name}',
    skills: { user: '.config/opencode/skills', project: '.opencode/skills' },
    reads: ['.agents/skills', '.opencode/skills', '.config/opencode/skills'],
    instructions: { user: '.config/opencode/AGENTS.md', project: 'AGENTS.md' },
    hooks: {
      format: 'opencode-plugin',
      file: { user: '.config/opencode/devflow-plugin', project: '.opencode/devflow-plugin' },
      config: { user: '.config/opencode', project: '' }
    }
  }
}

export function at (spec, scope) {
  return typeof spec === 'string' ? spec : spec[scope]
}
