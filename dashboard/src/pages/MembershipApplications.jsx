import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, RefreshCw, Check, SearchX, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { axiosInstance } from "@/services/axiosInstance";

const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  accepted: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

/**
 * Membership applications review — Accept (provisions mailboxes + emails the
 * applicant), Investigate (flag for review), or Cancel (with an optional note).
 */
export default function MembershipApplicationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get("/membership/applications", {
        params: filter ? { status: filter } : {},
      });
      setRows(data.applications || []);
    } catch {
      toast.error("Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      const { data } = await axiosInstance.post(`/membership/applications/${id}/action`, {
        action,
        note: (notes[id] || "").trim(),
      });
      toast.success(data?.message || "Done");
      setNotes((n) => ({ ...n, [id]: "" }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = rows;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Membership Applications</h1>
            <p className="text-sm text-muted-foreground">
              Approve, investigate or cancel membership requests. Approval activates the member's US/UK mailboxes and emails them.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-lg border bg-card px-3 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="accepted">Accepted</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button variant="outline" size="icon" onClick={load} title="Refresh">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </header>

      {!loading && filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <SearchX className="h-10 w-10 opacity-40" />
            <p>No membership applications here{filter ? ` (${filter})` : ""}.</p>
            <p className="text-sm">New requests appear when applicants use "Become a member" or sign up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a._id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{a.name}</p>
                      <Badge className={STATUS_STYLE[a.status] || ""}>{a.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.email}</p>
                    {(a.phone || a.homeCountry) && (
                      <p className="text-xs text-muted-foreground">
                        {a.phone} {a.phone && a.homeCountry ? "·" : ""} {a.homeCountry}
                      </p>
                    )}
                    {a.message && <p className="mt-1 text-sm text-slate-600">{a.message}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Applied {new Date(a.createdAt).toLocaleString()} {a.reviewedBy && `· reviewed by ${a.reviewedBy}`}
                    </p>
                    {a.note && (
                      <p className="mt-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-slate-600">Note: {a.note}</p>
                    )}
                  </div>

                  {a.status !== "accepted" && a.status !== "cancelled" && (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[340px]">
                      <Input
                        placeholder="Optional note for the applicant"
                        value={notes[a._id] || ""}
                        onChange={(e) => setNotes({ ...notes, [a._id]: e.target.value })}
                        className="h-9 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          disabled={busyId === a._id}
                          onClick={() => act(a._id, "accept")}
                        >
                          <Check className="mr-1.5 h-4 w-4" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={busyId === a._id}
                          onClick={() => act(a._id, "investigate")}
                        >
                          <FileSearch className="mr-1.5 h-4 w-4" /> Investigate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                          disabled={busyId === a._id}
                          onClick={() => act(a._id, "cancel")}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
