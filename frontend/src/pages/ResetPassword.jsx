import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { resetPassword } from "@/lib/authApi";
import { useI18n } from "@/i18n";

/**
 * Landing page for password-reset links: /reset-password?token=…
 * Validates client-side, POSTs { token, newPassword } to /auth/reset-password
 * and shows success/failure states.
 */
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token, newPassword: form.password });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.message || t("auth.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const invalidLink = Boolean(token) === false;

  return (
    <div className="min-h-[60vh] pb-24 pt-14 md:pt-20">
      <div className="shell-md mx-auto max-w-md">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Package className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
              Swift<span className="text-accent">Kifisha</span>
            </span>
          </div>

          <Card className="border-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_44px_-26px_rgba(15,23,42,0.25)] sm:border sm:border-border sm:shadow-sm">
            <CardContent className="p-7 md:p-9">
              {done ? (
                <div className="space-y-4 text-center" aria-live="polite">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </span>
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("auth.resetSuccessTitle")}</h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.resetSuccessDesc")}</p>
                  </div>
                  <Link to="/" className="block">
                    <Button className="h-[50px] w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      {t("auth.resetSuccessCta")}
                    </Button>
                  </Link>
                </div>
              ) : invalidLink ? (
                <div className="space-y-4 text-center" aria-live="polite">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-7 w-7" />
                  </span>
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("auth.resetInvalidTitle")}</h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.errorRequiredToken")}</p>
                  </div>
                  <Link to="/forgot-password" className="block">
                    <Button variant="outline" className="h-[50px] w-full rounded-[10px] border-border font-semibold text-foreground">
                      {t("auth.resetRequestNew")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">{t("auth.resetTitle")}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.resetDesc")}</p>

                  <form onSubmit={submit} className="mt-7 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rp-password">{t("auth.resetNewPassword")}</Label>
                      <Input
                        id="rp-password"
                        type={show ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder={t("auth.placeholderPassword8")}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="h-[50px] rounded-[10px] border-border bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rp-confirm">{t("auth.resetConfirm")}</Label>
                      <Input
                        id="rp-confirm"
                        type={show ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder={t("auth.placeholderPassword8")}
                        value={form.confirm}
                        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                        className="h-[50px] rounded-[10px] border-border bg-white"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 rounded border-border accent-[hsl(25_95%_53%)]" />
                      {t("auth.showPasswords")}
                    </label>
                    {error && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                    <Button type="submit" disabled={busy} className="h-[50px] w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      {busy ? t("auth.resetLoading") : t("auth.resetSubmit")}
                    </Button>
                  </form>

                  <div className="mt-6 border-t border-border/70 pt-4">
                    <Link to="/forgot-password" className="text-[13px] font-semibold text-primary hover:underline">
                      {t("auth.resetRequestNew")}
                    </Link>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
