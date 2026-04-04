"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useDeleteTask } from "@/modules/tasks/hooks/useTasks";

// =====================================================
// DELETE TASK MODAL
// =====================================================

interface DeleteTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTitle: string;
  projectId: string;
}

export function DeleteTaskModal({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  projectId,
}: DeleteTaskModalProps) {
  const deleteTaskMutation = useDeleteTask();

  const handleDelete = () => {
    deleteTaskMutation.mutate(
      { taskId, projectId },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-110 bg-zinc-900 border-zinc-800 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-zinc-100">
            Delete task?
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400 pt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-zinc-300">
              `&quot;`{taskTitle}`&quot;`
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteTaskMutation.isPending}
            className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleteTaskMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {deleteTaskMutation.isPending ? "Deleting..." : "Delete task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
