"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function PushToggle({ publicKey }: { publicKey: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function enable() {
    setMessage(null);
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("This browser can't show phone alerts. Email alerts still work.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("Alerts stayed off. You can turn them on in the phone's browser settings.");
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    setMessage(response.ok ? "Phone alerts are on for this device." : "We couldn't save the alert. Email still works.");
  }

  return (
    <div className="stack">
      <button className="btn btn-secondary btn-block" type="button" onClick={enable}>
        Turn on phone alerts
      </button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
