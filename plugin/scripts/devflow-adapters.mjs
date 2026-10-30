export const ADAPTERS = {
  codex: {
    skillsAgent: 'codex',
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
    backstop: { format: 'codex-rules', file: '.codex/rules/devflow.rules' }
  },
  cursor: {
    skillsAgent: 'cursor',
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
    }
  },
  opencode: {
    skillsAgent: 'opencode',
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
  },
  gemini: {
    skillsAgent: 'gemini-cli',
    entrySkill: 'devflow-{name}',
    invoke: '/devflow-{name}',
    skills: '.gemini/skills',
    reads: ['.agents/skills', '.gemini/skills'],
    instructions: { user: '.gemini/GEMINI.md', project: 'GEMINI.md' },
    hooks: {
      format: 'gemini-json',
      file: '.gemini/settings.json',
      events: { PreToolUse: 'BeforeTool', PostToolUse: 'AfterTool', SessionStart: 'SessionStart', UserPromptSubmit: 'BeforeAgent' },
      tools: { Bash: 'run_shell_command' }
    },
    backstop: { format: 'gemini-policy', file: { user: '.gemini/policies/devflow.toml' } }
  },
  pi: {
    skillsAgent: 'pi',
    entrySkill: 'devflow-{name}',
    invoke: '/skill:devflow-{name}',
    skills: { user: '.pi/agent/skills', project: '.pi/skills' },
    reads: ['.agents/skills', '.pi/agent/skills', '.pi/skills'],
    instructions: { user: '.pi/agent/AGENTS.md', project: 'AGENTS.md' },
    hooks: { format: 'pi-extension', file: { user: '.pi/agent/extensions', project: '.pi/extensions' } }
  }
}

export function at (spec, scope) {
  return typeof spec === 'string' ? spec : spec[scope]
}
