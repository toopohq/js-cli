#!/usr/bin/env node
import { init } from './init.ts'

const [command, ...args] = process.argv.slice(2)

if (command === 'init') {
  await init(args).catch((error: Error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
} else {
  process.stderr.write('usage: toopo init [--ts | --js]\n')
  process.exitCode = 1
}
