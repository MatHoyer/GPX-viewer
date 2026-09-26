---
name: release
description: Cut a GPX-viewer release end to end - run scripts/release.sh, wait for the GHCR image, then bump the image in the homelab ops repo and push (deploys via ArgoCD).
argument-hint: "[patch|minor|major|X.Y.Z]"
disable-model-invocation: true
---

# Release GPX-viewer

Invoking this skill is the go-ahead to release, push to `main`, and deploy.
Stop and report on any failure; never force-push or skip a failed step.

## 1. Pick the bump

If `$ARGUMENTS` is given, use it. Otherwise derive it from commits since the
latest tag (`git log $(git tag --list '[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -n1)..HEAD --format=%s`):
`!` or `BREAKING CHANGE` → `major`, any `feat` → `minor`, else `patch`.
If there are no commits since the latest tag, stop: nothing to release.
State the chosen bump and resulting version in one line, then continue.

## 2. Run the release script

From the repo root:

```bash
printf 'y\n' | scripts/release.sh <bump>
```

Run with a 10 min timeout (quality gates build the web app). The script
checks the tree, runs gates, commits `chore(release): X.Y.Z`, tags, and pushes
`main` + the tag. The push prints "3 of 3 required status checks are
expected": that is the admin-bypass warning, not a failure. Read the new
version from the `chore(release): X.Y.Z` line of the output.

## 3. Wait for the image

The tag fires `docker.yml` (multi-arch build, ~several minutes) and
`release.yml` (GitHub release). Find and watch the Docker run:

```bash
gh run list --workflow docker.yml --branch X.Y.Z --limit 1 --json databaseId --jq '.[0].databaseId'
gh run watch <id> --exit-status
```

The run may take a few seconds to appear after the push; retry the list a
couple of times. Run `gh run watch` in the background if it would exceed the
Bash timeout. If the run fails, stop and show `gh run view <id> --log-failed`.

Then confirm the image is pullable (GHCR package is public):

```bash
docker manifest inspect ghcr.io/mathoyer/gpx-viewer:X.Y.Z >/dev/null && echo ok
```

Also check `gh release view X.Y.Z` exists; report if the Release workflow failed,
but it doesn't block the deploy.

## 4. Bump the homelab ops repo

Repo: `~/work/homelab/ops` (origin `git.mathieuhoyer.fr/homelab/ops`). ArgoCD
auto-syncs `main`, so the push is the prod deploy.

```bash
cd ~/work/homelab/ops
git status --porcelain            # must be empty, else stop
git checkout main && git pull --ff-only
```

Edit `clusters/homelab/infrastructure/gpx-viewer/deployment.yaml`: change the
`image: ghcr.io/mathoyer/gpx-viewer:<old>` line to `:X.Y.Z` (pinned exact
version, never `latest`). Verify with `git diff` that only that line changed.

```bash
git commit -am "chore(gpx-viewer): bump image to X.Y.Z"
git push origin main
```

No AI attribution in the commit.

## 5. Report

One short summary: version, GitHub release URL, image tag, ops commit hash.
ArgoCD syncs within ~3 min (`argocd app sync gpx-viewer` to force).
