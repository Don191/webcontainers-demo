// Forwards /api/worker/* to the jobs worker, so the browser only ever talks
// to the dashboard's own origin (which matters inside a WebContainer preview).
export default defineEventHandler(async (event) => {
  const { workerUrl } = useRuntimeConfig(event)
  const path = getRouterParam(event, 'path') ?? ''
  const { search } = getRequestURL(event)
  try {
    return await proxyRequest(event, `${workerUrl}/${path}${search}`)
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'The worker isn\'t running. Start it with yarn dev.' })
  }
})
