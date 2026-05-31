# Claude Code Rules — WalkingRPGApp

## Branching

Always create a new branch before making any code changes. Never commit directly to `main`. If the current branch is `main`, create a descriptive branch first (e.g. `fix/player-null-check`, `feature/combat-rewards`).

## Production quality

This is a monetized App Store / Play Store app — not a demo. When a fix has a "quick" path and a "right" path, default to the right one and flag the tradeoff explicitly. Don't silence warnings by weakening types or adding suppressions unless the alternative is genuinely worse. Think about what a senior engineer shipping a paid app would do, not what gets CI green fastest.

## Pull requests

- Always apply labels from the repo label set (`bugfix`, `feature`, `security`, `refactor`, `android`, `iOS`, `github`, `dependencies`, `distribution`, `debug mode`, etc.)
- Omit the "## Test plan" section from PR bodies — the user will request testing explicitly before merging
- Open PRs and apply bugbot fixes without asking for confirmation. Only ask before `gh pr merge` — **never auto-merge**. The user merges, not Claude.

## After creating a PR — bugbot loop

After every PR is created, immediately start a self-paced `/loop` that polls for bugbot feedback and surfaces the result to the user when safe to merge. 60s monitor poll (catches build transitions quickly); ~270s `ScheduleWakeup` fallback (stays in the prompt-cache window). Do NOT auto-merge — the loop reports "ready to merge" and waits for the user to confirm.

**Bugbot reports in two modes — the gate below handles both:**
1. **Review mode** — posts inline comments (each is a GitHub *review thread*) + a review body; the `Cursor Bugbot` check shows `skipping`.
2. **Check mode** — reports a `pass`/`fail` check with no review body.

**Work the UNRESOLVED review threads — that is the authoritative signal.** Do NOT count raw comments or grep the review body. (We used to filter inline comments by `commit_id` + `ref1_` carry-forward markers; it was unreliable — bugbot re-posts already-fixed findings against the new HEAD *without* the `ref1_` marker, so they looked fresh and falsely blocked the gate. Thread *resolution state* is the reliable signal.)

For each **unresolved** `cursor` review thread on the PR:
- **Legitimate** → fix it, commit, push. Bugbot **auto-resolves** the thread on its re-review once it confirms the fix — no manual resolve needed.
- **False positive** → post a one-line reply stating *why* (auditable record), then resolve it with the `resolveReviewThread` mutation. Never resolve to silence a finding you haven't actually judged.

Repeat until **zero unresolved `cursor` threads**. NOTE: in the GraphQL API bugbot's author login is `cursor` (the REST API renders the same bot `cursor[bot]`).

**Merge gate — all must be true (never auto-merge; report and wait for the user):**
1. All CI checks terminal (`pass`/`skipping`), list non-empty.
2. `Cursor Bugbot` check ≠ `fail`.
3. **Zero unresolved `cursor` review threads** on the PR.

