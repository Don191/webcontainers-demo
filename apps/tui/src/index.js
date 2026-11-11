#!/usr/bin/env node
import { render } from 'ink'
import { createElement } from 'react'
import { App } from './app.js'

const workerUrl = process.env.WORKER_URL || undefined
const dashboardUrl = process.env.DASHBOARD_URL || undefined

const app = render(createElement(App, { workerUrl, dashboardUrl }), { exitOnCtrlC: true })
await app.waitUntilExit()
