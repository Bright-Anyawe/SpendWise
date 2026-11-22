import { renderToBuffer } from "@react-pdf/renderer";
import type { NextRequest } from "next/server";
import { isIsoDate, todayInTimeZone } from "@/lib/dates";
import { withUserTransaction } from "@/lib/db/user-transaction";
import { buildInsights } from "@/lib/insights";
import { formatMoneyCode } from "@/lib/money";
import { ReportDocument } from "@/lib/pdf/report-document";
import { comparisonLabel, monthName, rangeLabel } from "@/lib/view/dashboard";
import { periodNav } from "@/lib/view/reports";
import { getCurrentUser, getProfile } from "@/server/auth";
import { listExpenses } from "@/server/data/expenses";
import { reportData } from "@/server/data/reports";

/** PDF report for a week or month: /api/export/pdf?period=month|week&ref=YYYY-MM-DD */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in first.", { status: 401 });
  const profile = await getProfile();
  if (!profile) return new Response("Please finish setting up your account first.", { status: 403 });

  const params = request.nextUrl.searchParams;
  const period = params.get("period") === "week" ? "week" : "month";
  const today = todayInTimeZone(profile.timezone);
  const requested = params.get("ref") ?? "";
  const ref = isIsoDate(requested) && requested <= today ? requested : today;

  const { report, expenses } = await withUserTransaction(user.id, async (db) => {
    const r = await reportData(db, period, ref);
    const list = await listExpenses(db, { page: 0, from: r.start, to: r.upTo }, 5_000);
    return { report: r, expenses: list.rows };
  });

  const money = (n: number) => formatMoneyCode(n, profile.currency);
  const nav = periodNav(period, report.start, report.end, today);
  const against = report.isCurrent
    ? rangeLabel(report.previous.start, report.previous.end)
    : period === "month"
      ? monthName(report.previous.start)
      : "the week before";
  const title = period === "month" ? nav.label : `Week of ${nav.label}`;

  const pdf = await renderToBuffer(
    <ReportDocument
      report={report}
      title={title}
      comparison={comparisonLabel(report.total, report.previous.total, against).text}
      insights={buildInsights(report, money)}
      expenses={[...expenses].reverse()}
      money={money}
    />,
  );

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="spendwise-auto-${period}-${report.start}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
