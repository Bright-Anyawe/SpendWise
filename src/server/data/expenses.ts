import { one, type Queryable } from "@/lib/db/queryable";
import { toIlikePattern } from "@/lib/search";
import type { Category, Expense, ExpenseInsert, ExpenseWithCategory, PaymentMethod } from "@/lib/types/database";
import type { ExpenseFilters } from "@/schemas/expense";

export const EXPENSES_PAGE_SIZE = 50;

const SELECT_WITH_CATEGORY = `
  select e.*, json_build_object('name', c.name, 'icon', c.icon) as category
    from public.expenses e
    join public.categories c on c.id = e.category_id and c.user_id = e.user_id`;

/**
 * Saves an expense for the signed-in person. If the id already exists (an offline retry that
 * already reached the server) the saved expense is returned unchanged.
 */
export async function insertExpense(db: Queryable, row: ExpenseInsert): Promise<Expense | null> {
  const inserted = await one<Expense>(
    db,
    `insert into public.expenses (id, amount, category_id, payment_method, note, spent_on, spent_time)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
     on conflict (id) do nothing
     returning *`,
    [row.id ?? null, row.amount, row.category_id, row.payment_method, row.note, row.spent_on, row.spent_time],
  );
  if (inserted || !row.id) return inserted;
  return one<Expense>(db, "select * from public.expenses where id = $1", [row.id]);
}

export function updateExpense(db: Queryable, id: string, row: ExpenseInsert): Promise<Expense | null> {
  return one<Expense>(
    db,
    `update public.expenses
        set amount = $2, category_id = $3, payment_method = $4, note = $5, spent_on = $6, spent_time = $7
      where id = $1
      returning *`,
    [id, row.amount, row.category_id, row.payment_method, row.note, row.spent_on, row.spent_time],
  );
}

/** Deletes and returns the expense, so it can be put back (Undo). */
export function deleteExpense(db: Queryable, id: string): Promise<Expense | null> {
  return one<Expense>(db, "delete from public.expenses where id = $1 returning *", [id]);
}

export type CategoryWithUses = Category & { uses: number };

/** For quick add: categories most-used in the last 90 days first, and the payment method used last. */
export async function quickAddOptions(
  db: Queryable,
): Promise<{ categories: CategoryWithUses[]; lastPaymentMethod: PaymentMethod | null }> {
  const { rows: categories } = await db.query<CategoryWithUses>(
    `select c.*, coalesce(u.uses, 0)::int as uses
       from public.categories c
       left join (
         select category_id, count(*) as uses
           from public.expenses
          where spent_on >= current_date - 90
          group by category_id
       ) u on u.category_id = c.id
      order by coalesce(u.uses, 0) desc, c.sort_order, c.name`,
  );
  const last = await one<{ payment_method: PaymentMethod }>(
    db,
    "select payment_method from public.expenses order by created_at desc, spent_at desc limit 1",
  );
  return { categories, lastPaymentMethod: last?.payment_method ?? null };
}

/** Every expense on one calendar day, newest first. */
export async function expensesOn(db: Queryable, day: string): Promise<ExpenseWithCategory[]> {
  const { rows } = await db.query<ExpenseWithCategory>(
    `${SELECT_WITH_CATEGORY} where e.spent_on = $1::date order by e.spent_at desc, e.id`,
    [day],
  );
  return rows;
}

/** Newest first, 50 per page. Search matches the note or the category name. */
export async function listExpenses(
  db: Queryable,
  filters: ExpenseFilters,
  pageSize: number = EXPENSES_PAGE_SIZE,
): Promise<{ rows: ExpenseWithCategory[]; hasMore: boolean }> {
  const { where, params, param } = buildFilters(filters);
  const page = filters.page ?? 0;
  // One extra row tells us whether another page exists.
  const limit = param(pageSize + 1);
  const offset = param(page * pageSize);

  const { rows } = await db.query<ExpenseWithCategory>(
    `${SELECT_WITH_CATEGORY}
      where ${where}
      order by e.spent_on desc, e.spent_at desc, e.id
      limit ${limit} offset ${offset}`,
    params,
  );
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

/** How many expenses the same filters match, and their total. */
export async function summarizeExpenses(db: Queryable, filters: ExpenseFilters): Promise<{ count: number; total: number }> {
  const { where, params } = buildFilters(filters);
  const row = await one<{ count: number; total: number }>(
    db,
    `select count(*)::int as count, coalesce(sum(e.amount), 0) as total
       from public.expenses e
       join public.categories c on c.id = e.category_id and c.user_id = e.user_id
      where ${where}`,
    params,
  );
  return { count: row?.count ?? 0, total: Number(row?.total ?? 0) };
}

/** WHERE clause (for expenses e joined to categories c) and parameters for a set of filters. */
function buildFilters(filters: ExpenseFilters) {
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const where = ["e.user_id = (select app.current_user_id())"];
  if (filters.from) where.push(`e.spent_on >= ${param(filters.from)}::date`);
  if (filters.to) where.push(`e.spent_on <= ${param(filters.to)}::date`);
  if (filters.categoryIds?.length) where.push(`e.category_id = any(${param(filters.categoryIds)}::uuid[])`);
  if (filters.paymentMethods?.length) {
    // Compared as text so every driver can send the list as a plain text[].
    where.push(`e.payment_method::text = any(${param(filters.paymentMethods)}::text[])`);
  }
  if (filters.minAmount !== undefined) where.push(`e.amount >= ${param(filters.minAmount)}`);
  if (filters.maxAmount !== undefined) where.push(`e.amount <= ${param(filters.maxAmount)}`);
  if (filters.q) {
    const pattern = toIlikePattern(filters.q);
    if (pattern) {
      const p = param(pattern);
      where.push(`(e.note ilike ${p} or c.name ilike ${p})`);
    }
  }

  return { where: where.join(" and "), params, param };
}
