import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loginThunk, signupThunk } from "@/features/auth/authSlice";
import { requestPasswordReset } from "@/lib/authApi";
import SocialSignIn from "@/components/SocialSignIn";
import { useI18n } from "@/i18n";

const MODES = ["signin", "signup", "forgot"];

export default function AuthDialog({ open, onOpenChange, initialMode = "signin" }) {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const { loading } = useSelector((state) => state.auth);
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [refCode, setRefCode] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotState, setForgotState] = useState(null); // { message?, devResetLink?, error? }

  const switchMode = (m) => {
    setMode(MODES.includes(m) ? m : "signin");
    setForm({ name: "", email: "", password: "" });
    setForgotState(null);
  };

  // Optional referral prefill — read ?ref= once per signup session (also covers
  // /become-member?ref=… because client-side navigation keeps window.location.search
  // current). A code the member typed themselves is never overwritten.
  useEffect(() => {
    if (open && mode === "signup") {
      setRefCode((cur) => {
        if (cur) return cur;
        const ref = new URLSearchParams(window.location.search).get("ref");
        return ref ? ref.trim() : "";
      });
    }
  }, [open, mode]);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signin") {
      const res = await dispatch(loginThunk({ email: form.email, password: form.password }));
      if (loginThunk.fulfilled.match(res)) onOpenChange(false);
    } else {
      const ref = refCode.trim();
      const res = await dispatch(
        signupThunk({
          name: form.name,
          email: form.email,
          password: form.password,
          ...(ref ? { refCode: ref } : {}),
        }),
      );
      if (signupThunk.fulfilled.match(res)) onOpenChange(false);
    }
  };

  const submitForgot = async (e) => {
    e.preventDefault();
    setForgotBusy(true);
    setForgotState(null);
    try {
      const data = await requestPasswordReset(form.email);
      setForgotState({ message: data?.message, devResetLink: data?.devResetLink });
    } catch (error) {
      setForgotState({
        error: error?.response?.data?.message || "Something went wrong. Please try again.",
      });
    } finally {
      setForgotBusy(false);
    }
  };

  const titles = {
    signin: t("auth.signinTitle"),
    signup: t("auth.signupTitle"),
    forgot: t("auth.forgotTitle"),
  };
  const descriptions = {
    signin: t("auth.signinDesc"),
    signup: t("auth.signupDesc"),
    forgot: t("auth.forgotDesc"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titles[mode]}</DialogTitle>
          <DialogDescription>{descriptions[mode]}</DialogDescription>
        </DialogHeader>

        {mode !== "forgot" && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium mb-4">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={"rounded-md py-1.5 transition-colors " + (mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {t("auth.tabSignIn")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={"rounded-md py-1.5 transition-colors " + (mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {t("auth.tabSignUp")}
            </button>
          </div>
        )}
        {mode !== "forgot" && !forgotState?.message && <SocialSignIn />}


        {mode === "forgot" && forgotState?.message ? (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
            <p className="flex items-start gap-2.5 font-medium text-emerald-800">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              {forgotState.message || t("auth.forgotSent")}
            </p>
            {forgotState.devResetLink && (
              <div className="rounded-lg bg-white p-3 text-xs">
                <p className="mb-1 font-semibold text-slate-500">{t("auth.devLinkLabel")}</p>
                <a href={forgotState.devResetLink} className="break-all text-primary underline underline-offset-2">
                  {forgotState.devResetLink}
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("auth.backToSignIn")}
            </button>
          </div>
        ) : (
          <form onSubmit={mode === "forgot" ? submitForgot : submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>{t("auth.labelName")}</Label>
                <Input placeholder={t("auth.placeholderName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("auth.labelEmail")}</Label>
              <Input type="email" placeholder={t("auth.placeholderEmail")} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label>{t("auth.labelPassword")}</Label>
                <Input type="password" placeholder={t("auth.placeholderPassword")} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
            )}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label>Referral code (optional)</Label>
                <Input
                  placeholder="e.g. SK-XXXXXX — from a friend who referred you"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  maxLength={40}
                  autoComplete="off"
                />
              </div>
            )}

            {mode === "signin" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {t("auth.forgotLink")}
                </button>
              </div>
            )}

            {mode === "forgot" && forgotState?.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive">
                {forgotState.error}
              </p>
            )}

            <motion.div whileTap={{ scale: 0.98 }}>
              <Button type="submit" disabled={loading || forgotBusy} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                {mode === "forgot"
                  ? forgotBusy
                    ? t("auth.forgotLoading")
                    : t("auth.forgotSubmit")
                  : loading
                    ? mode === "signin"
                      ? t("auth.signinLoading")
                      : t("auth.signupLoading")
                    : mode === "signin"
                      ? t("auth.signinSubmit")
                      : t("auth.signupSubmit")}
              </Button>
            </motion.div>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                {t("auth.signupHint")}
              </p>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.backToSignIn")}
              </button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
