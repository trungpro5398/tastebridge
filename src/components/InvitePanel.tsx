"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Invite friends at the table (scan) or in a group chat (copy / share). */
export default function InvitePanel({ title, onClose }: { title: string; onClose: () => void }) {
  // Only ever rendered after a click, so window is available on first render.
  const [url] = useState(() => window.location.href.split("#")[0].split("?")[0]);
  const [canShare] = useState(() => "share" in navigator);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#1f1a17", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5" role="dialog" aria-label="Invite friends">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Invite your group</p>
          <p className="text-sm text-muted">Scan at the table, or send the link to your group chat.</p>
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-soft">
          ×
        </button>
      </div>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR code for this huddle" className="size-[180px] shrink-0 rounded-xl border border-line" />
        ) : (
          <div className="size-[180px] shrink-0 animate-pulse rounded-xl bg-soft" />
        )}
        <div className="w-full min-w-0 space-y-2">
          <p className="break-all rounded-xl bg-soft px-3 py-2 font-mono text-xs">{url}</p>
          <div className="flex gap-2">
            <button onClick={copy} className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background">
              {copied ? "Copied ✓" : "Copy link"}
            </button>
            {canShare && (
              <button
                onClick={() =>
                  navigator.share({ title, text: "Add your 3 favourites so we can decide:", url }).catch(() => {})
                }
                className="rounded-xl border border-line px-3 py-2 text-sm hover:bg-soft"
              >
                Share…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
