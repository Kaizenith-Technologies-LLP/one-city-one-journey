"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map only ever renders in the browser. */
const TransitMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-xl border border-line bg-brand-soft" aria-hidden />,
});

export default TransitMap;
