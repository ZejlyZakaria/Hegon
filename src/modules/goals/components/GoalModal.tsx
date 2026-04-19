"use client";

import { useEffect, useState } from "react";
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

import { useCreateGoal, useUpdateGoal } from "../hooks/useGoals";
import type { Goal, GoalCategory, GoalPriority } from "../types";

const goalSchema = z.object({
  title:       z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  category:    z.enum(["personal", "work", "health", "learning", "finance", "other", "none"]),
  priority:    z.enum(["low", "medium", "high", "critical"]),
  target_date: z.date().optional().nullable(),
});

type GoalFormData = {
  title:       string;
  description?: string;
  category:    "personal" | "work" | "health" | "learning" | "finance" | "other" | "none";
  priority:    "low" | "medium" | "high" | "critical";
  target_date?: Date | null;
};

interface Props {
  open:    boolean;
  onClose: () => void;
  goal?:   Goal;
}

const ACCENT = "var(--color-accent-goals)";

export function GoalModal({ open, onClose, goal }: Props) {
  const isEdit = !!goal;
  const [calendarOpen, setCalendarOpen] = useState(false);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title:       "",
      description: "",
      category:    "none",
      priority:    "medium",
      target_date: null,
    },
  });

  useEffect(() => {
    if (open && goal) {
      form.reset({
        title:       goal.title,
        description: goal.description ?? "",
        category:    goal.category ?? "none",
        priority:    goal.priority,
        target_date: goal.target_date ? new Date(goal.target_date) : null,
      });
    } else if (open && !goal) {
      form.reset({
        title:       "",
        description: "",
        category:    "none",
        priority:    "medium",
        target_date: null,
      });
    }
  }, [open, goal, form]);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      onClose();
    }
  };

  const onSubmit = async (data: GoalFormData) => {
    const input = {
      title:       data.title,
      description: data.description || null,
      category:    data.category === "none" ? null : data.category as GoalCategory,
      priority:    data.priority as GoalPriority,
      target_date: data.target_date ? data.target_date.toISOString().split("T")[0] : null,
    };

    if (isEdit && goal) {
      await updateGoal.mutateAsync({ id: goal.id, ...input });
    } else {
      await createGoal.mutateAsync(input);
    }
    handleOpenChange(false);
  };

  const isPending = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#1a1a1d] border-white/11">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-[#e2e2e6]">
            {isEdit ? "Edit Goal" : "New Goal"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                    Title <span style={{ color: ACCENT }}>*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      variant="tasks"
                      placeholder="e.g. Launch HEGON beta"
                      autoFocus
                      className="bg-[#1f1f22] focus:border-white/20"
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
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                    Description
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      variant="tasks"
                      placeholder="What does success look like?"
                      rows={2}
                      className="bg-[#1f1f22] focus:border-white/20"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                      Category
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-[#1f1f22] focus:border-white/20">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="none">No category</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="health">Health</SelectItem>
                        <SelectItem value="learning">Learning</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                      Priority
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger variant="tasks" className="w-full bg-[#1f1f22] focus:border-white/20">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent variant="tasks">
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="target_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-[#a0a0a8]">
                    Target date
                  </FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-8 justify-start text-left font-normal",
                            "bg-[#1f1f22] border-white/[0.07]",
                            "text-[#e2e2e6] hover:bg-[#1f1f22] hover:border-white/11",
                            "focus-visible:border-white/20",
                            !field.value && "text-[#71717a]"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-[#1a1a1d] border-white/11" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ?? undefined}
                        onSelect={(date) => {
                          field.onChange(date ?? null);
                          setCalendarOpen(false);
                        }}
                        initialFocus
                        className="bg-[#1a1a1d]"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="h-8 px-3 border-white/[0.07] text-[#a0a0a8] hover:text-[#e2e2e6] hover:bg-[#141416]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {isPending ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}