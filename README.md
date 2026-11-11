# WebContainers demo

A small monorepo that runs inside a [WebContainer](https://webcontainers.io), as well as on your own machine. It's pulled and run by the WebContainers experiment on [donovanhumphries.com](https://donovanhumphries.com/experiments/webcontainers).

There are three apps and one shared package:

| Path | What it is |
| --- | --- |
| `apps/dashboard` | A Nuxt UI dashboard for starting fake jobs and watching them run. Cut down from [nuxt-ui-templates/dashboard](https://github.com/nuxt-ui-templates/dashboard). |
| `apps/worker` | Runs the fake jobs in an in-memory queue and serves them over a small HTTP API on port 4100. No dependencies. |
| `apps/tui` | A terminal UI built with [Ink](https://github.com/vadimdemedes/ink). Shows whether each part is up, and lists jobs you can start, cancel and retry. |
| `packages/jobs` | Job types and a client for the worker's API, shared by the dashboard and the TUI. |

The jobs aren't real. Each one steps through a few stages over a few seconds and sometimes fails, so there's something to retry.

## Run it

You need [Volta](https://volta.sh), which picks up the Node and Yarn versions pinned in `package.json`.

```sh
yarn install
yarn dev     # worker on :4100 and dashboard on :3000, through Nx
yarn tui     # in a second terminal
```

`yarn dev:plain` starts the same two apps without Nx.

In the TUI: `↑` `↓` select a job, `n` start one, `c` cancel, `r` retry, `p` pause or resume the queue, `+` `-` change how many run at once, `f` filter, `x` clear finished jobs, `q` quit.

## Tooling

- **Yarn 4**, with the release checked in at `.yarn/releases` and `yarnPath` pointing at it. Anything that can run Node can run `node .yarn/releases/yarn-4.18.1.cjs`, including a WebContainer with no Volta or Corepack.
- **Nx** runs the `dev`, `build` and `test` targets across the workspaces. Targets come from each app's `package.json` scripts. The daemon and the Nx terminal UI are turned off in `nx.json`, since neither works in a WebContainer.
- **Volta** pins Node and Yarn for local work. A WebContainer brings its own Node and ignores this.

### What makes it WebContainer friendly

- `nodeLinker: node-modules`, not Plug'n'Play.
- `enableScripts: false`: dependency install scripts mostly build native binaries, which a WebContainer can't run.
- `supportedArchitectures` adds `wasm32`, so packages with a WebAssembly build (Tailwind's Oxide, for one) install it alongside the native one and fall back to it.
- The dashboard turns off Nuxt devtools and web fonts, and serves icons from `@iconify-json/lucide`, so it doesn't need any CDN.
- The worker and TUI are plain JavaScript modules. Nothing needs compiling before it runs.

## Worker API

| Method | Path | |
| --- | --- | --- |
| GET | `/health` | Uptime, queue state and job counts |
| GET | `/job-types` | What can be started |
| GET | `/jobs` | Every job, newest first |
| GET | `/jobs/:id` | One job with its log |
| POST | `/jobs` | `{ type, source?, count? }`. `type` can be `random` |
| POST | `/jobs/:id/cancel` | |
| POST | `/jobs/:id/retry` | |
| DELETE | `/jobs?finished=1` | Clear completed, failed and cancelled jobs |
| POST | `/queue` | `{ paused?, concurrency? }` |
| GET | `/events` | Server-sent events, one per change |

The dashboard reaches it through its own `/api/worker/*` route, so the browser only talks to one origin.
