import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adminOtpVerifyThunk, adminDevLoginThunk } from "@/features/auth/authSlice";
import { axiosInstance } from "@/services/axiosInstance";

const OTP_REQUEST_PATH = import.meta.env.VITE_AUTH_OTP_REQUEST_PATH || "/auth/admin/otp/request";

/**
 * Admin login — passwordless: enter the admin email, receive a one-time code
 * by email, and you are signed in automatically once the code is validated.
 */
export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, loading } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email"); // "email" | "code"
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { message?, devOtp?, error? }
  const codeRef = useRef(null);
  // DEV-ONLY admin fallback (rendered only when import.meta.env.DEV).
  const [devForm, setDevForm] = useState({ email: "", password: "" });
  const [devError, setDevError] = useState(null);

  const devLogin = async (e) => {
    e.preventDefault();
    setDevError(null);
    await dispatch(adminDevLoginThunk({ email: devForm.email, password: devForm.password }));
  };

  useEffect(() => {
    if (token) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [token, navigate, location.state]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const requestCode = async (e) => {
    e?.preventDefault?.();
    if (!email.trim()) return;
    setBusy(true);
    setNotice(null);
    setCode("");
    try {
      const { data } = await axiosInstance.post(OTP_REQUEST_PATH, { email: email.trim() });
      setNotice({ message: data.message, devOtp: data.devOtp });
      setStep("code");
    } catch (error) {
      setNotice({ error: error?.response?.data?.message || "Could not send the code. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (code.trim().length < 6) return;
    await dispatch(adminOtpVerifyThunk({ email: email.trim(), code: code.trim() }));
    // On success the token effect above redirects into the dashboard.
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-xl">Admin Login</CardTitle>
              <CardDescription>
                {step === "email"
                  ? "No password needed — we email you a one-time sign-in code."
                  : `Enter the code we sent to ${email || "your email"}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === "email" ? (
                <form onSubmit={requestCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Admin email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {notice?.error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                      {notice.error}
                    </p>
                  )}
                  <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                    {busy ? "Sending code..." : "Send sign-in code"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    The code is valid for 5 minutes and can be used once.
                  </p>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-code">6-digit code</Label>
                    <Input
                      id="login-code"
                      ref={codeRef}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="••••••"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-center font-mono text-xl tracking-[0.4em]"
                      required
                    />
                  </div>

                  {notice?.message && (
                    <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[13px] font-medium text-emerald-800">
                      {notice.message}
                    </p>
                  )}
                  {notice?.devOtp && (
                    <div className="rounded-lg bg-muted border border-border px-3 py-2 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Development code (no inbox needed)</p>
                      <p className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">{notice.devOtp}</p>
                    </div>
                  )}
                  {notice?.error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                      {notice.error}
                    </p>
                  )}

                  <Button type="submit" disabled={loading || code.trim().length < 6} className="w-full bg-primary hover:bg-primary/90">
                    {loading ? "Signing in..." : "Sign in"}
                  </Button>

                  <div className="flex items-center justify-between text-[13px]">
                    <button type="button" onClick={() => { setStep("email"); setNotice(null); }} className="font-semibold text-muted-foreground hover:text-foreground">
                      Change email
                    </button>
                    <button type="button" onClick={requestCode} disabled={busy} className="font-semibold text-primary underline-offset-4 hover:underline">
                      {busy ? "Sending..." : "Resend code"}
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {import.meta.env.DEV && (
            <Card className="mt-6 border border-dashed shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Developer login</CardTitle>
                <CardDescription>
                  Local-only fallback while email OTP is unavailable. Never present in production
                  builds; the backend also rejects it when NODE_ENV=production.
                </CardDescription>
                <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Credentials live in <code className="font-mono">backend/.env</code> as{" "}
                  <code className="font-mono">DEV_ADMIN_EMAIL</code> /{" "}
                  <code className="font-mono">DEV_ADMIN_PASSWORD</code> — the backend prints both in
                  the dev console on startup.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={devLogin} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dev-email">Email</Label>
                      <Input
                        id="dev-email"
                        type="email"
                        autoComplete="off"
                        value={devForm.email}
                        onChange={(ev) => setDevForm({ ...devForm, email: ev.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dev-password">Password</Label>
                      <Input
                        id="dev-password"
                        type="password"
                        autoComplete="off"
                        value={devForm.password}
                        onChange={(ev) => setDevForm({ ...devForm, password: ev.target.value })}
                        required
                      />
                    </div>
                  </div>
                  {devError && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive" role="alert">
                      {devError}
                    </p>
                  )}
                  <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
                    {loading ? "Signing in..." : "Local Admin Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </>
  );
}
