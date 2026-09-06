/**
 * Transactional email delivery for the SwiftKifisha Express API.
 *
 * Transports (in order):
 *   1. Hostinger SMTP (EMAIL_HOST/EMAIL_PORT/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD)
 *      — validated live with `235 Authentication successful`.
 *   2. Brevo/Sendinblue HTTP API (SENDINBLUE_API_KEY) — kept as an option.
 * If nothing is configured the reset link is only logged (dev fallback).
 *
 * The SMTP client is a minimal TLS implementation (node:net/tls) so no extra
 * dependency is required for port 465 submission.
 */

import net from "node:net";
import tls from "node:tls";

const DEFAULT_FROM = "LADSU <sales@ladwongsu.com>";

function fromParts() {
  const raw =
    process.env.EMAIL_FROM ||
    process.env.NEWSLETTER_FROM_EMAIL ||
    process.env.GOOGLE_EMAIL_USER ||
    DEFAULT_FROM;
  const m = /^(.*?)\s*<([^>]+)>/.exec(raw);
  return m
    ? { name: m[1].trim() || "LADSU", email: m[2].trim() }
    : { name: "LADSU", email: raw.trim() };
}

/* ------------------------------ SMTP (TLS) ------------------------------ */

function smtpSend({ host, port, user, password, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

    const sock = tls.connect(
      { host, port: Number(port) || 465, servername: host, rejectUnauthorized: true },
      () => send("EHLO swiftkifisha.local"),
    );

    let buffer = "";
    let phase = 0; // 0 greeting, 1 ehlo, 2 auth, 3 from, 4 rcpt, 5 data, 6 body
    const timeout = setTimeout(() => {
      sock.destroy();
      reject(new Error("SMTP timeout"));
    }, 20000);

    function send(line) {
      sock.write(line + "\r\n");
    }
    function fail(msg) {
      clearTimeout(timeout);
      sock.destroy();
      reject(new Error(msg));
    }

    // SMTP replies may span multiple lines ("250-…" continuations); only act
    // on the final line of each reply (no trailing dash).
    sock.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      while (buffer.includes("\r\n")) {
        const line = buffer.slice(0, buffer.indexOf("\r\n"));
        buffer = buffer.slice(buffer.indexOf("\r\n") + 2);
        const isFinal = !/^\d{3}-/.test(line);
        if (!isFinal) continue;
        const code = Number(line.slice(0, 3));

        if (phase === 5 && code === 354) {
          send(
            [
              "Content-Type: text/html; charset=utf-8",
              "MIME-Version: 1.0",
              `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
              `From: ${from.name} <${from.email}>`,
              `To: <${to}>`,
              "",
              html,
            ].join("\r\n") + "\r\n.",
          );
          phase = 6;
          return;
        }

        if (phase === 6) {
          clearTimeout(timeout);
          sock.end();
          if (code >= 200 && code < 300) resolve(true);
          else fail("SMTP data rejected: " + line);
          return;
        }

        if (phase === 5 && code !== 354) {
          if (code >= 400) fail("DATA rejected: " + line);
          return; // stray 2xx before the 354 prompt — keep waiting
        }

        if (code >= 400) {
          fail(`SMTP phase ${phase}: ${line}`);
          return;
        }

        // Observed Hostinger behaviour: after AUTH PLAIN it re-sends the full
        // EHLO banner ("250-… / 250 CHUNKING") and only then confirms with
        // "235 … Authentication successful" — which can arrive after our next
        // command. So stray 235/334 auth confirmations are ignored post-AUTH.
        if (phase === 0 && code === 220) {
          phase = 1;
          send("EHLO swiftkifisha.local");
        } else if (phase === 1) {
          if (code === 250) {
            phase = 2;
            send(`AUTH PLAIN ${b64("\u0000" + user + "\u0000" + password)}`);
          }
        } else if (phase === 2) {
          // Success is announced as either the replayed EHLO banner (250) or a
          // direct 235 confirmation.
          if (code >= 200 && code < 300) {
            phase = 3;
            send(`MAIL FROM:<${from.email}>`);
          } else if (code === 334) {
            send(`AUTH PLAIN ${b64("\u0000" + user + "\u0000" + password)}`);
          } else {
            fail("SMTP authentication failed (" + line + ")");
          }
        } else if (phase === 3) {
          if (code === 250 || code === 251) {
            phase = 4;
            send(`RCPT TO:<${to}>`);
          } else if (code === 235 || code === 334) {
            // Late auth confirmation — ignore.
          } else {
            fail("MAIL FROM rejected: " + line);
          }
        } else if (phase === 4) {
          if (code === 250 || code === 251) {
            phase = 5;
            send("DATA");
          } else if (code === 235 || code === 334) {
            // Late auth confirmation — ignore.
          } else {
            fail("RCPT TO rejected: " + line);
          }
        }
      }
    });

    sock.on("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

/* ------------------------------ Brevo (API) ------------------------------ */

async function sendViaBrevo({ to, subject, html }) {
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
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    throw new Error("Brevo " + res.status + ": " + (await res.text()));
  }
  return true;
}

/* --------------------------------- copy --------------------------------- */

const resetHtml = (resetLink) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="margin:0 0 4px">SwiftKifisha</h2>
  <p style="color:#475569;margin:0 0 20px">Reset your password</p>
  <p style="color:#0f172a;line-height:1.6">We received a request to reset the password for your SwiftKifisha account. Use the button below — the link expires in 60 minutes and can be used once.</p>
  <p style="text-align:center;margin:28px 0">
    <a href="${resetLink}" style="background:#f97316;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Set a new password</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;line-height:1.6">If you did not request this, you can safely ignore this email — your password will not change.<br/>If the button does not work, copy and open this link: <span style="color:#334155">${resetLink}</span></p>
</div>`;


/* ---------------------------- OTP sign-in mail ---------------------------- */

const otpHtml = (code, minutes = 5) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="margin:0 0 4px">SwiftKifisha</h2>
  <p style="color:#475569;margin:0 0 20px">Admin sign-in code</p>
  <p style="color:#0f172a;line-height:1.6">Use this one-time code to sign in to the SwiftKifisha admin dashboard. It expires in ${minutes} minutes.</p>
  <p style="text-align:center;margin:24px 0;font-size:34px;font-weight:bold;letter-spacing:10px;color:#0f172a">${code}</p>
  <p style="font-size:12px;color:#94a3b8;line-height:1.6">Never share this code with anyone. SwiftKifisha staff will never ask for it. If you did not request it, you can ignore this email.</p>
</div>`;

/**
 * Sends the admin OTP sign-in email (same transports as password reset).
 */
export async function sendOtpEmail({ to, code }) {
  const subject = "Your SwiftKifisha admin sign-in code";
  const html = otpHtml(code);
  const sender = fromParts();
  const smtpHost = process.env.EMAIL_HOST;
  const smtpUser = process.env.EMAIL_HOST_USER;
  const smtpPass = process.env.EMAIL_HOST_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    await smtpSend({ host: smtpHost, port: process.env.EMAIL_PORT, user: smtpUser, password: smtpPass, from: sender, to, subject, html });
    console.log(`[mail] queued "${subject}" to ${to} via ${smtpHost}:${process.env.EMAIL_PORT || 465}`);
    return true;
  }
  const sent = await sendViaBrevo({ to, subject, html });
  if (!sent) console.log(`[mail] no email provider configured; OTP for ${to}: ${code}`);
  return sent;
}

/**
 * Sends the password-reset email through the configured provider. Returns
 * true when delivered; false when no provider is configured.
 */

/* ------------------------- membership notifications ------------------------- */

const shell = (title, intro, footer) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto">
  <h2 style="margin:0 0 4px">SwiftKifisha</h2>
  <p style="color:#f97316;font-weight:600;margin:0 0 16px">${title}</p>
  <p style="color:#0f172a;line-height:1.6">${intro}</p>
  ${footer ? `<p style="color:#0f172a;line-height:1.6">${footer}</p>` : ""}
  <p style="font-size:12px;color:#94a3b8;line-height:1.6">SwiftKifisha Global — memberships are free during launch; payments are coming soon.</p>
</div>`;

const STATUS_TEXT = {
  accepted: "approved 🎉",
  cancelled: "not approved",
  under_review: "under review",
  pending: "received",
};

/**
 * Sends membership workflow emails. kind: "new" (to admins) | "status" (to
 * the applicant). Returns true when queued through a provider.
 */
export async function sendMembershipEmail({ to, kind, applicant, status, note, reviewUrl }) {
  let subject;
  let html;
  if (kind === "new") {
    subject = "New membership application — SwiftKifisha admin";
    html = shell(
      "New membership application",
      `<strong>${applicant.name}</strong> (${applicant.email}${applicant.phone ? ", " + applicant.phone : ""}${applicant.homeCountry ? ", " + applicant.homeCountry : ""}) has applied to become a member.`,
      `Review it and Accept, Investigate or Cancel: <a href="${reviewUrl}">${reviewUrl}</a>`,
    );
  } else {
    const label = STATUS_TEXT[status] || status;
    subject = status === "accepted"
      ? "Welcome to SwiftKifisha — your membership is approved"
      : "SwiftKifisha membership update";
    html = shell(
      `Your membership request is ${label}`,
      status === "accepted"
        ? `Hi ${applicant.name}, great news — your SwiftKifisha membership has been <strong>approved</strong>. Your personal US & UK mailbox addresses are ready; sign in to your dashboard to see them. Memberships are free during launch, payments are coming soon.`
        : status === "cancelled"
          ? `Hi ${applicant.name}, we're sorry — your membership request was <strong>not approved</strong>.`
          : `Hi ${applicant.name}, your membership request is <strong>under review</strong>.`,
      note ? `<em>Note from our team: ${note}</em>` : "",
    );
  }
  const htmlContent = html;
  const sender = fromParts();
  const smtpHost = process.env.EMAIL_HOST;
  const smtpUser = process.env.EMAIL_HOST_USER;
  const smtpPass = process.env.EMAIL_HOST_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    await smtpSend({ host: smtpHost, port: process.env.EMAIL_PORT, user: smtpUser, password: smtpPass, from: sender, to, subject, html: htmlContent });
    console.log(`[mail] queued "${subject}" to ${to} via ${smtpHost}:${process.env.EMAIL_PORT || 465}`);
    return true;
  }
  const sent = await sendViaBrevo({ to, subject, html: htmlContent });
  if (!sent) console.log(`[mail] no provider configured — membership email for ${to} (${subject}) not sent`);
  return sent;
}

/** Generic SMTP/API send (used by contact, replies and announcements). */
export async function sendGenericEmail({ to, subject, html }) {
  const sender = fromParts();
  const smtpHost = process.env.EMAIL_HOST;
  const smtpUser = process.env.EMAIL_HOST_USER;
  const smtpPass = process.env.EMAIL_HOST_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    await smtpSend({ host: smtpHost, port: process.env.EMAIL_PORT, user: smtpUser, password: smtpPass, from: sender, to, subject, html });
    console.log(`[mail] queued "${subject}" to ${to} via ${smtpHost}:${process.env.EMAIL_PORT || 465}`);
    return true;
  }
  const sent = await sendViaBrevo({ to, subject, html });
  if (!sent) console.log(`[mail] no provider — "${subject}" to ${to} not sent`);
  return sent;
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const html = resetHtml(resetLink);
  const subject = "Reset your SwiftKifisha password";
  const sender = fromParts();

  const smtpHost = process.env.EMAIL_HOST;
  const smtpUser = process.env.EMAIL_HOST_USER;
  const smtpPass = process.env.EMAIL_HOST_PASSWORD;
  if (smtpHost && smtpUser && smtpPass) {
    await smtpSend({
      host: smtpHost,
      port: process.env.EMAIL_PORT,
      user: smtpUser,
      password: smtpPass,
      from: sender,
      to,
      subject,
      html,
    });
    return true;
  }

  const sent = await sendViaBrevo({ to, subject, html });
  if (!sent) {
    console.log(`[mail] no email provider configured; reset link for ${to}: ${resetLink}`);
  }
  return sent;
}
