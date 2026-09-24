import { execFile } from 'node:child_process'
import { hash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { ServedRecord } from '@toopo/spec/record'
import { expect, onTestFinished, test } from 'vitest'

type Files = Record<string, string>

const ts = 'export function truncate(text: string): string {}\n'
const js = 'export function truncate(text) {}\n'
const t = 'js/string/truncate'
const record: ServedRecord = {
  address: t,
  version: '1.0.0',
  summary: 'Shortens a string to at most a given length.',
  emissions: {
    ts: { path: `${t}.ts`, sha256: hash('sha256', ts) },
    js: { path: `${t}.js`, sha256: hash('sha256', js) },
  },
  dependencies: [],
}

function registry(served: object = record, at = `/${t}.json`): Files {
  return { [at]: JSON.stringify(served), [`/${t}.ts`]: ts, [`/${t}.js`]: js }
}

const config = (emission: string, folder = 'toopo', extension = emission) =>
  JSON.stringify({ emission, extension, folder })
const lock = (entries: object) => `${JSON.stringify(entries, null, 2)}\n`
const ours = { 'toopo.json': config('ts') }

// Runs `toopo add` in a fresh project holding `files`, against a local registry serving `served`.
async function add(args: string[], served = registry(), files: Files = ours) {
  const server = createServer((request, response) => {
    const body = served[request.url ?? '']
    response.writeHead(body === undefined ? 404 : 200).end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  onTestFinished(() => void server.close())
  const cwd = mkdtempSync(join(tmpdir(), 'toopo-'))
  onTestFinished(() => rmSync(cwd, { recursive: true }))
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true })
    writeFileSync(join(cwd, file), text)
  }
  const tree = () => readdirSync(cwd, { recursive: true }).sort()
  const before = tree()
  const { port } = server.address() as AddressInfo
  const env = { ...process.env, TOOPO_REGISTRY: `http://127.0.0.1:${port}` }
  const main = join(import.meta.dirname, 'main.ts')
  const run = await promisify(execFile)(process.execPath, [main, 'add', ...args], {
    cwd,
    env,
  }).then(
    ({ stdout }) => ({ status: 0, stdout, stderr: '' }),
    (error) => ({ status: error.code, stdout: error.stdout, stderr: error.stderr }),
  )
  const read = (file: string) =>
    existsSync(join(cwd, file)) ? readFileSync(join(cwd, file), 'utf8') : undefined
  return { ...run, read, before, after: tree() }
}

const printed = (file: string, line: string) => `${join(file)}\n${line}\n`

test.each([
  ['ts', 'ts', 'src/toopo', "import { truncate } from './toopo/string/truncate.js'", ts],
  ['ts', 'mts', 'lib/fns', "import { truncate } from './fns/string/truncate.mjs'", ts],
  ['js', 'js', 'toopo', "import { truncate } from './toopo/string/truncate.js'", js],
  ['js', 'mjs', 'toopo', "const { truncate } = require('./toopo/string/truncate.mjs')", js],
])(
  'the %s emission lands as .%s in %s, is locked, and prints %s',
  async (emission, extension, folder, line, text) => {
    const files = { 'toopo.json': config(emission, folder, extension) }
    const run = await add(['string/truncate'], registry(), files)
    expect(run.stderr).toBe('')
    expect(run.status).toBe(0)
    const file = `${folder}/string/truncate.${extension}`
    expect(run.read(file)).toBe(text)
    expect(run.read('toopo.lock')).toBe(
      lock({ [t]: { version: '1.0.0', sha256: hash('sha256', text) } }),
    )
    expect(run.stdout).toBe(printed(file, line))
  },
)

test('a kebab-case name imports in camelCase', async () => {
  const address = 'js/string/snake-case'
  const run = await add(['string/snake-case'], registry({ ...record, address }, `/${address}.json`))
  expect(run.status).toBe(0)
  const file = 'toopo/string/snake-case.ts'
  expect(run.stdout).toBe(printed(file, "import { snakeCase } from './toopo/string/snake-case.js'"))
})

test('an existing lock keeps its entries', async () => {
  const pad = { 'js/string/pad': { version: '2.0.0', sha256: '0' } }
  const run = await add(['string/truncate'], registry(), { ...ours, 'toopo.lock': lock(pad) })
  expect(run.status).toBe(0)
  const truncate = { version: '1.0.0', sha256: record.emissions.ts.sha256 }
  expect(run.read('toopo.lock')).toBe(lock({ ...pad, [t]: truncate }))
})

const usage = 'usage: toopo add <domain>/<name>'
const truncate = ['string/truncate']
const target = join('toopo', 'string', 'truncate.ts')
const variant = (change: object) => registry({ ...record, ...change })
const pad = variant({ address: 'js/string/pad' })
const dependent = variant({ dependencies: ['js/string/pad'] })
const tsOnly = variant({ emissions: { ts: record.emissions.ts } })
const tampered = variant({ emissions: { ts: { ...record.emissions.ts, sha256: '0' } } })
// Fetch resolves `js/../y.json` to `/y.json`, where this registry serves another record.
const escaped = registry(record, '/y.json')
const mine = { ...ours, [target]: 'mine\n' }
const broken = { ...ours, 'toopo.lock': '{\n' }

test.each<[string, string[], Files, string, Files?]>([
  ['no address', [], registry(), usage],
  ['two addresses', [...truncate, 'string/pad'], registry(), usage],
  ['no toopo.json', truncate, registry(), 'no toopo.json: run toopo init', {}],
  ['an unknown address', ['string/nope'], registry(), 'js/string/nope.json: 404 Not Found'],
  ['a .. segment', ['../y'], escaped, `js/../y: the registry served ${t}`],
  ['another address served', truncate, pad, `${t}: the registry served js/string/pad`],
  ['a dependency', truncate, dependent, `${t}: dependencies are not supported yet`],
  ['no such emission', truncate, tsOnly, `${t}: no .js emission`, { 'toopo.json': config('js') }],
  ['a digest that differs', truncate, tampered, `${t}.ts: sha256 mismatch`],
  ['an existing file', truncate, registry(), `${target} already exists, and it is yours`, mine],
  ['a toopo.lock not JSON', truncate, registry(), 'toopo.lock is not valid JSON', broken],
])('%s fails and writes nothing', async (_, args, served, stderr, files = ours) => {
  const run = await add(args, served, files)
  expect(run.stderr).toBe(`${stderr}\n`)
  expect(run.stdout).toBe('')
  expect(run.status).toBe(1)
  expect(run.after).toEqual(run.before)
  expect(run.read(target)).toBe(files[target])
  expect(run.read('toopo.lock')).toBe(files['toopo.lock'])
})
