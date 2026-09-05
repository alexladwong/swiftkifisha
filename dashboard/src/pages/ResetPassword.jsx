import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/authApi";

/**
 * Admin password-reset landing page: /reset-password?token=…
 * Same contract as the customer site reset page.
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, newPassword: form.password });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Set a new password</CardTitle>
            <CardDescription>
              {done ? "Password updated — you can now sign in." : "Choose a new password for your admin account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="space-y-4 text-center py-4">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <Link to="/login" className="block">
                  <Button className="w-full bg-primary hover:bg-primary/90">Go to sign in</Button>
                </Link>
              </div>
            ) : !token ? (
              <div className="space-y-4 text-center py-4">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-7 w-7" />
                </span>
                <p className="text-sm text-muted-foreground">
                  This reset link is missing its security token. Please request a new one.
                </p>
                <Link to="/login" className="block">
                  <Button variant="outline" className="w-full">Request a new link</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirm new password</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repeat the new password"
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  />
                </div>
                {error && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                  {busy ? "Updating..." : "Update password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:underline">← Back to sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
