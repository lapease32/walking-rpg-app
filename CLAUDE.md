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
1. **Review comment mode** — posts a review body ("found N potential issues") with inline comments per file; check shows `skipping`
2. **Check status mode** — reports directly as a `pass`/`fail` check with no review body

The Monitor must watch all three signals AND emit immediately if already mergeable at startup:

```bash
PR=<number>
REPO=lapease32/walking-rpg-app

is_mergeable() {
  local checks bugbot_bucket inline review_body

  # 1. All CI checks must be terminal (pass/skipping). API failure → checks="" → jq errors → return 1.
  checks=$(gh pr checks $PR --repo $REPO --json name,bucket 2>/dev/null || true)
  echo "$checks" | jq -e 'length > 0 and all(.bucket == "pass" or .bucket == "skipping")' \
    >/dev/null 2>&1 || return 1

  # 2. Bugbot check must not be fail. Take first match to guard against duplicate entries.
  bugbot_bucket=$(echo "$checks" \
    | jq -r '[.[] | select(.name == "Cursor Bugbot") | .bucket] | first // ""' 2>/dev/null || true)
  [ "$bugbot_bucket" != "fail" ] || return 1

  # 3. No inline comments from cursor[bot]. ?per_page=100 avoids pagination truncation.
  inline=$(gh api "repos/$REPO/pulls/$PR/comments?per_page=100" \
    --jq '[.[] | select(.user.login == "cursor[bot]")] | length' 2>/dev/null || echo "99")
  [ "$inline" = "0" ] || return 1

  # 4. Review body must not report issues. Positive grep is portable across grep implementations.
  review_body=$(gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" \
    --jq '[.[] | select(.user.login == "cursor[bot]")] | last | .body // ""' 2>/dev/null || true)
  echo "$review_body" | grep -qE "found [1-9][0-9]* potential" && return 1

  return 0
}

emit_status() {
  local bugbot_bucket inline review_snippet
  bugbot_bucket=$(gh pr checks $PR --repo $REPO --json name,bucket \
    --jq '[.[] | select(.name == "Cursor Bugbot") | .bucket] | first // "none"' 2>/dev/null \
    || echo "err")
  inline=$(gh api "repos/$REPO/pulls/$PR/comments?per_page=100" \
    --jq '[.[] | select(.user.login == "cursor[bot]")] | length' 2>/dev/null || echo "err")
  review_snippet=$(gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" \
    --jq '[.[] | select(.user.login == "cursor[bot]")] | last | .body[:100] // "none"' \
    2>/dev/null || echo "err")
  # Collapse newlines in snippet so the status line stays single-line for string comparison
  echo "STATUS bugbot=$bugbot_bucket inline=$inline review=${review_snippet//$'\n'/ }"
}

# Emit immediately if already ready at startup
if is_mergeable; then echo "READY_AT_STARTUP: $(emit_status)"; fi

last_status=""
while true; do
  sleep 270
  cur=$(emit_status)
  if [ "$cur" != "$last_status" ]; then
    echo "CHANGED: $cur"
    last_status="$cur"
    is_mergeable && echo "MERGEABLE"
  fi
done
```

**Safe-to-merge gate — all must be true (run immediately before merging):**

```bash
# 1. All CI checks pass or skipping, and checks list is non-empty
gh pr checks $PR --repo $REPO --json name,bucket \
  | jq -e 'length > 0 and all(.bucket == "pass" or .bucket == "skipping")'

# 2. Bugbot check is not fail (pass or skipping both allowed)
gh pr checks $PR --repo $REPO --json name,bucket \
  --jq '[.[] | select(.name == "Cursor Bugbot") | .bucket] | first // ""' \
  | grep -qvE "^fail$"

# 3. No inline comments from cursor[bot]
gh api "repos/$REPO/pulls/$PR/comments?per_page=100" \
  --jq '[.[] | select(.user.login == "cursor[bot]")] | length' | grep -q "^0$"

# 4. Review body does not say "found N potential" (N >= 1)
review=$(gh api "repos/$REPO/pulls/$PR/reviews?per_page=100" \
  --jq '[.[] | select(.user.login == "cursor[bot]")] | last | .body // ""')
echo "$review" | grep -qE "found [1-9][0-9]* potential" && echo "BUGBOT FOUND ISSUES" && exit 1
echo "All gates passed — safe to merge"
```

Merge only when all four pass. If bugbot check is `fail` OR inline comments exist OR review body says "found N" (N > 0): stop and report to the user.

> **Key lessons:**
> - Bugbot sometimes reports as a check `pass`/`fail` with no review body, and sometimes posts a full review with inline comments while the check shows `skipping`. Always poll all three signals independently.
> - Review bodies are multi-line. Use a positive `grep -qE "found [1-9]..."` to detect issues — do NOT use `grep -qE "found 0|^$"` (blank lines match `^$`) or `grep -qvE` (behavior differs between macOS ugrep and GNU grep).
> - Use `?per_page=100` on inline comments and reviews endpoints; the default page size is 30.
> - Extract single bugbot bucket with `[...] | first // ""` to handle duplicate check entries safely.
