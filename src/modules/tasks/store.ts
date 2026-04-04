import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { TasksState, TaskFilters, ViewMode } from './types';

const initialFilters: TaskFilters = {
  search: '',
  statuses: [],
  priorities: [],
  tags: [],
  assignees: [],
  dueDateRange: null,
  showArchived: false,
};

export const useTasksStore = create<TasksState>()(
  devtools(
    persist(
      (set) => ({
        // Hydration
        _hasHydrated: false,
        setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),

        // View
        viewMode: 'kanban',
        setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

        // Selection
        selectedProjectId: null,
        setSelectedProjectId: (id: string | null) => set({ selectedProjectId: id }),

        // Filters
        filters: initialFilters,
        setFilters: (newFilters: Partial<TaskFilters>) =>
          set((state: TasksState) => ({
            filters: { ...state.filters, ...newFilters },
          })),
        resetFilters: () => set({ filters: initialFilters }),

        // Modals
        isCreateModalOpen: false,
        isEditModalOpen: false,
        editingTaskId: null,
        openCreateModal: () => set({ isCreateModalOpen: true }),
        closeCreateModal: () => set({ isCreateModalOpen: false }),
        openEditModal: (taskId: string) =>
          set({ isEditModalOpen: true, editingTaskId: taskId }),
        closeEditModal: () =>
          set({ isEditModalOpen: false, editingTaskId: null }),

        // Sidebar
        isSidebarCollapsed: false,
        toggleSidebar: () =>
          set((state: TasksState) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      }),
      {
        name: 'tasks-storage',
        partialize: (state) => ({
          viewMode: state.viewMode,
          isSidebarCollapsed: state.isSidebarCollapsed,
          selectedProjectId: state.selectedProjectId,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHasHydrated(true);
        },
      }
    ),
    { name: 'TasksStore' }
  )
);