```bash
PR=<number>
REPO=lapease32/walking-rpg-app

# Authoritative "outstanding bugbot findings" signal: unresolved cursor review threads.
unresolved_bugbot_threads() {
  gh api graphql -f query='
    query($owner:String!,$name:String!,$pr:Int!){
      repository(owner:$owner,name:$name){
        pullRequest(number:$pr){
          reviewThreads(first:100){ nodes{ isResolved comments(first:1){ nodes{ author{ login } } } } }
        }
      }
    }' -F owner=lapease32 -F name=walking-rpg-app -F pr=$PR \
    --jq '[.data.repository.pullRequest.reviewThreads.nodes[]
           | select(.isResolved == false and .comments.nodes[0].author.login == "cursor")] | length' \
    2>/dev/null || echo "err"
}

is_mergeable() {
  local checks bugbot_bucket unresolved
  checks=$(gh pr checks $PR --repo $REPO --json name,bucket 2>/dev/null || true)
  echo "$checks" | jq -e 'length > 0 and all(.bucket == "pass" or .bucket == "skipping")' >/dev/null 2>&1 || return 1
  bugbot_bucket=$(echo "$checks" | jq -r '[.[] | select(.name == "Cursor Bugbot") | .bucket] | first // ""' 2>/dev/null || true)
  [ "$bugbot_bucket" != "fail" ] || return 1
  unresolved=$(unresolved_bugbot_threads)
  [ "$unresolved" = "0" ] || return 1
  return 0
}

emit_status() {
  local checks bugbot_bucket unresolved failed pending
  checks=$(gh pr checks $PR --repo $REPO --json name,bucket 2>/dev/null || true)
  bugbot_bucket=$(echo "$checks" | jq -r '[.[] | select(.name == "Cursor Bugbot") | .bucket] | first // "none"' 2>/dev/null || echo "err")
  unresolved=$(unresolved_bugbot_threads)
  # failed/pending check names so build transitions trigger CHANGED notifications immediately
  failed=$(echo "$checks" | jq -r '[.[] | select(.bucket == "fail") | .name] | join(",")' 2>/dev/null || echo "err")
  pending=$(echo "$checks" | jq -r '[.[] | select(.bucket == "pending") | .name] | join(",")' 2>/dev/null || echo "err")
  echo "STATUS bugbot=$bugbot_bucket unresolvedThreads=$unresolved failed=$failed pending=$pending"
}

if is_mergeable; then echo "READY_AT_STARTUP: $(emit_status)"; fi

last_status=""
while true; do
  sleep 60
  cur=$(emit_status)
  if [ "$cur" != "$last_status" ]; then
    echo "CHANGED: $cur"
    last_status="$cur"
    is_mergeable && echo "MERGEABLE"
  fi
done
```

**Working a thread (judge → reply if false positive → resolve):**

```bash
# 1. List the unresolved cursor threads with their id + first comment, to judge each:
gh api graphql -f query='
  query($owner:String!,$name:String!,$pr:Int!){
    repository(owner:$owner,name:$name){
      pullRequest(number:$pr){
        reviewThreads(first:100){ nodes{
          id isResolved
          comments(first:1){ nodes{ author{ login } path body } }
        } }
      }
    }' -F owner=lapease32 -F name=walking-rpg-app -F pr=$PR \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved == false and .comments.nodes[0].author.login == "cursor")
        | {id, path: .comments.nodes[0].path, body: .comments.nodes[0].body[:240]}'

# 2. FALSE POSITIVE only — reply with the reason, then resolve. (Legit findings: just fix+push;
#    bugbot auto-resolves on re-review.)
gh api graphql -f query='
  mutation($id:ID!,$body:String!){
    addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$id, body:$body}){ comment{ id } }
  }' -F id=<THREAD_ID> -F body="False positive: <reason, e.g. localSavedAtRef was removed in <sha>>."

gh api graphql -f query='
  mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ id isResolved } } }' \
  -F id=<THREAD_ID>
```

Merge only when all three gate conditions hold. If the bugbot check is `fail`, or any unresolved `cursor` thread remains: stop and report to the user.

> **Key lessons:**
> - **Thread resolution state is the signal, not comment counts.** `commit_id`/`ref1_` filtering was abandoned (2026-05-31) — bugbot re-posts fixed findings on the new HEAD without the `ref1_` marker, defeating that filter (burned us on PR #170).
> - Bugbot **auto-resolves its own findings** once a re-review confirms the fix — verified on #170 (3 fixed findings auto-resolved; only 2 false positives stayed unresolved). So you usually only manually resolve false positives.
> - The `Cursor Bugbot` **check status is independent of thread resolution** — resolving threads does not flip the check to `pass`; the check passes when a re-review finds nothing. The merge gate keys off *unresolved threads*, not the review body.
> - GraphQL author login is `cursor`; REST renders it `cursor[bot]`. `resolveReviewThread` / `addPullRequestReviewThreadReply` are GraphQL-only (no plain `gh` subcommand) — proven working with the current token (#170, 2026-05-31).
> - Use a 60s poll in the monitor (catches build transitions); 270s is the `ScheduleWakeup` fallback only. Include `failed`/`pending` check names in `emit_status` so a `pending → pass` transition produces a `CHANGED` notification.
> - Bugbot reports `skipping` in review mode and `pass` in check mode — both are non-fail and allowed; the gate distinguishes outstanding work via unresolved threads, so it no longer needs to branch on the mode.
