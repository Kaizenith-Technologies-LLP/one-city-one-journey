"use client";

import { useState } from "react";
import { qs, useApi } from "@/lib/api";
import { metres, modeLabel } from "@/lib/format";
import type { Meta, NearStop } from "@/lib/types";
import Modal from "./Modal";
import type { Endpoint } from "./StopSearch";
import TransitMap from "./TransitMap";
import { ErrorState, Loading, btn } from "./ui";

type Props = { target: string | null; onClose: () => void; onPick: (value: Endpoint) => void };

export default function MapPicker({ target, onClose, onPick }: Props) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const meta = useApi<Meta>(target ? "/meta" : null);
  const near = useApi<NearStop[]>(point ? `/stops/nearest${qs({ lat: point.lat.toFixed(5), lng: point.lng.toFixed(5), limit: 1 })}` : null);
  const nearest = near.data?.[0];

  const close = () => {
    setPoint(null);
    onClose();
  };

  const confirm = () => {
    if (!point) return;
    onPick({
      id: `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
      name: nearest ? `Map point near ${nearest.name}` : "Map point",
    });
    close();
  };

  return (
    <Modal open={!!target} onClose={close} title={`Pick ${target ?? ""} on the map`}>
      <p className="mb-3 text-sm text-muted">Tap or click the map to drop a pin. We plan from the nearest stops within walking distance.</p>
      {meta.error ? <ErrorState message={meta.error} onRetry={meta.reload} /> : null}
      {meta.loading ? <Loading label="Loading map" /> : null}
      {meta.data ? (
        <TransitMap
          label="Map for picking a place"
          className="h-80"
          bounds={meta.data.bounds}
          markers={point ? [{ id: "pick", kind: "pick", lat: point.lat, lng: point.lng, label: "Selected point" }] : []}
          onPick={(lat, lng) => setPoint({ lat, lng })}
        />
      ) : null}
      <div className="mt-3 min-h-6 text-sm text-ink" aria-live="polite">
        {!point ? "No point selected yet." : null}
        {point && near.loading ? "Finding the nearest stop…" : null}
        {point && nearest ? `Nearest stop: ${nearest.name} (${modeLabel(nearest.mode)}), ${metres(nearest.distanceM)} away.` : null}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={close}>
          Cancel
        </button>
        <button type="button" className={btn.primary} onClick={confirm} disabled={!point}>
          Use this point
        </button>
      </div>
    </Modal>
  );
}
