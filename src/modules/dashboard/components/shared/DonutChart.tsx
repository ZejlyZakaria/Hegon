interface DonutChartProps {
  percent: number;
  isLoading?: boolean;
  color?: string;
}

export function DonutChart({ percent, isLoading = false, color = "#60a5fa" }: DonutChartProps) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(percent, 100) / 100);

  return (
    <div className="relative">
      <svg width={92} height={92} viewBox="0 0 92 92">
        <circle cx={46} cy={46} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
        <circle
          cx={46} cy={46} r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={isLoading ? circ : offset}
          transform="rotate(-90 46 46)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[15px] font-bold tabular-nums leading-none" style={{ color }}>
          {isLoading ? "—" : `${percent}%`}
        </span>
      </div>
    </div>
  );
}
