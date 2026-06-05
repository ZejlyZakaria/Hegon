"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarIcon, Check, MoreHorizontal, Pencil, Send, Target, Trash2, User, X } from "lucide-react";
import Image from "next/image";
import { format, formatDistanceToNow, isPast } from "date-fns";

import { useTasksStore } from "@/modules/tasks/store";
import { useCurrentUserId } from "@/shared/hooks/useCurrentUserId";
import { useTasks, useUpdateTask } from "@/modules/tasks/hooks/useTasks";
import { useStatuses } from "@/modules/tasks/hooks/useStatuses";
import { useProjectAssignees } from "@/modules/tasks/hooks/useOrgMembers";
import { useAddTagToTask, useRemoveTagFromTask } from "@/modules/tasks/hooks/useTags";
import { useGoals } from "@/modules/goals/hooks/useGoals";
import { useHabits } from "@/modules/habits/hooks/useHabits";
import { useRealtimeHabits } from "@/modules/habits/hooks/useRealtimeHabits";
import { resolveIcon } from "@/shared/constants/icons";
import { TagSelector } from "@/modules/tasks/components/shared/TagSelector";
import { MemberAvatar } from "@/modules/tasks/components/shared/MemberAvatar";
import { PriorityIcon } from "@/shared/components/icons/PriorityIcon";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import { DeleteTaskModal } from "@/modules/tasks/components/modals/DeleteTaskModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Calendar as DatePicker } from "@/shared/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  useTaskActivities,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
} from "@/modules/tasks/hooks/useTaskActivities";
import {
  useSubTasks,
  useCreateSubTask,
  useToggleSubTask,
  useDeleteSubTask,
} from "@/modules/tasks/hooks/useSubTasks";
import { cn } from "@/shared/utils/utils";
import type { Task, TaskActivity, Priority, Assignee } from "@/modules/tasks/types";

const SPRING = { type: "spring", damping: 30, stiffness: 280 } as const;
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

// ─────────────────────────────────────────────────────────────────────────────
// Activity grouping types & logic
// ─────────────────────────────────────────────────────────────────────────────

type ActivityGroupItem = {
  type: "group";
  user: TaskActivity["user"];
  user_id: string;
  activities: TaskActivity[];
  latest_at: string;
};
type DisplayItem = ActivityGroupItem | { type: "single"; activity: TaskActivity };

