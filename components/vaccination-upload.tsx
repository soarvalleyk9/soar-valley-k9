"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { registerVaccinationAction } from "@/app/actions/account";

export function VaccinationUpload({ url, anonKey, userId }: { url: string; anonKey: string; userId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("files");
    const files = input instanceof HTMLInputElement ? Array.from(input.files ?? []) : [];
    if (files.length === 0) {
      setMessage("Choose a photo or PDF first.");
      return;
    }
    setPending(true);
    setMessage(null);
    const supabase = createBrowserClient(url, anonKey);
    try {
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 10MB.`);
        }
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("vaccination-records").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw new Error(error.message);
        const data = new FormData();
        data.set("path", path);
        data.set("file_name", file.name);
        data.set("content_type", file.type);
        const result = await registerVaccinationAction(data);
        if (result?.error) throw new Error(result.error);
      }
      window.location.href =
        "/account?ok=" + encodeURIComponent("Uploaded. We'll email you when the records have been checked.");
    } catch (err) {
      setPending(false);
      setMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label className="stack">
        <span className="label">Vaccination card photos</span>
        <input
          className="input"
          name="files"
          type="file"
          accept="image/*,.heic,.heif,.pdf,application/pdf"
          multiple
          required
        />
      </label>
      <p className="muted">JPG, PNG, HEIC or PDF. Up to 10MB each. You can take a photo with your phone.</p>
      {message ? (
        <p className="flash flash-bad" role="alert">
          {message}
        </p>
      ) : null}
      <button className="btn btn-secondary btn-block" disabled={pending} type="submit">
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
