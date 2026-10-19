import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { findIndexedRepoOwnerForHost } from '@/lib/worktree-runtime-owner-index'
import { getProjectGroupsForRepoHost } from '@/store/slices/project-group-owner-routing'
import {
  LOCAL_EXECUTION_HOST_ID,
  toRuntimeExecutionHostId
} from '../../../../shared/execution-host'
import type { Worktree } from '../../../../shared/worktree/types'

/** The clicked workspace's own repo row and the groups that row can join. */
export function useWorktreeMenuProjectGroups(worktree: Worktree) {
  const allProjectGroups = useAppStore((s) => s.projectGroups)
  // Why: repo ids repeat across hosts, so resolve the row on the workspace's own host, never the
  // active workspace's; an unstamped row without a runtime owner is local, as in the owner index.
  const repo = useAppStore(
    (s) =>
      findIndexedRepoOwnerForHost(
        s.repos,
        worktree.repoId,
        worktree.runtimeOwnerEnvironmentId
          ? toRuntimeExecutionHostId(worktree.runtimeOwnerEnvironmentId)
          : (worktree.hostId ?? LOCAL_EXECUTION_HOST_ID)
      ) ?? undefined
  )
  const projectGroups = useMemo(
    () => (repo ? getProjectGroupsForRepoHost(allProjectGroups, repo) : []),
    [allProjectGroups, repo]
  )
  return { repo, projectGroups }
}
