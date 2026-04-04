// app/perso/sports/layout.tsx
import { Trophy } from "lucide-react";
import SectionHeader from "@/shared/components/layout/SectionHeader"

const TABS = [
  { label: "Football", href: "/perso/sports/football" },
  { label: "Tennis",   href: "/perso/sports/tennis" },
  { label: "F1",       href: "/perso/sports/f1" },
];

export default function SportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950">
      <SectionHeader
        icon={<Trophy size={16} />}
        title="Sport"
        accent="#10b981"
        tabs={TABS}
      />
      <div>{children}</div>
    </div>
  );
}