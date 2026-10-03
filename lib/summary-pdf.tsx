import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SummaryData } from "./summary-data";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#1f2937", lineHeight: 1.45 },
  brand: { fontSize: 10, color: "#0B3D91", fontWeight: "bold", marginBottom: 2 },
  title: { fontSize: 17, fontWeight: "bold", color: "#0F1E33", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#64748B", marginBottom: 12 },
  decision: { fontSize: 12, fontWeight: "bold", backgroundColor: "#0F1E33", color: "#ffffff", padding: 8, marginBottom: 4 },
  headline: { fontSize: 11, fontWeight: "bold", marginBottom: 8 },
  h2: { fontSize: 11, fontWeight: "bold", color: "#0B3D91", marginTop: 10, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingBottom: 2 },
  row: { flexDirection: "row", marginBottom: 2 },
  label: { width: "32%", fontWeight: "bold" },
  value: { width: "68%" },
  li: { marginBottom: 2 },
  table: { marginTop: 4 },
  thead: { flexDirection: "row", backgroundColor: "#EEF2F7", fontWeight: "bold" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  th: { width: "16.6%", padding: 3 },
  td: { width: "16.6%", padding: 3 },
  footer: { marginTop: 14, fontSize: 8, color: "#64748B" },
});

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{k}</Text>
      <Text style={s.value}>{v}</Text>
    </View>
  );
}

export function SummaryPdf({ d }: { d: SummaryData }) {
  const r = d.recommendation;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>CrediScout — Credit Assessment Summary</Text>
        <Text style={s.title}>{d.borrowerName}</Text>
        <Text style={s.subtitle}>
          {d.product} · Status: {d.status} · Generated {new Date().toLocaleDateString("en-NG")}
        </Text>

        {r && (
          <View>
            <Text style={s.decision}>RECOMMENDATION: {r.decision}</Text>
            <Text style={s.headline}>
              {r.amount} · {r.tenor} months · {r.rate} ({r.rateBasis})
            </Text>
          </View>
        )}

        <Text style={s.h2}>1–2 · Borrower &amp; loan request</Text>
        <KV k="Borrower" v={`${d.borrowerName} (${d.borrowerType})`} />
        <KV k="Client status" v={`${d.clientStatus}${d.clientVerified ? " (verified)" : " (UNVERIFIED)"}`} />
        <KV k="Product" v={d.product} />
        <KV k="Purpose" v={d.loanPurpose} />
        <KV k="Repayment source" v={d.repaymentSource} />
        <KV k="Frequency" v={d.frequency} />

        {d.financials && (
          <View>
            <Text style={s.h2}>3–4 · Financial position &amp; capacity</Text>
            <KV k="Revenue" v={d.financials.revenue} />
            <KV k="Operating expenses" v={d.financials.opex} />
            <KV k="Net surplus" v={d.financials.net} />
            <KV k="Cash flow" v={d.financials.cashFlow} />
            <KV k="Existing service" v={d.financials.existingService} />
            <KV k="Proposed service" v={d.financials.proposedService} />
            <KV k="DTI" v={d.financials.dti ?? "—"} />
            <KV k="DSCR" v={d.financials.dscr ?? "—"} />
            {d.financials.notes ? <Text style={s.li}>Notes: {d.financials.notes}</Text> : null}
          </View>
        )}

        {d.credit && (
          <View>
            <Text style={s.h2}>5 · Credit profile</Text>
            <KV k="History grade" v={d.credit.grade ?? "—"} />
            <KV k="Total exposure" v={d.credit.exposure} />
            <KV k="Utilisation" v={d.credit.utilization ?? "—"} />
            <KV k="Guarantor load" v={d.credit.guarantor} />
          </View>
        )}

        {d.qualitative && (
          <View>
            <Text style={s.h2}>6 · Business assessment</Text>
            <KV k="Score" v={d.qualitative.score ?? "—"} />
            <KV k="Band" v={d.qualitative.band ?? "—"} />
            {d.qualitative.weakest.length > 0 ? <Text style={s.li}>Watch: {d.qualitative.weakest.join("; ")}</Text> : null}
            {d.qualitative.notes ? <Text style={s.li}>Notes: {d.qualitative.notes}</Text> : null}
          </View>
        )}

        <Text style={s.h2}>7 · Security {d.coveragePct ? `(coverage ${d.coveragePct})` : ""}</Text>
        {d.collaterals.length === 0 ? <Text style={s.li}>No security registered.</Text> : null}
        {d.collaterals.map((c, i) => (
          <Text key={i} style={s.li}>
            {c.type}: {c.value} · encumbrances {c.encumbrances} · LTV {c.ltv ?? "—"} · docs {c.docs}
          </Text>
        ))}

        {d.productAssessment && (
          <View>
            <Text style={s.h2}>8 · Product-specific</Text>
            {Object.entries(d.productAssessment.fields).map(([k, v]) => (
              <Text key={k} style={s.li}>{k}: {v}</Text>
            ))}
            {d.productAssessment.notes ? <Text style={s.li}>Notes: {d.productAssessment.notes}</Text> : null}
          </View>
        )}

        <Text style={s.h2}>9–11 · Strengths, risks, mitigations</Text>
        {d.strengths.map((x) => (
          <Text key={x} style={s.li}>+ {x}</Text>
        ))}
        {d.risks.map((x) => (
          <Text key={x.title} style={s.li}>! [{x.severity}] {x.title}</Text>
        ))}
        {d.mitigations.map((x) => (
          <Text key={x} style={s.li}>- Mitigation: {x}</Text>
        ))}

        {r && (
          <View>
            <Text style={s.h2}>12–18 · Facility, terms &amp; decision</Text>
            <KV k="Recommended" v={`${r.amount} · ${r.tenor} months`} />
            <KV k="Rate" v={`${r.rate} (${r.rateBasis})`} />
            <KV k="Instalment" v={r.instalment} />
            <KV k="Total interest" v={r.totalInterest} />
            {r.ear ? <KV k="Effective annual rate" v={`${r.ear}%`} /> : null}
            <KV k="Basis" v={r.reasons} />
            <KV k="Conditions" v={r.conditions ?? "—"} />
            <KV k="Decided" v={r.decided} />
            <View style={s.table}>
              <View style={s.thead}>
                {["Per", "Opening", "Instal.", "Principal", "Interest", "Closing"].map((h) => (
                  <Text key={h} style={s.th}>{h}</Text>
                ))}
              </View>
              {r.schedule.map((row, i) => (
                <View key={i} style={s.tr}>
                  <Text style={s.td}>{row.period}</Text>
                  <Text style={s.td}>{fmt(row.openingKobo)}</Text>
                  <Text style={s.td}>{fmt(row.instalmentKobo)}</Text>
                  <Text style={s.td}>{fmt(row.principalKobo)}</Text>
                  <Text style={s.td}>{fmt(row.interestKobo)}</Text>
                  <Text style={s.td}>{fmt(row.closingKobo)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={s.h2}>Supporting documents</Text>
        {d.documents.length === 0 ? <Text style={s.li}>None submitted.</Text> : null}
        {d.documents.map((x, i) => (
          <Text key={i} style={s.li}>{x.kind} — {x.name} [{x.status}]</Text>
        ))}

        <Text style={s.footer}>
          Generated by CrediScout. Metrics follow the Metric → Value → Meaning → Interpretation pattern;
          rates resolve from the recommended amount band and verified client status.
        </Text>
      </Page>
    </Document>
  );
}

function fmt(kobo: number): string {
  return `N${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}
