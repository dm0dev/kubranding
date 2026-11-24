<script lang="ts">
  import { LIMITS } from '../../core/index.ts'
  import { studio } from '../state/studio.svelte.ts'
  import Card from './Card.svelte'
  import SliderField from './SliderField.svelte'
</script>

<Card title="3. Spacing & Alignment" dot="bg-success-500">
  <SliderField id="gap" label="Icon–Text Gap" bind:value={studio.config.gap} limits={LIMITS.gap} />
  <SliderField
    id="outerMargin"
    label="Outer Canvas Margin"
    bind:value={studio.config.outerMargin}
    limits={LIMITS.outerMargin}
  />
</Card>
