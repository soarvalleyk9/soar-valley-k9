"use client";

import { useState } from "react";
import { checkInAction } from "@/app/actions/admin";
import { SubmitButton } from "./submit-button";

export function CheckInForm() {
  const [note, setNote] = useState<string | null>(null);

  async function scan() {
    setNote(null);
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setNote("This phone can't scan. Type the 6-character code instead.");
      return;
    }
    const video = document.getElementById("checkin-video") as HTMLVideoElement | null;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      video.srcObject = stream;
      video.classList.remove("hidden");
      await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      const started = Date.now();
      const timer = window.setInterval(async () => {
        if (Date.now() - started > 20000) {
          window.clearInterval(timer);
          stream.getTracks().forEach((track) => track.stop());
          setNote("No code seen. Type it instead.");
          return;
        }
        const codes = await detector.detect(video).catch(() => []);
        const value = codes[0]?.rawValue;
        if (!value) return;
        window.clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
        const input = document.getElementById("checkin-code") as HTMLInputElement | null;
        if (input) input.value = value;
        input?.form?.requestSubmit();
      }, 600);
    } catch {
      setNote("Camera permission is needed to scan. You can still type the code.");
    }
  }

  return (
    <form action={checkInAction} className="stack">
      <label className="stack">
        <span className="label">Check-in code</span>
        <input id="checkin-code" className="input text-2xl tracking-[0.2em] uppercase" name="code" autoComplete="off" required />
      </label>
      <SubmitButton>Check in</SubmitButton>
      <button className="btn btn-quiet btn-block" type="button" onClick={scan}>
        Scan QR code
      </button>
      <video id="checkin-video" className="hidden w-full rounded-2xl" muted playsInline />
      {note ? <p>{note}</p> : null}
    </form>
  );
}
