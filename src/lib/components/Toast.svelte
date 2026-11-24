<script lang="ts">
  import { Toast } from '@skeletonlabs/skeleton-svelte'
  import { toaster } from '../state/toast.svelte.ts'
</script>

<Toast.Group {toaster}>
  {#snippet children(item)}
    <Toast toast={item}>
      <Toast.Message>
        <Toast.Title>{item.title}</Toast.Title>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>
