import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Package, Clock3, ShieldCheck, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { signupThunk } from "@/features/auth/authSlice";
import { fetchMembershipStatus } from "@/lib/portalApi";
import { useI18n } from "@/i18n";

/**
 * Become a member — application flow. Free during launch (payments coming
 * soon): create your account, our team approves it, and you receive your US/UK
 * mailboxes by email + in your dashboard.
 */
export default function BecomeMemberPage() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const { token, user, loading } = useSelector((state) => state.auth);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [status, setStatus] = useState(null); // { status, note? }
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetchMembershipStatus()
      .then(setStatus)
      .catch(() => setStatus({ status: "accepted" }));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const res = await dispatch(signupThunk({ name: form.name, email: form.email, password: form.password }));
    if (!signupThunk.fulfilled.match(res)) {
      setError(res.payload || "Could not create your account. Please try again.");
    }
  };

  const copy = {
    pending: {
      title: "Application received — pending approval",
      body: "Your account is ready. Our team reviews every application and you'll get your US & UK mailboxes as soon as you're approved. We'll email you — membership is free during launch.",
    },
    under_review: {
      title: "Your application is under review",
      body: "We're taking a closer look. You'll hear from us by email as soon as there's an update.",
    },
    cancelled: {
      title: "Membership request not approved",
      body: "This application was cancelled. Contact our team if you believe this was a mistake.",
    },
  };
  const applied = status && status.status !== "accepted";
  const mcopy = copy[status?.status];

  return (
    <div className="min-h-[70vh] pb-24 pt-14 md:pt-20">
      <div className="shell-md mx-auto max-w-lg">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Package className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="font-display text-xl font-extrabold tracking-tight text-foreground">
                Swift<span className="text-accent">Kifisha</span>
              </p>
              <p className="text-xs text-muted-foreground">Become a member — free during launch</p>
            </div>
          </div>

          <Card className="border-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_44px_-26px_rgba(15,23,42,0.25)] sm:border sm:border-border sm:shadow-sm">
            <CardContent className="p-7 md:p-9">
              {applied ? (
                <div className="space-y-4 text-center" aria-live="polite">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Clock3 className="h-7 w-7" />
                  </span>
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{mcopy.title}</h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{mcopy.body}</p>
                    {status?.note && <p className="mt-2 text-sm text-slate-600">Note: {status.note}</p>}
                  </div>
                  <Link to="/account" className="block">
                    <Button className="h-12 w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      Open my dashboard
                    </Button>
                  </Link>
                </div>
              ) : token && status?.status === "accepted" ? (
                <div className="space-y-4 text-center" aria-live="polite">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <ShieldCheck className="h-7 w-7" />
                  </span>
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">You're already a member</h1>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Your mailboxes are ready — manage them from your dashboard.
                    </p>
                  </div>
                  <Link to="/account" className="block">
                    <Button className="h-12 w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      Open my dashboard
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Become a member</h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Create your account in two minutes. Our team approves every application, then your
                    personal US & UK mailbox addresses are activated — free during launch (payments
                    coming soon).
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                    <li className="flex gap-2"><MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Approval updates by email</li>
                    <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> US + UK mailboxes on approval</li>
                    <li className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> No payment needed right now</li>
                  </ul>

                  <form onSubmit={submit} className="mt-7 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bm-name">{t("auth.labelName")}</Label>
                      <Input id="bm-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("auth.placeholderName")} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bm-email">{t("auth.labelEmail")}</Label>
                      <Input id="bm-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("auth.placeholderEmail")} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bm-password">{t("auth.labelPassword")}</Label>
                      <Input id="bm-password" type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t("auth.placeholderPassword")} required />
                    </div>
                    {error && (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                        {error}
                      </p>
                    )}
                    <Button type="submit" disabled={loading} className="h-[50px] w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                      {loading ? t("auth.signupLoading") : "Apply for membership"}
                    </Button>
                  </form>
                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    {user ? `Signed in as ${user.email}` : "Already have an account?"}{" "}
                    <Link to="/" className="font-semibold text-primary hover:underline">Go to sign in</Link>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
