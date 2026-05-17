"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { cn } from "@/shared/utils/utils";

import { useCreateTask } from "@/modules/tasks/hooks/useTasks";
import { useAddTagToTask } from "@/modules/tasks/hooks/useTags";
import { useProjectAssignees } from "@/modules/tasks/hooks/useOrgMembers";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { TagSelector } from "@/modules/tasks/components/shared/TagSelector";
import { MemberAvatar } from "@/modules/tasks/components/shared/MemberAvatar";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import type { CreateTaskInput, Priority } from "@/modules/tasks/types";
import { Check, User } from "lucide-react";

const ACCENT = "var(--color-accent-tasks)";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional().default("medium"),
  due_date: z.date().optional().nullable(),
  goal_id: z.string().optional().nullable(),
  assignee_id: z.string().optional().nullable(),
});

type CreateTaskFormData = {
  title: string;
  description?: string;
  priority?: "critical" | "high" | "medium" | "low";
  due_date?: Date | null;
  goal_id?: string | null;
  assignee_id?: string | null;
};

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  statusId: string;
  statusName: string;
}

export function CreateTaskModal({
  open,
  onOpenChange,
  projectId,
  statusId,
  statusName,
}: CreateTaskModalProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const createTaskMutation = useCreateTask();
  const addTagMutation = useAddTagToTask(projectId);
  const { data: goals = [] } = useGoals();
  const { data: orgMembers = [] } = useProjectAssignees(projectId);
  const currentUserId = useCurrentUserId();

  const form = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      due_date: undefined,
      goal_id: null,
      assignee_id: currentUserId ?? null,
    },
  });

  const onSubmit = async (data: CreateTaskFormData) => {
    const taskInput: CreateTaskInput = {
      project_id: projectId,
      status_id: statusId,
      title: data.title,
      description: data.description || null,
      priority: data.priority as Priority,
      due_date: data.due_date ? data.due_date.toISOString() : null,
      goal_id: data.goal_id || null,
      assignee_id: data.assignee_id || null,
    };

    createTaskMutation.mutate(taskInput, {
      onSuccess: (createdTask) => {
        selectedTagIds.forEach((tagId) => {
          addTagMutation.mutate({ taskId: createdTask.id, tagId });
        });
        form.reset({ title: "", description: "", priority: "medium", due_date: undefined, goal_id: null, assignee_id: currentUserId ?? null });
        setSelectedTagIds([]);
        onOpenChange(false);
      },
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      setSelectedTagIds([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-125 bg-surface-3 border-border-strong">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-text-primary">
            Create task in{" "}
            <span className="text-text-secondary">{statusName}</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Title
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="Task title..."
                      autoFocus
                      className="bg-surface-overlay focus:border-border-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="Add details..."
                      rows={3}
                      className="bg-surface-overlay focus:border-border-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Priority
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        {(["critical", "high", "medium", "low"] as Priority[]).map((p) => (
                          <SelectItem key={p} value={p}>
                            <div className="flex items-center gap-2">
                              <PriorityIcon priority={p} />
                              <span className="capitalize">{p}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Due date
                    </FormLabel>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            className={cn(
                              "w-full h-9 px-3 flex items-center gap-2 rounded-lg border border-border-default text-sm transition-colors",
                              "bg-surface-overlay hover:bg-surface-2",
                              field.value ? "text-text-primary" : "text-text-tertiary",
                            )}
                          >
                            <CalendarIcon size={14} className="shrink-0" />
                            {field.value ? (
                              format(field.value, "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-surface-3 border-border-strong"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(date) => {
                            field.onChange(date ?? null);
                            setIsCalendarOpen(false);
                          }}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                          className="bg-surface-3"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Goal link */}
            {goals.filter((g) => g.status === "active").length > 0 && (
              <FormField
                control={form.control}
                name="goal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">
                      Goal <span className="text-text-tertiary font-normal">(optional)</span>
                    </FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                          <SelectValue placeholder="No goal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="none">No goal</SelectItem>
                        {goals
                          .filter((g) => g.status === "active")
                          .map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Assignee */}
            <FormField
              control={form.control}
              name="assignee_id"
              render={({ field }) => {
                const selectedMember = orgMembers.find((m) => m.id === field.value) ?? null;
                return (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Assignee</FormLabel>
                    <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <button
                            type="button"
                            className="w-full h-9 px-3 flex items-center gap-2 rounded-lg border border-border-default bg-surface-overlay hover:bg-surface-2 text-sm transition-colors"
                          >
                            {selectedMember ? (
                              <>
                                <MemberAvatar member={selectedMember} size="sm" />
                                <span className="text-text-primary">{selectedMember.full_name ?? selectedMember.email}</span>
                              </>
                            ) : (
                              <>
                                <User size={14} className="text-text-tertiary shrink-0" />
                                <span className="text-text-tertiary">Unassigned</span>
                              </>
                            )}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-1 bg-surface-3 border-border-strong">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => { field.onChange(null); setIsAssigneeOpen(false); }}
                            className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors", !field.value ? "text-text-primary bg-surface-2" : "text-text-secondary hover:bg-surface-2")}
                          >
                            <User size={14} className="shrink-0" />
                            <span>Unassigned</span>
                            {!field.value && <Check size={12} className="ml-auto" />}
                          </button>
                          {orgMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => { field.onChange(member.id); setIsAssigneeOpen(false); }}
                              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors", field.value === member.id ? "text-text-primary bg-surface-2" : "text-text-secondary hover:bg-surface-2")}
                            >
                              <MemberAvatar member={member} size="sm" />
                              <span>{member.full_name ?? member.email}</span>
                              {field.value === member.id && <Check size={12} className="ml-auto" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                );
              }}
            />

            <TagSelector
              projectId={projectId}
              selectedIds={selectedTagIds}
              onChange={setSelectedTagIds}
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
                disabled={createTaskMutation.isPending}
                className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {createTaskMutation.isPending ? "Creating..." : "Create task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
