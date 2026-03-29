import { ReactNode } from "react";
import { DesktopSidebar, MobileNav } from "./AppNav";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0 pt-6 px-4 md:px-8">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

