<script lang="ts">
  import { LoaderCircle, Sparkles } from '@lucide/svelte'
  import { Combobox, Portal, type ComboboxRootProps, useListCollection } from '@skeletonlabs/skeleton-svelte'
  import { onMount } from 'svelte'
  import type { FontsourceCatalogEntry } from '../../browser/fonts.ts'
  import { COLOR_SWATCHES, FONT_PRESETS, LIMITS, parseHexColor } from '../../core/index.ts'
  import { studio } from '../state/studio.svelte.ts'
  import Card from './Card.svelte'
  import SliderField from './SliderField.svelte'

  const POPULAR_FONTSOURCE_IDS = [
    'poppins',
    'roboto',
    'open-sans',
    'montserrat',
    'space-grotesk',
    'plus-jakarta-sans',
    'dm-sans',
    'outfit',
    'fira-code',
    'source-sans-3',
    'ibm-plex-sans',
    'manrope',
    'playfair-display',
    'lato',
    'nunito',
    'oswald',
    'ubuntu',
    'work-sans',
    'geist',
    'rubik',
  ]

  const MAX_RESULTS = 40

  let fontsourceQuery = $state('')
  let comboboxValue = $state<string[]>([])

  onMount(() => {
    void studio.loadFontsourceCatalog()
  })

  const filteredCatalog = $derived.by((): FontsourceCatalogEntry[] => {
    const catalog = studio.fontsourceCatalog
    if (catalog.length === 0) return []

    const query = fontsourceQuery.trim().toLowerCase()
    if (!query) {
      const byId = new Map(catalog.map((entry) => [entry.id, entry]))
      const popular = POPULAR_FONTSOURCE_IDS.map((id) => byId.get(id)).filter(
        (entry): entry is FontsourceCatalogEntry => Boolean(entry),
      )
      return popular.length > 0 ? popular : catalog.slice(0, MAX_RESULTS)
    }

    const prefixMatches: FontsourceCatalogEntry[] = []
    const otherMatches: FontsourceCatalogEntry[] = []

    for (const entry of catalog) {
      const familyLower = entry.family.toLowerCase()
      const idLower = entry.id.toLowerCase()
      if (familyLower.startsWith(query) || idLower.startsWith(query)) {
        prefixMatches.push(entry)
      } else if (
        familyLower.includes(query) ||
        idLower.includes(query) ||
        entry.category.toLowerCase().includes(query)
      ) {
        otherMatches.push(entry)
      }
      if (prefixMatches.length >= MAX_RESULTS) break
    }

    return [...prefixMatches, ...otherMatches].slice(0, MAX_RESULTS)
  })

  const fontsourceCollection = $derived(
    useListCollection({
      items: filteredCatalog,
      itemToString: (item) => item.family,
      itemToValue: (item) => item.id,
    }),
  )

  const onComboboxOpenChange: ComboboxRootProps['onOpenChange'] = (details) => {
    if (details.open) {
      void studio.loadFontsourceCatalog()
    }
  }

  const onComboboxInputValueChange: ComboboxRootProps['onInputValueChange'] = (details) => {
    fontsourceQuery = details.inputValue
  }

  const onComboboxValueChange: ComboboxRootProps['onValueChange'] = (details) => {
    const selectedId = details.value[0]
    comboboxValue = []
    if (selectedId) {
      fontsourceQuery = ''
      void studio.loadFontsource(selectedId)
    }
  }

  function onDirectLoadKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && filteredCatalog.length === 0 && fontsourceQuery.trim()) {
      event.preventDefault()
      const query = fontsourceQuery.trim()
      fontsourceQuery = ''
      void studio.loadFontsource(query)
    }
  }

  // Hex field: keep what the user types, commit as soon as it is a valid colour.
  let hexFocused = false
  let hexDraft = $state('')
  $effect(() => {
    const color = studio.config.textColor
    if (!hexFocused) hexDraft = color.slice(1)
  })

  function onHexInput(event: Event & { currentTarget: HTMLInputElement }) {
    hexDraft = event.currentTarget.value
    const hex = parseHexColor(hexDraft.replace(/[^0-9A-Fa-f]/g, ''))
    if (hex) studio.config.textColor = hex
  }
