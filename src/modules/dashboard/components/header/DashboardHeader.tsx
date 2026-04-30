"use client";

interface DashboardHeaderProps {
  hasTask: boolean;
  hasMatch: boolean;
}

function getSubtitle(hasTask: boolean, hasMatch: boolean): string {
  if (hasTask && hasMatch) return "Your day is packed — let's make it count.";
  if (hasTask) return "One thing to conquer today.";
  if (hasMatch) return "Light day — enjoy the game tonight.";
  return "Nothing urgent today. Make it yours.";
}

export default function DashboardHeader({ hasTask, hasMatch }: DashboardHeaderProps) {
  const subtitle = getSubtitle(hasTask, hasMatch);

  return (
    <div>
      <p className="text-xs text-zinc-500" suppressHydrationWarning>
        {subtitle}
      </p>
    </div>
  );
}