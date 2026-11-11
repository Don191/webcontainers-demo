/**
 * The fake jobs the worker knows how to run. Each one walks through its steps,
 * taking roughly `seconds` in total, and fails now and then so there's
 * something to retry.
 *
 * @typedef {'queued' | 'running' | 'completed' | 'failed' | 'cancelled'} JobStatus
 *
 * @typedef {object} JobType
 * @property {string} id
 * @property {string} label
 * @property {string} icon Lucide icon name, used by the dashboard
 * @property {number} seconds Rough run time
 * @property {number} failRate Chance (0 to 1) that a run fails
 * @property {string[]} steps What the job logs as it goes
 *
 * @typedef {object} JobLog
 * @property {string} at ISO time
 * @property {'info' | 'warn' | 'error'} level
 * @property {string} message
 *
 * @typedef {object} Job
 * @property {number} id
 * @property {string} type
 * @property {string} label
 * @property {JobStatus} status
 * @property {number} progress 0 to 100
 * @property {number} step Steps finished so far
 * @property {number} steps
 * @property {number} attempts
 * @property {string} source Who started it: dashboard, tui, api or seed
 * @property {string} createdAt
 * @property {string | null} startedAt
 * @property {string | null} finishedAt
 * @property {string | null} error
 * @property {JobLog[]} logs
 */

/** @type {JobType[]} */
export const jobTypes = [
  {
    id: 'send-emails',
    label: 'Send welcome emails',
    icon: 'i-lucide-mail',
    seconds: 6,
    failRate: 0.1,
    steps: ['Loading new sign-ups', 'Rendering templates', 'Sending batch 1', 'Sending batch 2', 'Sending batch 3', 'Recording deliveries']
  },
  {
    id: 'resize-images',
    label: 'Resize product images',
    icon: 'i-lucide-image',
    seconds: 9,
    failRate: 0.05,
    steps: ['Listing uploads', 'Resizing to 1600px', 'Resizing to 800px', 'Resizing to 400px', 'Writing WebP copies', 'Updating the catalogue']
  },
  {
    id: 'generate-report',
    label: 'Generate monthly report',
    icon: 'i-lucide-file-chart-column',
    seconds: 12,
    failRate: 0.15,
    steps: ['Querying orders', 'Totalling revenue', 'Building charts', 'Rendering PDF', 'Uploading report']
  },
  {
    id: 'sync-inventory',
    label: 'Sync inventory',
    icon: 'i-lucide-package',
    seconds: 7,
    failRate: 0.1,
    steps: ['Fetching supplier feed', 'Matching SKUs', 'Updating stock levels', 'Flagging low stock']
  },
  {
    id: 'backup-database',
    label: 'Back up database',
    icon: 'i-lucide-database-backup',
    seconds: 15,
    failRate: 0.05,
    steps: ['Taking a snapshot', 'Compressing', 'Encrypting', 'Uploading to storage', 'Verifying checksum', 'Pruning old backups']
  }
]

/** @type {JobStatus[]} */
export const jobStatuses = ['queued', 'running', 'completed', 'failed', 'cancelled']

/** Statuses a job can't leave without a retry. */
export const finishedStatuses = ['completed', 'failed', 'cancelled']

/** @param {string} id */
export function getJobType(id) {
  return jobTypes.find(t => t.id === id)
}

/** @param {JobStatus} status */
export function isFinished(status) {
  return finishedStatuses.includes(status)
}

export const WORKER_PORT = 4100
export const DASHBOARD_PORT = 3000
