import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchSocialSession } from "@/lib/authApi";

/**
 * Landing page after Google OAuth: exchanges the session cookie set
 * by Better Auth for the admin bearer token, then returns to the dashboard.
 */
export default function SocialCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const errorParam = searchParams.get("error");

  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (errorParam) {
        setError("We could not complete social sign-in. Please try again or use email.");
        return;
      }
      try {
        const data = await fetchSocialSession();
        if (!active) return;
        if (!data?.token) throw new Error("empty session");
        localStorage.setItem("token", data.token);
        window.location.assign("/");
      } catch {
        if (active) setError("We could not complete social sign-in. Please try again or use email.");
      }
    };
    finish();
    return () => {
      active = false;
    };
  }, [errorParam]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-xl">Social sign-in</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-8 text-center">
            {error ? (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-7 w-7" />
                </span>
                <p className="mt-4 text-sm text-muted-foreground">{error}</p>
                <Link to="/login" className="mt-6 block w-full">
                  <Button variant="outline" className="w-full">Back to sign in</Button>
                </Link>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">Signing you in…</p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
