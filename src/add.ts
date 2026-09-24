import { hash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import type { ServedRecord } from '@toopo/spec/record'

const registry = process.env.TOOPO_REGISTRY ?? 'https://toopo.dev'

async function get(path: string): Promise<Response> {
  const response = await fetch(`${registry}/${path}`)
  if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`)
  return response
}

function read(file: string) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

export async function add(args: string[]): Promise<void> {
  const { positionals } = parseArgs({ args, allowPositionals: true })
  const [name] = positionals
  if (name === undefined || positionals.length > 1)
    throw new Error('usage: toopo add <domain>/<name>')
  if (!existsSync('toopo.json')) throw new Error('no toopo.json: run toopo init')
  const { emission, folder }: { emission: 'ts' | 'js'; folder: string } = read('toopo.json')
  const file = join(folder, `${name}.${emission}`)
  if (existsSync(file)) throw new Error(`${file} already exists, and it is yours`)
  const address = `js/${name}`
  const record: ServedRecord = await (await get(`${address}.json`)).json()
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
  const lock = existsSync('toopo.lock') ? read('toopo.lock') : {}
  lock[address] = { version: record.version, sha256: served.sha256 }
  await writeFile('toopo.lock', `${JSON.stringify(lock, null, 2)}\n`)
}
