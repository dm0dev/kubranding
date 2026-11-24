<script lang="ts">
  import { onMount } from 'svelte'
  import Footer from './lib/components/Footer.svelte'
  import Header from './lib/components/Header.svelte'
  import IconCard from './lib/components/IconCard.svelte'
  import OutputTabsCard from './lib/components/OutputTabsCard.svelte'
  import PreviewCard from './lib/components/PreviewCard.svelte'
  import SpacingCard from './lib/components/SpacingCard.svelte'
  import Toast from './lib/components/Toast.svelte'
  import TypographyCard from './lib/components/TypographyCard.svelte'
  import { studio } from './lib/state/studio.svelte.ts'

  onMount(() => {
    void studio.loadDefaultIcon()
  })
</script>

<Header />
<Toast />

<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
  <!-- Controls -->
  <section class="lg:col-span-5 space-y-5">
    <IconCard />
    <TypographyCard />
    <SpacingCard />
  </section>

  <!-- Live preview & output -->
  <section class="lg:col-span-7 space-y-5 lg:sticky lg:top-20">
    <PreviewCard />
    <OutputTabsCard />
  </section>
</main>

<Footer />
