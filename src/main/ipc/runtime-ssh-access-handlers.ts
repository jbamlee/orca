import { ipcMain } from 'electron'
import {
  RuntimeSshAccessLinkRequestSchema,
  RuntimeSshAccessUnlinkRequestSchema
} from '../../shared/runtime-ssh-access'
import { linkRuntimeSshAccess, unlinkRuntimeSshAccess } from '../ssh/runtime-ssh-access'
import { restoreManagedHostPortForwards } from './ssh/ssh-managed-port-forward-restore'
import { getCurrentMainWindow, portForwardManager } from './ssh/ssh-ipc-context'
import { broadcastPortForwards } from './ssh/ssh-renderer-broadcast'

async function closeLinkedHostPortForwards(sshTargetId: string): Promise<void> {
  await portForwardManager?.removeAllForwards(sshTargetId)
  broadcastPortForwards(getCurrentMainWindow, sshTargetId)
}

export function registerRuntimeSshAccessHandlers(options: {
  getUserDataPath: () => string
  invalidateTransport: (environmentId: string) => void | Promise<void>
}): void {
  ipcMain.handle('runtimeEnvironments:linkSshAccess', async (event, input: unknown) => {
    const args = RuntimeSshAccessLinkRequestSchema.parse(input)
    // Why: a link to an unreachable host holds two lifecycle queues; a closed window cancels it.
    const controller = new AbortController()
    const cancel = (): void => controller.abort()
    event.sender.once('destroyed', cancel)
    try {
      const linked = await linkRuntimeSshAccess(options.getUserDataPath(), args, {
        signal: controller.signal,
        invalidateTransport: options.invalidateTransport
      })
      // Why: the link's own connect fired before its access was saved, so it restored nothing.
      void restoreManagedHostPortForwards(args.sshTargetId)
      return linked
    } finally {
      event.sender.removeListener('destroyed', cancel)
    }
  })
  ipcMain.handle('runtimeEnvironments:unlinkSshAccess', async (_event, input: unknown) => {
    const args = RuntimeSshAccessUnlinkRequestSchema.parse(input)
    return unlinkRuntimeSshAccess(options.getUserDataPath(), args, {
      invalidateTransport: options.invalidateTransport,
      closePortForwards: closeLinkedHostPortForwards
    })
  })
}
