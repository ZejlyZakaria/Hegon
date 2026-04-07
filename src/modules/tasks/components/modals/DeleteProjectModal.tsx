"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useDeleteProject } from "@/modules/tasks/hooks/useProjects";
import type { Project } from "@/modules/tasks/types";

// =====================================================
// DELETE PROJECT MODAL
// =====================================================

interface DeleteProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onDeleted?: () => void;
}

export function DeleteProjectModal({
  open,
  onOpenChange,
  project,
  onDeleted,
}: DeleteProjectModalProps) {
  const deleteMutation = useDeleteProject();

  const handleDelete = () => {
    deleteMutation.mutate(
      { projectId: project.id, workspaceId: project.workspace_id },
      {
        onSuccess: () => {
          onOpenChange(false);
          onDeleted?.();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-zinc-100">
            Delete project?
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400 pt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-zinc-300">&quot;{project.name}&quot;</span>?
            All tasks inside will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
