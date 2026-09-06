import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { axiosInstance } from "@/services/axiosInstance";

const TYPES = ["general", "address", "delay", "weather", "other"];
const TYPE_LABEL = {
  general: "General news",
  address: "Address / hub changes",
  delay: "Package delays",
  weather: "Weather announcements",
  other: "Other",
};

/**
 * Announcements — publish to all members or a specific region/country.
 * Members see announcements in their dashboard notifications and receive them
 * by email.
 */
export default function AnnouncementsPage() {
  const [regions, setRegions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "general",
    audience: "all",
    region: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([
        axiosInstance.get("/announcements/regions"),
        axiosInstance.get("/announcements"),
      ]);
      setRegions(r.data.regions || []);
      setHistory(h.data.announcements || []);
    } catch {
      toast.error("Could not load announcement data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    if (form.audience === "region" && !form.region.trim()) {
      toast.error("Pick a region/country for the announcement.");
      return;
    }
    setSending(true);
    try {
      const { data } = await axiosInstance.post("/announcements", {
        title: form.title,
        body: form.body,
        type: form.type,
        audience: form.audience,
        region: form.audience === "region" ? form.region : "",
      });
      toast.success(data?.message || "Announcement published");
      setForm({ title: "", body: "", type: "general", audience: "all", region: "" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not publish.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Send updates (address changes, delays, weather…) to all members or a specific region.
          Members see them in their dashboard and receive them by email.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" /> New announcement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={publish} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. New UK mailbox suite format from Monday"
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
                >
                  <option value="all">All members</option>
                  <option value="region">Specific region / country</option>
                </select>
              </div>
              {form.audience === "region" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ann-region">Region / country</Label>
                  <Input
                    id="ann-region"
                    list="region-options"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="e.g. Uganda, United Kingdom…"
                  />
                  <datalist id="region-options">
                    {regions.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ann-body">Message</Label>
                <Textarea
                  id="ann-body"
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Write the announcement…"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={sending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {sending ? "Publishing…" : <><Send className="mr-1.5 h-4 w-4" /> Publish announcement</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">History</h2>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={"mr-1.5 h-4 w-4 " + (loading ? "animate-spin" : "")} /> Refresh
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Nothing published yet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((a) => (
              <Card key={a._id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold uppercase text-primary">{a.type}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                      {a.audience === "all" ? "All members" : `Region: ${a.region}`}
                    </span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1.5 font-semibold">{a.title}</p>
                  <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
