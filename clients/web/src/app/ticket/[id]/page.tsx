import type { Metadata } from "next";
import { Suspense } from "react";
import TicketView from "@/components/TicketView";
import { Loading } from "@/components/ui";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage() {
  return (
    <Suspense fallback={<Loading label="Loading ticket" />}>
      <TicketView />
    </Suspense>
  );
}
