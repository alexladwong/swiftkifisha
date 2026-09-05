import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, ChevronDown, ChevronUp, Mail, Phone, MapPin, Boxes } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { axiosInstance } from "@/services/axiosInstance";
import { formatMoney } from "@/lib/money";

const PLAN_STYLE = {
  Saver: "bg-muted text-muted-foreground",
  Classic: "bg-primary/10 text-primary",
  Pro: "bg-accent/10 text-accent",
};

const getStatus = (parcel) => {
  const cps = parcel?.checkpoints || [];
  return cps.length ? cps[cps.length - 1].status : "arrived";
};

export default function Members() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null); // member id
  const [memberParcels, setMemberParcels] = useState(null);

  const perPage = 10;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosInstance.get("/members", { params: { page, limit: perPage, search: search || undefined } });
      setRows(data.data || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (member) => {
    if (expanded === member._id) {
      setExpanded(null);
      setMemberParcels(null);
      return;
    }
    setExpanded(member._id);
    setMemberParcels(null);
    try {
      const { data } = await axiosInstance.get("/parcels", { params: { member: member._id, limit: 6 } });
      setMemberParcels(data.data || []);
    } catch {
      setMemberParcels([]);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fikisha Members</h1>
          <p className="text-sm text-muted-foreground">International members and their mailbox hubs</p>
        </div>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, member code or country..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
            <Button size="sm" onClick={load} disabled={loading}>Search</Button>
          </div>

          {error && <p className="text-sm text-destructive mb-3">{error}</p>}

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No members found.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((m) => (
                <div key={m._id} className="rounded-lg border border-border/70 overflow-hidden">
                  <button
                    onClick={() => toggleExpand(m)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {m.name}
                        <span className="font-mono text-xs text-muted-foreground">{m.memberCode}</span>
                        <Badge className={PLAN_STYLE[m.plan] || "bg-muted"}>{m.plan}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{m.email} · {m.homeCity}, {m.homeCountry}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                      <Boxes className="h-3.5 w-3.5" /> {m.totals.parcels} parcels
                      <span className="mx-1 text-border">|</span>
                      {m.hubAddresses.length} mailbox{(m.hubAddresses.length === 1 ? "" : "es")}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatMoney(m.totals.revenuePkr, "UGX")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(m.joinedAt).toLocaleDateString()}</p>
                    </div>
                    {expanded === m._id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {expanded === m._id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/60 bg-muted/30 px-4 py-3"
                      >
                        <div className="grid md:grid-cols-2 gap-3 mb-3 text-xs">
                          <div>
                            <p className="font-semibold mb-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Member</p>
                            <p className="text-muted-foreground">{m.email} · {m.phone}</p>
                            <p className="text-muted-foreground">Home: {m.homeCity}, {m.homeCountry}</p>
                          </div>
                          <div>
                            <p className="font-semibold mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Mailboxes</p>
                            {(m.hubAddresses || []).map((h) => (
                              <p key={h.country} className="text-muted-foreground">{h.country} · suite <span className="font-mono">{h.suite}</span></p>
                            ))}
                          </div>
                        </div>
                        {memberParcels === null ? (
                          <Skeleton className="h-10 w-full" />
                        ) : memberParcels.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No parcels yet for this member.</p>
                        ) : (
                          <div className="space-y-1">
                            {memberParcels.map((p) => (
                              <div key={p._id} className="flex items-center justify-between gap-2 text-xs rounded bg-card border border-border/60 px-3 py-2">
                                <span className="font-mono">{p.trackingId}</span>
                                <span className="text-muted-foreground truncate">{p.storeName || p.senderName} → {p.destinationCity}</span>
                                <Badge variant="outline">{getStatus(p).replace(/_/g, " ")}</Badge>
                                <span className="font-medium">{formatMoney(p.price, p.currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">{total} total members</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="flex items-center text-sm px-2">{page} / {Math.max(1, Math.ceil(total / perPage))}</span>
              <Button variant="outline" size="sm" disabled={page >= Math.max(1, Math.ceil(total / perPage))} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}