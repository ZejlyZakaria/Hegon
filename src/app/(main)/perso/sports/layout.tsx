// app/perso/sports/layout.tsx
import SectionHeader from "@/shared/components/layout/SectionHeader";

const TABS = [
  { label: "Football", href: "/perso/sports/football" },
  { label: "Tennis",   href: "/perso/sports/tennis" },
  { label: "F1",       href: "/perso/sports/f1" },
];

export default function SportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-0">
      <SectionHeader
        accent="#B6FF2E"
        tabs={TABS}
      />
      <div>{children}</div>
    </div>
  );
}