function buildDisplayItems(activities: TaskActivity[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const a of activities) {
    if (a.action === "commented") {
      items.push({ type: "single", activity: a });
      continue;
    }
    const prev = items[items.length - 1];
    if (
      prev?.type === "group" &&
      prev.user_id === a.user_id &&
      Math.abs(new Date(prev.latest_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60 * 1000
    ) {
      prev.activities.push(a);
    } else {
      items.push({ type: "group", user: a.user, user_id: a.user_id, activities: [a], latest_at: a.created_at });
    }
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich text renderer — **bold**, `code`, @mention
// ─────────────────────────────────────────────────────────────────────────────

function renderCommentText(text: string) {
  // @[Full Name] matches picker-inserted mentions (supports spaces), @\S+ matches plain @word
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|@\[[^\]]+\]|@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[11px] text-text-secondary">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    if (part.startsWith("@[") && part.endsWith("]"))
      return <span key={i} className="font-medium text-blue-400">@{part.slice(2, -1)}</span>;
    if (part.startsWith("@") && part.length > 1)
      return <span key={i} className="font-medium text-blue-400">{part}</span>;
    return part;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Root — reads from store, handles open/close
// ─────────────────────────────────────────────────────────────────────────────

export function TaskDetailPanel() {
  const { isEditModalOpen, editingTaskId, selectedProjectId, closeEditModal } = useTasksStore();

  const { data: tasks } = useTasks(isEditModalOpen ? selectedProjectId : null);
  const task = tasks?.find((t) => t.id === editingTaskId) ?? null;

  useEffect(() => {
    if (!isEditModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") closeEditModal(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditModalOpen, closeEditModal]);

  useEffect(() => {
    if (isEditModalOpen && editingTaskId && tasks !== undefined && !task) closeEditModal();
  }, [task, tasks, isEditModalOpen, editingTaskId, closeEditModal]);

  return (
    <AnimatePresence>
      {isEditModalOpen && task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closeEditModal}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={SPRING}
            className="fixed right-0 top-0 z-50 flex h-full w-120 flex-col border-l border-border-strong bg-surface-2"
          >
            <PanelContent key={task.id} task={task} onClose={closeEditModal} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PanelContent — only rendered when a task is available
// ─────────────────────────────────────────────────────────────────────────────

function PanelContent({ task, onClose }: { task: Task; onClose: () => void }) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isGoalOpen, setIsGoalOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "comments" | "events">("all");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const currentUserId = useCurrentUserId();
  const [newSubTask, setNewSubTask] = useState("");

  const [localTitle, setLocalTitle] = useState(task.title);
  const [localDesc, setLocalDesc] = useState(task.description ?? "");
  const savedTitle = useRef(task.title);
  const savedDesc = useRef(task.description ?? "");
  const titleEl = useRef<HTMLTextAreaElement>(null);
  const descEl = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  const updateTask = useUpdateTask();
  const addCommentMutation = useAddComment(task.id);
  const { data: activities } = useTaskActivities(task.id);
  const { data: statuses = [] } = useStatuses(task.project_id);
  const { data: assignees = [] } = useProjectAssignees(task.project_id);
  const { data: goals = [] } = useGoals();
  const { data: habits = [] } = useHabits();
  useRealtimeHabits();
  const addTag = useAddTagToTask(task.project_id);
  const removeTag = useRemoveTagFromTask(task.project_id);

  const { data: subTasks = [] } = useSubTasks(task.id);
  const createSubTaskMutation = useCreateSubTask(task.id, task.project_id);
  const toggleSubTask = useToggleSubTask(task.id);
  const deleteSubTask = useDeleteSubTask(task.id, task.project_id);

  useEffect(() => {
    if (!titleEl.current) return;
    titleEl.current.style.height = "auto";
    titleEl.current.style.height = `${titleEl.current.scrollHeight}px`;
  }, [localTitle]);

  useEffect(() => {
    if (!descEl.current) return;
    descEl.current.style.height = "auto";
    descEl.current.style.height = `${descEl.current.scrollHeight}px`;
  }, [localDesc]);

  const mentionMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return assignees.filter((m) =>
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    ).slice(0, 5);
  }, [mentionQuery, assignees]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    switch (filterMode) {
      case "comments": return activities.filter((a) => a.action === "commented");
      case "events":   return activities.filter((a) => a.action !== "commented");
      default:         return activities;
    }
  }, [activities, filterMode]);

  const displayItems = useMemo(() => buildDisplayItems(filteredActivities), [filteredActivities]);

  function patch(fields: { [K in keyof Task]?: Task[K] }) {
    updateTask.mutate({ id: task.id, project_id: task.project_id, ...fields });
  }

  function handleTitleBlur() {
    const trimmed = localTitle.trim();
    if (!trimmed) { setLocalTitle(savedTitle.current); return; }
    if (trimmed !== savedTitle.current) { savedTitle.current = trimmed; patch({ title: trimmed }); }
  }

  function handleDescBlur() {
    const next = localDesc.trim() || null;
    const prev = savedDesc.current || null;
    if (next !== prev) { savedDesc.current = next ?? ""; patch({ description: next }); }
  }

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setComment(val);
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1 && !textBefore.slice(atIdx + 1).includes(" ")) {
      setMentionQuery(textBefore.slice(atIdx + 1));
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: Assignee) {
    const cursor = commentRef.current?.selectionStart ?? comment.length;
    const textBefore = comment.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    const name = member.full_name ?? member.email ?? "";
    const newText = comment.slice(0, atIdx) + `@[${name}] ` + comment.slice(cursor);
    setComment(newText);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (commentRef.current) {
        const pos = atIdx + name.length + 4; // @[ + name + ] + space
        commentRef.current.focus();
        commentRef.current.setSelectionRange(pos, pos);
      }
    });
  }

  function submitComment() {
    const trimmed = comment.trim();
    if (!trimmed || addCommentMutation.isPending) return;
    addCommentMutation.mutate(trimmed);
    setComment("");
    setMentionQuery(null);
  }

  const currentStatus = statuses.find((s) => s.id === task.status_id);
  const currentAssignee = assignees.find((m) => m.id === task.assignee_id) ?? null;
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = !!dueDate && isPast(dueDate) && !currentStatus?.is_completed;
  const activeGoals = goals.filter((g) => g.status === "active" || g.id === task.goal_id);
  const currentGoal = goals.find((g) => g.id === task.goal_id) ?? null;
  const firstStatus = statuses.find((s) => !s.is_completed);
  const completedStatus = statuses.find((s) => s.is_completed);
  const doneSubTasksCount = subTasks.filter((s) => statuses.find((st) => st.id === s.status_id)?.is_completed).length;
  const relatedHabits = task.goal_id ? habits.filter((h) => h.goal_id === task.goal_id) : [];

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-strong px-4">
        <span className="text-xs text-text-tertiary">{task.project?.name ?? "Task"}</span>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary">
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-surface-3 border-border-strong">
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-500/10"
                onClick={() => setIsDeleteOpen(true)}
              >
                <Trash2 size={12} />
                Delete task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Title */}
        <div className="px-5 pb-4 pt-5">
          <textarea
            ref={titleEl}
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); titleEl.current?.blur(); } }}
            rows={1}
            placeholder="Task title…"
            className="w-full resize-none overflow-hidden bg-transparent text-[17px] font-semibold leading-snug text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </div>

        {/* Properties */}
        <div className="border-t border-border-subtle px-5">

          {/* Status */}
          <Prop label="Status">
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3">
                  <StatusIcon status={currentStatus} size={13} />
                  {currentStatus?.name ?? "No status"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-48 p-1 bg-surface-3 border-border-strong">
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => patch({ status_id: s.id })}
                    className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors", task.status_id === s.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                  >
                    <StatusIcon status={s} size={13} />
                    {s.name}
                    {task.status_id === s.id && <Check size={11} className="ml-auto" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Priority */}
          <Prop label="Priority">
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs capitalize text-text-secondary transition-colors hover:bg-surface-3">
                  <PriorityIcon priority={task.priority} />
                  {task.priority}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-40 p-1 bg-surface-3 border-border-strong">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ priority: p })}
                    className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs capitalize transition-colors", task.priority === p ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                  >
                    <PriorityIcon priority={p} />
                    {p}
                    {task.priority === p && <Check size={11} className="ml-auto" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Assignee */}
          <Prop label="Assignee">
            <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3">
                  {currentAssignee ? (
                    <><MemberAvatar member={currentAssignee} size="sm" />{currentAssignee.full_name ?? currentAssignee.email}</>
                  ) : (
                    <><User size={13} className="text-text-tertiary" /><span className="text-text-tertiary">Unassigned</span></>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-52 p-1 bg-surface-3 border-border-strong">
                <button
                  type="button"
                  onClick={() => { patch({ assignee_id: null }); setIsAssigneeOpen(false); }}
                  className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors", !task.assignee_id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                >
                  <User size={13} />Unassigned
                  {!task.assignee_id && <Check size={11} className="ml-auto" />}
                </button>
                {assignees.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { patch({ assignee_id: m.id }); setIsAssigneeOpen(false); }}
                    className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors", task.assignee_id === m.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                  >
                    <MemberAvatar member={m} size="sm" />
                    {m.full_name ?? m.email}
                    {task.assignee_id === m.id && <Check size={11} className="ml-auto" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Start date */}
          <Prop label="Start date">
            <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-3", task.start_date ? "text-text-secondary" : "text-text-tertiary")}>
                  <CalendarIcon size={13} />
                  {task.start_date ? format(new Date(task.start_date), "MMM d, yyyy") : "No start date"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0 bg-surface-3 border-border-strong">
                <DatePicker
                  mode="single"
                  selected={task.start_date ? new Date(task.start_date) : undefined}
                  onSelect={(d) => { patch({ start_date: d ? d.toISOString() : null }); setIsStartDateOpen(false); }}
                  disabled={(d) => {
                    if (!task.due_date) return false;
                    const due = new Date(task.due_date);
                    if (isPast(due)) return false;
                    return d > due;
                  }}
                  className="bg-surface-3"
                />
                {task.start_date && (
                  <div className="border-t border-border-subtle p-2">
                    <button type="button" onClick={() => { patch({ start_date: null }); setIsStartDateOpen(false); }} className="w-full rounded px-2 py-1 text-left text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary">
                      Clear start date
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Due date */}
          <Prop label="Due date">
            <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
              <PopoverTrigger asChild>
                <button type="button" className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-3", overdue ? "text-[#ef4444]" : dueDate ? "text-text-secondary" : "text-text-tertiary")}>
                  <CalendarIcon size={13} />
                  {dueDate ? format(dueDate, "MMM d, yyyy") : "No due date"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0 bg-surface-3 border-border-strong">
                <DatePicker mode="single" selected={dueDate ?? undefined} onSelect={(d) => { patch({ due_date: d ? d.toISOString() : null }); setIsDateOpen(false); }} disabled={(d) => !!task.start_date && d < new Date(task.start_date)} className="bg-surface-3" />
                {dueDate && (
                  <div className="border-t border-border-subtle p-2">
                    <button type="button" onClick={() => { patch({ due_date: null }); setIsDateOpen(false); }} className="w-full rounded px-2 py-1 text-left text-xs text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary">
                      Clear due date
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </Prop>

          {/* Goal */}
          {activeGoals.length > 0 && (
            <Prop label="Goal">
              <Popover open={isGoalOpen} onOpenChange={setIsGoalOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-3">
                    <Target size={13} className={currentGoal ? "text-[#22c55e]" : "text-text-tertiary"} />
                    {currentGoal ? <span className="max-w-45 truncate">{currentGoal.title}</span> : <span className="text-text-tertiary">No goal</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-1 bg-surface-3 border-border-strong">
                  <button
                    type="button"
                    onClick={() => { patch({ goal_id: null }); setIsGoalOpen(false); }}
                    className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors", !task.goal_id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                  >
                    No goal
                    {!task.goal_id && <Check size={11} className="ml-auto" />}
                  </button>
                  {activeGoals.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { patch({ goal_id: g.id }); setIsGoalOpen(false); }}
                      className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors", task.goal_id === g.id ? "bg-surface-2 text-text-primary" : "text-text-secondary hover:bg-surface-2")}
                    >
                      <Target size={12} className="shrink-0 text-[#22c55e]" />
                      <span className="truncate">{g.title}</span>
                      {task.goal_id === g.id && <Check size={11} className="ml-auto shrink-0" />}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </Prop>
          )}

          {/* Tags */}
          <Prop label="Tags">
            <TagSelector
              projectId={task.project_id}
              selectedTags={task.tags ?? []}
              onAdd={(tagId) => addTag.mutate({ taskId: task.id, tagId })}
              onRemove={(tagId) => removeTag.mutate({ taskId: task.id, tagId })}
              inline
            />
          </Prop>
        </div>

        {/* Description */}
        <div className="border-t border-border-subtle px-5 py-4">
          <p className="mb-2 text-xs font-medium text-text-tertiary">Description</p>
          <textarea
            ref={descEl}
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
            onBlur={handleDescBlur}
            placeholder="Add a description…"
            rows={3}
            className="w-full resize-none overflow-hidden rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.5 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary transition-colors focus:border-border-focus"
          />
        </div>

        {/* Sub-tasks */}
        <div className="border-t border-border-subtle px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Sub-tasks</p>
            {subTasks.length > 0 && (
              <span className="tabular-nums text-[10px] text-text-tertiary">
                {doneSubTasksCount}/{subTasks.length} done
              </span>
            )}
          </div>

          {subTasks.length > 0 && (
            <div className="mb-2 -mx-2">
              {subTasks.map((sub) => {
                const isDone = !!statuses.find((st) => st.id === sub.status_id)?.is_completed;
                return (
                  <SubTaskRow
                    key={sub.id}
                    title={sub.title}
                    isDone={isDone}
                    onToggle={() =>
                      toggleSubTask.mutate({
                        subtaskId: sub.id,
                        projectId: task.project_id,
                        statusId: isDone
                          ? (firstStatus?.id ?? sub.status_id)
                          : (completedStatus?.id ?? sub.status_id),
                      })
                    }
                    onDelete={() => deleteSubTask.mutate(sub.id)}
                  />
                );
              })}
            </div>
          )}

          <input
            value={newSubTask}
            onChange={(e) => setNewSubTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSubTask.trim() && firstStatus) {
                e.preventDefault();
                createSubTaskMutation.mutate({ title: newSubTask.trim(), statusId: firstStatus.id });
                setNewSubTask("");
              }
              if (e.key === "Escape") setNewSubTask("");
            }}
            placeholder="Add sub-task…"
            className="w-full rounded-lg border border-transparent bg-surface-1 px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-tertiary transition-colors focus:border-border-focus"
          />
        </div>

        {/* Context — only when a goal is linked */}
        {currentGoal && (
          <div className="border-t border-border-subtle px-5 py-4">
            <p className="mb-3 text-xs font-medium text-text-tertiary">Context</p>

            {/* Goal card */}
            <div className="mb-3 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Target size={13} className="shrink-0 text-[#22c55e]" />
                <span className="flex-1 truncate text-xs font-medium text-text-primary">{currentGoal.title}</span>
                <span className="tabular-nums text-[11px] font-medium text-[#22c55e]">{currentGoal.progress}%</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-1 rounded-full bg-[#22c55e] transition-[width] duration-500"
                  style={{ width: `${currentGoal.progress}%` }}
                />
              </div>
              {currentGoal.target_date && (
                <p className="mt-1.5 text-[10px] text-text-tertiary">
                  Target: {format(new Date(currentGoal.target_date), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {/* Related habits */}
            {relatedHabits.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] text-text-tertiary">Habits supporting this goal</p>
                <div className="-mx-2 space-y-0.5">
                  {relatedHabits.map((habit) => {
                    const { icon: HabitIcon } = resolveIcon(habit.icon);
                    return (
                      <div
                        key={habit.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                      >
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                          style={{ backgroundColor: `${habit.color}25` }}
                        >
                          <HabitIcon size={11} style={{ color: habit.color }} />
                        </div>
                        <span className="text-xs text-text-secondary">{habit.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activity */}
        <div className="border-t border-border-subtle px-5 py-4">

          {/* Header + filter tabs */}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Activity</p>
            <div className="flex items-center gap-0.5">
              {(["all", "comments", "events"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                    filterMode === mode ? "bg-surface-3 text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Comment input with @mention picker */}
          <div className="relative mb-4">
            {mentionQuery !== null && mentionMembers.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 z-10 w-52 overflow-hidden rounded-lg border border-border-strong bg-surface-3 shadow-md">
                {mentionMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                  >
                    <MemberAvatar member={m} size="sm" />
                    {m.full_name ?? m.email}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={commentRef}
                value={comment}
                onChange={handleCommentChange}
                onKeyDown={(e) => {
                  if (mentionQuery !== null && mentionMembers.length > 0) {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); insertMention(mentionMembers[0]); return; }
                    if (e.key === "Escape") { setMentionQuery(null); return; }
                  }
                  if (e.key === "Enter" && !e.shiftKey && comment.trim() && mentionQuery === null) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
                placeholder="Add a comment… (@ to mention)"
                rows={1}
                className="flex-1 resize-none rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-xs leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary transition-colors focus:border-border-focus"
              />
              <button
                type="button"
                disabled={!comment.trim() || addCommentMutation.isPending}
                onClick={submitComment}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>

          {/* Activity feed */}
          {displayItems.length > 0 ? (
            <div className="space-y-3">
              {displayItems.map((item, i) => (
                <ActivityItem
                  key={item.type === "single" ? item.activity.id : `group-${i}`}
                  item={item}
                  currentUserId={currentUserId}
                  taskId={task.id}
                />
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-text-tertiary">No activity yet.</p>
          )}
        </div>
      </div>

      <DeleteTaskModal
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDeleted={onClose}
        taskId={task.id}
        taskTitle={task.title}
        projectId={task.project_id}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Prop — label + control row
// ─────────────────────────────────────────────────────────────────────────────

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-border-subtle last:border-0">
      <span className="w-20 shrink-0 text-xs text-text-tertiary">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge / PriorityBadge — inline pills for activity events
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-surface-3 text-[10px] font-medium text-text-secondary">
      <StatusIcon status={{ type: "todo", color: "#6b7280" }} size={9} />
      {name}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-surface-3 text-[10px] font-medium text-text-secondary capitalize">
      <PriorityIcon priority={priority as Priority} />
      {priority}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// formatAction — rich ReactNode for system events
// ─────────────────────────────────────────────────────────────────────────────

function formatAction(activity: TaskActivity) {
  const { action, changes } = activity;
  switch (action) {
    case "created":
      return "created this task";
    case "title_changed":
      return <span>renamed to <span className="font-medium text-text-primary">&ldquo;{changes.to as string}&rdquo;</span></span>;
    case "status_changed":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          moved
          <StatusBadge name={changes.from as string} />
          <span className="text-text-tertiary">→</span>
          <StatusBadge name={changes.to as string} />
        </span>
      );
    case "priority_changed":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          changed priority
          <PriorityBadge priority={changes.from as string} />
          <span className="text-text-tertiary">→</span>
          <PriorityBadge priority={changes.to as string} />
        </span>
      );
    case "assigned":   return "assigned this task";
    case "unassigned": return "removed assignee";
    case "due_date_set":
      return <span>set due date to <span className="font-medium text-text-primary">{format(new Date(changes.to as string), "MMM d")}</span></span>;
    case "due_date_cleared":   return "cleared due date";
    case "goal_linked":        return "linked a goal";
    case "goal_unlinked":      return "unlinked goal";
    default:                   return action;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UserDot — avatar or initial
// ─────────────────────────────────────────────────────────────────────────────

function UserDot({ user }: { user?: TaskActivity["user"] }) {
  if (user?.avatar_url) {
    return <Image src={user.avatar_url} alt="" width={20} height={20} className="mt-0.5 h-5 w-5 shrink-0 rounded-full object-cover" />;
  }
  const initial = (user?.full_name ?? user?.email ?? "?")[0].toUpperCase();
  return (
    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-medium text-text-secondary">
      {initial}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommentBubble — editable/deletable by author
// ─────────────────────────────────────────────────────────────────────────────

function CommentBubble({ activity, isOwn, taskId }: { activity: TaskActivity; isOwn: boolean; taskId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState((activity.changes.text as string) ?? "");
  const [isHovered, setIsHovered] = useState(false);
  const updateComment = useUpdateComment(taskId);
  const deleteComment = useDeleteComment(taskId);

  const name = activity.user?.full_name ?? activity.user?.email ?? "Someone";
  const time = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  return (
    <div className="flex gap-2" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <UserDot user={activity.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text-primary">{name}</span>
          <span className="text-[10px] text-text-tertiary">{time}</span>
          {isOwn && !isEditing && (
            <div className={cn("ml-auto flex items-center gap-1 transition-opacity duration-100", isHovered ? "opacity-100" : "opacity-0")}>
              <button
                type="button"
                onClick={() => { setIsEditing(true); setEditText((activity.changes.text as string) ?? ""); }}
                className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
              >
                <Pencil size={10} />
              </button>
              <button
                type="button"
                onClick={() => deleteComment.mutate(activity.id)}
                className="flex h-5 w-5 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (editText.trim()) { updateComment.mutate({ activityId: activity.id, text: editText.trim() }); setIsEditing(false); }
                }
                if (e.key === "Escape") setIsEditing(false);
              }}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-border-focus bg-surface-1 px-3 py-2 text-xs leading-relaxed text-text-primary outline-none"
            />
            <div className="flex gap-3 text-[10px]">
              <button
                type="button"
                onClick={() => { if (editText.trim()) { updateComment.mutate({ activityId: activity.id, text: editText.trim() }); setIsEditing(false); } }}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Save
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="text-text-tertiary transition-colors hover:text-text-primary">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 rounded-lg bg-surface-1 px-3 py-2 text-xs leading-relaxed text-text-primary">
            {renderCommentText((activity.changes.text as string) ?? "")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupedEventEntry — consecutive system events from same user, same 5-min window
// ─────────────────────────────────────────────────────────────────────────────

function GroupedEventEntry({ group }: { group: ActivityGroupItem }) {
  const name = group.user?.full_name ?? group.user?.email ?? "Someone";
  const time = formatDistanceToNow(new Date(group.latest_at), { addSuffix: true });

  return (
    <div className="flex items-start gap-2">
      <UserDot user={group.user} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-xs font-medium text-text-primary">{name}</span>
          <span className="text-[10px] text-text-tertiary">{time}</span>
        </div>
        <div className="space-y-0.5">
          {group.activities.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-text-secondary">
              {formatAction(a)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityItem — routes to CommentBubble or GroupedEventEntry
// ─────────────────────────────────────────────────────────────────────────────

function ActivityItem({ item, currentUserId, taskId }: { item: DisplayItem; currentUserId: string | null; taskId: string }) {
  if (item.type === "single") {
    return <CommentBubble activity={item.activity} isOwn={item.activity.user_id === currentUserId} taskId={taskId} />;
  }
  return <GroupedEventEntry group={item} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SubTaskRow — checkbox + title + delete on hover
// ─────────────────────────────────────────────────────────────────────────────

function SubTaskRow({
  title,
  isDone,
  onToggle,
  onDelete,
}: {
  title: string;
  isDone: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          isDone ? "border-text-tertiary bg-surface-3" : "border-border-strong hover:border-text-tertiary"
        )}
      >
        {isDone && <Check size={9} className="text-text-tertiary" />}
      </button>
      <span className={cn("flex-1 text-xs leading-tight", isDone ? "text-text-tertiary line-through" : "text-text-primary")}>
        {title}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded text-text-tertiary transition-opacity hover:text-red-400",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <X size={10} />
      </button>
    </div>
  );
}
