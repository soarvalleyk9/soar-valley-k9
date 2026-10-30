"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "quiet";
}) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn btn-${variant} btn-block`} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
