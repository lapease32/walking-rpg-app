# Claude Code Rules — WalkingRPGApp

## Branching

Always create a new branch before making any code changes. Never commit directly to `main`. If the current branch is `main`, create a descriptive branch first (e.g. `fix/player-null-check`, `feature/combat-rewards`).

## Production quality

This is a monetized App Store / Play Store app — not a demo. When a fix has a "quick" path and a "right" path, default to the right one and flag the tradeoff explicitly. Don't silence warnings by weakening types or adding suppressions unless the alternative is genuinely worse. Think about what a senior engineer shipping a paid app would do, not what gets CI green fastest.

## Pull requests

- Always apply labels from the repo label set (`bugfix`, `feature`, `security`, `refactor`, `android`, `iOS`, `github`, `dependencies`, `distribution`, `debug mode`, etc.)
- Omit the "## Test plan" section from PR bodies — the user will request testing explicitly before merging
- When the user asks "should we create a PR?" treat it as a genuine question, give a recommendation with tradeoffs, and wait for confirmation before running `gh pr create`

## After creating a PR — bugbot loop

After every PR is created, immediately start a self-paced `/loop` that polls for bugbot feedback and squash-merges when safe. Use ~270s poll intervals to stay within the prompt cache window.

**Safe-to-merge gate — run all three checks:**

```bash
PR=<number>

# 1. All CI checks pass or skipping
gh pr checks $PR --repo lapease32/walking-rpg-app --json name,bucket \
  | jq -e 'all(.bucket == "pass" or .bucket == "skipping")'

# 2. Bugbot review (posted as a PR review, not a check result)
gh api repos/lapease32/walking-rpg-app/pulls/$PR/reviews \
  --jq '[.[] | select(.author.login == "cursor")] | last | .body' \
  | grep -c "found 0 potential"

# 3. Bugbot inline comments
gh api repos/lapease32/walking-rpg-app/pulls/$PR/comments \
  --jq '[.[] | select(.author.login == "cursor")] | length'
```

Merge only when all checks pass/skip, bugbot review says "found 0 potential issues" (or no review yet), and there are no inline comments from `cursor`. If bugbot finds issues, stop and report them — don't merge.

> **Key lesson:** `gh pr checks` can report "skipping" for the bugbot check even when bugbot left a detailed review with real issues. Always fetch reviews AND inline comments separately via the API.
