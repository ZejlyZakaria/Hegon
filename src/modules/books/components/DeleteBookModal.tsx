"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useDeleteBook } from "../hooks/useBooks";

interface DeleteBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  onDeleted?: () => void;
}

export function DeleteBookModal({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  onDeleted,
}: DeleteBookModalProps) {
  const deleteMutation = useDeleteBook();

  const handleDelete = () => {
    deleteMutation.mutate(bookId, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-110 bg-[#1a1a1d] border-white/11 rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#e2e2e6]">
            Delete book?
          </DialogTitle>
          <DialogDescription className="text-sm text-[#a0a0a8] pt-2">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[#e2e2e6]">
              &quot;{bookTitle}&quot;
            </span>
            ? This action cannot be undone.
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
            {deleteMutation.isPending ? "Deleting..." : "Delete book"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
