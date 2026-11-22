import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { BRAND } from "@/config/brand";
import { PAYMENT_METHOD_LABELS } from "@/config/payment-methods";
import { formatTime } from "@/lib/dates";
import type { Insight } from "@/lib/insights";
import type { ExpenseWithCategory } from "@/lib/types/database";
import type { ReportData } from "@/server/data/reports";

const EMERALD = "#065f46";
const MUTED = "#4b5563";
const BORDER = "#e3e8e5";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold", color: EMERALD },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginTop: 6 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  section: { marginTop: 18 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  total: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  stats: { flexDirection: "row", gap: 24, marginTop: 8 },
  statLabel: { fontSize: 8, color: MUTED },
  statValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#9ca3af", paddingVertical: 4, fontFamily: "Helvetica-Bold", color: MUTED, fontSize: 8 },
  bullet: { flexDirection: "row", gap: 6, marginBottom: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

export interface ReportDocumentProps {
  report: ReportData;
  title: string;
  comparison: string;
  insights: Insight[];
  expenses: ExpenseWithCategory[];
  money: (n: number) => string;
}

/** The PDF report: summary, categories, insights and every expense in the period. */
export function ReportDocument({ report: r, title, comparison, insights, expenses, money }: ReportDocumentProps) {
  const spending = r.categories.filter((c) => c.counts_as_spending);
  const saved = r.categories.filter((c) => !c.counts_as_spending).reduce((sum, c) => sum + c.total, 0);
  return (
    <Document title={`${BRAND.name} report — ${title}`} author={BRAND.name}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>{BRAND.name}</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.subtitle}>
          {r.start} to {r.upTo}
          {r.isCurrent ? " (so far)" : ""}
        </Text>

        <View style={s.section}>
          <Text style={s.statLabel}>Total spending</Text>
          <Text style={s.total}>{money(r.total)}</Text>
          <Text style={{ color: MUTED, marginTop: 2 }}>{comparison}</Text>
          <View style={s.stats}>
            <View>
              <Text style={s.statLabel}>Expenses</Text>
              <Text style={s.statValue}>{r.count}</Text>
            </View>
            {saved > 0 ? (
              <View>
                <Text style={s.statLabel}>Set aside to Savings</Text>
                <Text style={s.statValue}>{money(saved)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {spending.length > 0 ? (
          <View style={s.section}>
            <Text style={s.h2}>By category</Text>
            <View style={s.head}>
              <Text style={{ flex: 3 }}>Category</Text>
              <Text style={{ flex: 1, textAlign: "right" }}>Share</Text>
              <Text style={{ flex: 2, textAlign: "right" }}>Amount</Text>
            </View>
            {spending.map((c) => (
              <View key={c.category_id} style={s.row}>
                <Text style={{ flex: 3 }}>{c.name}</Text>
                <Text style={{ flex: 1, textAlign: "right" }}>{c.share === null ? "" : `${Math.round(c.share)}%`}</Text>
                <Text style={{ flex: 2, textAlign: "right" }}>{money(c.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {insights.length > 0 ? (
          <View style={s.section}>
            <Text style={s.h2}>What stands out</Text>
            {insights.map((i) => (
              <View key={i.id} style={s.bullet}>
                <Text>•</Text>
                <Text style={{ flex: 1 }}>{i.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.h2}>Every expense ({expenses.length})</Text>
          <View style={s.head} fixed>
            <Text style={{ flex: 2 }}>Date</Text>
            <Text style={{ flex: 4 }}>Description</Text>
            <Text style={{ flex: 3 }}>Category</Text>
            <Text style={{ flex: 2 }}>Paid with</Text>
            <Text style={{ flex: 2, textAlign: "right" }}>Amount</Text>
          </View>
          {expenses.map((e) => (
            <View key={e.id} style={s.row} wrap={false}>
              <Text style={{ flex: 2 }}>
                {e.spent_on} {formatTime(e.spent_time)}
              </Text>
              <Text style={{ flex: 4 }}>{e.note ?? "—"}</Text>
              <Text style={{ flex: 3 }}>{e.category.name}</Text>
              <Text style={{ flex: 2 }}>{PAYMENT_METHOD_LABELS[e.payment_method]}</Text>
              <Text style={{ flex: 2, textAlign: "right" }}>{money(e.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>
            {BRAND.name} · {title}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
