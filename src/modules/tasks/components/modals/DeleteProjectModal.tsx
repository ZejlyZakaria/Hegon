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
      <DialogContent className="sm:max-w-md bg-[#1a1a1d] border-white/11 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#e2e2e6]">
            Delete project?
          </DialogTitle>
          <DialogDescription className="text-sm text-[#a0a0a8] pt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[#e2e2e6]">&quot;{project.name}&quot;</span>?
            All tasks inside will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="h-8 px-3 border-white/[0.07] text-[#a0a0a8] hover:text-[#e2e2e6] hover:bg-[#141416]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
