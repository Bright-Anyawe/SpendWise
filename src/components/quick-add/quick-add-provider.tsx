"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Expense } from "@/lib/types/database";

export interface QuickAddState {
  open: boolean;
  /** The expense being edited, or null when adding a new one. */
  editing: Expense | null;
  /** Changes on every open so the form starts fresh. */
  session: number;
  /** A past day to log a forgotten expense on (opened from a past month or day); null = today. */
  presetDay: string | null;
}

interface QuickAddApi {
  openNew(): void;
  /** Add an expense on a particular (past) day, e.g. one the person forgot to log. */
  openNewOn(day: string): void;
  openEdit(expense: Expense): void;
  close(): void;
  state: QuickAddState;
}

const QuickAddContext = createContext<QuickAddApi | null>(null);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Lets any button open quick add (new or edit). Press N anywhere (outside a text field) to add. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuickAddState>({ open: false, editing: null, session: 0, presetDay: null });

  const openNew = useCallback(() => setState((s) => ({ open: true, editing: null, session: s.session + 1, presetDay: null })), []);
  const openNewOn = useCallback(
    (day: string) => setState((s) => ({ open: true, editing: null, session: s.session + 1, presetDay: day })),
    [],
  );
  const openEdit = useCallback(
    (expense: Expense) => setState((s) => ({ open: true, editing: expense, session: s.session + 1, presetDay: null })),
    [],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      openNew();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openNew]);

  const value = useMemo(() => ({ openNew, openNewOn, openEdit, close, state }), [openNew, openNewOn, openEdit, close, state]);
  return <QuickAddContext value={value}>{children}</QuickAddContext>;
}

export function useQuickAdd(): QuickAddApi {
  const api = useContext(QuickAddContext);
  if (!api) throw new Error("useQuickAdd must be used inside QuickAddProvider");
  return api;
}
