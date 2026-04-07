"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { useCreateProject, useUpdateProject } from "@/modules/tasks/hooks/useProjects";
import type { Project } from "@/modules/tasks/types";

// =====================================================
// SCHEMA
// =====================================================

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

type FormData = { name: string };

// =====================================================
// COMPONENT
// =====================================================

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  project?: Project; // If provided → rename mode, else → create mode
}

export function ProjectModal({ open, onOpenChange, workspaceId, project }: ProjectModalProps) {
  const isEdit = !!project;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: project?.name || "" },
  });

  useEffect(() => {
    form.reset({ name: project?.name || "" });
  }, [project, open, form]);

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate(
        { projectId: project.id, workspaceId, updates: { name: data.name.trim() } },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createMutation.mutate(
        { workspace_id: workspaceId, name: data.name.trim() },
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
          },
        }
      );
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) form.reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-base font-medium text-zinc-100">
            {isEdit ? "Rename project" : "New project"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="e.g. Website Redesign, Q2 Goals..."
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {isPending ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save" : "Create project")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
