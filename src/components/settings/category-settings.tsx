"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { ResponsiveSheet } from "@/components/common/responsive-sheet";
import { CATEGORY_ICONS, CategoryIcon, CategoryTile } from "@/components/icons/category-icon";
import { Switch } from "@/components/ui/switch";
import type { Category } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { createCategory, deleteCategory, updateCategory } from "@/server/actions/categories";

export function CategorySettings({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  return (
    <>
      <ul className="rounded-xl border border-border bg-card px-4">
        {categories.map((c, i) => (
          <li key={c.id} className={cn(i > 0 && "border-t border-muted")}>
            <button
              type="button"
              onClick={() => setEditing(c)}
              className="flex min-h-14 w-full items-center gap-3 py-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <CategoryTile icon={c.icon} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{c.name}</span>
                {!c.counts_as_spending || c.is_fallback ? (
                  <span className="text-xs text-muted-foreground">
                    {!c.counts_as_spending ? "Set aside, not counted as spending" : "Used when a category is deleted"}
                  </span>
                ) : null}
              </span>
              <ChevronRight aria-hidden="true" className="size-[18px] text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#9ca3af] text-[15px] font-semibold text-primary"
      >
        <Plus aria-hidden="true" className="size-[18px]" />
        Add a category
      </button>

      <ResponsiveSheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} title={editing === "new" ? "New category" : "Edit category"}>
        {editing ? (
          <CategoryForm category={editing === "new" ? null : editing} categories={categories} onDone={() => setEditing(null)} />
        ) : null}
      </ResponsiveSheet>
    </>
  );
}

function CategoryForm({ category, categories, onDone }: { category: Category | null; categories: Category[]; onDone: () => void }) {
  const ids = useId();
  const fallback = categories.find((c) => c.is_fallback);
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "circle");
  const [countsAsSpending, setCountsAsSpending] = useState(category?.counts_as_spending ?? true);
  const [moveTo, setMoveTo] = useState(fallback && fallback.id !== category?.id ? fallback.id : "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const input = { name, icon, countsAsSpending };
      const result = category ? await updateCategory(category.id, input) : await createCategory(input);
      if (!result.ok) {
        setError(result.fieldErrors?.name?.[0] ?? result.error);
        return;
      }
      toast(category ? "Category saved" : `Added ${result.data.name}`);
      onDone();
    });
  }

  function remove() {
    if (!category) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteCategory(category.id, moveTo);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(`Deleted ${category.name}`);
      onDone();
    });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={`${ids}-name`} className="flex flex-col gap-1.5 text-sm font-semibold">
        Name
        <input id={`${ids}-name`} value={name} maxLength={40} autoFocus={!category} onChange={(e) => setName(e.target.value)} className="h-12 rounded-md border border-input bg-card px-3.5 text-base font-normal" />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Icon</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {Object.keys(CATEGORY_ICONS).map((key) => (
            <label
              key={key}
              className="flex aspect-square cursor-pointer items-center justify-center rounded-[10px] bg-muted text-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" name={`${ids}-icon`} value={key} checked={icon === key} onChange={() => setIcon(key)} className="sr-only" aria-label={key.replace(/-/g, " ")} />
              <CategoryIcon icon={key} />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-4">
        <label htmlFor={`${ids}-counts`} className="flex flex-col">
          <span className="text-[15px] font-medium">Counts as spending</span>
          <span className="text-[13px] text-muted-foreground">Turn off for money you set aside, like Savings.</span>
        </label>
        <Switch id={`${ids}-counts`} checked={countsAsSpending} onCheckedChange={setCountsAsSpending} />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="h-[52px] rounded-[14px] bg-primary text-base font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
        {pending ? "Saving…" : category ? "Save category" : "Add category"}
      </button>

      {category && !category.is_fallback ? (
        <div className="flex flex-col gap-2 border-t border-muted pt-4">
          <label htmlFor={`${ids}-move`} className="flex flex-col gap-1.5 text-sm font-semibold">
            Move its expenses to
            <select id={`${ids}-move`} value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-12 rounded-md border border-input bg-card px-3 text-base font-normal">
              {categories
                .filter((c) => c.id !== category.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <button type="button" onClick={remove} disabled={pending || !moveTo} className="h-11 rounded-md text-[15px] font-semibold text-destructive hover:bg-danger-bg">
            {confirmDelete ? `Tap again to delete ${category.name}` : "Delete category"}
          </button>
          <p className="text-xs text-muted-foreground">Budgets for this category are removed with it.</p>
        </div>
      ) : null}
      {category?.is_fallback ? <p className="text-xs text-muted-foreground">{category.name} can be renamed but not deleted.</p> : null}
    </form>
  );
}
