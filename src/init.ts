import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'

async function ask(detected: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  // question() never settles when stdin ends unanswered: the close event settles it instead.
  const closed = new Promise<undefined>((resolve) => rl.once('close', resolve))
  const answer = await Promise.race([rl.question(`Emission (ts/js) [${detected}]: `), closed])
  rl.close()
  if (answer === undefined) throw new Error('no answer: pass --ts or --js')
  return answer.trim() || detected
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
