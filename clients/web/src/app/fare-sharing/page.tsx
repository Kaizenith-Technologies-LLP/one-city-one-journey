import type { Metadata } from "next";
import FareSharingView from "@/components/FareSharingView";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Fare sharing" };

export default function FareSharingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Fare sharing" intro="How the money from one integrated ticket is split between the operators that carry you." />
      <FareSharingView />
    </div>
  );
}
