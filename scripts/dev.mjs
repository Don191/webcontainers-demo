// Starts the worker and the dashboard side by side without Nx, with each
// line prefixed by the app it came from. `yarn dev` does the same through
// Nx; this is the fallback for places where Nx can't run.
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The checked-in Yarn release, run with this same Node. (npm_execpath can be
// a shell shim, which a WebContainer can't always run.)
const releases = fileURLToPath(new URL('../.yarn/releases/', import.meta.url))
const yarn = releases + readdirSync(releases).find(f => f.endsWith('.cjs'))
const apps = [
  { name: 'worker', workspace: '@demo/worker', colour: 36 },
  { name: 'dashboard', workspace: '@demo/dashboard', colour: 35 }
]

const children = apps.map(({ name, workspace, colour }) => {
  const child = spawn(process.execPath, [yarn, 'workspace', workspace, 'dev'], {
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const prefix = `\x1b[${colour}m${name.padEnd(9)}\x1b[0m│ `
  let partial = ''
  const onData = (chunk) => {
    const lines = (partial + chunk).split('\n')
    partial = lines.pop()
    for (const line of lines) process.stdout.write(`${prefix}${line}\n`)
  }
  child.stdout.setEncoding('utf8').on('data', onData)
  child.stderr.setEncoding('utf8').on('data', onData)
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`)
    shutdown(code ?? 1)
  })
  return child
})

function shutdown(code = 0) {
  for (const child of children) child.kill()
  process.exit(code)
}
process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
