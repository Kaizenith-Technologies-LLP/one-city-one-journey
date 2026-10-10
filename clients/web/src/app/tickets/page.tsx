import type { Metadata } from "next";
import MyTickets from "@/components/MyTickets";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My tickets" };

export default function TicketsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My tickets" intro="Tickets booked in this browser. Open one to see its code, validity and route." />
      <MyTickets />
    </div>
  );
}
