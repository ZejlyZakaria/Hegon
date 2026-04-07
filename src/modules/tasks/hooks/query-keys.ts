export const TASK_KEYS = {
  all: ['tasks'] as const,
  lists: () => [...TASK_KEYS.all, 'list'] as const,
  list: (filters: string) => [...TASK_KEYS.lists(), { filters }] as const,
  byProject: (projectId: string) => [...TASK_KEYS.all, 'project', projectId] as const,
  byWorkspace: (workspaceId: string) => [...TASK_KEYS.all, 'workspace', workspaceId] as const,
  byStatus: (statusId: string) => [...TASK_KEYS.all, 'status', statusId] as const,
} as const;

export const PROJECT_KEYS = {
  all: ['projects'] as const,
  lists: () => [...PROJECT_KEYS.all, 'list'] as const,
  byWorkspace: (workspaceId: string) => [...PROJECT_KEYS.all, 'workspace', workspaceId] as const,
  detail: (id: string) => [...PROJECT_KEYS.all, 'detail', id] as const,
} as const;

export const WORKSPACE_KEYS = {
  all: ['workspaces'] as const,
  lists: () => [...WORKSPACE_KEYS.all, 'list'] as const,
  detail: (id: string) => [...WORKSPACE_KEYS.all, 'detail', id] as const,
} as const;

export const STATUS_KEYS = {
  all: ['statuses'] as const,
  lists: () => [...STATUS_KEYS.all, 'list'] as const,
  byProject: (projectId: string) => [...STATUS_KEYS.all, 'project', projectId] as const,
} as const;

export const TAG_KEYS = {
  all: ['tags'] as const,
  lists: () => [...TAG_KEYS.all, 'list'] as const,
} as const;