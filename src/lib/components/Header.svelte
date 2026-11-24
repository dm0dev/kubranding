<script lang="ts">
  import { Box, Copy, Download, RotateCcw } from '@lucide/svelte'
  import { AppBar } from '@skeletonlabs/skeleton-svelte'
  import { studio } from '../state/studio.svelte.ts'
</script>

<AppBar
  class="border-b border-surface-200-800 bg-surface-100-900/90 backdrop-blur-md sticky top-0 z-30 p-0"
>
  <AppBar.Toolbar class="max-w-7xl mx-auto w-full px-4 sm:px-6 h-14 grid-cols-[1fr_auto]">
    <AppBar.Lead class="flex items-center gap-3">
      <div
        class="w-8 h-8 rounded-base bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shadow-inner shrink-0"
      >
        <Box class="w-4 h-4 text-primary-400" />
      </div>
      <div>
        <h1 class="text-sm font-semibold tracking-tight text-surface-950-50">
          KuBranding
        </h1>
        <p class="text-xs text-surface-600-400 hidden sm:block">Client-side PNG compositor &amp; Base64 encoder</p>
      </div>
    </AppBar.Lead>

    <AppBar.Trail class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => studio.reset()}
        class="btn btn-sm preset-outlined-surface-200-800 hover:preset-tonal"
        title="Reset settings to default"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span class="hidden sm:inline">Reset</span>
      </button>

      <button
        type="button"
        onclick={() => studio.copyBase64()}
        class="btn btn-sm preset-tonal"
      >
        <Copy class="w-3.5 h-3.5" />
        <span>Copy Base64</span>
      </button>

      <button
        type="button"
        onclick={() => studio.downloadPng()}
        class="btn btn-sm preset-filled-primary-500"
      >
        <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
        <span>Download PNG</span>
      </button>
    </AppBar.Trail>
  </AppBar.Toolbar>
</AppBar>
