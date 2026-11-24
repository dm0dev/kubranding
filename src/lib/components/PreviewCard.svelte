<script lang="ts">
  import { ScanLine } from '@lucide/svelte'
  import { SegmentedControl } from '@skeletonlabs/skeleton-svelte'
  import { ensureFontLoaded } from '../../browser/fonts.ts'
  import { drawGuides, renderLogo } from '../../core/index.ts'
  import { studio, type StageBackground } from '../state/studio.svelte.ts'

  let logoCanvas: HTMLCanvasElement
  let guideCanvas: HTMLCanvasElement
  let variantCanvas: HTMLCanvasElement | undefined

  function renderVariantDataUrl(
    icon: Parameters<typeof renderLogo>[1],
    config: Parameters<typeof renderLogo>[2],
    textColor: string,
    fallbackDataUrl: string,
  ): string {
    if (textColor === config.textColor) return fallbackDataUrl
    variantCanvas ??= document.createElement('canvas')
    renderLogo(variantCanvas, icon, { ...config, textColor })
    return variantCanvas.toDataURL('image/png')
  }

  const backgrounds: { id: StageBackground; label: string; stage: string }[] = [
    { id: 'checker', label: 'Transparent', stage: 'bg-checkerboard' },
    { id: 'dark', label: 'Dark #151515', stage: 'bg-[#151515]' },
    { id: 'light', label: 'Light #FFF', stage: 'bg-white' },
  ]
  const stageClass = $derived(backgrounds.find((b) => b.id === studio.stageBackground)?.stage)

  // Re-render whenever the config, icon, or themed text colours change. Fonts are
  // awaited first so glyph metrics are exact; `token` drops superseded renders.
  let renderToken = 0
  $effect(() => {
    const config = $state.snapshot(studio.config)
    const icon = studio.icon?.asset ?? null
    const lightTextColor = studio.lightTextColor
    const darkTextColor = studio.darkTextColor
    const token = ++renderToken

    void ensureFontLoaded(config).then(() => {
      if (token !== renderToken) return
      try {
        const layout = renderLogo(logoCanvas, icon, config)
        const mainDataUrl = logoCanvas.toDataURL('image/png')
        studio.setRenderResult(layout, mainDataUrl)
        studio.setThemedRenderResults(
          renderVariantDataUrl(icon, config, lightTextColor, mainDataUrl),
          renderVariantDataUrl(icon, config, darkTextColor, mainDataUrl),
        )
      } catch (error) {
        console.error('Canvas export error:', error)
        studio.setRenderError()
      }
    })
  })

  // Guides live on a separate overlay canvas and are never exported.
  $effect(() => {
    const layout = studio.layout
    if (studio.showGuides && layout) drawGuides(guideCanvas, layout)
  })
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-100-900/60 overflow-hidden shadow-xl">
  <div
    class="px-4 py-3 border-b border-surface-200-800 flex flex-wrap items-center justify-between gap-3 bg-surface-100-900/80"
  >
    <div class="flex items-center gap-2.5">
      <span class="text-xs font-semibold text-surface-950-50">Live Preview</span>
      <span class="badge preset-tonal font-mono text-[11px] px-2 py-0.5">
        {studio.dimensionLabel}
      </span>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onclick={() => (studio.showGuides = !studio.showGuides)}
        aria-pressed={studio.showGuides}
        title="Show exact bounding-box alignment guides (not included in export)"
        class="btn btn-sm px-2.5 py-1 text-[11px] {studio.showGuides
          ? 'preset-tonal-primary border border-primary-500/60'
          : 'preset-outlined-surface-200-800 hover:preset-tonal'}"
      >
        <ScanLine class="w-3 h-3" />
        <span>Guides</span>
      </button>

      <SegmentedControl
        value={studio.stageBackground}
        onValueChange={(details) => {
          if (details.value) studio.stageBackground = details.value as StageBackground
        }}
        aria-label="Preview background mode"
      >
        <SegmentedControl.Control class="p-1 gap-0.5 bg-surface-50-950">
          <SegmentedControl.Indicator />
          {#each backgrounds as bg (bg.id)}
            <SegmentedControl.Item value={bg.id} class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>{bg.label}</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
          {/each}
        </SegmentedControl.Control>
      </SegmentedControl>
    </div>
  </div>

  <div
    class="{stageClass} relative min-h-[260px] sm:min-h-[320px] p-6 sm:p-10 flex items-center justify-center overflow-auto transition-colors duration-200"
  >
    <div class="relative inline-flex items-center justify-center">
      <!-- Actual export canvas -->
      <canvas bind:this={logoCanvas} class="max-w-full h-auto block"></canvas>
      <!-- Optional visual bounding guides overlay -->
      <canvas
        bind:this={guideCanvas}
        class="max-w-full h-auto block absolute inset-0 pointer-events-none"
        class:hidden={!studio.showGuides}
      ></canvas>
    </div>
  </div>

  <div
    class="px-4 py-2.5 bg-surface-50-950/70 border-t border-surface-200-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-surface-600-400"
  >
    <span>Exported PNG always preserves true alpha transparency.</span>
    <span class="font-mono">Pixel-exact glyph bounding metrics</span>
  </div>
</div>
