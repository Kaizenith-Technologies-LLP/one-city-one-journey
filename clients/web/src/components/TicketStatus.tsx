import type { TicketStatus } from "@/lib/types";
import { CheckIcon, ClockIcon, XCircleIcon } from "./icons";

const STATUS: Record<TicketStatus, { label: string; cls: string; icon: typeof CheckIcon }> = {
  active: { label: "Active", cls: "bg-brand text-on-brand", icon: CheckIcon },
  used: { label: "Used", cls: "bg-brand-soft text-brand", icon: CheckIcon },
  expired: { label: "Expired", cls: "bg-accent-soft text-accent-ink", icon: ClockIcon },
  cancelled: { label: "Cancelled", cls: "bg-accent-soft text-accent-ink", icon: XCircleIcon },
};

export default function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS[status] ?? STATUS.expired;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${s.cls}`}>
      <Icon className="h-4 w-4" />
      {s.label}
    </span>
  );
}
