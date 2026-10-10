import type { Metadata } from "next";
import AlertsView from "@/components/AlertsView";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Service alerts" };

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Service alerts" intro="Closures and service changes across Metro, BRTS, AMTS and GSRTC." />
      <AlertsView />
    </div>
  );
}
