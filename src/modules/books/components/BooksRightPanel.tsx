"use client";

import { BookOpen, Star } from "lucide-react";
import Image from "next/image";
import { useBooksRightPanel } from "../hooks/useBooks";

const SKY = "#0ea5e9";
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const RING_R = 56;
const RING_C = 2 * Math.PI * RING_R;

export function BooksRightPanel() {
  const { data, isLoading } = useBooksRightPanel();

  if (isLoading) {
    return (
      <div className="w-full flex flex-col gap-3">
        {[72, 112, 120].map((h, i) => (
          <div key={i} className="bg-surface-1 rounded-lg p-4">
            <div className="h-3 w-24 rounded bg-surface-2 animate-pulse mb-3" />
            <div className={`h-${h === 72 ? '10' : h === 112 ? '28' : '20'} rounded bg-surface-2 animate-pulse`} />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { streak, pages_this_month, recently_finished, activityLast7 } = data;

  const today = new Date();
  const weekDots = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    return { label: DAYS[dayIndex], active: activityLast7[i] };
  });

  const ringDash = Math.min(pages_this_month / 300, 1) * RING_C;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* ── Reading Streak ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary">Reading Streak</h3>
          <span className="text-xs text-text-tertiary">Best {streak.best}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-text-primary">{streak.current}</span>
          <span className="text-sm" style={{ color: SKY }}>days</span>
        </div>
        <div className="flex items-center justify-between">
          {weekDots.map((dot, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-text-tertiary">{dot.label}</span>
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: dot.active ? SKY : "#27272a" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Pages This Month ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-text-secondary">Pages This Month</h3>
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={RING_R} fill="none" stroke="#27272a" strokeWidth="8" />
              <circle
                cx="64" cy="64" r={RING_R}
                fill="none"
                stroke={SKY}
                strokeWidth="8"
                strokeDasharray={`${ringDash} ${RING_C}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-text-primary">{pages_this_month}</span>
              <span className="text-[10px] text-text-tertiary">pages</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recently Finished ── */}
      <div className="bg-surface-1 rounded-lg p-4 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-text-secondary">Recently Finished</h3>
        {recently_finished.length === 0 ? (
          <p className="text-xs text-text-tertiary">No books finished yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recently_finished.map((book) => (
              <div key={book.id} className="flex gap-3">
                <div className="relative w-10 h-14 shrink-0 bg-surface-2 rounded overflow-hidden">
                  {book.cover_url ? (
                    <Image src={book.cover_url} alt={book.title} fill className="object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-text-tertiary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-sm font-medium text-text-primary truncate">{book.title}</p>
                  {book.rating != null && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-3 h-3"
                          fill={i < book.rating! ? SKY : "none"}
                          stroke={i < book.rating! ? SKY : "#71717a"}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
