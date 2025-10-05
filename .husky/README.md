# Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The `pre-commit` hook runs automatically before each commit to ensure code quality:

### Checks Performed

1. **ESLint** - Lints all staged TypeScript files and auto-fixes issues
2. **TypeScript** - Type checks all staged TypeScript files
3. **Build** - Ensures the project builds successfully

### What This Prevents

- Committing code with linting errors
- Committing code with TypeScript errors
- Committing code that doesn't build
- Pushing broken code that would fail CI

### Benefits

- Catches issues early (before pushing)
- Faster feedback loop
- Reduces failed CI runs
- Maintains code quality standards

## Setup

Hooks are automatically installed when you run:

```bash
npm install
```

The `prepare` script in `package.json` sets up Husky automatically.

## Skipping Hooks (Emergency Only)

If you absolutely need to skip the pre-commit checks:

```bash
git commit --no-verify -m "your message"
```

⚠️ **Warning**: Only use `--no-verify` in emergencies. Your commit will likely fail CI.
