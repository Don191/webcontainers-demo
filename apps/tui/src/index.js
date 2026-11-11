#!/usr/bin/env node
import { App } from './app.js'
import { ServiceManager } from './services.js'

// Usage: node apps/tui/src/index.js [--no-start]
// By default the TUI starts the worker and the dashboard, unless something is
// already serving their ports, and stops what it started when you quit.
const autostart = !process.argv.includes('--no-start') && process.env.TUI_AUTOSTART !== '0'
const manager = new ServiceManager()
const app = new App({
  manager,
  workerUrl: process.env.WORKER_URL || undefined,
  dashboardUrl: process.env.DASHBOARD_URL || undefined
})

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.quit())
process.on('exit', () => manager.stopAll())

if (autostart) manager.startAll()
await app.start()
process.exit(0)
