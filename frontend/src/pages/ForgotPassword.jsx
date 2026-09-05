import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/authApi";
import { useI18n } from "@/i18n";

/**
 * Standalone "forgot password" page (deep link from the sign-in dialog).
 * POSTs to /auth/forgot-password and, when the API returns a dev reset link
 * (no email provider configured yet), shows it so the flow can be completed.
 */
export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(null); // { message?, devResetLink?, error? }

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setState(null);
    try {
      const data = await requestPasswordReset(email.trim());
      setState({ message: data?.message, devResetLink: data?.devResetLink });
    } catch (error) {
      setState({ error: error?.response?.data?.message || t("auth.errorGeneric") });
    } finally {
      setBusy(false);
    }
  };

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
              {state?.message ? (
                <div className="space-y-4 text-sm" aria-live="polite">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <MailCheck className="h-6 w-6" />
                  </span>
                  <div>
                    <h1 className="font-display text-xl font-bold text-foreground">{t("auth.forgotTitle")}</h1>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      {state.message || t("auth.forgotSent")}
                    </p>
                  </div>
                  {state.devResetLink && (
                    <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs">
                      <p className="mb-1 font-semibold text-slate-500">{t("auth.devLinkLabel")}</p>
                      <a href={state.devResetLink} className="break-all text-primary underline underline-offset-2">
                        {state.devResetLink}
                      </a>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <Link to="/" className="text-[13px] font-semibold text-primary hover:underline">
                      {t("auth.backToHome")}
                    </Link>
                    <button type="button" onClick={() => setState(null)} className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                      {t("auth.forgotResend")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t("auth.forgotTitle")}</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("auth.forgotDesc")}</p>

                  <form onSubmit={submit} className="mt-7 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fp-email">{t("auth.labelEmail")}</Label>
                      <Input
                        id="fp-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder={t("auth.placeholderEmail")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-[50px] rounded-[10px] border-border bg-white"
                      />
                    </div>
                    {state?.error && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                        {state.error}
                      </p>
                    )}
                    <Button type="submit" disabled={busy} className="h-[50px] w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      {busy ? t("auth.forgotLoading") : t("auth.forgotSubmit")}
                    </Button>
                  </form>

                  <div className="mt-6 border-t border-border/70 pt-4">
                    <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.backToHome")}
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
