# Decisions

One line per decision, newest last.

- 2026-09-24 — The toolchain and its checks are those of `spec` and `js`, at the same versions: Biome capping a file at 150 lines and a function at 40, a warning failing like an error; TypeScript 7; Vitest; knip; CI on Node 24. One project, one policy.
- 2026-09-24 — The client has no runtime dependencies. Node covers what it needs (`fetch`, `node:crypto`, `util.parseArgs`, `node:readline/promises`), and `npx toopo` downloads the client alone. The hook refuses a `dependencies` field on a write, CI on every pull request, since `pnpm add` in a shell bypasses the hook.
- 2026-09-24 — The client runs on Node 22 and later, the oldest line still maintained, until April 2027; the toolchain runs on 24. `@types/node` is pinned to 22, so `tsc` refuses an API Node 22 does not have, as `lib` holds the catalogue to its baseline. `tsconfig.json` names it, since TypeScript 7 includes no `@types` package unless named. Known ceiling: its behaviour is tested on Node 24 alone. `engines` is written with the first release.
- 2026-09-24 — The published client is JavaScript: Node strips no types under `node_modules`. The build, which will also bundle `spec`'s raw `.ts`, is chosen with the first release; until then `package.json` is `private`, and `bin` points at `src/main.ts`, which Node 24 runs as it is.
- 2026-09-24 — `@toopo/spec` joins the devDependencies with its first import: knip refuses a dependency nothing imports.
- 2026-09-24 — No Stryker: mutation testing is the catalogue's, scoped to the files a user copies. The client is tested by Vitest.
