import { revalidatePath } from "next/cache";
import { pgErrorCode } from "@/lib/db/queryable";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { expenseInputSchema, toExpenseRow } from "@/schemas/expense";
import { getCurrentUser } from "@/server/auth";
import { insertExpense } from "@/server/data/expenses";
import { friendlyDbError } from "@/server/db-errors";
import { scheduleBudgetAlerts } from "@/server/notifications/live";

const MAX_ITEMS = 200;

/**
 * Receives expenses saved while offline: { items: ExpenseInput[] } (each with its device-made id).
 * Safe to repeat: an id that's already saved is reported as synced, not saved twice.
 * Each expense is saved on its own so one bad item can't block the rest.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items) || body.items.length > MAX_ITEMS) {
    return Response.json({ error: "Send up to 200 expenses as { items: [...] }." }, { status: 400 });
  }

  const synced: string[] = [];
  const rejected: { id: string; error: string }[] = [];

  for (const raw of body.items) {
    const rawId = typeof raw === "object" && raw && "id" in raw && typeof raw.id === "string" ? raw.id : "unknown";
    const parsed = expenseInputSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.id) {
      rejected.push({ id: rawId, error: "Some details of this expense weren't valid." });
      continue;
    }
    try {
      const saved = await withUserTransaction(user.id, (db) => insertExpense(db, toExpenseRow(parsed.data)));
      if (saved) synced.push(parsed.data.id);
      else rejected.push({ id: parsed.data.id, error: "This expense couldn't be saved." });
    } catch (error) {
      rejected.push({ id: parsed.data.id, error: friendlyDbError(pgErrorCode(error), "expense") });
    }
  }

  if (synced.length > 0) {
    revalidatePath("/", "layout");
    scheduleBudgetAlerts(user.id);
  }
  return Response.json({ synced, rejected });
}
