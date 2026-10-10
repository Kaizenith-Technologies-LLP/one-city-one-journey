"use client";

import { Fragment, useEffect, useState } from "react";
import { api, qs } from "@/lib/api";
import type { AuditEntry, Paged } from "@/lib/types";
import { Alert, Button, Empty, PageHeader, Pager, TableWrap, useLoad } from "@/components/ui";

const LIMIT = 50;
const ENTITIES = ["stop", "platform", "line", "fares", "settings", "ticket"];
const ACTION_STYLE: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700",
  update: "bg-sky-50 text-sky-700",
  delete: "bg-red-50 text-red-700",
  suspend: "bg-amber-50 text-amber-800",
  cancel: "bg-red-50 text-red-700",
};

export default function AuditPage() {
  const [entity, setEntity] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setOffset(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useLoad(() => api<Paged<AuditEntry>>(`/admin/audit${qs({ entity, q: query, limit: LIMIT, offset })}`), [entity, query, offset]);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin write, newest first" actions={<Button onClick={reload}>Refresh</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-[12rem]" value={entity} onChange={(e) => { setEntity(e.target.value); setOffset(0); }}>
          <option value="">All entities</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      <TableWrap>
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">When</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">Id</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((e) => (
              <Fragment key={e.id}>
                <tr className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-xs">{new Date(e.at).toLocaleString("en-IN")}</td>
                  <td className="td"><span className={`rounded px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[e.action] ?? "bg-slate-100 text-slate-700"}`}>{e.action}</span></td>
                  <td className="td">{e.entity}</td>
                  <td className="td font-mono text-xs">{e.entityId ?? "-"}</td>
                  <td className="td text-right">
                    {Object.keys(e.details ?? {}).length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>{expanded === e.id ? "Hide" : "Details"}</Button>
                    )}
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 px-3 py-2">
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-slate-700">{JSON.stringify(e.details, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {data && !data.items.length && <Empty>{loading ? "Loading..." : "No audit entries yet."}</Empty>}
        {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </TableWrap>
    </>
  );
}
