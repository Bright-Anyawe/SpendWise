"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsDesktop } from "@/hooks/use-media-query";
import type { PaymentMethod } from "@/lib/types/database";
import type { CategoryWithUses } from "@/server/data/expenses";
import { QuickAddForm } from "./quick-add-form";
import { useQuickAdd } from "./quick-add-provider";

export interface QuickAddSheetProps {
  categories: CategoryWithUses[];
  currency: string;
  timezone: string;
  lastPaymentMethod: PaymentMethod | null;
}

/** Bottom sheet with a keypad on phones; a centred dialog on larger screens. */
export function QuickAddSheet(props: QuickAddSheetProps) {
  const { state, close } = useQuickAdd();
  const isDesktop = useIsDesktop();
  const title = state.editing ? "Edit expense" : "Add expense";
  const description = state.editing ? "Change any detail, or delete it." : "Amount, category, done.";

  const form = (
    <QuickAddForm
      key={state.session}
      editing={state.editing}
      presetDay={state.presetDay}
      useKeypad={!isDesktop}
      onDone={close}
      {...props}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={state.open} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl p-6 sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={state.open} onOpenChange={(open) => !open && close()} repositionInputs={false}>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[96dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <DrawerHeader className="px-5 pt-1 pb-0 text-left">
          <DrawerTitle className="text-[17px] font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-5 pt-2 pb-5">{form}</div>
      </DrawerContent>
    </Drawer>
  );
}
