"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { API_BASE, getToken, setToken } from "@/lib/api";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z" },
  { href: "/brief", label: "Morning brief", icon: "M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8" },
  { href: "/closures", label: "Diversions", icon: "M12 2 2 21h20L12 2zm0 7v5m0 3h.01" },
  { href: "/stations", label: "Stations", icon: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" },
  { href: "/lines", label: "Lines & routes", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/hubs", label: "Interchange hubs", icon: "M12 2 2 7l10 5 10-5-10-5zm-10 10 10 5 10-5M2 17l10 5 10-5" },
  { href: "/fares", label: "Fares", icon: "M6 3h12M6 8h12M14 21 6 13h3a5 5 0 0 0 0-10" },
  { href: "/settings", label: "Fare sharing", icon: "M12 2v20M2 12h20M5 5l14 14" },
  { href: "/tickets", label: "Tickets", icon: "M3 7h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM13 7v12" },
  { href: "/audit", label: "Audit log", icon: "M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Unauthenticated visitors go to /login; any API 401 does the same (lib/api.ts).
  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const logout = () => {
    setToken(null);
    router.replace("/login");
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon d={n.icon} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex gap-0.5">
        {["#1E5BC6", "#D7263D", "#F4A300", "#2A9D8F", "#8E44AD"].map((c) => (
          <span key={c} className="h-6 w-1.5 rounded-full" style={{ background: c }} />
        ))}
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight text-white">One Journey</div>
        <div className="text-[11px] leading-tight text-slate-400">Admin portal</div>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
      <div className="truncate" title={API_BASE}>API: {API_BASE.replace(/^https?:\/\//, "")}</div>
      <button onClick={logout} className="mt-2 text-slate-300 hover:text-white">Sign out</button>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-slate-900 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="sticky top-0 z-40 flex items-center justify-between bg-slate-900 px-4 py-2 lg:hidden">
        {brand}
        <button onClick={() => setMenuOpen((o) => !o)} className="rounded p-2 text-slate-200 hover:bg-white/10" aria-label="Menu">
          <Icon d="M4 6h16M4 12h16M4 18h16" />
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-slate-900">
            {brand}
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
