import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'

// A file is a name, written `{}`, or a name and its text; a name ending in `/` is a folder.
type File = string | [string, string]

function init(files: File[], args: string[], input: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'toopo-'))
  onTestFinished(() => rmSync(cwd, { recursive: true }))
  for (const entry of files) {
    const [file, text = '{}\n'] = typeof entry === 'string' ? [entry] : entry
    if (file.endsWith('/')) mkdirSync(join(cwd, file))
    else writeFileSync(join(cwd, file), text)
  }
  const main = join(import.meta.dirname, 'main.ts')
  const run = spawnSync(process.execPath, [main, 'init', ...args], { cwd, input, encoding: 'utf8' })
  const config = join(cwd, 'toopo.json')
  return { ...run, config: existsSync(config) ? readFileSync(config, 'utf8') : undefined }
}

const esm: File = ['package.json', '{ "type": "module" }\n']
const cjs: File = ['package.json', '{ "type": "commonjs" }\n']
const bom: File = ['package.json', '\uFEFF{ "type": "module" }\n']

test.each<[string, File[], string[], string, string, string, string]>([
  ['a tsconfig.json, the detection accepted', ['tsconfig.json'], [], '\n', 'ts', 'ts', 'toopo'],
  ['no tsconfig.json, the detection accepted', [], [], '\n', 'js', 'mjs', 'toopo'],
  ['an answer against the detection', ['tsconfig.json'], [], 'js\n', 'js', 'mjs', 'toopo'],
  ['an answer without a newline', [], [], 'ts', 'ts', 'ts', 'toopo'],
  ['--ts, unasked', [], ['--ts'], '', 'ts', 'ts', 'toopo'],
  ['--js, unasked', ['tsconfig.json'], ['--js'], '', 'js', 'mjs', 'toopo'],
  ['a src/ folder', ['tsconfig.json', 'src/'], ['--ts'], '', 'ts', 'ts', 'src/toopo'],
  ['a src file, not a folder', ['src'], ['--ts'], '', 'ts', 'ts', 'toopo'],
  ['a package.json with no type', ['package.json'], ['--js'], '', 'js', 'mjs', 'toopo'],
  ['a package.json of type module', [esm], ['--js'], '', 'js', 'js', 'toopo'],
  ['a package.json of type commonjs', [cjs], ['--js'], '', 'js', 'mjs', 'toopo'],
  ['a package.json behind a BOM', [bom], ['--js'], '', 'js', 'js', 'toopo'],
])('%s writes toopo.json', (_, files, args, input, emission, extension, folder) => {
  const run = init(files, args, input)
  expect(run.status).toBe(0)
  expect(run.config).toBe(
    `{\n  "emission": "${emission}",\n  "extension": "${extension}",\n  "folder": "${folder}"\n}\n`,
  )
})

const prompt = 'Emission (ts/js) [js]: '
const broken: File = ['package.json', '{\n']

test.each<[string, File[], string[], string, string]>([
  ['--ts with --js', [], ['--ts', '--js'], '', '--ts and --js exclude each other\n'],
  ['an answer neither ts nor js', [], [], 'py\n', `${prompt}expected ts or js, got py\n`],
  ['stdin closed unanswered', [], [], '', `${prompt}no answer: pass --ts or --js\n`],
  ['an existing toopo.json, before asking', ['toopo.json'], [], '', 'toopo.json already exists\n'],
  ['a package.json not JSON, before asking', [broken], [], '', 'package.json is not valid JSON\n'],
])('%s fails and writes nothing', (_, files, args, input, stderr) => {
  const run = init(files, args, input)
  expect(run.stderr).toBe(stderr)
  expect(run.status).toBe(1)
  expect(run.config).toBe(files.includes('toopo.json') ? '{}\n' : undefined)
})
