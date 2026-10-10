"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellIcon, CloseIcon, CoinsIcon, InterchangeIcon, MenuIcon, SearchIcon, TicketIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Plan a journey", icon: SearchIcon },
  { href: "/alerts", label: "Service alerts", icon: BellIcon },
  { href: "/interchanges", label: "Interchanges", icon: InterchangeIcon },
  { href: "/fare-sharing", label: "Fare sharing", icon: CoinsIcon },
  { href: "/tickets", label: "My tickets", icon: TicketIcon },
];

const isActive = (path: string | null, href: string) =>
  path !== null && (href === "/" ? path === "/" || path.startsWith("/journey") : path.startsWith(href) || (href === "/tickets" && path.startsWith("/ticket/")));

function Links({ path, onNavigate, className }: { path: string | null; onNavigate?: () => void; className: string }) {
  return (
    <ul className={className}>
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-brand"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Navigation without the current-page highlight, used while the path is unknown during prerender. */
export function StaticNav() {
  return (
    <nav aria-label="Main">
      <Links path={null} className="hidden items-center gap-1 lg:flex" />
    </nav>
  );
}

export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <nav aria-label="Main">
      <Links path={path} className="hidden items-center gap-1 lg:flex" />
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink lg:hidden"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
        Menu
      </button>
      {open ? (
        <div id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-card px-4 py-3 shadow-sm lg:hidden">
          <Links path={path} onNavigate={() => setOpen(false)} className="flex flex-col gap-1" />
        </div>
      ) : null}
    </nav>
  );
}
