// node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from '../plugin/scripts/devflow-guard.mjs'

const blocked = [
  'git push', 'git push origin main', 'git push --force-with-lease', 'git -C repo push', 'git -c core.x=y push',
  'git --no-pager push', '/usr/bin/git push', 'cd x && git push -u origin b', 'git status; git push', 'nohup git push &',
  'git reset --hard', 'git reset --hard HEAD~1', 'git reset --keep HEAD~1 && git reset --hard',
  'git clean -fd', 'git clean -xdf', 'git clean --force',
  'git branch -D foo', 'git branch -Df x', 'git branch -d -f foo', 'git branch --delete --force foo',
  'git checkout .', 'git checkout -- .', 'git checkout HEAD -- .', 'git checkout -p .', 'git checkout -f main',
  'git switch -f main', 'git switch --discard-changes main',
  'git restore .', 'git restore -- :/', 'git restore --source=HEAD .', 'git restore --worktree --staged .',
  'bash -c "git push"', "sh -c 'git reset --hard'", 'eval "git push"', 'echo $(git push)', 'echo `git push`',
  'sudo git push', 'env FOO=1 git push', 'FOO=1 git push', 'timeout 10 git push', 'xargs git push', 'command git push',
  '(git push)', '{ git push; }',
  'bash <<EOF\ngit push\nEOF', "sh <<'X'\necho hi\ngit reset --hard\nX",
  'cat <<EOF && git push\nhi\nEOF', 'cat <<-EOF\n\tx\n\tEOF\ngit push', 'cat <<A <<B\na\nA\nb\nB\ngit push'
]

const allowed = [
  'git status', 'git log --oneline', 'git log --grep="reset --hard"', 'git diff > out.txt', 'git stash', 'git fetch origin',
  'git rebase main', 'git add . && git commit -m wip', 'git commit -m "git push later"', 'echo git push', 'echo "a; git push"',
  'grep -r "git push" .', 'git checkout -b feat', 'git checkout main', 'git checkout -- src/a.ts', 'git switch main',
  'git switch -c feat', 'git restore src/a.ts', 'git restore --staged .', 'git branch -d merged', 'git clean -n',
  'git reset HEAD~1', 'git reset --soft HEAD~1', 'gh pr create --body-file pr.md', 'npm test 2>&1 | tail',
  'cat <<EOF\ngit push\nEOF', "cat > deploy.sh <<'EOF'\ngit push origin main\nEOF\nchmod +x deploy.sh",
  'git commit -F - <<EOF\nnever git reset --hard\nEOF', `git commit -m "$(cat <<'EOF'\ngit push docs\nEOF\n)"`,
  'cat <<A <<B\ngit push\nA\ngit push\nB', 'cat <<<"git push"'
]

test('blocks commands that lose work or leave the machine', () => {
  for (const c of blocked) assert.ok(check(c), `should block: ${JSON.stringify(c)}`)
})

test('allows everything else', () => {
  for (const c of allowed) assert.equal(check(c), null, `should allow: ${JSON.stringify(c)}`)
})
