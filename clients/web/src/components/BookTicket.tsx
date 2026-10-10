"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { lineLabel, rupees } from "@/lib/format";
import { rememberTicket } from "@/lib/myTickets";
import type { Option, Ticket } from "@/lib/types";
import { InfoIcon, TicketIcon } from "./icons";
import Modal from "./Modal";
import { Notice, btn } from "./ui";

type Props = {
  request: { from: string; to: string; fromName?: string; toName?: string; depart: string };
  fromName: string;
  toName: string;
  option: Option;
};

export default function BookTicket({ request, fromName, toName, option }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rides = option.legs.flatMap((l) => (l.type === "ride" ? [l] : []));

  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const ticket = await api<Ticket>("/tickets", {
        method: "POST",
        body: { ...request, signature: option.signature, optionId: option.id, channel: "web" },
      });
      rememberTicket(ticket.id);
      router.push(`/ticket/${ticket.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={`${btn.primary} w-full`} onClick={() => setOpen(true)}>
        <TicketIcon className="h-5 w-5" />
        Book ticket, {rupees(option.fare)}
      </button>
      <p className="mt-2 flex items-start gap-2 text-sm text-muted">
        <InfoIcon className="mt-0.5 h-4 w-4" />
        Payment at counter, online payment coming soon.
      </p>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Confirm your ticket">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">From</dt>
            <dd className="text-right font-medium">{fromName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">To</dt>
            <dd className="text-right font-medium">{toName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Departs</dt>
            <dd className="text-right font-medium">
              {option.leaveTime}, arrives {option.arriveTime}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Lines</dt>
            <dd className="text-right font-medium">{rides.map((r) => lineLabel(r)).join(", ")}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base">
            <dt className="font-semibold">Fare</dt>
            <dd className="font-bold">{rupees(option.fare)}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <Notice title="Payment at counter, online payment coming soon">
            Nothing is charged online. You pay the fare at the counter.
          </Notice>
        </div>
        {error ? (
          <div className="mt-3">
            <Notice tone="error" title="The ticket was not booked">
              {error}
            </Notice>
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={btn.primary} onClick={book} disabled={busy}>
            {busy ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      </Modal>
    </>
  );
}
