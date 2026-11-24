<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    title,
    dot,
    aside,
    children,
  }: {
    title: string
    /** Tailwind bg class for the leading dot. */
    dot: string
    aside?: Snippet
    children: Snippet
  } = $props()
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-100-900/60 p-4 sm:p-5 space-y-4">
  <div class="flex items-center justify-between gap-2">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-surface-600-400 flex items-center gap-2">
      <span class="w-1.5 h-1.5 rounded-full {dot}"></span>
      {title}
    </h2>
    {@render aside?.()}
  </div>
  {@render children()}
</div>
