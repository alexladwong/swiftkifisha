import { useEffect, useState } from "react";
import { Bell, Megaphone, MessageSquareReply, Send, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { axiosInstance } from "@/services/axiosInstance";

const TYPE_STYLE = {
  general: "bg-surface-muted text-slate-600",
  address: "bg-primary/10 text-primary",
  delay: "bg-amber-100 text-amber-800",
  weather: "bg-sky-100 text-sky-800",
  other: "bg-surface-muted text-slate-600",
};

/**
 * Member notifications — announcements from SwiftKifisha (all or your region)
 * and the direct conversation with support (read replies, write back).
 */
export default function NotificationsSection() {
  const [announcements, setAnnouncements] = useState(null);
  const [messages, setMessages] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [a, m] = await Promise.all([
        axiosInstance.get("/announcements/feed"),
        axiosInstance.get("/messages/me"),
      ]);
      setAnnouncements(a.data.announcements || []);
      setMessages(m.data.messages || []);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sendReply = async (e) => {
    e.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setSending(true);
    try {
      await axiosInstance.post("/messages/me", { body });
      setReply("");
      load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Notifications
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Announcements from SwiftKifisha and replies from our team — also sent to your email.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={busy} className="gap-1.5">
          <RefreshCw className={"h-4 w-4 " + (busy ? "animate-spin" : "")} /> Refresh
        </Button>
      </header>

      {/* Announcements */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Megaphone className="h-5 w-5 text-primary" /> Announcements
        </h2>
        {busy && !announcements ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !announcements || announcements.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">
            No announcements right now — you'll see service updates here and in your email.
          </p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a._id} className="rounded-xl border border-border bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " + (TYPE_STYLE[a.type] || TYPE_STYLE.general)}>
                    {a.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <h3 className="mt-2 font-display text-[17px] font-bold text-foreground">{a.title}</h3>
                <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-600">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Conversation with support */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <MessageSquareReply className="h-5 w-5 text-primary" /> Messages with our team
        </h2>
        {messages && messages.length > 0 ? (
          <div className="space-y-2.5 rounded-xl border border-border bg-white p-5">
            {messages.map((m) => (
              <div key={m._id} className={"flex " + (m.direction === "in" ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm " +
                    (m.direction === "in"
                      ? "rounded-br-sm bg-accent-soft text-foreground"
                      : "rounded-bl-sm border border-border bg-surface text-foreground")
                  }
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.direction === "in" ? "You" : "SwiftKifisha support"}
                  </p>
                  {m.subject && m.direction === "out" && <p className="mt-0.5 font-semibold">{m.subject}</p>}
                  <p className="mt-0.5 whitespace-pre-line">{m.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted-foreground">
            No messages yet — contact us any time and replies will appear here.
          </p>
        )}

        <form onSubmit={sendReply} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Textarea
            rows={2}
            placeholder="Write to our team…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            className="flex-1 rounded-xl border-border bg-white"
          />
          <Button type="submit" disabled={sending || !reply.trim()} className="h-auto rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-1.5">Send</span>
          </Button>
        </form>
      </section>
    </div>
  );
}
