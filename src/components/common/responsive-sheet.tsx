"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";

/** A bottom sheet on phones and a centred dialog on larger screens. */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl p-6 sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">{title}</DialogTitle>
            <DialogDescription className={description ? "" : "sr-only"}>{description ?? title}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[94dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <DrawerHeader className="px-5 pt-1 pb-0 text-left">
          <DrawerTitle className="text-[17px] font-semibold">{title}</DrawerTitle>
          <DrawerDescription className={description ? "" : "sr-only"}>{description ?? title}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 pt-3 pb-6">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
