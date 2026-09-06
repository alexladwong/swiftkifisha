import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  AtSign, Fingerprint, KeyRound, ShieldCheck, Timer, CalendarClock, AlertTriangle, Loader2, MailCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { axiosInstance } from "@/services/axiosInstance";

const CHANGE_PASSWORD_PATH = import.meta.env.VITE_AUTH_CHANGE_PASSWORD_PATH || "/auth/change-password";
const ME_PATH = "/auth/me";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function passwordScore(pw) {
  let score = 0;
  if (!pw) return 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return score; // 0..5
}

const POLICY = [
  { ok: (pw) => pw.length >= 8, label: "At least 8 characters" },
  { ok: (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw), label: "Upper and lower case letters" },
  { ok: (pw) => /\d/.test(pw), label: "At least one number" },
  { ok: (pw) => /[^A-Za-z0-9]/.test(pw), label: "At least one symbol" },
];

/**
 * Admin Security — password + session management.
 * - Change your own admin password (shared /auth/change-password contract).
 * - Shows the active sign-in method and current session lifetime from
 *   GET /api/auth/me (JWT sessions expire automatically; tokens can't be
 *   revoked server-side before expiry — signing out clears the local one).
 */
export default function SecurityPage() {
  const { user } = useSelector((state) => state.auth);
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, message }
  const [mailBusy, setMailBusy] = useState(false);
  const [mailNote, setMailNote] = useState(null);
  const [mailOk, setMailOk] = useState(false);

  const sendTestEmail = async () => {
    setMailBusy(true);
    setMailNote(null);
    try {
      const { data } = await axiosInstance.post("/auth/admin/email/test");
      setMailOk(true);
      setMailNote(`${data?.message || "Queued"} — check ${user?.email || "your inbox"} (incl. spam) in the next minute.`);
    } catch (err) {
      setMailOk(false);
      setMailNote(err?.response?.data?.message || "Test email failed — check the backend logs.");
    } finally {
      setMailBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    axiosInstance
      .get(ME_PATH)
      .then(({ data }) => active && setMe(data.user))
      .catch(() => {
        /* offline fallback: rely on Redux user */
      });
    return () => {
      active = false;
    };
  }, []);

  const score = useMemo(() => passwordScore(form.newPassword), [form.newPassword]);
  const scoreLabel = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score];

  const submit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (form.newPassword.length < 8) {
      setFeedback({ ok: false, message: "New password must be at least 8 characters." });
      return;
    }
    if (form.newPassword !== form.confirm) {
      setFeedback({ ok: false, message: "New passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      const { data } = await axiosInstance.post(CHANGE_PASSWORD_PATH, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setFeedback({ ok: true, message: data?.message || "Password changed successfully" });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setMe((m) => ({ ...m, passwordSet: true }));
    } catch (err) {
      setFeedback({
        ok: false,
        message: err?.response?.data?.message || "Could not change your password. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const info = me || user || {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Password, sign-in method and session details for {user?.email || "your admin account"}.
        </p>
      </header>

      {/* Sign-in method banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">
            {info.passwordSet === false
              ? "This admin signs in with email codes only (no password)."
              : "This admin can sign in with a password or an email code."}
          </p>
          <p className="text-xs text-muted-foreground">
            Email-code (OTP) sign-in is always available and can recover access if you forget the
            password.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        {/* Change password */}
        <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm" aria-label="Change admin password">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="h-5 w-5 text-primary" /> Change password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.passwordSet === false
                ? "No current password exists yet — create one by leaving the current field empty (or keep using email codes)."
                : "Use at least 8 characters. Your session stays signed in."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-current">
              {info.passwordSet === false ? "Current password (none yet — optional)" : "Current password"}
            </Label>
            <Input
              id="sec-current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required={info.passwordSet !== false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-new">New password</Label>
            <Input
              id="sec-new"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
            />
            {form.newPassword && (
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Strength: {scoreLabel}</span>
                  <span className="tabular-nums text-muted-foreground">{score}/5</span>
                </div>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={
                        "h-1.5 flex-1 rounded-full " +
                        (i <= score
                          ? score <= 2
                            ? "bg-red-400"
                            : score === 3
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          : "bg-muted")
                      }
                    />
                  ))}
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {POLICY.map((rule) => {
                    const ok = rule.ok(form.newPassword);
                    return (
                      <li
                        key={rule.label}
                        className={
                          "flex items-center gap-1.5 text-[11px] " + (ok ? "text-emerald-600" : "text-muted-foreground")
                        }
                      >
                        <span className={ok ? "text-emerald-500" : "text-slate-400"}>{ok ? "✓" : "•"}</span>
                        {rule.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sec-confirm">Confirm new password</Label>
              <Input
                id="sec-confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={show}
                  onChange={(e) => setShow(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Show passwords
              </label>
            </div>
          </div>

          {feedback && (
            <p
              className={
                "rounded-lg border px-3 py-2 text-sm font-medium " +
                (feedback.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-destructive/20 bg-destructive/10 text-destructive")
              }
              role="status"
            >
              {feedback.message}
            </p>
          )}

          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={busy} className="bg-primary hover:bg-primary/90">
              {busy ? "Updating..." : info.passwordSet === false ? "Set password" : "Change password"}
            </Button>
          </div>
        </form>

        {/* Right column: account + session */}
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Admin account</h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <AtSign className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{user?.name || "Admin"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Fingerprint className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sign-in method</p>
                  <p className="font-medium">
                    {info.passwordSet === false ? "Email code only" : "Password or email code"}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Timer className="h-4 w-4 text-primary" /> Active session
            </h2>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
                  <p className="font-medium">{info.issuedAt ? fmtDate(info.issuedAt) : "—"}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expires</p>
                  <p className="font-medium">{info.sessionExp ? fmtDate(info.sessionExp) : "—"}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Sessions are JWT-based and expire automatically. Signing out clears the session on
                  this device only.
                </p>
              </li>
            </ul>
            <button
              type="button"
              onClick={sendTestEmail}
              disabled={mailBusy}
              className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              {mailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              Send test email to my inbox
            </button>
            {mailNote && (
              <p className={"mt-2 text-xs " + (mailOk ? "text-emerald-600" : "text-destructive")}>{mailNote}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
