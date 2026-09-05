import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adminOtpVerifyThunk } from "@/features/auth/authSlice";
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
        </motion.div>
      </div>
    </>
  );
}
