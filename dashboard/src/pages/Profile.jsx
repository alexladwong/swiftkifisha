import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AtSign, BadgeCheck, CalendarDays, Fingerprint, KeyRound, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { axiosInstance } from "@/services/axiosInstance";
import { updateUser } from "@/features/auth/authSlice";

const ME_PATH = "/auth/me";

const initialsOf = (name) =>
  (name || "A")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

/**
 * Admin Profile — view and edit the signed-in admin's own account details.
 * Data comes from GET /api/auth/me; name edits are saved via PATCH /api/auth/me
 * and synced back into Redux + localStorage so the header updates instantly.
 */
export default function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [me, setMe] = useState(null); // server-enriched account
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, message }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    axiosInstance
      .get(ME_PATH)
      .then(({ data }) => {
        if (!active) return;
        setMe(data.user);
        setName(data.user?.name || user?.name || "");
      })
      .catch(() => {
        if (active) setMe(user || null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveName = async (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setFeedback({ ok: false, message: "Name is required." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await axiosInstance.patch(ME_PATH, { name: clean });
      setMe((m) => ({ ...m, name: clean }));
      dispatch(updateUser({ name: clean }));
      setFeedback({ ok: true, message: data?.message || "Profile updated" });
    } catch (err) {
      setFeedback({ ok: false, message: err?.response?.data?.message || "Could not update profile." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading profile…
      </div>
    );
  }

  const info = me || user || {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your admin account details and preferences.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* Identity card */}
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="flex-row items-center gap-4 space-y-0">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                {initialsOf(name || info.name)}
              </span>
              <div>
                <CardTitle className="text-xl">{info.name || "Admin"}</CardTitle>
                <CardDescription>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold capitalize text-primary">
                    <BadgeCheck className="h-3 w-3" /> {info.role || "admin"} · full access
                  </span>
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveName} className="max-w-sm space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="profile-name">Display name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="profile-name"
                      value={name}
                      maxLength={80}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white"
                    />
                    <Button type="submit" disabled={saving || name.trim() === (info.name || "")} className="bg-primary hover:bg-primary/90">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span className="ml-1.5 hidden sm:inline">Save</span>
                    </Button>
                  </div>
                </div>
                {feedback && (
                  <p
                    className={
                      "rounded-lg border px-3 py-2 text-sm font-medium " +
                      (feedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-destructive/20 bg-destructive/10 text-destructive")
                    }
                    role="status"
                  >
                    {feedback.message}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Account facts */}
        <aside className="h-fit space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Account</h2>
          <ul className="space-y-3.5 text-sm">
            <li className="flex items-start gap-3">
              <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="truncate font-medium">{info.email}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin since</p>
                <p className="font-medium">{fmtDate(info.createdAt)}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Account ID</p>
                <p className="truncate font-mono text-xs">{info._id || info.id}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sign-in method</p>
                <p className="font-medium">
                  {info.passwordSet ? "Password or email code" : "Email code only"}
                </p>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
