import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useRepoById } from '@/store/selectors'
import { findIndexedRepoOwnerForHost } from '@/lib/worktree-runtime-owner-index'
import { getProjectGroupsForRepoHost } from '@/store/slices/project-group-owner-routing'
import {
  getWorktreeExecutionHostId,
  toRuntimeExecutionHostId
} from '../../../../shared/execution-host'
import type { Worktree } from '../../../../shared/worktree/types'

/** The clicked workspace's own repo row and the groups that row can join. */
export function useWorktreeMenuProjectGroups(worktree: Worktree) {
  const allProjectGroups = useAppStore((s) => s.projectGroups)
  const repoById = useRepoById(worktree.repoId)
  // Why: repo ids repeat across hosts; the active-workspace lookup can return another host's row.
  const repo = useAppStore(
    (s) =>
      findIndexedRepoOwnerForHost(
        s.repos,
        worktree.repoId,
        worktree.runtimeOwnerEnvironmentId
          ? toRuntimeExecutionHostId(worktree.runtimeOwnerEnvironmentId)
          : getWorktreeExecutionHostId(worktree, repoById ?? undefined)
      ) ?? undefined
  )
  const projectGroups = useMemo(
    () => (repo ? getProjectGroupsForRepoHost(allProjectGroups, repo) : []),
    [allProjectGroups, repo]
  )
  return { repo, projectGroups }
}
