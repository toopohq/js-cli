# js-cli

`toopo`, the client for JavaScript and TypeScript projects. It copies a function of the
[JavaScript catalogue](https://github.com/toopohq/js) into your project, as `.ts` or `.js` to
match it, and the source is yours from then on.

```sh
npx toopo init
npx toopo add string/truncate
```

`init` writes `toopo.json`; `add` writes the function and records its version and digest in
`toopo.lock`. Node 22 or later.
