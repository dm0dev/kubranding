<script lang="ts">
  import { FileUpload } from '@skeletonlabs/skeleton-svelte'
  import { LIMITS, SUPPORTED_ICON_MIME_TYPES } from '../../core/index.ts'
  import { studio } from '../state/studio.svelte.ts'
  import { toast } from '../state/toast.svelte.ts'
  import Card from './Card.svelte'
  import SliderField from './SliderField.svelte'

  const accept = [...SUPPORTED_ICON_MIME_TYPES]
</script>

<Card title="1. Left Icon Asset" dot="bg-primary-500">
  {#snippet aside()}
    <button
      type="button"
      onclick={() => studio.restoreDefaultIcon()}
      class="anchor text-xs"
    >
      Restore Sample Cube
    </button>
  {/snippet}

  <FileUpload
    {accept}
    maxFiles={1}
    acceptedFiles={[]}
    onFileAccept={(details) => {
      const file = details.files[0]
      if (file) void studio.setIconFromFile(file)
    }}
    onFileReject={() => {
      toast.show('Unsupported format. Use PNG, SVG, JPG, or WebP.', 'error')
    }}
  >
    <FileUpload.Dropzone
      class="w-full p-4! items-stretch! justify-start! bg-surface-50-950/60 hover:bg-surface-50-950 border-surface-300-700 hover:border-primary-500/70 transition-colors cursor-pointer"
    >
      <div class="flex items-center gap-4 w-full text-left">
        <div
          class="w-14 h-14 rounded-base bg-surface-50-950 border border-surface-200-800 flex items-center justify-center shrink-0 overflow-hidden p-1.5"
        >
          {#if studio.icon}
            <img src={studio.icon.previewSrc} alt="Icon thumbnail" class="max-w-full max-h-full object-contain" />
          {/if}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-surface-950-50 truncate">{studio.icon?.name ?? 'No icon'}</p>
          <p class="text-xs text-surface-600-400 font-mono mt-0.5">
            {#if studio.icon}
              {studio.icon.asset.width} × {studio.icon.asset.height} px • {studio.icon.typeLabel}
            {:else}
              —
            {/if}
          </p>
          <p class="text-xs text-surface-600-400 mt-1.5">
            <span class="text-primary-400 font-medium">Click to upload</span> or drag &amp; drop (PNG, SVG, JPG, WebP)
          </p>
        </div>
      </div>
      <FileUpload.HiddenInput />
    </FileUpload.Dropzone>
  </FileUpload>

  <div class="pt-1">
    <SliderField
      id="iconHeight"
      label="Icon Target Height"
      bind:value={studio.config.iconHeight}
      limits={LIMITS.iconHeight}
      numberWidth="w-14"
    />
  </div>
</Card>
