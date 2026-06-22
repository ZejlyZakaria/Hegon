"use client";

import { StaggerList, StaggerItem } from "@/shared/components/ui/motion";
import { HabitRow } from "./HabitRow";
import type { HabitWithStatus } from "../types";

interface Props {
  habits: HabitWithStatus[];
  onToggle: (habit: HabitWithStatus) => void;
  onOpen: (habit: HabitWithStatus) => void;
  pendingId?: string | null;
  onEdit: (habit: HabitWithStatus) => void;
  onDelete: (habit: HabitWithStatus) => void;
}

export function HabitsTodayTable({
  habits,
  onToggle,
  onOpen,
  pendingId,
  onEdit,
  onDelete,
}: Props) {
  return (
    <StaggerList className="space-y-2">
      {habits.map((habit, i) => (
        <StaggerItem key={habit.id} index={i}>
          <HabitRow
            habit={habit}
            onToggle={onToggle}
            onOpen={onOpen}
            isPending={pendingId === habit.id}
            onEdit={() => onEdit(habit)}
            onDelete={() => onDelete(habit)}
          />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
