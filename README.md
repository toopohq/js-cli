# js-cli

`toopo`, the client for JavaScript and TypeScript projects. It copies a function of the
[JavaScript catalogue](https://github.com/toopohq/js) into your project, as `.ts` or `.js` to
match it, and the source is yours from then on.

```sh
npx toopo init
npx toopo add string/truncate
```

`init` writes `toopo.json`; `add` writes the function and records its version and digest in
`toopo.lock`. Node 22.12 or later.

`add` prints the file it wrote and the line that imports it from beside its folder, from `src/`
when the folder is `src/toopo`:

```
src/toopo/string/truncate.ts
import { truncate } from './toopo/string/truncate.js'
```

TypeScript imports a `.ts` file as `.js`, as `tsc` requires without `allowImportingTsExtensions`.

The function is an ES module. In a CommonJS project, one whose `package.json` does not say
`"type": "module"`, the JavaScript lands as `.mjs`, which Node loads as ESM, from `require` too
since Node 22.12, and `add` prints the `require` line:

```
toopo/string/truncate.mjs
const { truncate } = require('./toopo/string/truncate.mjs')
```
