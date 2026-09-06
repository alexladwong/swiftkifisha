import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox as InboxIcon, RefreshCw, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/messages");
      setMessages(data.messages || []);
    } catch {
      toast.error("Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const threads = useMemo(() => {
    const map = new Map();
    for (const m of [...messages].reverse()) {
      if (!map.has(m.email)) map.set(m.email, { email: m.email, name: m.name, items: [] });
      map.get(m.email).items.push(m);
    }
    return [...map.values()].sort((a, b) => {
      const last = (arr) => new Date(arr[arr.length - 1].createdAt).getTime();
      return last(b.items) - last(a.items);
    });
  }, [messages]);

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
        <Button variant="outline" size="icon" onClick={load} title="Refresh">
          <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
        </Button>
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
                        {m.direction === "in" ? thread.name : "You"} ·{" "}
                        {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
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
