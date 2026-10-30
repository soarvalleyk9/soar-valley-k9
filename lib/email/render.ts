import { SITE, siteUrl } from "../site";

export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailShell(input: {
  heading: string;
  intro?: string;
  bodyHtml: string;
  site?: string;
}): { html: string; textFooter: string } {
  const base = input.site ?? siteUrl();
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF6FA;color:#1F2D38;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF6FA;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:24px;">
        <tr><td>
          <img src="${esc(base)}/brand/logo-email.png" alt="Soar Valley K9" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin:0 0 16px;">
          <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2;color:#2F5D7B;">${esc(input.heading)}</h1>
          ${input.intro ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${esc(input.intro)}</p>` : ""}
          ${input.bodyHtml}
          <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#1F2D38;">
            ${esc(SITE.venue)}<br>
            ${esc(SITE.addressLines.join(", "))}<br>
            <a href="tel:${esc(SITE.phoneTel)}" style="color:#2F5D7B;">${esc(SITE.phoneDisplay)}</a>
          </p>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.5;">Questions? Reply to this email or call us.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const textFooter = `\n\n${SITE.venue}\n${SITE.addressLines.join(", ")}\n${SITE.phoneDisplay}\nQuestions? Reply to this email or call us.`;
  return { html, textFooter };
}

export function button(href: string, label: string): string {
  return `<p style="margin:16px 0;"><a href="${esc(href)}" style="display:inline-block;background:#3D79A0;color:#ffffff;text-decoration:none;font-weight:700;font-size:18px;line-height:1;padding:16px 22px;border-radius:12px;">${esc(label)}</a></p>`;
}

export function lines(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
    ${rows
      .map(
        ([label, value]) => `<tr>
          <td style="padding:6px 12px 6px 0;font-size:15px;color:#2F5D7B;vertical-align:top;white-space:nowrap;">${esc(label)}</td>
          <td style="padding:6px 0;font-size:16px;font-weight:700;">${esc(value)}</td>
        </tr>`,
      )
      .join("")}
  </table>`;
}

export function bigCode(label: string, value: string): string {
  return `<p style="margin:16px 0 4px;font-size:15px;color:#2F5D7B;">${esc(label)}</p>
    <p style="margin:0 0 8px;font-size:32px;line-height:1.2;letter-spacing:0.18em;font-weight:700;color:#1F2D38;">${esc(value)}</p>`;
}
