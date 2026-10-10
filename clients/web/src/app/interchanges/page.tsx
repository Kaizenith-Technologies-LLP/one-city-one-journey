import type { Metadata } from "next";
import InterchangesView from "@/components/InterchangesView";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Interchanges" };

export default function InterchangesPage() {
  return (
    <div>
      <PageHeader title="Interchanges" intro="Stations where you can change between Metro, BRTS, AMTS and GSRTC, with the walk between their stops." />
      <InterchangesView />
    </div>
  );
}
