<script lang="ts">
  import { Check, ChevronDown, CircleAlert, Code, Copy, Download, Menu, Moon, Sun } from '@lucide/svelte'
  import { Collapsible, SegmentedControl, Tabs } from '@skeletonlabs/skeleton-svelte'
  import {
    buildCiCdCommand,
    buildKubermaticConfigMapCommand,
    buildKubermaticConfiguration,
    buildLogoConfigJson,
    buildOpenShiftManifest,
    type CiCdTarget,
    type OpenShiftManifestMode,
  } from '../../core/index.ts'
  import { studio, type OutputTab } from '../state/studio.svelte.ts'

  const RANCHER_MAX_BYTES = 20 * 1024

  let openShiftMode = $state<OpenShiftManifestMode>('customLogoFile')
  let includeKubermaticVolumes = $state(true)
  let cicdTarget = $state<CiCdTarget>('cli')
  let includeCicdBase64Out = $state(false)
  let copiedKey = $state<string | null>(null)
  let copiedKeyTimer: ReturnType<typeof setTimeout> | undefined

  function markCopied(key: string) {
    copiedKey = key
    clearTimeout(copiedKeyTimer)
    copiedKeyTimer = setTimeout(() => {
      if (copiedKey === key) copiedKey = null
    }, 1800)
  }

  async function copyWithFeedback(key: string, text: string, label: string) {
    if (await studio.copyContent(text, label)) markCopied(key)
  }

  const openShiftYaml = $derived(
    openShiftMode === 'logos'
      ? buildOpenShiftManifest({
          mode: 'logos',
          lightFileName: studio.lightFileName,
          lightBase64: studio.lightRawBase64,
          darkFileName: studio.darkFileName,
          darkBase64: studio.darkRawBase64,
        })
      : buildOpenShiftManifest({
          mode: 'customLogoFile',
          fileName: studio.primaryFileName,
          base64: studio.rawBase64,
        }),
  )

  const kubermaticYaml = $derived(
    buildKubermaticConfiguration({
      productName: studio.productName,
      lightFileName: studio.lightFileName,
      darkFileName: studio.darkFileName,
      includeVolumeMounts: includeKubermaticVolumes,
    }),
  )

  const kubermaticCmd = $derived(
    buildKubermaticConfigMapCommand({
      lightFileName: studio.lightFileName,
      darkFileName: studio.darkFileName,
    }),
  )

  const cicdIconArg = $derived<'default' | 'none' | string>(
    !studio.icon ? 'none' : studio.icon.isDefault ? 'default' : studio.icon.name,
  )

  const cicdCommand = $derived(
    buildCiCdCommand({
      config: $state.snapshot(studio.config),
      iconFile: cicdIconArg,
      fontsourceId: studio.activeFontsourceFont?.id,
      includeBase64Out: includeCicdBase64Out,
      target: cicdTarget,
    }),
  )

  const logoConfigJson = $derived(buildLogoConfigJson($state.snapshot(studio.config)))

  const rancherOverLimit = $derived(
    studio.lightByteCount > RANCHER_MAX_BYTES || studio.darkByteCount > RANCHER_MAX_BYTES,
  )
</script>

