import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* TODO: Sidebar, Header, etc. */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
