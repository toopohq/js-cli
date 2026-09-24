import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { expect, test } from 'vitest'

test.each([
  ['no command', []],
  ['an unknown command', ['nope']],
])('%s prints the usage and fails', (_, args) => {
  const run = spawnSync(process.execPath, [join(import.meta.dirname, 'main.ts'), ...args], {
    encoding: 'utf8',
  })
  expect(run.stderr).toBe('usage: toopo init [--ts | --js]\n')
  expect(run.status).toBe(1)
})
