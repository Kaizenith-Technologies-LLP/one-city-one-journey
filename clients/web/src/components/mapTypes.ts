export type MapLine = { id: string; kind: "ride" | "walk"; points: [number, number][]; label?: string };

export type MapMarker = { id: string; kind: "start" | "end" | "hub" | "pick"; lat: number; lng: number; label: string };

export type MapProps = {
  lines?: MapLine[];
  markers?: MapMarker[];
  /** Area to show when there are no lines or markers. */
  bounds?: { south: number; west: number; north: number; east: number };
  onPick?: (lat: number, lng: number) => void;
  label: string;
  className?: string;
};
