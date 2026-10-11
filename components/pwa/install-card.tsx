"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(isIos());
    if (isStandalone()) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setBusy(false);
      setDeferred(null);
    }
  }

  // iOS Safari has no install prompt — guide to Share → Add to Home Screen.
  if (ios && !deferred) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="font-bold text-ink">Install CrediScout on this iPhone/iPad</p>
        <p className="mt-1 text-sm text-slate-600">
          Tap <span className="font-semibold">Share</span> in Safari, then{" "}
          <span className="font-semibold">Add to Home Screen</span> → Add.
        </p>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-white">
        ◈
      </div>
      <div className="flex-1">
        <p className="font-bold text-ink">Install CrediScout app</p>
        <p className="text-[13px] text-slate-500">Home-screen icon, full-screen, works offline-ready.</p>
      </div>
      <Button onClick={install} disabled={busy}>
        {busy ? "Installing…" : "Install"}
      </Button>
    </div>
  );
}
