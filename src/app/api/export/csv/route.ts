import type { NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { isIsoDate } from "@/lib/dates";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { getCurrentUser, getProfile } from "@/server/auth";
import { listExpenses } from "@/server/data/expenses";

const MAX_ROWS = 50_000;

/** CSV of the signed-in person's expenses: /api/export/csv?from=YYYY-MM-DD&to=YYYY-MM-DD (both optional). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in first.", { status: 401 });
  const profile = await getProfile();
  if (!profile) return new Response("Please finish setting up your account first.", { status: 403 });

  const from = request.nextUrl.searchParams.get("from") ?? undefined;
  const to = request.nextUrl.searchParams.get("to") ?? undefined;
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to)) || (from && to && from > to)) {
    return new Response("Choose a valid date range.", { status: 400 });
  }

  const { rows } = await withUserTransaction(user.id, (db) => listExpenses(db, { page: 0, from, to }, MAX_ROWS));
  const name = `spendwise-auto-expenses${from ? `-${from}` : ""}${to ? `-to-${to}` : ""}.csv`;

  return new Response(toCsv(rows, profile.currency), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
