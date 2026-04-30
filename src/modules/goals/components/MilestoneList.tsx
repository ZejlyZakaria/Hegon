/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/shared/utils/utils";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useReorderMilestones,
} from "../hooks/useMilestones";
import type { GoalMilestone } from "../types";
import { MilestoneListSkeleton } from "./GoalDetailSkeleton";

const ACCENT = "var(--color-accent-goals)";

interface Props {
  goalId: string;
}

interface RowProps {
  m: GoalMilestone;
  idx: number;
  completedCount: number;
  onToggle: (id: string, status: "pending" | "completed") => void;
  onDelete: (id: string) => void;
}

function SortableRow({ m, idx, completedCount, onToggle, onDelete }: RowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: m.id });

  const isActive = m.status !== "completed" && idx === completedCount;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5",
        isDragging && "bg-[#141416] shadow-lg shadow-black/40 z-50 relative border-white/4",
        !isDragging && m.status === "completed" && "border-white/4 bg-[#0e0e10] opacity-50",
        !isDragging && m.status !== "completed" && !isActive && "border-white/4 bg-[#0e0e10]",
        !isDragging && m.status !== "completed" && isActive && "border-white/[0.07] bg-[#141416]"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical
          size={12}
          className={cn(
            "transition-colors",
            isDragging ? "text-[#a0a0a8]" : "text-[#71717a] group-hover:text-[#a0a0a8]"
          )}
        />
      </div>

      <button
        type="button"
        onClick={() => onToggle(m.id, m.status)}
        className={cn(
          "shrink-0 h-4 w-4 rounded-full border transition-all flex items-center justify-center",
          m.status === "completed"
            ? "border-transparent"
            : "border-white/20 hover:border-white/30"
        )}
        style={
          m.status === "completed"
            ? { backgroundColor: ACCENT }
            : undefined
        }
      >
        {m.status === "completed" && <Check size={9} className="text-white" />}
      </button>

      <span
        className={cn(
          "flex-1 text-sm",
          m.status === "completed" ? "line-through text-[#71717a]" : "text-[#e2e2e6]"
        )}
      >
        {m.title}
      </span>

      {m.due_date && (
        <span className="text-[11px] text-[#71717a] shrink-0">
          {new Date(m.due_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}

      <button
        type="button"
        onClick={() => onDelete(m.id)}
        className="text-[#71717a] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function MilestoneList({ goalId }: Props) {
  const { data: milestones = [], isLoading } = useMilestones(goalId);
  const createMilestone   = useCreateMilestone(goalId);
  const updateMilestone   = useUpdateMilestone(goalId);
  const deleteMilestone   = useDeleteMilestone(goalId);
  const reorderMilestones = useReorderMilestones(goalId);

  const [newTitle, setNewTitle] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [ordered,  setOrdered]  = useState<GoalMilestone[]>(milestones);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    setOrdered(prev => {
      const unchanged =
        prev.length === milestones.length &&
        prev.every(
          (m, i) =>
            m.id === milestones[i]?.id &&
            m.status === milestones[i]?.status &&
            m.title === milestones[i]?.title
        );
      return unchanged ? prev : milestones;
    });
  }, [milestones]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const completedCount = ordered.filter((m) => m.status === "completed").length;

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await createMilestone.mutateAsync({
      goal_id:     goalId,
      title:       newTitle.trim(),
      order_index: ordered.length,
    });
    setNewTitle("");
    setAdding(false);
  }

  async function toggleComplete(id: string, current: "pending" | "completed") {
    await updateMilestone.mutateAsync({
      id,
      status:       current === "completed" ? "pending" : "completed",
      completed_at: current === "completed" ? null : new Date().toISOString(),
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    draggingRef.current = false;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((m) => m.id === active.id);
    const newIndex = ordered.findIndex((m) => m.id === over.id);
    const newOrder = arrayMove(ordered, oldIndex, newIndex);

    setOrdered(newOrder);
    reorderMilestones.mutate(
      newOrder.map((m, i) => ({ id: m.id, order_index: i }))
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717a]">
          The Path
        </h3>
        <span className="text-xs text-[#71717a]">
          {completedCount}/{ordered.length} completed
        </span>
      </div>

      {isLoading ? (
        <MilestoneListSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={() => { draggingRef.current = true; }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { draggingRef.current = false; }}
        >
          <SortableContext
            items={ordered.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {ordered.map((m, idx) => (
                <SortableRow
                  key={m.id}
                  m={m}
                  idx={idx}
                  completedCount={completedCount}
                  onToggle={toggleComplete}
                  onDelete={(id) => deleteMilestone.mutateAsync(id)}
                />
              ))}

              {adding ? (
                <div className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] px-3">
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") setAdding(false);
                    }}
                    placeholder="Milestone title…"
                    className="flex-1 bg-transparent text-sm text-[#e2e2e6] placeholder:text-[#71717a] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newTitle.trim()}
                    className="text-xs disabled:opacity-40"
                    style={{ color: ACCENT }}
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="text-xs text-[#71717a]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex h-9 items-center gap-2 w-full rounded-lg border border-dashed border-white/4 px-3 text-sm text-[#71717a] hover:text-[#a0a0a8] hover:border-white/[0.07] transition-colors"
                >
                  <Plus size={12} />
                  Add milestone
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}