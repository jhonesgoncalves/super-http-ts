# Contributing to super-http

Thank you for considering a contribution! 🎉

## Development setup

```bash
git clone https://github.com/jhonesgoncalves/super-http-ts.git
cd super-http-ts
npm install
```

## Workflow

1. Fork the repo and create your branch from `main`.
2. Write your code and update/add tests in `src/__tests__/`.
3. Make sure all checks pass before opening a PR:

```bash
npm run lint       # ESLint
npm run build      # TypeScript compiler
npm test           # Jest
npm run docs       # TypeDoc (ensure no broken references)
```

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code change with no feature or fix |
| `test:` | Test additions or corrections |
| `chore:` | Build, CI, tooling |

## Pull Request checklist

- [ ] Tests added or updated for every changed behaviour
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` produces no TypeScript errors
- [ ] CHANGELOG.md updated under `[Unreleased]`

## Reporting bugs

Open an issue at [github.com/jhonesgoncalves/super-http-ts/issues](https://github.com/jhonesgoncalves/super-http-ts/issues) and include:

- Node.js version (`node -v`)
- super-http version
- Minimal reproduction snippet
- Expected vs actual behaviour
