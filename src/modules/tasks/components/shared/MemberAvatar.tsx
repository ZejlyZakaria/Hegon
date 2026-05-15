"use client";

import type { Assignee } from "@/modules/tasks/types";

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#22c55e","#0ea5e9","#14b8a6"];

function getColor(id: string) {
  return COLORS[id.charCodeAt(0) % COLORS.length];
}

function getInitials(member: Assignee) {
  if (member.full_name) {
    return member.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  }
  return member.email[0].toUpperCase();
}

interface Props {
  member: Assignee;
  size?: "sm" | "md";
}

export function MemberAvatar({ member, size = "sm" }: Props) {
  const dim = size === "sm" ? "w-5 h-5 text-[9px]" : "w-6 h-6 text-[10px]";

  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt={member.full_name ?? member.email}
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ backgroundColor: getColor(member.id) }}
    >
      {getInitials(member)}
    </div>
  );
}
