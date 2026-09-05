import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, AtSign, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/portalApi";

export default function SecuritySection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast.success("Password changed successfully");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toast.error(err?.response?.data?.message || "We could not change your password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">Security</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Manage your password and account security.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Change password */}
        <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-white p-6 md:p-8" aria-label="Change password">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <KeyRound className="h-5 w-5 text-primary" /> Change password
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Use at least 8 characters with a mix of letters and numbers.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sec-current">Current password</Label>
            <Input id="sec-current" type={show ? "text" : "password"} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="h-[50px] rounded-[10px] border-border bg-white" required />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sec-new">New password</Label>
              <Input id="sec-new" type={show ? "text" : "password"} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="h-[50px] rounded-[10px] border-border bg-white" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-confirm">Confirm new password</Label>
              <Input id="sec-confirm" type={show ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} className="h-[50px] rounded-[10px] border-border bg-white" required />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 rounded border-border accent-[hsl(25_95%_53%)]" />
              Show passwords
            </label>
          </div>

          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button type="submit" disabled={saving} className="h-[48px] rounded-[10px] bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/95">
              {saving ? "Updating..." : "Change password"}
            </Button>
          </div>
        </form>

        {/* Honest status facts */}
        <aside className="h-fit space-y-4 rounded-xl border border-border bg-white p-6">
          <h2 className="font-display text-base font-bold text-foreground">Account security</h2>
          <ul className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck className="" style={{ width: 18, height: 18 }} /></span>
              <div>
                <p className="font-semibold text-foreground">Secure sign-in</p>
                <p className="text-[13px] text-muted-foreground">Managed sessions with encrypted passwords.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-slate-500"><AtSign className="" style={{ width: 18, height: 18 }} /></span>
              <div>
                <p className="font-semibold text-foreground">Email sign-in</p>
                <p className="text-[13px] text-muted-foreground">Your email is your login identifier.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-slate-500"><Smartphone className="" style={{ width: 18, height: 18 }} /></span>
              <div>
                <p className="font-semibold text-foreground">Two-factor authentication</p>
                <p className="text-[13px] text-muted-foreground">Coming soon - we will notify members when it launches.</p>
              </div>
            </li>
          </ul>
          <Link to="/contact" className="mt-2 inline-block text-[13px] font-semibold text-primary hover:underline">
            Something wrong? Contact support
          </Link>
        </aside>
      </div>
    </div>
  );
}