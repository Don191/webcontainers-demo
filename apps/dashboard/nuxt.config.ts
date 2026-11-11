// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/ui'],

  // Devtools and web fonts are left out so it starts faster in a WebContainer
  // and doesn't need to reach any font or icon CDN.
  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],

  ui: {
    fonts: false
  },

  icon: {
    // Icons come from @iconify-json/lucide in node_modules, not the Iconify API.
    serverBundle: 'local'
  },

  runtimeConfig: {
    // Where the jobs worker listens. Override with NUXT_WORKER_URL.
    workerUrl: 'http://localhost:4100'
  },

  telemetry: false,

  compatibilityDate: '2026-06-30'
})
