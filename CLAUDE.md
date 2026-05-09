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

**Bugbot has two reporting modes — monitor BOTH:**
1. **Review comment mode** — posts a review body ("found N potential issues") with inline comments per file
2. **Check status mode** — reports directly as a `pass`/`fail` check with no review body

The Monitor must watch all three signals to catch either mode:

```bash
PR=<number>
REPO=lapease32/walking-rpg-app
last_reviews=""
last_inline_count=""
last_bugbot_check=""

while true; do
  # Signal 1: bugbot review body
  reviews=$(gh api repos/$REPO/pulls/$PR/reviews \
    --jq '[.[] | select(.author.login == "cursor[bot]")] | last | "\(.commit_id[:8]):\(.body[:200])"' 2>/dev/null || true)

  # Signal 2: bugbot inline comment count
  inline=$(gh api repos/$REPO/pulls/$PR/comments \
    --jq '[.[] | select(.author.login == "cursor[bot]")] | length | tostring' 2>/dev/null || true)

  # Signal 3: Cursor Bugbot check status
  bugbot_check=$(gh pr checks $PR --repo $REPO --json name,bucket \
    --jq '.[] | select(.name == "Cursor Bugbot") | .bucket' 2>/dev/null || true)

  [ "$reviews" != "$last_reviews" ] && [ -n "$reviews" ] && echo "REVIEW: $reviews" && last_reviews="$reviews"
  [ "$inline" != "$last_inline_count" ] && echo "INLINE_COMMENTS: $inline" && last_inline_count="$inline"
  [ "$bugbot_check" != "$last_bugbot_check" ] && [ -n "$bugbot_check" ] && echo "CHECK: Cursor Bugbot=$bugbot_check" && last_bugbot_check="$bugbot_check"

  sleep 270
done
```

**Safe-to-merge gate — all must be true:**

```bash
# 1. All CI checks pass or skipping
gh pr checks $PR --repo $REPO --json name,bucket \
  | jq -e 'all(.bucket == "pass" or .bucket == "skipping")'

# 2. Bugbot check status is pass (not pending/fail)
gh pr checks $PR --repo $REPO --json name,bucket \
  --jq '.[] | select(.name == "Cursor Bugbot") | .bucket' | grep -q "^pass$"

# 3. No inline comments from cursor[bot]
gh api repos/$REPO/pulls/$PR/comments \
  --jq '[.[] | select(.author.login == "cursor[bot]")] | length' | grep -q "^0$"

# 4. If a review body exists, it says "found 0 potential"
gh api repos/$REPO/pulls/$PR/reviews \
  --jq '[.[] | select(.author.login == "cursor[bot]")] | last | .body // ""' \
  | grep -qE "found 0 potential|^$"
```

Merge only when all four pass. If bugbot check is `fail` OR inline comments exist OR review body says "found N" (N > 0): stop and report to the user.

> **Key lesson:** Bugbot sometimes reports as a check `pass`/`fail` with no review body, and sometimes posts a full review with inline comments while the check shows `skipping`. Always poll all three signals independently.
