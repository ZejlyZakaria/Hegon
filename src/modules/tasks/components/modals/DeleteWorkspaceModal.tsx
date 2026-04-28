"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useDeleteWorkspace } from "@/modules/tasks/hooks/useWorkspaces";
import type { Workspace } from "@/modules/tasks/types";

interface DeleteWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace;
  onDeleted?: () => void;
}

export function DeleteWorkspaceModal({
  open,
  onOpenChange,
  workspace,
  onDeleted,
}: DeleteWorkspaceModalProps) {
  const deleteMutation = useDeleteWorkspace();

  const handleDelete = () => {
    deleteMutation.mutate(workspace.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-surface-3 border-border-strong rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            Delete workspace?
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary pt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-text-primary">&quot;{workspace.name}&quot;</span>?
            All projects and tasks inside will be permanently deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
