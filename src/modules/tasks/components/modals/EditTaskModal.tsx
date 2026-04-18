/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, MoreHorizontal } from "lucide-react";
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
import { TagSelector } from "@/modules/tasks/components/shared/TagSelector";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import type {
  Task,
  Priority,
} from "@/modules/tasks/types"

// =====================================================
// VALIDATION SCHEMA
// =====================================================

const editTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  due_date: z.date().optional().nullable(),
  status_id: z.string().min(1, "Status is required"),
  estimated_hours: z.number().min(0).optional().nullable(),
});

type EditTaskFormData = z.infer<typeof editTaskSchema>;

// =====================================================
// COMPONENT
// =====================================================

interface EditTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function EditTaskModal({
  open,
  onOpenChange,
  task,
}: EditTaskModalProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const updateTaskMutation = useUpdateTask();
  const { data: statuses } = useStatuses(task.project_id);
  const addTagMutation = useAddTagToTask(task.project_id);
  const removeTagMutation = useRemoveTagFromTask(task.project_id);

  // Track last saved values to avoid duplicate/unnecessary saves
  // due_date is normalized via toISOString() to match autoSave's computed value
  const lastSaved = useRef({
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
    status_id: task.status_id,
    estimated_hours: task.estimated_hours ?? null,
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
    },
  });

  // Reset form + lastSaved ref when modal opens with new task data
  useEffect(() => {
    if (open) {
      form.reset({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        due_date: task.due_date ? new Date(task.due_date) : null,
        status_id: task.status_id,
        estimated_hours: task.estimated_hours || null,
      });
      lastSaved.current = {
        title: task.title,
        description: task.description ?? null,
        priority: task.priority,
        due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
        status_id: task.status_id,
        estimated_hours: task.estimated_hours ?? null,
      };
    }
  }, [open, task.id]); // Only depend on open and task.id to avoid infinite loops

  // Auto-save — only fires if values actually changed since last save
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

    const hasChanges =
      title !== lastSaved.current.title ||
      description !== lastSaved.current.description ||
      priority !== lastSaved.current.priority ||
      due_date !== lastSaved.current.due_date ||
      status_id !== lastSaved.current.status_id ||
      estimated_hours !== lastSaved.current.estimated_hours;

    if (!hasChanges) return;

    // Update ref before mutating so re-entrant calls don't double-save
    lastSaved.current = { title, description, priority, due_date, status_id, estimated_hours };

    updateTaskMutation.mutate({
      id: task.id,
      project_id: task.project_id,
      title,
      description,
      priority,
      due_date,
      status_id,
      estimated_hours,
    });
  };

  // Handle modal close
  const handleOpenChange = async (open: boolean) => {
    if (!open) {
      // Validate before closing
      const isValid = await form.trigger();

      if (!isValid) {
        // Block close if invalid
        return;
      }

      // Save if valid
      await autoSave();
    }

    onOpenChange(open);
  };

  // Prevent close on ESC if form invalid
  const handleEscapeKeyDown = async (e: Event) => {
    const isValid = await form.trigger();
    if (!isValid) {
      e.preventDefault();
    }
  };

  // Prevent close on outside click if form invalid
  const handlePointerDownOutside = async (e: Event) => {
    const isValid = await form.trigger();
    if (!isValid) {
      e.preventDefault();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-150 bg-zinc-900 border-zinc-800 rounded-xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={handleEscapeKeyDown}
        onPointerDownOutside={handlePointerDownOutside}
      >
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base font-medium text-zinc-100">
              Edit task
            </DialogTitle>

            {/* Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-10 h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-md bg-zinc-900 border-zinc-800"
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
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Title
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="Task title..."
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-zinc-400">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="Add details..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 1: Priority + Status */}
            <div className="grid grid-cols-2 gap-3">
              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Priority
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger variant="tasks">
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

              {/* Status */}
              <FormField
                control={form.control}
                name="status_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Status
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger variant="tasks">
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

            {/* Tags — immediate mutations, outside form auto-save */}
            <TagSelector
              selectedTags={task.tags}
              onAdd={(tagId) => addTagMutation.mutate({ taskId: task.id, tagId })}
              onRemove={(tagId) => removeTagMutation.mutate({ taskId: task.id, tagId })}
            />

            {/* Row 2: Due Date + Estimated Hours */}
            <div className="grid grid-cols-2 gap-3">
              {/* Due Date */}
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Due date
                    </FormLabel>
                    <Popover
                      open={isCalendarOpen}
                      onOpenChange={setIsCalendarOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              "bg-zinc-800/50 border-zinc-700/50",
                              "text-zinc-100 hover:bg-zinc-800/50 hover:text-zinc-100",
                              "focus-visible:ring-1 focus-visible:ring-zinc-700",
                              !field.value && "text-zinc-600",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "MMM d, yyyy")
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-zinc-900 border-zinc-800"
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
                          className="bg-zinc-900"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Estimated Hours */}
              <FormField
                control={form.control}
                name="estimated_hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-zinc-400">
                      Estimated hours
                    </FormLabel>
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
          // Si delete réussi, fermer aussi le Edit modal
          if (!open && !isDeleteModalOpen) {
            onOpenChange(false);
          }
        }}
        taskId={task.id}
        taskTitle={task.title}
        projectId={task.project_id}
      />
    </Dialog>
  );
}
