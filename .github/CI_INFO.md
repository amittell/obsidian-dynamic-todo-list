# GitHub Actions CI Workflow

## Overview

This repository uses a lean, cost-effective CI pipeline designed to catch common issues while staying within GitHub's free tier limits.

**Estimated cost**: ~$0.03 per PR (~$1/month for typical usage)

---

## Jobs

### 1. Build & Lint (Required)
**Runs on**: All branches and PRs  
**Duration**: ~2 minutes  
**Cost**: ~$0.02 per run

**Checks**:
- ✅ TypeScript type checking (`tsc --noEmit`)
- ✅ ESLint validation
- ✅ Production build succeeds
- ✅ Build artifacts generated (`main.js`)

**Fails if**:
- TypeScript errors
- Linting errors
- Build fails
- Missing build artifacts

---

### 2. Release Ready (Optional)
**Runs on**: Main branch and PRs to main only  
**Duration**: ~1 minute  
**Cost**: ~$0.01 per run

**Checks**:
- ✅ Version consistency (`package.json` = `manifest.json`)
- ✅ Required files present (`manifest.json`, `README.md`, `LICENSE`)
- ⚠️ Security audit (non-blocking)

**Fails if**:
- Version mismatch between package.json and manifest.json
- Missing required files

---

## Cost Optimization Features

### 1. Concurrency Control
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
- Cancels old runs when new commits are pushed
- **Saves**: ~50% on rapid iteration

### 2. Timeout Limits
- Build & Lint: 5 minutes max
- Release Ready: 3 minutes max
- **Saves**: Prevents runaway jobs

### 3. Conditional Jobs
- Release Ready only runs on main/PRs to main
- **Saves**: ~50% on branch workflows

### 4. NPM Cache
```yaml
cache: 'npm'
```
- Caches `node_modules` between runs
- **Saves**: ~30 seconds per run

---

## Monthly Cost Estimate

Based on typical usage:
- ~10 PRs/month × 2 pushes/PR = 20 runs
- Build & Lint: 20 × $0.02 = $0.40
- Release Ready: 10 × $0.01 = $0.10
- **Total**: ~$0.50/month

**GitHub free tier**: 2,000 minutes/month = ~$10 equivalent  
**Usage**: ~5% of free tier

---

## What's NOT Included

To keep costs minimal, we intentionally skip:
- ❌ Unit tests (add `npm test` if you have tests)
- ❌ Integration tests
- ❌ Code coverage reports
- ❌ Multiple Node versions
- ❌ Multiple OS testing
- ❌ Artifact uploads (except on main)
- ❌ Deployment automation

---

## Adding More Checks

If you want to add more checks later, add them to the `build-and-lint` job:

```yaml
- name: Run tests
  run: npm test
  if: github.event_name == 'pull_request'  # Only on PRs
```

---

## Viewing Results

- **PR page**: Status checks appear at the bottom
- **Actions tab**: https://github.com/amittell/obsidian-dynamic-todo-list/actions
- **Direct link**: Shows in PR status checks

---

## Troubleshooting

### Build fails locally but passes in CI
- Check Node version: CI uses Node 18
- Clear cache: `rm -rf node_modules package-lock.json && npm install`

### CI is too slow
- Check if npm cache is working
- Consider reducing dependencies

### CI costs too much
- Reduce push frequency (batch commits)
- Use draft PRs (no CI runs)
- Disable Release Ready job on branches

---

## Further Optimization

If you need to cut costs further:
1. Remove ESLint from CI (rely on local checks)
2. Only run CI on PRs, not all pushes
3. Increase debounce time with concurrency rules

---

**Last Updated**: 2025-10-05  
**Based on**: `amittell/obsidian-granola` workflow (simplified)
