"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/shared/utils/utils";

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
import { useTasksStore } from "@/modules/tasks/store";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import type { Project, StatusType } from "@/modules/tasks/types";

const ACCENT = "var(--color-accent-tasks)";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
});

type FormData = { name: string };

interface SelectableStatus {
  key: string;
  type: StatusType;
  label: string;
  color: string;
  icon: string;
  defaultOn: boolean;
}

const SELECTABLE: SelectableStatus[] = [
  { key: "backlog",     type: "backlog",     label: "Backlog",      color: "#6b7280", icon: "circle_dashed",       defaultOn: true  },
  { key: "todo",        type: "todo",        label: "Todo",          color: "#94a3b8", icon: "circle_empty",        defaultOn: true  },
  { key: "in_progress", type: "in_progress", label: "In Progress",   color: "#3b82f6", icon: "circle_quarter",      defaultOn: true  },
  { key: "in_review",   type: "in_progress", label: "In Review",     color: "#8b5cf6", icon: "circle_half",         defaultOn: false },
  { key: "qa",          type: "in_progress", label: "QA",            color: "#f97316", icon: "circle_three_quarter", defaultOn: false },
  { key: "done",        type: "done",        label: "Done",          color: "#22c55e", icon: "circle_check",        defaultOn: true  },
  { key: "cancelled",   type: "cancelled",   label: "Cancelled",     color: "#ef4444", icon: "circle_x",            defaultOn: false },
];

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
  const setSelectedProjectId = useTasksStore((s) => s.setSelectedProjectId);

  const defaultSelected = new Set(SELECTABLE.filter((s) => s.defaultOn).map((s) => s.key));
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(defaultSelected);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: project?.name || "" },
  });

  useEffect(() => {
    form.reset({ name: project?.name || "" });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedKeys(new Set(SELECTABLE.filter((s) => s.defaultOn).map((s) => s.key)));
  }, [project, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onSubmit = (data: FormData) => {
    if (isEdit) {
      updateMutation.mutate(
        { projectId: project.id, workspaceId, updates: { name: data.name.trim() } },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      const workflow = SELECTABLE
        .filter((s) => selectedKeys.has(s.key))
        .map((s) => ({ type: s.type, name: s.label, color: s.color, icon: s.icon }));

      createMutation.mutate(
        { workspace_id: workspaceId, name: data.name.trim(), workflow },
        {
          onSuccess: (newProject) => {
            setSelectedProjectId(newProject.id);
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
      <DialogContent className="sm:max-w-md bg-surface-2 border-border-strong">
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
                      placeholder="e.g. Website Redesign, Q2 Goals..."
                      autoFocus
                      className="bg-surface-overlay focus:border-border-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEdit && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-secondary">Workflow</p>
                <div className="flex flex-wrap gap-2">
                  {SELECTABLE.map((option) => {
                    const isOn = selectedKeys.has(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleKey(option.key)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                          isOn
                            ? "border-border-default bg-surface-2 text-text-primary"
                            : "border-border-subtle bg-transparent text-text-tertiary"
                        )}
                      >
                        <StatusIcon
                          status={{ type: option.type, color: isOn ? option.color : "#4b5563", icon: option.icon }}
                          size={12}
                        />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {selectedKeys.size === 0 && (
                  <p className="text-[10px] text-red-400">Select at least one status.</p>
                )}
                {selectedKeys.size > 0 && (
                  <p className="text-[10px] text-text-tertiary">
                    You can add or remove statuses later in project settings.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-8 px-3 border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-2"
              >
                Cancel
              </Button>
              <Button variant="legacy"
                type="submit"
                disabled={isPending || (!isEdit && selectedKeys.size === 0)}
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
