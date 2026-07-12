"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Info, Pencil, GripVertical } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui/tooltip";
import { ColorPalette } from "@/shared/components/ui/color-palette";
import { cn } from "@/shared/utils/utils";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { StatusIcon } from "@/shared/components/icons/StatusIcon";
import { renderStatusIcon, ALL_STATUS_ICON_KEYS, TYPE_TO_ICON_KEY, type StatusIconKey } from "@/shared/components/icons/status-icons";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useStatuses,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  useReorderStatuses,
} from "@/modules/tasks/hooks/useStatuses";
import type { Status, StatusType } from "@/modules/tasks/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { type: StatusType; label: string }[] = [
  { type: "backlog",     label: "Backlog"     },
  { type: "todo",        label: "Todo"        },
  { type: "in_progress", label: "In Progress" },
  { type: "done",        label: "Done"        },
  { type: "cancelled",   label: "Cancelled"   },
];

const TYPE_COLORS: Record<StatusType, string> = {
  backlog:     "#6b7280",
  todo:        "#94a3b8",
  in_progress: "#3b82f6",
  done:        "#22c55e",
  cancelled:   "#ef4444",
};


// ─── Icon picker ──────────────────────────────────────────────────────────────

function IconPicker({ selected, color, onSelect }: { selected: StatusIconKey; color: string; onSelect: (k: StatusIconKey) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1">
      {ALL_STATUS_ICON_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            selected === key ? "bg-surface-3 ring-1 ring-border-default" : "hover:bg-surface-2"
          )}
        >
          {renderStatusIcon(key, color, 14)}
        </button>
      ))}
    </div>
  );
}

// ─── Type selector (shared) ───────────────────────────────────────────────────

function TypeSelector({ type, color, icon, onChange }: {
  type: StatusType;
  color: string;
  icon: StatusIconKey;
  onChange: (t: StatusType) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onChange(opt.type)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-xs transition-colors",
            type === opt.type
              ? "border-border-default bg-surface-2 text-text-primary"
              : "border-transparent text-text-tertiary hover:bg-surface-2"
          )}
        >
          <StatusIcon status={{ type: opt.type, color: type === opt.type ? color : "#4b5563", icon: type === opt.type ? icon : null }} size={14} />
          <span className="text-[10px] leading-none">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Type info tooltip (shared) ───────────────────────────────────────────────

function TypeLabel() {
  return (
    <div className="flex items-center gap-1.5">
      <p className="text-[10px] text-text-tertiary">Type</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info size={11} className="text-text-tertiary cursor-default" />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6}>
          Le type définit si une tâche est <strong className="text-text-primary">terminée</strong>. Les types <strong className="text-text-primary">Done</strong> et <strong className="text-text-primary">Cancelled</strong> marquent les tâches comme complétées — elles disparaissent des vues actives.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function PaletteSection({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] text-text-tertiary">Color</p>
      <ColorPalette selected={color} onChange={onChange} />
    </div>
  );
}

// ─── Add form ─────────────────────────────────────────────────────────────────

interface AddFormProps {
  nextPosition: number;
  onCreate: (data: { name: string; type: StatusType; color: string; icon: string | null; position: number }) => void;
  isPending: boolean;
  onCancel: () => void;
}

