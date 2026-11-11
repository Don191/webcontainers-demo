<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Job } from '~/types'

const props = defineProps<{
  jobs: Job[]
  loading?: boolean
}>()

const emit = defineEmits<{
  open: [job: Job]
}>()

const UBadge = resolveComponent('UBadge')
const UButton = resolveComponent('UButton')
const UProgress = resolveComponent('UProgress')

const { cancel, retry } = useJobs()

const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString() : '–'

const columns: TableColumn<Job>[] = [{
  accessorKey: 'id',
  header: '#',
  cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, `#${row.original.id}`)
}, {
  accessorKey: 'label',
  header: 'Job',
  cell: ({ row }) => h('div', { class: 'min-w-0' }, [
    h('p', { class: 'font-medium text-highlighted truncate' }, row.original.label),
    h('p', { class: 'text-xs text-muted truncate' }, row.original.error ?? row.original.lastLog ?? '')
  ])
}, {
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => h(UBadge, { variant: 'subtle', color: statusColor[row.original.status] }, () => statusLabel[row.original.status])
}, {
  accessorKey: 'progress',
  header: 'Progress',
  cell: ({ row }) => h('div', { class: 'flex items-center gap-2 w-36' }, [
    h(UProgress, { modelValue: row.original.progress, size: 'sm', color: statusColor[row.original.status] === 'neutral' ? 'neutral' : statusColor[row.original.status] }),
    h('span', { class: 'text-xs text-muted tabular-nums w-9 text-right' }, `${row.original.progress}%`)
  ])
}, {
  accessorKey: 'source',
  header: 'From',
  cell: ({ row }) => h('span', { class: 'text-muted' }, row.original.source)
}, {
  accessorKey: 'startedAt',
  header: 'Started',
  cell: ({ row }) => h('span', { class: 'text-muted tabular-nums' }, time(row.original.startedAt))
}, {
  id: 'actions',
  cell: ({ row }) => {
    const job = row.original
    const finished = ['completed', 'failed', 'cancelled'].includes(job.status)
    return h('div', { class: 'flex justify-end gap-1' }, [
      finished
        ? h(UButton, { 'icon': 'i-lucide-rotate-ccw', 'color': 'neutral', 'variant': 'ghost', 'size': 'sm', 'aria-label': `Retry #${job.id}`, 'onClick': (e: Event) => {
            e.stopPropagation()
            retry(job)
          } })
        : h(UButton, { 'icon': 'i-lucide-square', 'color': 'error', 'variant': 'ghost', 'size': 'sm', 'aria-label': `Cancel #${job.id}`, 'onClick': (e: Event) => {
            e.stopPropagation()
            cancel(job)
          } })
    ])
  }
}]
</script>

<template>
  <UTable
    :data="props.jobs"
    :columns="columns"
    :loading="loading"
    empty="No jobs yet. Start one above."
    class="shrink-0"
    :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer',
      th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default',
      separator: 'h-0'
    }"
    @select="(_e: Event, row: { original: Job }) => emit('open', row.original)"
  />
</template>
