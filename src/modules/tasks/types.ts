/* eslint-disable @typescript-eslint/no-explicit-any */
// =====================================================
// DATABASE TYPES (matching Supabase schema)
// =====================================================

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type ViewMode = 'kanban' | 'list' | 'calendar' | 'timeline';

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
  estimated_hours: number | null;
  actual_hours: number | null;
  position: number;
  is_archived: boolean;
  recurring_pattern: Record<string, any> | null;
  
  // Relationships (for joins)
  status?: Status;
  project?: Project;
  tags?: Tag[];
  subtasks?: Task[];
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
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
  estimated_hours?: number | null;
  parent_task_id?: string | null;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
   project_id: string; 
  completed_at?: string | null;
  actual_hours?: number | null;
  is_archived?: boolean;
}

export interface MoveTaskInput {
  taskId: string;
  newStatusId: string;
  newPosition: number;
  projectId: string;
}