function AddForm({ nextPosition, onCreate, isPending, onCancel }: AddFormProps) {
  const [name,  setName]  = useState("");
  const [type,  setType]  = useState<StatusType>("todo");
  const [color, setColor] = useState("#94a3b8");
  const [icon,  setIcon]  = useState<StatusIconKey>(TYPE_TO_ICON_KEY["todo"]);

  const handleTypeChange = (t: StatusType) => {
    setType(t);
    setColor(TYPE_COLORS[t]);
    setIcon(TYPE_TO_ICON_KEY[t]);
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-subtle)" }}
    >
      <p className="text-caption uppercase text-text-tertiary">
        New status
      </p>
      <Input variant="legacy" value={name} onChange={(e) => setName(e.target.value)} placeholder="Status name..." autoFocus className="h-8 text-xs" />
      <TypeLabel />
      <TypeSelector type={type} color={color} icon={icon} onChange={handleTypeChange} />
      <div>
        <p className="mb-1.5 text-[10px] text-text-tertiary">Icon</p>
        <IconPicker selected={icon} color={color} onSelect={setIcon} />
      </div>
      <PaletteSection color={color} onChange={setColor} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} className="h-7 px-3 text-xs text-text-secondary">Cancel</Button>
        <Button variant="legacy"
          type="button"
          disabled={isPending || !name.trim()}
          onClick={() => onCreate({ name: name.trim(), type, color, icon, position: nextPosition })}
          className="h-7 px-3 text-xs text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-accent-tasks)" }}
        >
          {isPending ? "Adding..." : "Add"}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  status: Status;
  onSave: (updates: { name: string; type: StatusType; color: string; icon: string }) => void;
  isPending: boolean;
  onCancel: () => void;
}

function EditForm({ status, onSave, isPending, onCancel }: EditFormProps) {
  const [name,  setName]  = useState(status.name);
  const [type,  setType]  = useState<StatusType>(status.type);
  const [color, setColor] = useState(status.color ?? TYPE_COLORS[status.type]);
  const [icon,  setIcon]  = useState<StatusIconKey>((status.icon ?? TYPE_TO_ICON_KEY[status.type]) as StatusIconKey);

  const handleTypeChange = (t: StatusType) => {
    setType(t);
    setColor(TYPE_COLORS[t]);
    setIcon(TYPE_TO_ICON_KEY[t]);
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: "var(--color-surface-1)", borderColor: "var(--color-border-default)" }}
    >
      <p className="text-caption uppercase text-text-tertiary">
        Edit status
      </p>
      <Input variant="legacy" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8 text-xs" />
      <TypeLabel />
      <TypeSelector type={type} color={color} icon={icon} onChange={handleTypeChange} />
      <div>
        <p className="mb-1.5 text-[10px] text-text-tertiary">Icon</p>
        <IconPicker selected={icon} color={color} onSelect={setIcon} />
      </div>
      <PaletteSection color={color} onChange={setColor} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} className="h-7 px-3 text-xs text-text-secondary">Cancel</Button>
        <Button variant="legacy"
          type="button"
          disabled={isPending || !name.trim()}
          onClick={() => onSave({ name: name.trim(), type, color, icon })}
          className="h-7 px-3 text-xs text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-accent-tasks)" }}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Status row (pure display — used both in list and DragOverlay) ─────────────

function StatusRowContent({ status, isOverlay = false }: { status: Status; isOverlay?: boolean }) {
  return (
    <>
      <GripVertical
        size={13}
        className={cn("shrink-0 transition-colors", isOverlay ? "text-text-secondary" : "text-text-tertiary group-hover:text-text-secondary")}
      />
      <StatusIcon status={status} size={15} />
      <span className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>{status.name}</span>
      <span className="text-[10px] capitalize" style={{ color: "var(--color-text-tertiary)" }}>
        {status.type.replace("_", " ")}
      </span>
    </>
  );
}

