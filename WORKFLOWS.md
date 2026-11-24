# GitHub Actions Workflows

This repository uses three GitHub Actions workflows in [`.github/workflows/`](.github/workflows/) to handle continuous integration and GitHub Pages deployment, OCI container builds and releases, and automated dependency updates.

## Overview

| Workflow | File | Triggers | Purpose |
| --- | --- | --- | --- |
| **CI & Deploy** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Push/PR to `main` (with `paths-ignore`), manual dispatch | Typecheck, run core & CLI tests, build the Svelte/Vite web app, and deploy `dist/` to GitHub Pages on `main`. |
| **Container & Release** | [`.github/workflows/release.yml`](.github/workflows/release.yml) | Push/PR to `main` (container paths), SemVer tags (`[0-9]*.*.*`), manual dispatch | Build the headless CLI container with Buildah, smoke-test it with Podman, push OCI images to GHCR, and create/update GitHub Releases. |
| **Renovate** | [`.github/workflows/renovate.yml`](.github/workflows/renovate.yml) | Weekly schedule (Mon 03:00 UTC), push/PR on Renovate config, manual dispatch | Validate [`renovate.json`](renovate.json) on PRs and run self-hosted Renovate using `GITHUB_TOKEN` to open/update dependency PRs for manual review. |

---

## 1. CI & Deploy

**File:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

Validates the codebase and publishes the static web app to GitHub Pages.

### Triggers
- **`push` to `main`** and **`pull_request` targeting `main`**, ignoring changes that do not affect the web app or tests:
  - `**.md`
  - `Containerfile`
  - `renovate.json`
  - `.github/workflows/renovate.yml`
  - `.github/workflows/release.yml`
- **`workflow_dispatch`**: Can be run manually from the Actions tab (no inputs).

### Concurrency & Permissions
- **Concurrency group:** `ci-${{ github.workflow }}-${{ github.ref }}`
  - Cancels superseded runs on pull requests and non-`main` refs, while allowing in-progress `main` builds/deployments to finish.
- **Permissions:** `contents: read`, `pages: write`, `id-token: write` (for GitHub Pages OIDC deployment).

### Jobs

1. **`test-and-build` (`Test, Typecheck & Build`)** — `ubuntu-latest`, 10-minute timeout
   - Checks out the repository and sets up **Node.js 24** with npm caching.
   - Installs dependencies via `npm ci --prefer-offline --no-audit --no-fund`.
   - Runs typechecking and tests (core unit tests and CLI integration tests) **in parallel**, waiting on both processes so failures in either fail the job:
     - `npm run check` (`svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json`)
     - `npm test` (`node --test "src/**/*.test.ts"`)
   - Builds the production static site with `npm run build` (`vite build`, outputting to `dist/` with relative `base: './'`).
   - Uploads `dist/` as a GitHub Pages artifact (`actions/upload-pages-artifact@v3`) **only** on non-PR runs against `refs/heads/main`.

2. **`deploy-pages` (`Deploy to GitHub Pages`)** — `ubuntu-latest`, 5-minute timeout
   - Runs after `test-and-build`, **only** when `github.event_name != 'pull_request'` and `github.ref == 'refs/heads/main'`.
   - Deploys the uploaded artifact to the `github-pages` environment via `actions/deploy-pages@v4`.

---

## 2. Container & Release

**File:** [`.github/workflows/release.yml`](.github/workflows/release.yml)

Builds and verifies the headless Node CLI container image defined in [`Containerfile`](Containerfile), publishes it to GitHub Container Registry (`ghcr.io`), and manages GitHub Releases.

### Triggers
- **`push` to `main`** or **`pull_request` targeting `main`** when any container-relevant file changes:
  - `Containerfile`
  - `package.json`, `package-lock.json`
  - `src/core/**`, `src/node/**`, `src/cli/**`
  - `public/preset_logo.svg`
  - `.github/workflows/release.yml`
- **`push` of SemVer tags** matching `[0-9]*.*.*` (e.g., `0.1.0`, `1.2.3`).
- **`workflow_dispatch`** with an optional SemVer `tag` input (e.g., `0.1.0`) to manually publish a tagged container image and create/update a GitHub Release.

