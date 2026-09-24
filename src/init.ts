import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

async function ask(detected: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  rl.setPrompt(`Emission (ts/js) [${detected}]: `)
  rl.prompt()
  // Not question(): it drops a last line with no newline, and never settles when stdin ends.
  const line = await rl[Symbol.asyncIterator]().next()
  rl.close()
  if (line.done) throw new Error('no answer: pass --ts or --js')
  return line.value.trim() || detected
}

export async function init(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { ts: { type: 'boolean' }, js: { type: 'boolean' } },
  })
  if (values.ts && values.js) throw new Error('--ts and --js exclude each other')
  if (existsSync('toopo.json')) throw new Error('toopo.json already exists')
  const detected = existsSync('tsconfig.json') ? 'ts' : 'js'
  const emission = values.ts ? 'ts' : values.js ? 'js' : await ask(detected)
  if (emission !== 'ts' && emission !== 'js') throw new Error(`expected ts or js, got ${emission}`)
  await writeFile('toopo.json', `${JSON.stringify({ emission }, null, 2)}\n`, { flag: 'wx' })
}
