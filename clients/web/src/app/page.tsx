import { Suspense } from "react";
import Planner from "@/components/Planner";
import { Loading } from "@/components/ui";

export default function Home() {
  return (
    <Suspense fallback={<Loading label="Loading the journey planner" />}>
      <Planner />
    </Suspense>
  );
}
