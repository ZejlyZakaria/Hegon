// app/(main)/layout.tsx
// all protected routes live under this layout — sidebar always present
import Dock from "@/shared/components/navigation/Dock";
import TopBar from "@/shared/components/layout/TopBar";
import { CommandCenterProvider } from "@/modules/command-center/components/CommandCenterProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden custom-scrollbar">
      <Dock />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarGutter: "stable" }}
        >
          <div className="max-w-400 mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
      <CommandCenterProvider />
    </div>
  );
}