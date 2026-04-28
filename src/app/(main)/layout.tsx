// app/(main)/layout.tsx
// all protected routes live under this layout — sidebar always present
import Dock from "@/shared/components/navigation/Dock";
import { CommandCenterProvider } from "@/modules/command-center/components/CommandCenterProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden custom-scrollbar">
      <Dock />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarGutter: "stable" }}
      >
        {children}
      </main>
      <CommandCenterProvider />
    </div>
  );
}