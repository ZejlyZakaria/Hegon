"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description = "This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
}: DeleteConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-surface-3 border-border-strong rounded-xl">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary pt-1">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 h-8 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 h-8 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