<div class="card preset-outlined-surface-200-800 bg-surface-100-900/60 p-4 sm:p-5">
  <Tabs
    value={studio.activeOutputTab}
    onValueChange={(details) => {
      if (details.value) studio.activeOutputTab = details.value as OutputTab
    }}
  >
    <Tabs.List class="overflow-x-auto overflow-y-hidden flex-nowrap">
      <Tabs.Trigger
        value="base64"
        class="btn-sm text-xs whitespace-nowrap text-surface-600-400 data-[selected]:text-surface-950-50 data-[selected]:font-semibold"
      >
        Base64 Data URI Output
      </Tabs.Trigger>
      <Tabs.Trigger
        value="openshift"
        class="btn-sm text-xs whitespace-nowrap text-surface-600-400 data-[selected]:text-surface-950-50 data-[selected]:font-semibold"
      >
        OpenShift
      </Tabs.Trigger>
      <Tabs.Trigger
        value="rancher"
        class="btn-sm text-xs whitespace-nowrap text-surface-600-400 data-[selected]:text-surface-950-50 data-[selected]:font-semibold"
      >
        Rancher / Harvester
      </Tabs.Trigger>
      <Tabs.Trigger
        value="kubermatic"
        class="btn-sm text-xs whitespace-nowrap text-surface-600-400 data-[selected]:text-surface-950-50 data-[selected]:font-semibold"
      >
        Kubermatic
      </Tabs.Trigger>
      <Tabs.Trigger
        value="cicd"
        class="btn-sm text-xs whitespace-nowrap text-surface-600-400 data-[selected]:text-surface-950-50 data-[selected]:font-semibold"
      >
        CI/CD
      </Tabs.Trigger>
      <Tabs.Indicator class="bg-primary-500!" />
    </Tabs.List>

    <!-- 1. Base64 Data URI Output (default) -->
    <Tabs.Content value="base64" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-800-200 flex items-center gap-2">
            Base64 Data URI Output
            <span class="badge preset-tonal font-mono text-[11px] font-normal px-2 py-0.5">
              {studio.byteSize}
            </span>
          </h3>
          <p class="text-xs text-surface-600-400 mt-0.5">
            Ready for direct embedding in HTML <code class="code">&lt;img src="..."&gt;</code> or CSS
            <code class="code">url(...)</code>
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => studio.copyBase64()}
            class="btn btn-sm preset-tonal"
          >
            {#if studio.copied}
              <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
              <span>Copied!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copy Base64</span>
            {/if}
          </button>

          <button
            type="button"
            onclick={() => studio.downloadPng()}
            class="btn btn-sm preset-filled-primary-500"
          >
            <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      <Collapsible
        open={studio.base64BoxOpen}
        onOpenChange={(details) => (studio.base64BoxOpen = details.open)}
        class="items-stretch!"
      >
        <div class="flex items-center justify-between gap-3 text-[11px] flex-wrap">
          <div class="flex items-center gap-3">
            <Collapsible.Trigger class="btn btn-sm px-1.5 py-0.5 text-[11px] hover:preset-tonal">
              <ChevronDown
                class="w-3.5 h-3.5 transition-transform {studio.base64BoxOpen ? '' : '-rotate-90'}"
              />
              <span>Inspect Raw String</span>
            </Collapsible.Trigger>
            <label class="inline-flex items-center gap-1.5 text-surface-600-400 cursor-pointer select-none">
              <input
                type="checkbox"
                bind:checked={studio.includeDataUriPrefix}
                class="checkbox"
              />
              <span>Include <code class="code">data:image/png;base64,</code> prefix</span>
            </label>
          </div>
          <span class="font-mono text-surface-600-400">{studio.base64Text.length.toLocaleString()} chars</span>
        </div>

        <Collapsible.Content class="w-full">
          <textarea
            readonly
            rows="4"
            value={studio.base64Text}
            aria-label="Base64 output"
            class="textarea font-mono text-[11px] leading-relaxed break-all resize-y select-all"
          ></textarea>
        </Collapsible.Content>
      </Collapsible>
    </Tabs.Content>

    <!-- 2. OpenShift -->
    <Tabs.Content value="openshift" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-800-200 flex items-center gap-2">
            OpenShift Web Console
            <span class="badge preset-tonal font-mono text-[11px] font-normal px-2 py-0.5">
              operator.openshift.io/v1
            </span>
          </h3>
          <p class="text-xs text-surface-600-400 mt-0.5">
            <code class="code">ConfigMap</code> in <code class="code">openshift-config</code> paired with
            <code class="code">Console</code> resource (<code class="code">oc apply -f</code>).
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => copyWithFeedback('openshift-yaml', openShiftYaml, 'OpenShift YAML')}
            class="btn btn-sm preset-tonal"
          >
            {#if copiedKey === 'openshift-yaml'}
              <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
              <span>Copied!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copy YAML</span>
            {/if}
          </button>

          <button
            type="button"
            onclick={() => studio.downloadTextFile(openShiftYaml, 'openshift-console-branding.yaml')}
            class="btn btn-sm preset-filled-primary-500"
          >
            <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Download YAML</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <SegmentedControl
          value={openShiftMode}
          onValueChange={(details) => {
            if (details.value) openShiftMode = details.value as OpenShiftManifestMode
          }}
          aria-label="OpenShift Console customization mode"
        >
          <SegmentedControl.Control class="p-1 gap-0.5 bg-surface-50-950">
            <SegmentedControl.Indicator />
            <SegmentedControl.Item value="customLogoFile" class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>customLogoFile (OCP 4.x)</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="logos" class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>logos (OCP 4.19+ Light &amp; Dark)</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
          </SegmentedControl.Control>
        </SegmentedControl>

        <span class="text-surface-600-400 font-mono">
          {openShiftMode === 'logos' ? `${studio.lightFileName} + ${studio.darkFileName}` : studio.primaryFileName}
        </span>
      </div>

      <textarea
        readonly
        rows="11"
        value={openShiftYaml}
        aria-label="OpenShift ConfigMap and Console YAML"
        class="textarea font-mono text-[11px] leading-relaxed resize-y select-all whitespace-pre overflow-x-auto"
      ></textarea>

      <p class="text-[11px] text-surface-600-400">
        OpenShift Console constrains masthead logos to <code class="code">max-height: 60px</code> and ConfigMaps to
        under 1 MB.
      </p>
    </Tabs.Content>

    <!-- 3. Rancher / Harvester -->
    <Tabs.Content value="rancher" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-800-200 flex items-center gap-2">
            Rancher / Harvester Branding
            <span class="badge preset-tonal font-mono text-[11px] font-normal px-2 py-0.5">
              Global Settings → Branding
            </span>
          </h3>
          <p class="text-xs text-surface-600-400 mt-0.5">
            Upload both Light and Dark theme logos under <strong>Global Settings → Branding</strong> (≤ 20 KB each,
            ~21 px height recommended).
          </p>
        </div>
      </div>

      {#if rancherOverLimit}
        <div
          class="flex items-center gap-2 rounded-base border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs text-warning-300"
        >
          <CircleAlert class="w-4 h-4 shrink-0 text-warning-400" />
          <span>
            Logo exceeds Rancher's <strong>20 KB</strong> upload limit — reduce Icon Target Height or Font Size.
          </span>
        </div>
      {/if}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Light Theme Preview & Actions -->
        <div class="rounded-container border border-surface-200-800 bg-surface-50-950/60 p-3.5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-surface-950-50 flex items-center gap-1.5">
              <Sun class="w-3.5 h-3.5 text-warning-400" />
              Light Theme
            </span>
            <span
              class="badge font-mono text-[10px] px-1.5 py-0.5 {studio.lightByteCount > RANCHER_MAX_BYTES
                ? 'preset-tonal-warning'
                : 'preset-tonal-success'}"
            >
              {studio.lightByteSize}
            </span>
          </div>

          <!-- Simulated Rancher/Harvester light top bar -->
          <div class="rounded-base border border-surface-300 bg-white overflow-hidden shadow-sm">
            <div class="h-12 px-3 flex items-center justify-between gap-2 bg-[#f4f5f6] border-b border-black/10">
              <div class="flex items-center gap-2.5 min-w-0">
                <Menu class="w-3.5 h-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                {#if studio.lightDataUrl}
                  <img
                    src={studio.lightDataUrl}
                    alt="Rancher light theme logo preview"
                    class="max-h-7 w-auto object-contain"
                  />
                {/if}
              </div>
              <span class="w-5 h-5 rounded-full bg-neutral-300 shrink-0" aria-hidden="true"></span>
            </div>
            <div class="px-3 py-1.5 text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>ui-logo-light</span>
              <span class="truncate max-w-[140px]">{studio.lightFileName}</span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 text-[11px]">
            <label class="inline-flex items-center gap-1.5 text-surface-600-400 cursor-pointer">
              <input
                type="color"
                value={studio.lightTextColor.toLowerCase()}
                oninput={(e) => (studio.lightTextOverride = e.currentTarget.value.toUpperCase())}
                aria-label="Light theme text color"
                class="w-5 h-5 rounded cursor-pointer border border-surface-300-700 bg-transparent p-0"
              />
              <span class="font-mono">{studio.lightTextColor}</span>
            </label>
            {#if studio.lightTextOverride}
              <button
                type="button"
                onclick={() => (studio.lightTextOverride = null)}
                class="anchor text-[11px]"
              >
                Auto
              </button>
            {:else}
              <span class="text-surface-600-400">Auto contrast</span>
            {/if}
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => copyWithFeedback('rancher-light', studio.lightDataUrl, 'Light Data URI')}
              class="btn btn-sm preset-tonal flex-1"
            >
              {#if copiedKey === 'rancher-light'}
                <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
                <span>Copied!</span>
              {:else}
                <Copy class="w-3.5 h-3.5" />
                <span>Data URI</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={() => studio.downloadThemedPng('light')}
              class="btn btn-sm preset-filled-primary-500 flex-1"
            >
              <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
              <span>Download</span>
            </button>
          </div>
        </div>

        <!-- Dark Theme Preview & Actions -->
        <div class="rounded-container border border-surface-200-800 bg-surface-50-950/60 p-3.5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-surface-950-50 flex items-center gap-1.5">
              <Moon class="w-3.5 h-3.5 text-primary-400" />
              Dark Theme
            </span>
            <span
              class="badge font-mono text-[10px] px-1.5 py-0.5 {studio.darkByteCount > RANCHER_MAX_BYTES
                ? 'preset-tonal-warning'
                : 'preset-tonal-success'}"
            >
              {studio.darkByteSize}
            </span>
          </div>

          <!-- Simulated Rancher/Harvester dark top bar -->
          <div class="rounded-base border border-surface-700 bg-[#141419] overflow-hidden shadow-sm">
            <div class="h-12 px-3 flex items-center justify-between gap-2 bg-[#1b1d21] border-b border-white/10">
              <div class="flex items-center gap-2.5 min-w-0">
                <Menu class="w-3.5 h-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                {#if studio.darkDataUrl}
                  <img
                    src={studio.darkDataUrl}
                    alt="Rancher dark theme logo preview"
                    class="max-h-7 w-auto object-contain"
                  />
                {/if}
              </div>
              <span class="w-5 h-5 rounded-full bg-neutral-700 shrink-0" aria-hidden="true"></span>
            </div>
            <div class="px-3 py-1.5 text-[10px] font-mono text-neutral-400 flex items-center justify-between">
              <span>ui-logo-dark</span>
              <span class="truncate max-w-[140px]">{studio.darkFileName}</span>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 text-[11px]">
            <label class="inline-flex items-center gap-1.5 text-surface-600-400 cursor-pointer">
              <input
                type="color"
                value={studio.darkTextColor.toLowerCase()}
                oninput={(e) => (studio.darkTextOverride = e.currentTarget.value.toUpperCase())}
                aria-label="Dark theme text color"
                class="w-5 h-5 rounded cursor-pointer border border-surface-300-700 bg-transparent p-0"
              />
              <span class="font-mono">{studio.darkTextColor}</span>
            </label>
            {#if studio.darkTextOverride}
              <button
                type="button"
                onclick={() => (studio.darkTextOverride = null)}
                class="anchor text-[11px]"
              >
                Auto
              </button>
            {:else}
              <span class="text-surface-600-400">Auto contrast</span>
            {/if}
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => copyWithFeedback('rancher-dark', studio.darkDataUrl, 'Dark Data URI')}
              class="btn btn-sm preset-tonal flex-1"
            >
              {#if copiedKey === 'rancher-dark'}
                <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
                <span>Copied!</span>
              {:else}
                <Copy class="w-3.5 h-3.5" />
                <span>Data URI</span>
              {/if}
            </button>
            <button
              type="button"
              onclick={() => studio.downloadThemedPng('dark')}
              class="btn btn-sm preset-filled-primary-500 flex-1"
            >
              <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </Tabs.Content>

    <!-- 4. Kubermatic -->
    <Tabs.Content value="kubermatic" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-800-200 flex items-center gap-2">
            Kubermatic (KKP) Branding
            <span class="badge preset-tonal font-mono text-[11px] font-normal px-2 py-0.5">
              kubermatic.k8c.io/v1
            </span>
          </h3>
          <p class="text-xs text-surface-600-400 mt-0.5">
            Download both PNG assets and paste the <code class="code">KubermaticConfiguration</code> YAML with matching
            filenames.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => copyWithFeedback('kkp-yaml', kubermaticYaml, 'KubermaticConfiguration YAML')}
            class="btn btn-sm preset-tonal"
          >
            {#if copiedKey === 'kkp-yaml'}
              <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
              <span>Copied!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copy YAML</span>
            {/if}
          </button>

          <button
            type="button"
            onclick={() => studio.downloadTextFile(kubermaticYaml, 'kubermatic-configuration.yaml')}
            class="btn btn-sm preset-filled-primary-500"
          >
            <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
            <span>Download YAML</span>
          </button>
        </div>
      </div>

      <div
        class="flex items-start gap-2.5 rounded-base border border-warning-500/40 bg-warning-500/10 px-3 py-2 text-xs text-warning-300"
      >
        <CircleAlert class="w-4 h-4 shrink-0 text-warning-400 mt-0.5" />
        <p class="leading-relaxed">
          <strong>Heads up:</strong> This <code class="code">KubermaticConfiguration</code> snippet is based on KKP
          documentation and has <strong>not been tested on a live Kubermatic cluster</strong>. Verify
          <code class="code">mountPath: /dist/assets/branding</code> and <code class="code">spec.ui.config</code>
          keys against your KKP version before applying (or replace paths with hosted <code class="code">https://</code>
          URLs).
        </p>
      </div>

      <!-- Downloadable logo files matching KubermaticConfiguration filenames -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          class="rounded-base border border-surface-200-800 bg-surface-50-950/60 p-2.5 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-16 h-9 rounded bg-white border border-surface-300 flex items-center justify-center p-1 shrink-0">
              {#if studio.lightDataUrl}
                <img src={studio.lightDataUrl} alt="Kubermatic light logo" class="max-h-full max-w-full object-contain" />
              {/if}
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-medium text-surface-950-50 truncate">{studio.lightFileName}</div>
              <div class="text-[10px] font-mono text-surface-600-400 truncate">
                logo_url • {studio.lightByteSize}
              </div>
            </div>
          </div>
          <button
            type="button"
            onclick={() => studio.downloadThemedPng('light')}
            class="btn btn-sm preset-tonal shrink-0"
            title="Download {studio.lightFileName}"
          >
            <Download class="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
        </div>

        <div
          class="rounded-base border border-surface-200-800 bg-surface-50-950/60 p-2.5 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-16 h-9 rounded bg-[#1b1d21] border border-surface-700 flex items-center justify-center p-1 shrink-0"
            >
              {#if studio.darkDataUrl}
                <img src={studio.darkDataUrl} alt="Kubermatic dark logo" class="max-h-full max-w-full object-contain" />
              {/if}
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-medium text-surface-950-50 truncate">{studio.darkFileName}</div>
              <div class="text-[10px] font-mono text-surface-600-400 truncate">
                logo_dark_url • {studio.darkByteSize}
              </div>
            </div>
          </div>
          <button
            type="button"
            onclick={() => studio.downloadThemedPng('dark')}
            class="btn btn-sm preset-tonal shrink-0"
            title="Download {studio.darkFileName}"
          >
            <Download class="w-3.5 h-3.5" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <label class="inline-flex items-center gap-1.5 text-surface-600-400 cursor-pointer select-none">
          <input type="checkbox" bind:checked={includeKubermaticVolumes} class="checkbox" />
          <span>Include <code class="code">extraVolumes</code> / <code class="code">extraVolumeMounts</code></span>
        </label>
        <span class="font-mono text-surface-600-400">assets/branding/{studio.slug}-{'{light,dark}'}.png</span>
      </div>

      <textarea
        readonly
        rows="11"
        value={kubermaticYaml}
        aria-label="KubermaticConfiguration YAML"
        class="textarea font-mono text-[11px] leading-relaxed resize-y select-all whitespace-pre overflow-x-auto"
      ></textarea>

      {#if includeKubermaticVolumes}
        <div class="rounded-base border border-surface-200-800 bg-surface-50-950/70 p-2.5 space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-medium text-surface-700-300 flex items-center gap-1.5">
              <Code class="w-3.5 h-3.5 text-primary-400" />
              Create ConfigMap from downloaded files
            </span>
            <button
              type="button"
              onclick={() => copyWithFeedback('kkp-cmd', kubermaticCmd, 'kubectl command')}
              class="btn btn-sm px-2 py-0.5 text-[11px] preset-tonal"
            >
              {#if copiedKey === 'kkp-cmd'}
                <Check class="w-3 h-3 text-success-400" strokeWidth={2.5} />
                <span>Copied!</span>
              {:else}
                <Copy class="w-3 h-3" />
                <span>Copy Command</span>
              {/if}
            </button>
          </div>
          <pre class="text-[11px] font-mono text-surface-700-300 overflow-x-auto whitespace-pre select-all">{kubermaticCmd}</pre>
        </div>
      {/if}
    </Tabs.Content>

    <!-- 5. CI/CD -->
    <Tabs.Content value="cicd" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-surface-800-200 flex items-center gap-2">
            CI/CD Headless Generator
            <span class="badge preset-tonal font-mono text-[11px] font-normal px-2 py-0.5">
              Node ≥ 22.18
            </span>
          </h3>
          <p class="text-xs text-surface-600-400 mt-0.5">
            Reproduce this exact logo headlessly in pipelines using <code class="code">src/cli/generate.ts</code> or
            <code class="code">Containerfile</code>.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={() => copyWithFeedback('cicd-cmd', cicdCommand, 'CI/CD command')}
            class="btn btn-sm preset-tonal"
          >
            {#if copiedKey === 'cicd-cmd'}
              <Check class="w-3.5 h-3.5 text-success-400" strokeWidth={2.5} />
              <span>Copied!</span>
            {:else}
              <Copy class="w-3.5 h-3.5" />
              <span>Copy Command</span>
            {/if}
          </button>

          {#if cicdTarget === 'json'}
            <button
              type="button"
              onclick={() => studio.downloadTextFile(logoConfigJson, 'logo.json')}
              class="btn btn-sm preset-filled-primary-500"
            >
              <Download class="w-3.5 h-3.5" strokeWidth={2.2} />
              <span>Download logo.json</span>
            </button>
          {/if}
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <SegmentedControl
          value={cicdTarget}
          onValueChange={(details) => {
            if (details.value) cicdTarget = details.value as CiCdTarget
          }}
          aria-label="CI/CD runner mode"
        >
          <SegmentedControl.Control class="p-1 gap-0.5 bg-surface-50-950">
            <SegmentedControl.Indicator />
            <SegmentedControl.Item value="cli" class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>Node CLI</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="podman" class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>Podman</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
            <SegmentedControl.Item value="json" class="btn-sm px-2.5 py-1 text-[11px]">
              <SegmentedControl.ItemText>logo.json + CLI</SegmentedControl.ItemText>
              <SegmentedControl.ItemHiddenInput />
            </SegmentedControl.Item>
          </SegmentedControl.Control>
        </SegmentedControl>

        <label class="inline-flex items-center gap-1.5 text-surface-600-400 cursor-pointer select-none">
          <input type="checkbox" bind:checked={includeCicdBase64Out} class="checkbox" />
          <span>Also write <code class="code">--base64-out</code></span>
        </label>
      </div>

      <textarea
        readonly
        rows={cicdTarget === 'json' ? 5 : 10}
        value={cicdCommand}
        aria-label="CI/CD generator command"
        class="textarea font-mono text-[11px] leading-relaxed resize-y select-all whitespace-pre overflow-x-auto"
      ></textarea>

      {#if cicdTarget === 'json'}
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2 text-[11px]">
            <span class="font-medium text-surface-700-300 font-mono">logo.json</span>
            <button
              type="button"
              onclick={() => copyWithFeedback('cicd-json', logoConfigJson, 'logo.json')}
              class="btn btn-sm px-2 py-0.5 text-[11px] preset-tonal"
            >
              {#if copiedKey === 'cicd-json'}
                <Check class="w-3 h-3 text-success-400" strokeWidth={2.5} />
                <span>Copied!</span>
              {:else}
                <Copy class="w-3 h-3" />
                <span>Copy JSON</span>
              {/if}
            </button>
          </div>
          <textarea
            readonly
            rows="9"
            value={logoConfigJson}
            aria-label="logo.json configuration"
            class="textarea font-mono text-[11px] leading-relaxed resize-y select-all whitespace-pre overflow-x-auto"
          ></textarea>
        </div>
      {/if}

      {#if studio.icon && !studio.icon.isDefault}
        <p class="text-[11px] text-surface-600-400">
          Make sure referenced asset files ({studio.icon.name}) exist in the working directory when running in CI.
        </p>
      {/if}
      {#if studio.activeFontsourceFont}
        <p class="text-[11px] text-surface-600-400">
          Font <span class="font-medium text-surface-800-200">{studio.activeFontsourceFont.family}</span> is
          automatically downloaded from Fontsource (<code class="code">--fontsource {studio.activeFontsourceFont.id}</code>).
        </p>
      {/if}
    </Tabs.Content>
  </Tabs>
</div>
