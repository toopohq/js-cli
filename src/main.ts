#!/usr/bin/env node
import { add } from './add.ts'
import { init } from './init.ts'

const [command, ...args] = process.argv.slice(2)
const run = command === 'init' ? init : command === 'add' ? add : undefined

if (run) {
  await run(args).catch((error: Error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
} else {
  process.stderr.write('usage: toopo init [--ts | --js]\n       toopo add <domain>/<name>\n')
  process.exitCode = 1
}
