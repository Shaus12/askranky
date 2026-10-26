"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Row } from "@/lib/i18n-pricing";
// Plan comparison table. Static first paint uses the "coming soon" wording; cells with an `on` variant switch only when
// /api/pricing reports the job enabled (autoRescan for the cadence row, digest for the summary row).
export default function PlanCompare({ rows, plans, feature }: { rows: Row[]; plans: string[]; feature: string }) {
  const [f, setF] = useState<{ autoRescan?: boolean; digest?: boolean }>({});
  useEffect(() => { api<{ autoRescan?: boolean; digest?: boolean }>("/api/pricing").then(setF).catch(() => {}); }, []);
  const on = (k: string) => (k === "cad" ? !!f.autoRescan : k === "digest" ? !!f.digest : false);
  const txt = (c: Row["cells"][number], k: string) => (typeof c === "string" ? c : on(k) ? c.on : c.soon);
  return (
    <div className="pc-wrap" role="region" aria-label={feature} tabIndex={0}>
      <table className="pc-table">
        <thead><tr><th scope="col">{feature}</th>{plans.map((p, i) => <th key={p} scope="col" className={i === 2 ? "pc-hot" : ""}>{p}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.k} data-row={r.k}><th scope="row">{r.label}</th>{r.cells.map((c, i) => { const t = txt(c, r.k); const soon = /coming soon|בקרוב/i.test(t);
            return <td key={i} className={`${i === 2 ? "pc-hot" : ""} ${soon ? "pc-soon" : ""}`}>{t}</td>; })}</tr>))}</tbody>
      </table>
    </div>);
}
