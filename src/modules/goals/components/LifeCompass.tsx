"use client";

import { useState } from "react";
import type { Goal, GoalCategory, CategoryStats } from "../types";

const ACCENT = "var(--color-accent-goals)";

const CATEGORIES: GoalCategory[] = [
  "personal",
  "work",
  "health",
  "learning",
  "finance",
  "other",
];

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  personal: "Personal",
  work: "Work",
  health: "Health",
  learning: "Learning",
  finance: "Finance",
  other: "Other",
};

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  personal: "#f472b6",
  work: "#60a5fa",
  health: "#f87171",
  learning: "#facc15",
  finance: "#22d3ee",
  other: "#a1a1aa",
};

function computeStats(goals: Goal[]): CategoryStats[] {
  return CATEGORIES.map((cat) => {
    const catGoals = goals.filter(
      (g) => g.category === cat && g.status !== "abandoned",
    );
    if (catGoals.length === 0)
      return { category: cat, avgProgress: 0, total: 0, atRisk: 0 };

    const avg = Math.round(
      catGoals.reduce((sum, g) => sum + g.progress, 0) / catGoals.length,
    );
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const atRisk = catGoals.filter(
      (g) =>
        g.status === "active" &&
        g.target_date !== null &&
        new Date(g.target_date) < in14 &&
        g.progress < 50,
    ).length;

    return { category: cat, avgProgress: avg, total: catGoals.length, atRisk };
  });
}

const CENTER = 120;
const MAX_R = 90;

function polarToXY(angle: number, r: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

interface Props {
  goals: Goal[];
  activeCategory: GoalCategory | null;
  onCategoryClick: (cat: GoalCategory | null) => void;
}

export function LifeCompass({ goals, activeCategory, onCategoryClick }: Props) {
  const [tooltip, setTooltip] = useState<GoalCategory | null>(null);
  const stats = computeStats(goals);
  const n = CATEGORIES.length;
  const angleStep = 360 / n;
  const rings = [25, 50, 75, 100];

  const filledPoints = stats.map((s, i) =>
    polarToXY(i * angleStep, (s.avgProgress / 100) * MAX_R),
  );
  const filledPath =
    filledPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ") + " Z";

  const tooltipStat = tooltip
    ? stats.find((s) => s.category === tooltip)
    : null;

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/4 bg-[#0e0e10]">
      <div className="relative p-3">
        <h3
          className="text-xs font-semibold mb-2.5"
          style={{ color: "var(--color-text-primary)" }}
        >
          Life Compass
        </h3>

        <div className="flex items-center justify-center">
          <svg
            width={240}
            height={240}
            viewBox="0 0 240 240"
            onMouseLeave={() => setTooltip(null)}
          >
            {/* Grid rings */}
            {rings.map((pct) => {
              const r = (pct / 100) * MAX_R;
              const pts = CATEGORIES.map((_, i) => polarToXY(i * angleStep, r));
              const d =
                pts
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ") + " Z";
              return (
                <path
                  key={pct}
                  d={d}
                  fill="none"
                  stroke="#141416"
                  strokeWidth={1}
                />
              );
            })}

            {/* Axis lines */}
            {CATEGORIES.map((_, i) => {
              const end = polarToXY(i * angleStep, MAX_R);
              return (
                <line
                  key={i}
                  x1={CENTER}
                  y1={CENTER}
                  x2={end.x}
                  y2={end.y}
                  stroke="#141416"
                  strokeWidth={1}
                />
              );
            })}

            {/* Filled polygon */}
            <path
              d={filledPath}
              fill={ACCENT}
              fillOpacity={0.15}
              stroke={ACCENT}
              strokeWidth={1.5}
            />

            {/* Category dots + hit areas */}
            {stats.map((s, i) => {
              const angle = i * angleStep;
              const dotPos = polarToXY(angle, (s.avgProgress / 100) * MAX_R);
              const labelPos = polarToXY(angle, MAX_R + 18);
              const color = CATEGORY_COLORS[s.category];
              const isActive = activeCategory === s.category;

              return (
                <g key={s.category}>
                  <line
                    x1={CENTER}
                    y1={CENTER}
                    x2={polarToXY(angle, MAX_R + 10).x}
                    y2={polarToXY(angle, MAX_R + 10).y}
                    stroke="transparent"
                    strokeWidth={20}
                    className="cursor-pointer"
                    onClick={() =>
                      onCategoryClick(isActive ? null : s.category)
                    }
                    onMouseEnter={() => setTooltip(s.category)}
                  />

                  {s.total > 0 && (
                    <circle
                      cx={dotPos.x}
                      cy={dotPos.y}
                      r={isActive ? 5 : 3.5}
                      fill={color}
                      stroke={isActive ? "#09090b" : "none"}
                      strokeWidth={1.5}
                      className="transition-all"
                    />
                  )}

                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize: 9,
                      fontWeight: isActive ? 700 : 500,
                      fill: isActive ? color : "#71717a",
                    }}
                  >
                    {CATEGORY_LABELS[s.category]}
                  </text>
                </g>
              );
            })}

            <circle
              cx={CENTER}
              cy={CENTER}
              r={3}
              fill={ACCENT}
              fillOpacity={0.6}
            />
          </svg>
        </div>

        {/* Tooltip */}
        {tooltipStat && (
          <div className="mt-2 rounded-md border border-white/[0.07] bg-[#0e0e10] px-3 py-2 text-xs text-[#a0a0a8]">
            <span
              className="font-medium"
              style={{ color: CATEGORY_COLORS[tooltipStat.category] }}
            >
              {CATEGORY_LABELS[tooltipStat.category]}
            </span>
            {" • "}Avg {tooltipStat.avgProgress}%{" • "}
            {tooltipStat.total} goal{tooltipStat.total !== 1 ? "s" : ""}
            {tooltipStat.atRisk > 0 && (
              <span className="text-red-400">
                {" "}
                • {tooltipStat.atRisk} at risk
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
