import { ReactNode } from "react";
import { DesktopSidebar, MobileHeader, MobileNav } from "./AppNav";
import { useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import { Toaster } from "@/components/ui/sonner";
import { OfflineStatus } from "./OfflineStatus";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background overflow-x-hidden">
      <DesktopSidebar />
      <MobileHeader />
      <main className="flex-1 pb-20 md:pb-0 pt-24 md:pt-6 px-4 md:px-8 max-w-full overflow-x-hidden md:ml-56 lg:ml-64">
        {children}
      </main>
      <MobileNav />
      <Toaster position="top-center" richColors closeButton />
      <OfflineStatus />
    </div>
  );
}
