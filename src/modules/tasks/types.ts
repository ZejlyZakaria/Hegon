// =====================================================
// DATABASE TYPES (matching Supabase schema)
// =====================================================

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type StatusType = 'backlog' | 'todo' | 'in_progress' | 'done' | 'cancelled';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type ViewMode = 'kanban' | 'list' | 'calendar' | 'now';

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  status: ProjectStatus;
  position: number;
  created_at: string;
  updated_at: string;
  workspace?: Workspace; // For joins
}

export interface Status {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  type: StatusType;
  icon: string | null;
  position: number;
  is_completed: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Assignee {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status_id: string;
  priority: Priority;
  created_by: string | null;
  assignee_id: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  position: number;
  is_archived: boolean;
  recurring_pattern: Record<string, unknown> | null;
  
  goal_id?: string | null;

  // Relationships (for joins)
  status?: Status;
  project?: Project;
  tags?: Tag[];
  assignee?: Assignee | null;
  subtasks?: Task[];
}

// =====================================================
// UI STATE TYPES
// =====================================================

export interface TaskFilters {
  search: string;
  statuses: string[];
  priorities: Priority[];
  tags: string[];
  assignees: string[];
  dueDateRange: {
    from: Date | null;
    to: Date | null;
  } | null;
  showArchived: boolean;
}

export interface TasksState {
  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Selection
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  
  // Filters
  filters: TaskFilters;
  setFilters: (filters: Partial<TaskFilters>) => void;
  resetFilters: () => void;
  
  // Modals
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  editingTaskId: string | null;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (taskId: string) => void;
  closeEditModal: () => void;
  
  // Sidebar
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  // Mobile sidebar — ephemeral overlay drawer (not persisted, separate from desktop collapse)
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
}

// =====================================================
// API TYPES
// =====================================================

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string | null;
  status_id?: string;
  priority?: Priority;
  due_date?: string | null;
  start_date?: string | null;
  parent_task_id?: string | null;
  goal_id?: string | null;
  assignee_id?: string | null;
}

// =====================================================
// ACTIVITY LOG
// =====================================================

export type TaskActivityAction =
  | "created" | "title_changed" | "status_changed" | "priority_changed"
  | "assigned" | "unassigned" | "due_date_set" | "due_date_cleared"
  | "start_date_set" | "start_date_cleared" | "goal_linked" | "goal_unlinked"
  | "commented";

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string;
  action: TaskActivityAction;
  changes: Record<string, unknown>;
  created_at: string;
  org_id: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
   project_id: string; 
  completed_at?: string | null;
  is_archived?: boolean;
}

export interface MoveTaskInput {
  taskId: string;
  newStatusId: string;
  newPosition: number;
  projectId: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: string;
  invited_by: string | null;
  created_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface WorkspaceInvitation {
  id: string;
  org_id: string;
  workspace_id: string;
  invited_by: string;
  email: string;
  token: string;
  role: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}