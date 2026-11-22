import { type ReactNode, Suspense } from "react";
import { SyncStatus } from "@/components/pwa/sync-status";
import { UrlActions } from "@/components/pwa/url-actions";
import { QuickAddLoader } from "@/components/quick-add/quick-add-loader";
import { QuickAddProvider } from "@/components/quick-add/quick-add-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Toaster } from "@/components/ui/sonner";

// Signed-in app shell: sidebar on tablet/desktop, bottom bar on phones, quick add everywhere.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QuickAddProvider>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="min-w-0 flex-1 pb-28 md:pb-0">
          <SyncStatus />
          {children}
        </div>
      </div>
      <BottomNav />
      <Suspense fallback={null}>
        <QuickAddLoader />
      </Suspense>
      <Suspense fallback={null}>
        <UrlActions />
      </Suspense>
      <Toaster position="bottom-center" mobileOffset={{ bottom: 100 }} />
    </QuickAddProvider>
  );
}
