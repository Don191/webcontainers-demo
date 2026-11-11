<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const { health, workerError, start, jobTypes } = useJobs()

const links = [{
  label: 'Overview',
  icon: 'i-lucide-layout-dashboard',
  to: '/',
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Jobs',
  icon: 'i-lucide-list-checks',
  to: '/jobs',
  onSelect: () => {
    open.value = false
  }
}] satisfies NavigationMenuItem[]

const groups = computed(() => [{
  id: 'links',
  label: 'Go to',
  items: links
}, {
  id: 'start',
  label: 'Start a job',
  items: jobTypes.map(type => ({
    id: type.id,
    label: type.label,
    icon: type.icon,
    onSelect: () => start(type.id)
  }))
}])

const router = useRouter()
defineShortcuts({
  'g-o': () => router.push('/'),
  'g-j': () => router.push('/jobs')
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <div class="flex items-center gap-2 px-1">
          <UIcon name="i-lucide-cpu" class="size-5 shrink-0 text-primary" />
          <span v-if="!collapsed" class="truncate font-semibold text-highlighted">Jobs dashboard</span>
        </div>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <div class="flex w-full items-center gap-2">
          <UTooltip :text="health ? 'Worker is running' : workerError || 'Checking the worker'">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="health ? (health.paused ? 'bg-warning' : 'bg-success') : 'bg-error'"
            />
          </UTooltip>
          <span v-if="!collapsed" class="flex-1 truncate text-xs text-muted">
            {{ health ? (health.paused ? 'Queue paused' : `Worker up · ${health.concurrency} at a time`) : 'Worker not answering' }}
          </span>
          <UColorModeButton v-if="!collapsed" size="sm" />
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
