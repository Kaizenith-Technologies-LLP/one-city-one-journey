"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, API_BASE, setToken } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>("/admin/login", { method: "POST", body: { password }, auth: false });
      setToken(token);
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex gap-0.5">
            {["#1E5BC6", "#D7263D", "#F4A300", "#2A9D8F", "#8E44AD"].map((c) => (
              <span key={c} className="h-8 w-2 rounded-full" style={{ background: c }} />
            ))}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">One Journey Admin</h1>
            <p className="text-xs text-slate-500">Ahmedabad + Gandhinagar integrated transit</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="label">Admin password</span>
            <input className="input" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          </label>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" className="w-full" disabled={busy || !password}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-[11px] text-slate-400">API: {API_BASE}</p>
      </div>
    </div>
  );
}
