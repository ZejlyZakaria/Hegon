"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const reduce = useReducedMotion();

  return (
    <div>
      {/* Rows */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {habits.map((habit, i) => (
            <motion.div
              key={habit.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{
                duration: reduce ? 0.12 : 0.22,
                delay: reduce ? 0 : i * 0.04,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              <HabitRow
                habit={habit}
                onToggle={onToggle}
                onOpen={onOpen}
                isPending={pendingId === habit.id}
                onEdit={() => onEdit(habit)}
                onDelete={() => onDelete(habit)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
