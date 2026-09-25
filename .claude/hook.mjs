// Before a write, refuse what this repository forbids. After it, format and lint what it touched.
// With --all, refuse the same over every file git lists: `pnpm check` runs it, since a shell
// bypasses the hook.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, isAbsolute, join, relative, sep } from 'node:path'

const allowed = new Set([
  '.claude',
  '.github',
  'src',
  '.gitattributes',
  '.gitignore',
  'biome.json',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'DECISIONS.md',
  'LICENSE',
  'package.json',
  'pnpm-lock.yaml',
  'README.md',
  'tsconfig.build.json',
  'tsconfig.json',
])

const runtime = ['dependencies', 'optionalDependencies', 'peerDependencies']

function stop(reason) {
  process.stderr.write(`${reason}\n`)
  process.exit(2)
}

function refuse(path, text) {
  const top = path.split('/')[0]
  if (!allowed.has(top)) stop(`${top} is not on the root allowlist in .claude/hook.mjs`)
  if (basename(path) === 'CLAUDE.md' && text().trimEnd().split('\n').length > 150) {
    stop(`${path} is over 150 lines`)
  }
  if (path === 'package.json') {
    const manifest = JSON.parse(text())
    const field = runtime.find((name) => name in manifest)
    if (field) stop(`The client has no runtime dependencies: package.json takes no ${field} field`)
  }
}

if (process.argv[2] === '--all') {
  const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard']
  const listed = execFileSync('git', args, { encoding: 'utf8', maxBuffer: Infinity })
  for (const path of listed.split('\0').filter(existsSync)) {
    refuse(path, () => readFileSync(path, 'utf8'))
  }
  process.exit(0)
}

const root = process.env.CLAUDE_PROJECT_DIR
const { hook_event_name: event, tool_input: input } = JSON.parse(readFileSync(0, 'utf8'))
const path = relative(root, input.file_path)

function after({ content, old_string: old, new_string: next, replace_all: all }) {
  if (content !== undefined) return content
  const text = readFileSync(input.file_path, 'utf8')
  return all ? text.replaceAll(old, () => next) : text.replace(old, () => next)
}

if (isAbsolute(path) || path.startsWith(`..${sep}`)) process.exit(0)

if (event === 'PreToolUse') {
  refuse(path.replaceAll(sep, '/'), () => after(input))
} else {
  const biome = join(root, 'node_modules/@biomejs/biome/bin/biome')
  if (!existsSync(biome)) process.exit(0)
  const flags = [
    '--write',
    '--error-on-warnings',
    '--colors=off',
    '--no-errors-on-unmatched',
    '--files-ignore-unknown=true',
  ]
  const run = spawnSync(process.execPath, [biome, 'check', ...flags, path], {
    cwd: root,
    encoding: 'utf8',
  })
  if (run.status !== 0) stop(run.stdout + run.stderr)
}
