# Contributing

- **A runtime dependency** is not accepted: `npx toopo` downloads the client and nothing else.
- **A new function** belongs in the catalogue, [`toopohq/js`](https://github.com/toopohq/js), not
  here.

## Before a pull request

```sh
pnpm install
pnpm check
```

- The title follows [Conventional Commits](https://www.conventionalcommits.org), for example
  `feat(init): detect a TypeScript project`. It becomes the commit on `main`.
- Every commit is signed off (`git commit -s`), certifying the
  [Developer Certificate of Origin](https://developercertificate.org).
- No assistant attribution in the title, the body or any commit.

CI refuses a pull request that breaks any of these.
