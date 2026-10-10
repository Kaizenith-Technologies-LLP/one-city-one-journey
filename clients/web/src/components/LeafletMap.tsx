"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MapProps } from "./mapTypes";

const icons = new Map<string, L.DivIcon>();

function markerIcon(kind: string, text: string) {
  const key = `${kind}:${text}`;
  if (!icons.has(key)) {
    const size = kind === "hub" ? 22 : 28;
    icons.set(
      key,
      L.divIcon({
        className: "",
        html: `<span class="oj-marker oj-marker-${kind}">${text}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    );
  }
  return icons.get(key)!;
}

/** Leaflet writes stroke colours as SVG attributes, so read them from the CSS tokens. */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const MARKER_TEXT ={ start: "A", end: "B", hub: "", pick: "" } as const;

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  const key = JSON.stringify(bounds);
  useEffect(() => {
    map.fitBounds(JSON.parse(key), { padding: [32, 32], maxZoom: 16 });
  }, [map, key]);
  return null;
}

function PickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LeafletMap({ lines = [], markers = [], bounds, onPick, label, className = "h-80" }: MapProps) {
  const fit = useMemo<L.LatLngBoundsExpression | null>(() => {
    const pts: [number, number][] = [...lines.flatMap((l) => l.points), ...markers.filter((m) => m.kind !== "pick").map((m) => [m.lat, m.lng] as [number, number])];
    if (pts.length) return pts;
    return bounds ? [[bounds.south, bounds.west], [bounds.north, bounds.east]] : null;
  }, [lines, markers, bounds]);

  if (!fit) return null;

  return (
    <div role="region" aria-label={label} className={`overflow-hidden rounded-xl border border-line ${className}`}>
      <MapContainer bounds={fit as L.LatLngBoundsExpression} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={fit} />
        {lines.map((l) => (
          <Polyline
            key={l.id}
            positions={l.points}
            pathOptions={
              l.kind === "ride"
                ? { color: token("--primary"), weight: 6, opacity: 0.9 }
                : { color: token("--neutral"), weight: 4, dashArray: "6 8" }
            }
          >
            {l.label ? <Tooltip sticky>{l.label}</Tooltip> : null}
          </Polyline>
        ))}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon(m.kind, MARKER_TEXT[m.kind])} title={m.label} alt={m.label}>
            <Tooltip>{m.label}</Tooltip>
          </Marker>
        ))}
        {onPick ? <PickHandler onPick={onPick} /> : null}
      </MapContainer>
    </div>
  );
}
