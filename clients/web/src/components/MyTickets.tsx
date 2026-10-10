"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { istDateTime, rupees } from "@/lib/format";
import { forgetTicket, useMyTickets } from "@/lib/myTickets";
import type { Ticket } from "@/lib/types";
import { ChevronRightIcon, ModeIcon, TicketIcon } from "./icons";
import TicketStatusBadge from "./TicketStatus";
import { Loading, Notice, btn } from "./ui";

type Row = { id: string; ticket?: Ticket; error?: string; missing?: boolean };

export default function MyTickets() {
  const ids = useMyTickets();
  const [rows, setRows] = useState<{ key: string; list: Row[] } | null>(null);
  const key = ids?.join(",") ?? "";

  useEffect(() => {
    if (!key) return;
    let live = true;
    Promise.all(
      key.split(",").map((id) =>
        api<Ticket>(`/tickets/${encodeURIComponent(id)}`).then(
          (ticket): Row => ({ id, ticket }),
          (e: Error): Row => ({ id, error: e.message, missing: e instanceof ApiError && e.status === 404 }),
        ),
      ),
    ).then((list) => live && setRows({ key, list }));
    return () => {
      live = false;
    };
  }, [key]);

  if (ids === null) return <Loading label="Loading your tickets" />;
  if (!ids.length)
    return (
      <Notice title="No tickets on this device yet">
        <p>Tickets you book in this browser are listed here.</p>
        <Link href="/" className={`${btn.primary} mt-3 py-2 text-sm`}>
          Plan a journey
        </Link>
      </Notice>
    );
  if (rows?.key !== key) return <Loading label="Loading your tickets" />;

  return (
    <ul className="space-y-3">
      {rows.list.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-card p-4">
          {r.ticket ? (
            <Link href={`/ticket/${r.id}`} className="flex items-center gap-4 rounded-lg">
              <TicketIcon className="h-6 w-6 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-wider">{r.id}</span>
                  <TicketStatusBadge status={r.ticket.status} />
                </div>
                <p className="mt-1 font-medium">
                  {r.ticket.from.name} to {r.ticket.to.name}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {r.ticket.modes.map((m) => (
                    <ModeIcon key={m} mode={m} className="h-4 w-4" />
                  ))}
                  Booked {istDateTime(r.ticket.createdAt)} IST, {rupees(r.ticket.fare)}
                </p>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-muted" />
            </Link>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-bold tracking-wider">{r.id}</p>
                <p className="text-sm text-muted">{r.missing ? "This ticket is no longer on record." : r.error}</p>
              </div>
              {r.missing ? (
                <button type="button" onClick={() => forgetTicket(r.id)} className={`${btn.secondary} py-1.5 text-sm`}>
                  Remove from list
                </button>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