### Concurrency & Permissions
- **Concurrency group:** `container-${{ github.workflow }}-${{ github.ref }}`
  - Cancels in-progress runs only for `pull_request` events.
- **Permissions:** `contents: write` (for creating/editing GitHub Releases) and `packages: write` (for pushing to GHCR).

### Job: `container-and-release` (`Build Container (Buildah) & Release`)

Runs on `ubuntu-latest` with a 15-minute timeout:

1. **Resolve image metadata (`docker/metadata-action@v5`)**
   Computes OCI labels and image tags for `ghcr.io/<owner>/<repo>`:

   | Event / Condition | Tags Generated |
   | --- | --- |
   | Pull request | `pr-<number>`, `<short-sha>` |
   | Push to `main` | `main`, `<short-sha>`, `latest` |
   | Push of `X.Y.Z` tag | `X.Y.Z`, `X.Y`, `X`, `<short-sha>`, `latest` |
   | Manual dispatch with `inputs.tag` | Branch tag, `<short-sha>`, `latest`, `<inputs.tag>` |

2. **Restore npm cache (`actions/cache@v4`)**
   Caches `/tmp/buildah-npm-cache` keyed by `package-lock.json` hash (`<os>-buildah-npm-<hash>`). This directory is bind-mounted into the container build at `/tmp/npm-cache` so `npm ci --omit=dev` inside [`Containerfile`](Containerfile) reuses downloaded packages.

3. **Log in to GHCR** *(skipped on pull requests)*
   Authenticates `buildah` to `ghcr.io` using `GITHUB_TOKEN`.

4. **Build container image with Buildah**
   Builds [`Containerfile`](Containerfile) with `buildah bud --layers --format oci`, applying all resolved tags and OCI labels (extending/overriding the static `org.opencontainers.image.*` labels defined in `Containerfile` with dynamic build metadata such as `created`, `revision`, and `version`). The multi-stage image installs only runtime dependencies (`@napi-rs/canvas` and bundled fonts) on top of `quay.io/hummingbird/nodejs:24`.

5. **Smoke test image with Podman** *(runs on PRs as well)*
   Executes the built image against a temporary output directory:
   ```bash
   podman run --rm -v /tmp/smoke-out:/out:Z <primary_tag> --text "CI\nSmoke" --out /out/logo.png
   ```
   Verifies `/tmp/smoke-out/logo.png` exists and is non-empty (`test -s`).

6. **Push tags to GHCR with Buildah** *(skipped on pull requests)*
   Pushes every resolved tag via `buildah push --digestfile ...` and captures the resulting immutable image digest (`sha256:...`).

7. **Create GitHub Release** *(runs on SemVer tag pushes or manual dispatch with a non-empty `tag` input)*
   Creates (or updates, if it already exists) a GitHub Release for the tag via `gh release create --generate-notes` / `gh release edit`. The release notes include `podman pull` commands for both the SemVer release tag and the immutable `@sha256:...` digest, plus a sample `podman run` invocation.

### Cutting a Release
- **Recommended (SemVer tag push):**
  ```bash
  git tag 0.1.0
  git push origin 0.1.0
  ```
- **Manual:** Trigger **Container & Release** from the Actions tab and provide the SemVer `tag` input (for example, `0.1.0`).

---

## 3. Renovate

**File:** [`.github/workflows/renovate.yml`](.github/workflows/renovate.yml)  
**Config:** [`renovate.json`](renovate.json)

Keeps npm dependencies and [`Containerfile`](Containerfile) base images up to date using a self-hosted Renovate GitHub Action running with the built-in `GITHUB_TOKEN` (no personal access token and no auto-merge).

### Triggers
- **`schedule`:** Weekly on Mondays at `03:00 UTC` (`0 3 * * 1`), aligned with the `00:00–04:59 UTC` Monday schedule window in [`renovate.json`](renovate.json).
- **`push` to `main`** and **`pull_request` targeting `main`** when `renovate.json` or `.github/workflows/renovate.yml` changes.
- **`workflow_dispatch`:** Supports an optional `logLevel` input (`info` [default] or `debug`) for troubleshooting.

