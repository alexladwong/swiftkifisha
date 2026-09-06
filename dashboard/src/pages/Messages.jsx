import { useCallback, useEffect, useMemo, useState } from "react";

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};
import { toast } from "sonner";
import { Inbox as InboxIcon, RefreshCw, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { axiosInstance } from "@/services/axiosInstance";

/**
 * Customer messages inbox — contact-form messages and member messages.
 * Each thread (by customer email) shows history, lets the admin mark inbound
 * messages as read and reply directly (reply is stored + emailed to customer).
 */
export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [busyEmail, setBusyEmail] = useState(null);
  const [search, setSearch] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/messages");
      setMessages(data.messages || []);
      setUnreadCount(data.unread || 0);
    } catch {
      toast.error("Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const threads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();
    for (const m of [...messages].reverse()) {
      if (q && !m.email.toLowerCase().includes(q) && !m.name.toLowerCase().includes(q)) continue;
      if (!map.has(m.email)) map.set(m.email, { email: m.email, name: m.name, items: [] });
      map.get(m.email).items.push(m);
    }
    const list = [...map.values()];
    list.sort((a, b) => {
      const hasUnread = (t) => t.items.some((m) => m.direction === "in" && !m.read);
      if (hasUnread(a) !== hasUnread(b)) return hasUnread(a) ? -1 : 1;
      const last = (arr) => new Date(arr[arr.length - 1].createdAt).getTime();
      return last(b.items) - last(a.items);
    });
    return list;
  }, [messages, search]);

  const markRead = async (id) => {
    await axiosInstance.post(`/messages/${id}/read`).catch(() => {});
    load();
  };

  const reply = async (email, name) => {
    const body = (drafts[email] || "").trim();
    if (!body) return;
    setBusyEmail(email);
    try {
      await axiosInstance.post("/messages/reply", {
        email,
        subject: `SwiftKifisha support — ${name}`,
        body,
      });
      toast.success("Reply sent to the customer");
      setDrafts((d) => ({ ...d, [email]: "" }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Reply failed.");
    } finally {
      setBusyEmail(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <InboxIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Messages</h1>
            <p className="text-sm text-muted-foreground">
              Messages from the contact form and member dashboards. Reply directly — the customer
              receives it by email and in their notifications.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search customer or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 text-sm sm:w-64"
          />
          <Button variant="outline" size="icon" onClick={load} title="Refresh">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </header>

      {!loading && threads.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <InboxIcon className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>No customer messages yet.</p>
          </CardContent>
        </Card>
      ) : (
        threads.map((thread) => (
          <Card key={thread.email}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{thread.name}</p>
                  <p className="text-sm text-muted-foreground">{thread.email}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {thread.items.some((m) => m.direction === "in" && !m.read) && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">unread</span>
                  )}
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{unreadCount} unread total</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => thread.items.forEach((m) => m.direction === "in" && !m.read && markRead(m._id))}
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark read
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {thread.items.map((m) => (
                  <div key={m._id} className={"flex " + (m.direction === "in" ? "justify-end" : "justify-start")}>
                    <div
                      className={
                        "max-w-[85%] rounded-2xl px-4 py-2 text-sm " +
                        (m.direction === "in" ? "rounded-br-sm bg-primary/10" : "rounded-bl-sm border bg-muted/60")
                      }
                    >
                      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                        {m.direction === "in" ? thread.name : "You"} · {timeAgo(m.createdAt)}
                      </p>
                      {m.subject && <p className="mt-0.5 font-semibold">{m.subject}</p>}
                      <p className="mt-0.5 whitespace-pre-line">{m.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Textarea
                  rows={2}
                  placeholder={`Reply to ${thread.email}…`}
                  value={drafts[thread.email] || ""}
                  onChange={(e) => setDrafts({ ...drafts, [thread.email]: e.target.value })}
                  className="flex-1"
                />
                <Button
                  onClick={() => reply(thread.email, thread.name)}
                  disabled={busyEmail === thread.email || !(drafts[thread.email] || "").trim()}
                  className="h-auto bg-primary px-6 text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="mr-1.5 h-4 w-4" /> Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
