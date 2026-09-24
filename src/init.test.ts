import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'

function init(files: string[], args: string[], input: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'toopo-'))
  onTestFinished(() => rmSync(cwd, { recursive: true }))
  for (const file of files) writeFileSync(join(cwd, file), '{}\n')
  const main = join(import.meta.dirname, 'main.ts')
  const run = spawnSync(process.execPath, [main, 'init', ...args], { cwd, input, encoding: 'utf8' })
  const config = join(cwd, 'toopo.json')
  return { ...run, config: existsSync(config) ? readFileSync(config, 'utf8') : undefined }
}

test.each([
  ['a tsconfig.json, the detection accepted', ['tsconfig.json'], [], '\n', 'ts'],
  ['no tsconfig.json, the detection accepted', [], [], '\n', 'js'],
  ['an answer against the detection', ['tsconfig.json'], [], 'js\n', 'js'],
  ['--ts, unasked', [], ['--ts'], '', 'ts'],
  ['--js, unasked', ['tsconfig.json'], ['--js'], '', 'js'],
])('%s writes the emission', (_, files, args, input, emission) => {
  const run = init(files, args, input)
  expect(run.status).toBe(0)
  expect(run.config).toBe(`{\n  "emission": "${emission}"\n}\n`)
})

test.each<[string, string[], string[], string, string]>([
  ['--ts with --js', [], ['--ts', '--js'], '', '--ts and --js exclude each other\n'],
  ['an answer neither ts nor js', [], [], 'py\n', 'expected ts or js, got py\n'],
  ['stdin closed unanswered', [], [], '', 'no answer: pass --ts or --js\n'],
  ['an existing toopo.json, before asking', ['toopo.json'], [], '', 'toopo.json already exists\n'],
])('%s fails and writes nothing', (_, files, args, input, message) => {
  const run = init(files, args, input)
  expect(run.stderr.endsWith(message)).toBe(true)
  expect(run.status).toBe(1)
  expect(run.config).toBe(files.includes('toopo.json') ? '{}\n' : undefined)
})