</script>

<Card title="2. Logo Typography" dot="bg-warning-500">
  {#snippet aside()}
    <span class="text-[11px] font-mono text-surface-600-400">Multi-line supported</span>
  {/snippet}

  <label class="label space-y-1.5">
    <span class="label-text text-xs font-medium">Display Text</span>
    <textarea
      id="logoText"
      rows="2"
      placeholder="Enter logo text..."
      bind:value={studio.config.text}
      class="textarea text-sm resize-y leading-snug"
    ></textarea>
  </label>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <label class="label space-y-1.5">
      <span class="label-text text-xs font-medium">Font Family</span>
      <select
        id="fontFamily"
        value={studio.config.fontFamily}
        onchange={(e) => studio.setFontFamily(e.currentTarget.value)}
        class="select text-xs py-2"
      >
        <optgroup label="Built-in &amp; System Fonts">
          {#each FONT_PRESETS as font (font.value)}
            <option value={font.value}>{font.label}</option>
          {/each}
        </optgroup>
        {#if studio.fontsourceFonts.length > 0}
          <optgroup label="Fontsource Fonts">
            {#each studio.fontsourceFonts as font (font.id)}
              <option value={font.cssFamily}>{font.family}</option>
            {/each}
          </optgroup>
        {/if}
      </select>
    </label>

    <label class="label space-y-1.5">
      <span class="label-text text-xs font-medium">Font Weight</span>
      <select id="fontWeight" bind:value={studio.config.fontWeight} class="select text-xs py-2">
        {#each studio.availableFontWeights as weight (weight.value)}
          <option value={weight.value}>{weight.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="space-y-1.5 pt-0.5">
    <div class="flex items-center justify-between gap-2">
      <span class="label-text text-xs font-medium flex items-center gap-1.5">
        <Sparkles class="w-3.5 h-3.5 text-warning-400" />
        Load from Fontsource
      </span>
      {#if studio.fontsourceLoadingId}
        <span class="text-[11px] font-mono text-warning-400 flex items-center gap-1">
          <LoaderCircle class="w-3 h-3 animate-spin" />
          Loading…
        </span>
      {:else if studio.activeFontsourceFont}
        <span class="text-[11px] font-mono text-surface-600-400 truncate max-w-[180px]">
          {studio.activeFontsourceFont.id} • {studio.activeFontsourceFont.weights.length}w
        </span>
      {:else}
        <span class="text-[11px] font-mono text-surface-600-400">
          {studio.fontsourceCatalog.length > 0 ? `${studio.fontsourceCatalog.length.toLocaleString()} fonts` : 'fontsource.org'}
        </span>
      {/if}
    </div>

    <Combobox
      collection={fontsourceCollection}
      value={comboboxValue}
      inputValue={fontsourceQuery}
      placeholder="Search Fontsource (e.g. Poppins, Space Grotesk)…"
      openOnClick={true}
      inputBehavior="autohighlight"
      selectionBehavior="clear"
      disabled={Boolean(studio.fontsourceLoadingId)}
      onOpenChange={onComboboxOpenChange}
      onInputValueChange={onComboboxInputValueChange}
      onValueChange={onComboboxValueChange}
    >
      <Combobox.Control>
        <Combobox.Input class="text-xs py-2" onkeydown={onDirectLoadKeydown} />
        <Combobox.Trigger />
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner class="z-50">
          <Combobox.Content class="max-h-64 overflow-y-auto z-50">
            {#if studio.fontsourceCatalogLoading}
              <div class="px-3 py-2.5 text-xs text-surface-600-400 flex items-center gap-2">
                <LoaderCircle class="w-3.5 h-3.5 animate-spin" />
                <span>Loading Fontsource directory…</span>
              </div>
            {:else if studio.fontsourceCatalogError}
              <div class="px-3 py-2.5 text-xs space-y-2">
                <p class="text-error-400">{studio.fontsourceCatalogError}</p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick={() => studio.loadFontsourceCatalog()}
                    class="btn btn-sm preset-tonal text-[11px]"
                  >
                    Retry Catalog
                  </button>
                  {#if fontsourceQuery.trim()}
                    <button
                      type="button"
                      onclick={() => void studio.loadFontsource(fontsourceQuery)}
                      class="btn btn-sm preset-filled-primary-500 text-[11px]"
                    >
                      Load “{fontsourceQuery.trim()}”
                    </button>
                  {/if}
                </div>
              </div>
            {:else if filteredCatalog.length === 0}
              <div class="px-3 py-2.5 text-xs text-surface-600-400 flex items-center justify-between gap-2">
                <span>No matching fonts in directory.</span>
                {#if fontsourceQuery.trim()}
                  <button
                    type="button"
                    onclick={() => void studio.loadFontsource(fontsourceQuery)}
                    class="btn btn-sm preset-tonal text-[11px]"
                  >
                    Try “{fontsourceQuery.trim()}”
                  </button>
                {/if}
              </div>
            {:else}
              {#if !fontsourceQuery.trim()}
                <div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-600-400">
                  Popular on Fontsource
                </div>
              {/if}
              {#each filteredCatalog as item (item.id)}
                {@const isLoaded = studio.fontsourceFonts.some((f) => f.id === item.id)}
                <Combobox.Item {item}>
                  <Combobox.ItemText class="flex items-center justify-between gap-2 w-full min-w-0">
                    <span class="truncate font-medium">{item.family}</span>
                    <span class="flex items-center gap-1.5 shrink-0">
                      {#if isLoaded}
                        <span class="badge preset-tonal-success text-[10px] px-1.5 py-0">Loaded</span>
                      {/if}
                      <span class="text-[10px] font-mono text-surface-600-400">{item.category}</span>
                    </span>
                  </Combobox.ItemText>
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              {/each}
            {/if}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
    <SliderField id="fontSize" label="Font Size" bind:value={studio.config.fontSize} limits={LIMITS.fontSize} />
    <SliderField
      id="lineSpacing"
      label="Line Spacing"
      bind:value={studio.config.lineSpacing}
      limits={LIMITS.lineSpacing}
    />
  </div>

  <div class="space-y-2 pt-1">
    <div class="flex items-center justify-between">
      <label for="textColorHex" class="label-text text-xs font-medium">Text Color</label>
      <div class="flex items-center gap-1.5">
        {#each COLOR_SWATCHES as swatch (swatch.value)}
          <button
            type="button"
            onclick={() => studio.pickSwatch(swatch.value)}
            class="w-4 h-4 rounded-full border border-surface-400-600 hover:scale-110 transition-transform"
            style:background-color={swatch.value}
            title={swatch.title}
            aria-label={swatch.title}
          ></button>
        {/each}
      </div>
    </div>
    <div class="flex items-center gap-2.5">
      <input
        type="color"
        value={studio.config.textColor.toLowerCase()}
        oninput={(e) => studio.setTextColor(e.currentTarget.value)}
        aria-label="Text color picker"
        class="input w-9! h-9! cursor-pointer shrink-0"
      />
      <div class="field-group grid-cols-[auto_1fr] flex-1 items-center">
        <span class="label label-text preset-tonal font-mono text-xs">#</span>
        <input
          id="textColorHex"
          type="text"
          maxlength="7"
          placeholder="FFFFFF"
          value={hexDraft}
          oninput={onHexInput}
          onfocus={() => (hexFocused = true)}
          onblur={() => {
            hexFocused = false
            hexDraft = studio.config.textColor.slice(1)
          }}
          class="input font-mono text-xs uppercase py-2"
        />
      </div>
    </div>
  </div>
</Card>
