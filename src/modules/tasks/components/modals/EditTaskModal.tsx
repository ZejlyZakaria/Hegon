/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Check, MoreHorizontal, User } from "lucide-react";
import { DeleteTaskModal } from "./DeleteTaskModal";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
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

import { useUpdateTask } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { useAddTagToTask, useRemoveTagFromTask } from "@/modules/tasks/hooks/useTags";
import { useProjectAssignees } from "@/modules/tasks/hooks/useOrgMembers";
import { TagSelector } from "@/modules/tasks/components/shared/TagSelector";
import { MemberAvatar } from "@/modules/tasks/components/shared/MemberAvatar";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import type { Task, Priority } from "@/modules/tasks/types";

const editTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  due_date: z.date().optional().nullable(),
  status_id: z.string().min(1, "Status is required"),
  estimated_hours: z.number().min(0).optional().nullable(),
  goal_id: z.string().optional().nullable(),
  assignee_id: z.string().optional().nullable(),
});

type EditTaskFormData = z.infer<typeof editTaskSchema>;

interface EditTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function EditTaskModal({ open, onOpenChange, task }: EditTaskModalProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const updateTaskMutation = useUpdateTask();
  const { data: statuses } = useStatuses(task.project_id);
  const addTagMutation = useAddTagToTask(task.project_id);
  const removeTagMutation = useRemoveTagFromTask(task.project_id);
  const { data: goals = [] } = useGoals();
  const { data: orgMembers = [] } = useProjectAssignees(task.project_id);

  const lastSaved = useRef({
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
    status_id: task.status_id,
    estimated_hours: task.estimated_hours ?? null,
    goal_id: task.goal_id ?? null,
    assignee_id: task.assignee_id ?? null,
  });

  const form = useForm<EditTaskFormData>({
    resolver: zodResolver(editTaskSchema),
    mode: "all",
    defaultValues: {
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date) : null,
      status_id: task.status_id,
      estimated_hours: task.estimated_hours || null,
      goal_id: task.goal_id ?? null,
      assignee_id: task.assignee_id ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        due_date: task.due_date ? new Date(task.due_date) : null,
        status_id: task.status_id,
        estimated_hours: task.estimated_hours || null,
        goal_id: task.goal_id ?? null,
        assignee_id: task.assignee_id ?? null,
      });
      lastSaved.current = {
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
        status_id: task.status_id,
        estimated_hours: task.estimated_hours ?? null,
        goal_id: task.goal_id ?? null,
        assignee_id: task.assignee_id ?? null,
      };
    }
  }, [open, task.id]);

  const autoSave = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    const values = form.getValues();
    const title = values.title.trim();
    const description = values.description?.trim() || null;
    const priority = values.priority as Priority;
    const due_date = values.due_date ? values.due_date.toISOString() : null;
    const status_id = values.status_id;
    const estimated_hours = values.estimated_hours || null;
    const goal_id = values.goal_id ?? null;
    const assignee_id = values.assignee_id ?? null;

    const hasChanges =
      title !== lastSaved.current.title ||
      description !== lastSaved.current.description ||
      priority !== lastSaved.current.priority ||
      due_date !== lastSaved.current.due_date ||
      status_id !== lastSaved.current.status_id ||
      estimated_hours !== lastSaved.current.estimated_hours ||
      goal_id !== lastSaved.current.goal_id ||
      assignee_id !== lastSaved.current.assignee_id;

    if (!hasChanges) return;

    lastSaved.current = { title, description, priority, due_date, status_id, estimated_hours, goal_id, assignee_id };

    updateTaskMutation.mutate({
      id: task.id,
      project_id: task.project_id,
      title,
      description,
      priority,
      due_date,
      status_id,
      estimated_hours,
      goal_id,
      assignee_id,
    });
  };

  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      const isValid = await form.trigger();
      if (!isValid) return;
      await autoSave();
    }
    onOpenChange(open);
  };

  const handleEscapeKeyDown = async (e: Event) => {
    const isValid = await form.trigger();
    if (!isValid) e.preventDefault();
  };

  const handlePointerDownOutside = async (e: Event) => {
    const isValid = await form.trigger();
    if (!isValid) e.preventDefault();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-150 bg-surface-3 border-border-strong rounded-xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={handleEscapeKeyDown}
        onPointerDownOutside={handlePointerDownOutside}
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Edit task
            </DialogTitle>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-10 h-8 w-8 p-0 text-text-tertiary hover:text-text-primary hover:bg-surface-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-md bg-surface-3 border-border-strong"
              >
                <DropdownMenuItem
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                >
                  Delete task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-text-secondary">Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="Task title..."
                      autoComplete="off"
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
                  <FormLabel className="text-xs font-medium text-text-secondary">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="Add details..."
                      rows={4}
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
                    <FormLabel className="text-xs font-medium text-text-secondary">Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                name="status_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-surface-overlay focus:border-border-focus">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        {statuses?.map((status) => (
                          <SelectItem key={status.id} value={status.id}>
                            <div className="flex items-center gap-2">
                              <StatusIcon status={status.name} size={14} />
                              <span>{status.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                                <span className="text-text-primary">
                                  {selectedMember.full_name ?? selectedMember.email}
                                </span>
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
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                              !field.value ? "text-text-primary bg-surface-2" : "text-text-secondary hover:bg-surface-2"
                            )}
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
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                                field.value === member.id ? "text-text-primary bg-surface-2" : "text-text-secondary hover:bg-surface-2"
                              )}
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

            {/* Tags */}
            <TagSelector
              projectId={task.project_id}
              selectedTags={task.tags}
              onAdd={(tagId) => addTagMutation.mutate({ taskId: task.id, tagId })}
              onRemove={(tagId) => removeTagMutation.mutate({ taskId: task.id, tagId })}
            />

            {/* Goal link */}
            {goals.filter((g) => g.status === "active" || g.id === task.goal_id).length > 0 && (
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
                          .filter((g) => g.status === "active" || g.id === task.goal_id)
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Due date</FormLabel>
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
                            {field.value ? format(field.value, "MMM d, yyyy") : <span>Pick a date</span>}
                          </button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-surface-3 border-border-strong" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(date) => { field.onChange(date ?? null); setIsCalendarOpen(false); }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className="bg-surface-3"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimated_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-text-secondary">Estimated hours</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        variant="tasks"
                        placeholder="0"
                        min="0"
                        step="0.5"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? null : parseFloat(val));
                        }}
                        autoComplete="off"
                        className="bg-surface-overlay focus:border-border-focus"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </DialogContent>
      <DeleteTaskModal
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          setIsDeleteModalOpen(open);
          if (!open && !isDeleteModalOpen) onOpenChange(false);
        }}
        taskId={task.id}
        taskTitle={task.title}
        projectId={task.project_id}
      />
    </Dialog>
  );
}
