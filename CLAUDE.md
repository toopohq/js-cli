# js-cli

The Toopo client, published to npm as `toopo`: the command a user runs to copy a function of the
JavaScript catalogue, `toopohq/js`, into their project.

## Structure

- `src/main.ts` — the entry; `bin` is its emission, `dist/main.js`, which `tsconfig.build.json`
  builds on `prepack`. With no command it knows, it prints the usage to stderr and exits 1.
- `src/init.ts` — `toopo init`: detects TypeScript or JavaScript, asks, writes `toopo.json`.
- `src/add.ts` — `toopo add`: fetches a record, verifies the digest, writes the file and
  `toopo.lock`, prints the file and its import.
- `src/*.test.ts` — run `main.ts` in a child Node process; `add` against a local registry,
  `TOOPO_REGISTRY`.
- `.claude/hook.mjs` — fast feedback for Claude Code, not enforcement: it sees Write and Edit, and
  a shell bypasses it. Refuses a root entry outside its allowlist, a runtime dependency field in
  `package.json` — CI refuses that one too — and a `CLAUDE.md` past 150 lines; formats and lints
  every file written.
- `.github/workflows/release.yml` — a tag `v<version>` on `main` packs the client, runs the tarball
  on Linux, macOS and Windows, Node 22.13.0 and 24, then publishes it to npm with provenance from
  the `npm` environment. A release is a pull request bumping `version`, which runs it short of
  publishing, then the owner's tag on its merge; a tag ruleset refuses anyone else's.
- `DECISIONS.md` — one line per decision.

## Commands

- `pnpm install`
- `pnpm check` — Biome (a warning fails), `tsc`, Vitest, knip. CI runs the same, plus the packed
  client, unpacked where no devDependency resolves and run, and the pull request checks, which
  run even when `pnpm check` fails.

## Non-negotiables

- Zero runtime dependencies: `package.json` has no `dependencies`, `optionalDependencies` or
  `peerDependencies` field. The hook and CI refuse each.
- The client runs on Node 22.13 and later: `@types/node` is pinned to 22 and `lib` to ES2024, so
  `tsc` refuses an API Node 22 does not have. The toolchain and CI run Node 24.
- A source file is at most 150 lines, a function at most 40. Biome enforces both.
- A pull request title is a Conventional Commit, every commit is signed off (DCO), and no title,
  body or commit carries assistant attribution. CI refuses otherwise.
- `main` takes squash merges of green pull requests, nothing else. Its ruleset refuses the rest.
