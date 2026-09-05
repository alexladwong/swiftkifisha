// Transactional email delivery for Convex HTTP actions (Brevo/Sendinblue API).
// fetch is available in HTTP actions; mutations must NOT call this directly.
// Without SENDINBLUE_API_KEY the helpers skip silently (reset links stay in
// logs / devResetLink, matching the pre-email fallback).

function fromParts() {
  const raw = process.env.EMAIL_FROM || process.env.NEWSLETTER_FROM_EMAIL || "LADSU <sales@ladwongsu.com>";
  const m = /^(.*?)\s*<([^>]+)>/.exec(raw);
  return m
    ? { name: m[1].trim() || "LADSU", email: m[2].trim() }
    : { name: "LADSU", email: raw.trim() };
}

const resetHtml = (resetLink: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="margin:0 0 4px">SwiftKifisha</h2>
  <p style="color:#475569;margin:0 0 20px">Reset your password</p>
  <p style="color:#0f172a;line-height:1.6">We received a request to reset the password for your SwiftKifisha account. Use the button below — the link expires in 60 minutes and can be used once.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${resetLink}" style="background:#f97316;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Set a new password</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;line-height:1.6">If you did not request this, you can safely ignore this email — your password will not change.<br/>If the button does not work, copy and open this link: <span style="color:#334155">${resetLink}</span></p>
</div>`;

const otpHtml = (code: string) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="margin:0 0 4px">SwiftKifisha</h2>
  <p style="color:#475569;margin:0 0 20px">Admin sign-in code</p>
  <p style="color:#0f172a;line-height:1.6">Use this one-time code to sign in to the SwiftKifisha admin dashboard. It expires in 5 minutes.</p>
  <p style="text-align:center;margin:24px 0;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0f172a">${code}</p>
  <p style="font-size:12px;color:#94a3b8;line-height:1.6">Never share this code with anyone. SwiftKifisha staff will never ask for it. If you did not request it, you can ignore this email.</p>
</div>`;

/** Sends the admin OTP sign-in email via Brevo (false when unconfigured). */
export async function sendOtpEmail({ to, code }: { to: string; code: string }): Promise<boolean> {
  const key = process.env.SENDINBLUE_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": key,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: fromParts(),
      to: [{ email: to }],
      subject: "Your SwiftKifisha admin sign-in code",
      htmlContent: otpHtml(code),
    }),
  });
  if (!res.ok) {
    throw new Error("Brevo " + res.status + ": " + (await res.text()));
  }
  return true;
}

/**
 * Sends the password-reset email via Brevo. Resolves false when no API key is
 * configured; throws when Brevo rejects the request.
 */
export async function sendPasswordResetEmail({ to, resetLink }: { to: string; resetLink: string }): Promise<boolean> {
  const key = process.env.SENDINBLUE_API_KEY;
  if (!key) return false;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": key,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: fromParts(),
      to: [{ email: to }],
      subject: "Reset your SwiftKifisha password",
      htmlContent: resetHtml(resetLink),
    }),
  });
  if (!res.ok) {
    throw new Error("Brevo " + res.status + ": " + (await res.text()));
  }
  return true;
}
