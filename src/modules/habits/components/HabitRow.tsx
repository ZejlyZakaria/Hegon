"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Flame, Link2, MoreHorizontal, Pencil, SkipForward, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/utils";
import { resolveIcon } from "@/shared/constants/icons";
import { formatFrequency } from "../utils";
import type { HabitWithStatus } from "../types";

const HABITS_ACCENT = "var(--color-accent-habits-vivid)";
const FIRE = "var(--color-fire)";
const AMBER = "#f59e0b";

interface Props {
  habit: HabitWithStatus;
  onToggle: (habit: HabitWithStatus) => void;
  onOpen: (habit: HabitWithStatus) => void;
  isPending?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function HabitRow({
  habit,
  onToggle,
  onOpen,
  isPending = false,
  onEdit,
  onDelete,
}: Props) {
  const { completed_today, at_risk, skipped_today, current_streak, best_streak } = habit;
  const { icon: Icon, color: iconColor } = resolveIcon(habit.icon);
  const reduce = useReducedMotion();

  return (
    <div
      onClick={() => onOpen(habit)}
      className="group flex h-14 cursor-pointer items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 px-3 transition-[background-color,opacity] duration-200 ease-out hover:bg-surface-2"
      style={{ opacity: completed_today ? 0.5 : 1 }}
    >
      {/* Complete — leading checkbox. The primary, repeated action sits first. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle(habit);
        }}
        disabled={isPending}
        aria-label={
          completed_today
            ? `Mark ${habit.title} as not done`
            : `Complete ${habit.title}`
        }
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          "transition-[background-color,border-color,transform] duration-150 ease-out",
          "active:scale-90 disabled:opacity-50",
          completed_today
            ? "border-transparent"
            : "border-border-strong hover:border-text-tertiary",
        )}
        style={completed_today ? { backgroundColor: HABITS_ACCENT } : undefined}
      >
        {completed_today && (
          <motion.span
            initial={reduce ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: reduce ? 0.08 : 0.12, ease: "easeOut" }}
            className="text-white"
          >
            <Check size={12} strokeWidth={3} />
          </motion.span>
        )}
      </button>

      {/* Habit — icon + title + (at-risk / description) */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2"
          style={{ color: iconColor }}
        >
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "truncate text-sm font-medium leading-tight",
                completed_today
                  ? "text-text-tertiary line-through"
                  : "text-text-primary",
              )}
            >
              {habit.title}
            </p>
            {/* Frequency rides with the title — it describes the schedule,
                so it belongs to the identity, not a far-off column. */}
            <span className="hidden shrink-0 text-xs text-text-tertiary sm:inline">
              {formatFrequency(habit)}
            </span>
          </div>
          {skipped_today && !completed_today ? (
            <span className="mt-0.5 inline-flex items-center gap-1 leading-none">
              <SkipForward size={11} style={{ color: HABITS_ACCENT }} />
              <span
                className="text-[11px] font-medium"
                style={{ color: HABITS_ACCENT }}
              >
                Skipped today
              </span>
            </span>
          ) : at_risk && !completed_today ? (
            <span className="mt-0.5 inline-flex items-center gap-1 leading-none">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: AMBER }}
                aria-hidden="true"
              />
              <span className="text-[11px] font-medium" style={{ color: AMBER }}>
                Missed yesterday
              </span>
            </span>
          ) : habit.description ? (
            <p className="mt-0.5 truncate text-xs leading-snug text-text-secondary">
              {habit.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Goal — fixed, left-aligned column so links line up across rows.
          Empty (no placeholder) when the habit isn't linked to a goal. */}
      <div className="hidden w-56 shrink-0 md:block">
        {habit.goal && (
          <span className="inline-flex max-w-full items-center gap-1 text-xs text-text-tertiary">
            <Link2 size={11} className="shrink-0" />
            <span className="truncate">{habit.goal.title}</span>
          </span>
        )}
      </div>

      {/* Streak — fixed column, current (fire) + best */}
      <div className="flex w-20 shrink-0 items-center gap-1.5">
        <Flame
          size={13}
          style={{ color: current_streak > 0 ? FIRE : "var(--color-text-tertiary)" }}
        />
        <span
          className="text-sm font-bold leading-none"
          style={{ color: current_streak > 0 ? FIRE : "var(--color-text-secondary)" }}
        >
          {current_streak}
        </span>
        {best_streak > 0 && (
          <span className="text-[10px] leading-none text-text-tertiary">
            best {best_streak}
          </span>
        )}
      </div>

      {/* Actions — revealed on hover */}
      <div className="w-7 shrink-0" onClick={(e) => e.stopPropagation()}>
        {(onEdit || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Habit options"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary opacity-0 transition-[opacity,background-color,color,transform] duration-150 ease-out hover:bg-surface-2 hover:text-text-secondary focus-visible:opacity-100 active:scale-95 group-hover:opacity-100"
              >
                <MoreHorizontal size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-36 rounded-xl border-border-strong bg-surface-3"
            >
              {onEdit && (
                <DropdownMenuItem
                  onClick={onEdit}
                  className="cursor-pointer text-text-secondary focus:bg-surface-2 focus:text-text-primary"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5 shrink-0" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={onDelete}
                  className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5 shrink-0" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
