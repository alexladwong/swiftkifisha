import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Package, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchSocialSession } from "@/lib/authApi";
import { useI18n } from "@/i18n";

/**
 * Landing page after the Google OAuth redirect. Better Auth has set
 * a session cookie on the API origin; we exchange it for the regular
 * { token, user } contract, persist it like email sign-in, and continue to
 * the member portal.
 */
export default function SocialCallbackPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const errorParam = searchParams.get("error");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (errorParam) {
        setError(t("auth.socialErrorDesc"));
        return;
      }
      try {
        const data = await fetchSocialSession();
        if (!active) return;
        if (!data?.token || !data?.user) throw new Error("empty session");
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/account", { replace: true });
      } catch {
        if (active) setError(t("auth.socialErrorDesc"));
      }
    };
    finish();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorParam]);

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
            <CardContent className="flex flex-col items-center p-9 text-center">
              {error ? (
                <>
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-7 w-7" />
                  </span>
                  <h1 className="mt-4 font-display text-xl font-bold text-foreground">
                    {t("auth.socialErrorTitle")}
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
                  <div className="mt-6 flex w-full flex-col gap-2">
                    <Link to="/" className="block">
                      <Button className="h-[48px] w-full rounded-[10px] bg-accent font-semibold text-accent-foreground hover:bg-accent/90">
                        {t("auth.backToHome")}
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="mt-4 text-sm font-medium text-muted-foreground">{t("common.loading")}</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