function SortableStatusRow({ status, onEdit, onDelete, isDeleting }: {
  status: Status;
  onEdit: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subtle)",
      }}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isDragging ? "opacity-40" : ""
      )}
    >
      <div {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing touch-none">
        <GripVertical
          size={13}
          className="text-text-tertiary transition-colors group-hover:text-text-secondary"
        />
      </div>
      <StatusIcon status={status} size={15} />
      <span className="flex-1 text-sm" style={{ color: "var(--color-text-primary)" }}>{status.name}</span>
      <span className="text-[10px] capitalize" style={{ color: "var(--color-text-tertiary)" }}>
        {status.type.replace("_", " ")}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-surface-2"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(status.id)}
          disabled={isDeleting}
          className="flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:opacity-20 hover:bg-red-500/10 hover:text-red-400"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function ProjectStatusesPanel({ open, onClose, projectId, projectName }: Props) {
  const [showAddForm,    setShowAddForm]    = useState(false);
  const [editingStatus,  setEditingStatus]  = useState<Status | null>(null);
  const [activeId,       setActiveId]       = useState<string | null>(null);
  const [ordered,        setOrdered]        = useState<Status[]>([]);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowAddForm(false);
      setEditingStatus(null);
      setActiveId(null);
    }
  }, [open]);

  const { data: statuses = [] } = useStatuses(projectId);
  const createMutation  = useCreateStatus(projectId);
  const updateMutation  = useUpdateStatus(projectId);
  const deleteMutation  = useDeleteStatus(projectId);
  const reorderMutation = useReorderStatuses(projectId);

  useEffect(() => {
    if (draggingRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrdered((prev) => {
      const unchanged =
        prev.length === statuses.length &&
        prev.every((s, i) => s.id === statuses[i]?.id && s.name === statuses[i]?.name);
      return unchanged ? prev : statuses;
    });
  }, [statuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const activeStatus = activeId ? ordered.find((s) => s.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    draggingRef.current = true;
    setActiveId(active.id as string);
    setEditingStatus(null);
    setShowAddForm(false);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(ordered, oldIndex, newIndex);

    setOrdered(newOrder);
    reorderMutation.mutate(newOrder.map((s, i) => ({ id: s.id, position: i + 1 })));
  }

  const handleCreate = (data: { name: string; type: StatusType; color: string; icon: string | null; position: number }) => {
    createMutation.mutate(data, { onSuccess: () => setShowAddForm(false) });
  };

  const handleEdit = (updates: { name: string; type: StatusType; color: string; icon: string }) => {
    if (!editingStatus) return;
    updateMutation.mutate(
      { id: editingStatus.id, updates },
      { onSuccess: () => setEditingStatus(null) }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l shadow-lg sm:w-130"
            style={{
              backgroundColor: "var(--color-surface-0)",
              borderColor: "var(--color-border-subtle)",
            }}
          >
            {/* Header */}
            <div
              className="flex h-14 shrink-0 items-center justify-between border-b px-5"
              style={{ borderColor: "var(--color-border-subtle)" }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {projectName}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  Manage statuses
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md transition-colors text-text-tertiary hover:bg-surface-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-2">
                <p className="text-caption uppercase text-text-tertiary">
                  Statuses ({ordered.length})
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => { draggingRef.current = false; setActiveId(null); }}
                >
                  <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {ordered.map((status) => (
                        editingStatus?.id === status.id ? (
                          <EditForm
                            key={status.id}
                            status={status}
                            onSave={handleEdit}
                            isPending={updateMutation.isPending}
                            onCancel={() => setEditingStatus(null)}
                          />
                        ) : (
                          <SortableStatusRow
                            key={status.id}
                            status={status}
                            onEdit={() => { setShowAddForm(false); setEditingStatus(status); }}
                            onDelete={(id) => deleteMutation.mutate(id)}
                            isDeleting={deleteMutation.isPending}
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
                    {activeStatus && (
                      <div
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 shadow-xl ring-1"
                        style={{
                          backgroundColor: "var(--color-surface-2)",
                          border: "1px solid var(--color-border-default)",
                        }}
                      >
                        <StatusRowContent status={activeStatus} isOverlay />
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>

                <div className="pt-1">
                  {showAddForm ? (
                    <AddForm
                      nextPosition={ordered.length + 1}
                      onCreate={handleCreate}
                      isPending={createMutation.isPending}
                      onCancel={() => setShowAddForm(false)}
                    />
                  ) : !editingStatus ? (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs transition-colors"
                      style={{ borderColor: "var(--color-border-subtle)", color: "var(--color-text-tertiary)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-border-default)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border-subtle)"; e.currentTarget.style.color = "var(--color-text-tertiary)"; }}
                    >
                      <Plus size={13} />
                      Add status
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
