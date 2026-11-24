import { createToaster } from '@skeletonlabs/skeleton-svelte'

export type ToastKind = 'success' | 'error'

export const toaster = createToaster({
  placement: 'bottom-end',
  duration: 2400,
})

export const toast = {
  show(message: string, kind: ToastKind = 'success'): void {
    if (kind === 'error') {
      toaster.error({ title: message })
    } else {
      toaster.success({ title: message })
    }
  },
}
