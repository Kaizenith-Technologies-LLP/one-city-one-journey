import type { Metadata } from "next";
import { Suspense } from "react";
import JourneyView from "@/components/JourneyView";
import { Loading } from "@/components/ui";

export const metadata: Metadata = { title: "Journey details" };

export default function JourneyPage() {
  return (
    <Suspense fallback={<Loading label="Loading journey" />}>
      <JourneyView />
    </Suspense>
  );
}