### Concurrency & Permissions
- **Concurrency group:** `renovate-${{ github.ref }}` (cancels in-progress runs only on pull requests).
- **Permissions:** `contents: read` at workflow level; the `renovate` job (non-PR only) elevates to `contents: write`, `pull-requests: write`, and `issues: write` so Renovate can push branches, open PRs, and maintain the Dependency Dashboard issue using `GITHUB_TOKEN`.

### Jobs

1. **`validate` (`Validate Renovate Config`)** — `ubuntu-latest`, 5-minute timeout
   - Runs **only on `pull_request`**.
   - Sets up Node.js 24 and runs `npx --yes --package renovate -c "renovate-config-validator --strict"` to verify [`renovate.json`](renovate.json) before merging.

2. **`renovate` (`Run Renovate`)** — `ubuntu-latest`, 15-minute timeout
   - Runs on **all non-PR events** (`schedule`, `push` to `main`, `workflow_dispatch`).
   - Restores and saves Renovate's cache at `/tmp/renovate/cache` (`actions/cache@v4`, rolling key `renovate-cache-<run_id>`).
   - Runs `renovatebot/github-action@v43.0.4` against this repository using `renovate.json` and `GITHUB_TOKEN`.

### Key `renovate.json` Rules
- **Base presets:** `config:best-practices`, `:maintainLockFilesWeekly` (auto-merge disabled; all PRs are reviewed and merged manually).
- **Rate limits & labels:** Up to 5 PRs/hour, 10 concurrent PRs, labeled `dependencies`.
- **Custom `Containerfile` manager:** Regex manager tracks `FROM <image>:<tag>[@<digest>]` lines against the `docker` datasource.
- **Grouping & manager scope:**
  - **Container base images (`Containerfile`):** Grouped with digests pinned (`pinDigests: true`).
  - **Svelte & UI toolchain** (`svelte*`, `@sveltejs/*`, `@tsconfig/svelte`, `vite`, `@skeletonlabs/*`, `@lucide/svelte`): Grouped together.
  - **Tailwind CSS** (`tailwindcss`, `@tailwindcss/vite`): Grouped together.
  - **GitHub Actions (`github-actions` manager):** Disabled while running with `GITHUB_TOKEN`, which cannot modify `.github/workflows/*` files without a dedicated GitHub App or PAT.

---

## Path Filtering Summary

Path filters keep workflow runs targeted to what changed:

| Changed Files | CI & Deploy | Container & Release | Renovate |
| --- | :---: | :---: | :---: |
| `*.md` (docs only) | Skipped | Skipped | Skipped |
| Web UI (`src/lib/**`, `src/browser/**`, `src/App.svelte`, `index.html`) | Runs | Skipped | Skipped |
| Shared/CLI (`src/core/**`, `src/node/**`, `src/cli/**`, `package*.json`, `public/preset_logo.svg`) | Runs | Runs | Skipped |
| `Containerfile` | Skipped | Runs | Skipped |
| `renovate.json` / `.github/workflows/renovate.yml` | Skipped | Skipped | Runs (`validate` on PR, `renovate` on `main`) |

---

## Repository Settings

To make sure all three workflows operate as intended in GitHub (no custom secrets required):

1. **GitHub Pages (`CI & Deploy`):**
   Go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
2. **GitHub Container Registry (`Container & Release`):**
   Uses the built-in `GITHUB_TOKEN` with `packages: write`. After the first push, set the package visibility to **Public** in GitHub Packages settings so anyone can pull `ghcr.io/dm0dev/kubranding`.
3. **Actions PR creation (`Renovate`):**
   Go to **Settings → Actions → General → Workflow permissions** and enable **Allow GitHub Actions to create and approve pull requests** so Renovate can open PRs with `GITHUB_TOKEN`. Note that GitHub does not automatically trigger `pull_request` workflows on PRs opened by `GITHUB_TOKEN` (close/reopen the PR or push a commit to run CI on a Renovate PR, or switch to a GitHub App/PAT later if you want automatic CI triggers and `.github/workflows/*` updates).
