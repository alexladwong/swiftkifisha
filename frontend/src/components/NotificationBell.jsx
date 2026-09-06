import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Bell, Megaphone, MessageSquareReply, ChevronRight } from "lucide-react";
import { axiosInstance } from "@/services/axiosInstance";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Notification bell for signed-in members: shows unread support replies as a
 * badge and previews the latest announcements. Everything links through to the
 * full notifications centre at /account/notifications.
 */
export default function NotificationBell() {
  const { token } = useSelector((state) => state.auth);
  const [summary, setSummary] = useState(null); // { unreadMessages, announcements }

  useEffect(() => {
    if (!token) return;
    let active = true;
    const tick = () =>
      axiosInstance
        .get("/notifications/summary")
        .then(({ data }) => active && setSummary(data))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 60000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token]);

  if (!token) return null;
  const unread = summary?.unreadMessages || 0;
  const announcements = summary?.announcements || [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-foreground transition-colors hover:bg-surface"
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
              {unread} unread
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {unread > 0 && (
            <div className="flex items-start gap-2.5 px-3 py-2.5">
              <MessageSquareReply className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-slate-700">
                {unread} new reply{unread > 1 ? "s" : ""} from our team —{" "}
                <Link to="/account/notifications" className="font-semibold text-primary hover:underline">
                  open the conversation
                </Link>
                .
              </p>
            </div>
          )}
          {announcements.length === 0 && unread === 0 && (
            <p className="px-3 py-5 text-center text-sm text-muted-foreground">You're all caught up.</p>
          )}
          {announcements.slice(0, 3).map((a) => (
            <div key={a._id} className="border-t border-border/60 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent">
                <Megaphone className="h-3 w-3" /> {a.type}
              </p>
              <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{a.title}</p>
              <p className="line-clamp-2 mt-0.5 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
            </div>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/account/notifications" className="flex items-center justify-between">
            View all notifications <ChevronRight className="h-4 w-4" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
