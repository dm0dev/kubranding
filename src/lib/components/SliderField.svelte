<script lang="ts">
  import { Slider } from '@skeletonlabs/skeleton-svelte'
  import { clamp, type NumericLimits } from '../../core/index.ts'

  let {
    id,
    label,
    value = $bindable(),
    limits,
    numberWidth = 'w-14',
  }: {
    id: string
    label: string
    value: number
    limits: NumericLimits
    /** Tailwind width class of the numeric field. */
    numberWidth?: string
  } = $props()

  // The numeric field keeps what the user types until blur (so "1" → "100" isn't
  // rewritten to the minimum mid-typing); the state itself is always clamped.
  let editing = false
  let draft = $state('')

  $effect(() => {
    const current = value
    if (!editing) draft = String(current)
  })

  function onNumberInput(event: Event & { currentTarget: HTMLInputElement }) {
    editing = true
    draft = event.currentTarget.value
    const n = Number(draft)
    if (draft.trim() === '' || Number.isNaN(n)) return
    value = clamp(n, limits.min, limits.max)
  }

  function onNumberBlur() {
    editing = false
    draft = String(value)
  }

  const sliderValue = $derived([clamp(value, limits.sliderMin, limits.sliderMax)])
</script>

<Slider
  value={sliderValue}
  min={limits.sliderMin}
  max={limits.sliderMax}
  step={1}
  onValueChange={(details) => (value = details.value[0])}
>
  <div class="flex items-center justify-between gap-2">
    <Slider.Label class="label-text text-xs font-medium">{label}</Slider.Label>
    <div class="field-group grid-cols-[1fr_auto] items-center">
      <input
        id="{id}-number"
        type="number"
        min={limits.min}
        max={limits.max}
        value={draft}
        oninput={onNumberInput}
        onblur={onNumberBlur}
        aria-label="{label} (px)"
        class="input field-xs {numberWidth} text-right font-mono py-1"
      />
      <span class="label label-text preset-tonal font-mono text-[11px] px-2">px</span>
    </div>
  </div>
  <Slider.Control>
    <Slider.Track class="bg-surface-200-800">
      <Slider.Range class="bg-primary-500" />
    </Slider.Track>
    <Slider.Thumb index={0} class="ring-primary-500">
      <Slider.HiddenInput />
    </Slider.Thumb>
  </Slider.Control>
</Slider>
