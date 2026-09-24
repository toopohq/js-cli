import { hash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, posix } from 'node:path'
import { parseArgs } from 'node:util'
import type { ServedRecord } from '@toopo/spec/record'

const registry = process.env.TOOPO_REGISTRY ?? 'https://toopo.dev'

async function get(path: string): Promise<Response> {
  const response = await fetch(`${registry}/${path}`)
  if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`)
  return response
}

export function read(file: string) {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${file} is not valid JSON`)
  }
}

export async function add(args: string[]): Promise<void> {
  const { positionals } = parseArgs({ args, allowPositionals: true })
  const [name] = positionals
  if (name === undefined || positionals.length > 1)
    throw new Error('usage: toopo add <domain>/<name>')
  if (!existsSync('toopo.json')) throw new Error('no toopo.json: run toopo init')
  const config: { emission: 'ts' | 'js'; extension: string; folder: string } = read('toopo.json')
  const { emission, extension, folder } = config
  const lock = existsSync('toopo.lock') ? read('toopo.lock') : {}
  const file = join(folder, `${name}.${extension}`)
  if (existsSync(file)) throw new Error(`${file} already exists, and it is yours`)
  const address = `js/${name}`
  const record: ServedRecord = JSON.parse(await (await get(`${address}.json`)).text())
  // The registry serves only addresses `spec` accepts: equal to the one asked, no `..` reaches `file`.
  if (record.address !== address)
    throw new Error(`${address}: the registry served ${record.address}`)
  if (record.dependencies.length) throw new Error(`${address}: dependencies are not supported yet`)
  const served = record.emissions[emission]
  if (!served) throw new Error(`${address}: no .${emission} emission`)
  const bytes = Buffer.from(await (await get(served.path)).arrayBuffer())
  if (hash('sha256', bytes) !== served.sha256) throw new Error(`${served.path}: sha256 mismatch`)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, bytes, { flag: 'wx' })
  const locked = { ...lock, [address]: { version: record.version, sha256: served.sha256 } }
  await writeFile('toopo.lock', `${JSON.stringify(locked, null, 2)}\n`)
  // From beside `folder`; `tsc` refuses a `.ts` specifier (TS5097), so `.ts` imports as `.js`.
  const from = posix.join(basename(folder), `${name}.${extension.replace('ts', 'js')}`)
  const exported = basename(name).replace(/-(.)/g, (_, letter: string) => letter.toUpperCase())
  // `.mjs` is a CommonJS project's `.js` emission, and a `.js` file there cannot `import`.
  const line =
    extension === 'mjs'
      ? `const { ${exported} } = require('./${from}')`
      : `import { ${exported} } from './${from}'`
  process.stdout.write(`${file}\n${line}\n`)
}
