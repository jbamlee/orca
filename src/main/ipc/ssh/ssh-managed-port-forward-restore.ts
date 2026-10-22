import { getAppEnvironment } from '../../../shared/app-environment'
import { listEnvironments } from '../../../shared/runtime-environment-store'
import { getSshHostServerStatus } from '../../ssh/ssh-host-server-status'
import { getCurrentMainWindow } from './ssh-ipc-context'
import { restorePortForwards } from './ssh-port-forward-persistence'

const restoring = new Map<string, Promise<void>>()

/** A managed host, or one carrying a paired server's SSH access, restores forwards on connect. */
function restoresOnConnect(targetId: string): boolean {
  return (
    getSshHostServerStatus(targetId)?.kind === 'managed' ||
    listEnvironments(getAppEnvironment().getPath('userData')).some(
      (environment) => environment.sshAccess?.sshTargetId === targetId
    )
  )
}

/** Such a host's connects restore its saved forwards. */
export function restoreManagedHostPortForwards(targetId: string): Promise<void> {
  if (!restoresOnConnect(targetId)) {
    return Promise.resolve()
  }
  // Why chained: overlapping connects would otherwise both bind the same saved local port.
  const previous = restoring.get(targetId) ?? Promise.resolve()
  const next = previous
    // Why re-checked: a disconnect or unlink queued behind the previous restore may have ended it.
    .then(() =>
      restoresOnConnect(targetId) ? restorePortForwards(targetId, getCurrentMainWindow) : undefined
    )
    .catch((error: unknown) => {
      console.warn(`[ssh] Could not restore port forwards for ${targetId}:`, error)
    })
    .finally(() => {
      if (restoring.get(targetId) === next) {
        restoring.delete(targetId)
      }
    })
  restoring.set(targetId, next)
  return next
}
