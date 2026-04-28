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

const ACCENT = "var(--color-accent-tasks)";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

type FormData = { name: string };

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  project?: Project;
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
      <DialogContent className="sm:max-w-md bg-surface-3 border-border-strong">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
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
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="e.g. Website Redesign, Q2 Goals..."
                      autoFocus
                      className="bg-surface-overlay focus:border-border-focus"
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
                className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {isPending
                  ? isEdit ? "Saving..." : "Creating..."
                  : isEdit ? "Save" : "Create project"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
