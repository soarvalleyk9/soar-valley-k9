export function publicDbError(error: { message?: string } | null | undefined): string {
  const raw = error?.message?.trim() || "";
  if (!raw) return "Something went wrong. Please try again or call us.";
  const cleaned = raw.replace(/^.*ERROR:\s*/i, "").split("\n")[0].trim();
  if (/schema cache|does not exist|could not find the function|relation /i.test(cleaned)) {
    return "Online booking is not fully switched on yet. Please call or email us and we will book you in.";
  }
  if (/jwt|stack|secret|password|api key|violates|constraint|syntax/i.test(cleaned)) {
    return "Something went wrong. Please try again or call us.";
  }
  if (cleaned.length > 180) return "Something went wrong. Please try again or call us.";
  return cleaned;
}

export function safeNextPath(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return fallback;
  }
  return value;
}
