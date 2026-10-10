"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/** Native modal dialog: traps focus, closes on Escape and returns focus to the opener. */
export default function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-primary/50"
    >
      {open ? (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:text-brand" aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
