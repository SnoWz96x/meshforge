import { Sidebar } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
      <CommandPalette />
    </div>
  );
}
