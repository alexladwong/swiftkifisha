import { useState } from "react";
import { useSelector } from "react-redux";
import { KeyRound, ShieldCheck, AtSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { axiosInstance } from "@/services/axiosInstance";

const CHANGE_PASSWORD_PATH = import.meta.env.VITE_AUTH_CHANGE_PASSWORD_PATH || "/auth/change-password";

/**
 * Admin Security: change your own admin password (works on the Express and
 * Convex backends via the shared /auth/change-password contract). Admins that
 * sign in with email codes only (no password set) get a clear message.
 */
export default function SecurityPage() {
  const { user } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, message }

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
    } catch (err) {
      setFeedback({
        ok: false,
        message: err?.response?.data?.message || "Could not change your password. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your admin password and session details.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm" aria-label="Change admin password">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="h-5 w-5 text-primary" /> Change password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use at least 8 characters. If you sign in with email codes only, this page tells you —
              password login is optional for OTP admins.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-current">Current password</Label>
            <Input
              id="sec-current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
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
            </div>
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
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Show passwords
          </label>

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
              {busy ? "Updating..." : "Change password"}
            </Button>
          </div>
        </form>

        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Admin account</h2>
          <ul className="space-y-4 text-sm">
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Signed in with full admin access. Passwordless email-code sign-in is available from
                the login screen whenever you need it.
              </p>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
