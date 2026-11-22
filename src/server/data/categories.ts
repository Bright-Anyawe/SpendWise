import { one, type Queryable } from "@/lib/db/queryable";
import type { Category } from "@/lib/types/database";
import type { CategoryInput } from "@/schemas/category";

export async function listCategories(db: Queryable): Promise<Category[]> {
  const { rows } = await db.query<Category>("select * from public.categories order by sort_order, name");
  return rows;
}

/** New categories go to the end of the list. */
export async function createCategory(db: Queryable, input: CategoryInput): Promise<Category> {
  const row = await one<Category>(
    db,
    `insert into public.categories (name, icon, counts_as_spending, sort_order)
     values ($1, $2, $3, (select coalesce(max(sort_order), 0) + 1 from public.categories))
     returning *`,
    [input.name, input.icon, input.countsAsSpending],
  );
  if (!row) throw new Error("The category wasn't saved.");
  return row;
}

export function updateCategory(db: Queryable, id: string, input: CategoryInput): Promise<Category | null> {
  return one<Category>(
    db,
    "update public.categories set name = $2, icon = $3, counts_as_spending = $4 where id = $1 returning *",
    [id, input.name, input.icon, input.countsAsSpending],
  );
}

/** Moves the category's expenses to `moveTo`, then deletes it (see public.delete_category). */
export async function deleteCategory(db: Queryable, id: string, moveTo: string): Promise<void> {
  await db.query("select public.delete_category($1, $2)", [id, moveTo]);
}
