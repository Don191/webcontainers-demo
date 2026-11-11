# WebContainers demo

A small monorepo that runs inside a [WebContainer](https://webcontainers.io), as well as on your own machine. It's pulled and run by the WebContainers experiment on [donovanhumphries.com](https://donovanhumphries.com/experiments/webcontainers).

There are three apps and one shared package:

| Path | What it is |
| --- | --- |
| `apps/dashboard` | A Nuxt UI dashboard for starting fake jobs and watching them run. Cut down from [nuxt-ui-templates/dashboard](https://github.com/nuxt-ui-templates/dashboard). |
| `apps/worker` | Runs the fake jobs in an in-memory queue and serves them over a small HTTP API on port 4100. No dependencies. |
| `apps/tui` | A terminal UI with no dependencies. Starts, stops and restarts the worker and dashboard, shows their logs and the queue, and lists jobs you can start, cancel and retry. |
| `packages/jobs` | Job types and a client for the worker's API, shared by the dashboard and the TUI. |

The jobs aren't real. Each one steps through a few stages over a few seconds and sometimes fails, so there's something to retry.

## Run it

You need [Volta](https://volta.sh), which picks up the Node and Yarn versions pinned in `package.json`.

```sh
yarn install
yarn start   # the TUI, which starts the worker (:4100) and the dashboard (:3000)
```

The TUI starts both services when it opens and stops them when you quit. `yarn start --no-start` opens it without starting anything. If a service is already running (say from `yarn dev` in another terminal), the TUI shows it as running and leaves it alone.

Keys: `w` and `d` start or stop the worker and dashboard, `W` and `D` restart them, `l` switches the right-hand panel between the job log and each service's log. For jobs: `↑` `↓` select, `n` start one, `c` cancel, `r` retry, `p` pause or resume the queue, `+` `-` change how many run at once, `f` filter, `x` clear finished jobs. `?` lists them all, `q` quits.

Without the TUI:

```sh
yarn dev         # worker and dashboard through Nx
yarn dev:plain   # the same two, without Nx
```

## Tooling

- **Yarn 4**, with the release checked in at `.yarn/releases` and `yarnPath` pointing at it. Anything that can run Node can run `node .yarn/releases/yarn-4.18.1.cjs`, including a WebContainer with no Volta or Corepack.
- **Nx** runs the `dev`, `build` and `test` targets across the workspaces. Targets come from each app's `package.json` scripts. The daemon and the Nx terminal UI are turned off in `nx.json`.
- **Volta** pins Node and Yarn for local work. A WebContainer brings its own Node and ignores this.

## Running in a WebContainer

The [WebContainers experiment](https://donovanhumphries.com/experiments/webcontainers) downloads this repo, runs `node .yarn/releases/yarn-4.18.1.cjs install`, then `node apps/tui/src/index.js`. What makes that work:

- `nodeLinker: node-modules`, not Plug'n'Play.
- `enableScripts: false`: dependency install scripts mostly build native binaries.
- A WebContainer can't load native binaries, so `resolutions` swaps the three build tools that have no automatic fallback for their WebAssembly builds: `rollup` → `@rollup/wasm-node`, `esbuild` → `esbuild-wasm`, `lightningcss` → `lightningcss-wasm`. They're drop-in, a little slower, and used everywhere so the lockfile stays the same.
- `supportedArchitectures` adds `wasm32`, so packages that do fall back on their own (Tailwind's Oxide) get their WebAssembly build installed, and `@rolldown/binding-wasm32-wasi` is installed so Rolldown doesn't have to download it.
- The TUI starts services with `node` directly, not `yarn run`: Yarn 4 installs fine in a WebContainer, but running package scripts through it hangs there.
- The TUI draws with plain ANSI codes. Ink was tried first, but its WebAssembly layout engine never finishes loading in a WebContainer.
- The dashboard runs with `--no-fork`, so stopping it from the TUI stops the server.
- Nuxt devtools and web fonts are off, and icons come from `@iconify-json/lucide`, so nothing needs a CDN.

**Nx doesn't run in a WebContainer yet.** Nx falls back to a WebAssembly build when it can't load its native binary, but in Nx 22 to 24 that build doesn't match its JavaScript glue (every export is undefined), and in Nx 21 it hangs while loading. So inside the WebContainer the TUI does Nx's job, and Nx stays for local work.

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
