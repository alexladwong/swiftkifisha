import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMe, updateMe } from "@/lib/portalApi";
import { updateUser } from "@/features/auth/authSlice";

const initialsOf = (name) =>
  (name || "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

const CITIES = [
  "Kampala", "Entebbe", "Jinja", "Mbarara", "Gulu", "Mbale", "Mukono", "Masaka",
  "Lira", "Kasese", "Fort Portal", "Arua", "Soroti", "Nansana", "Kira",
];
const COUNTRIES = ["Uganda", "Kenya", "United Arab Emirates", "United Kingdom", "United States", "Canada", "Australia", "Germany", "Rwanda", "Tanzania"];

export default function ProfileSection() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [member, setMember] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", homeCity: "", homeCountry: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMe().then((m) => {
      setMember(m);
      setForm({ name: m.name || "", phone: m.phone || "", homeCity: m.homeCity || "Kampala", homeCountry: m.homeCountry || "Uganda" });
    }).catch(() => toast.error("Could not load your profile."));
  }, []);

  // Completion derived from real fields (placeholder phone does not count).
  const phoneSet = form.phone && form.phone !== "+256-700-000000" ? 1 : 0;
  const completion = Math.min(100, 40 + (phoneSet ? 20 : 0) + (form.homeCity ? 20 : 0) + (form.homeCountry ? 20 : 0));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateMe(form);
      setMember(res.member);
      dispatch(updateUser({ name: res.member.name, homeCity: res.member.homeCity, homeCountry: res.member.homeCountry, phone: res.member.phone }));
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || "We could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  if (!member) {
    return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full rounded-xl" /><Skeleton className="h-72 w-full rounded-xl" /></div>;
  }

  return (
    <div className="mx-auto max-w-[1080px] space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">My Profile</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">Manage your personal information and account settings.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Summary */}
        <aside className="h-fit rounded-xl border border-border bg-white p-6 lg:sticky lg:top-24">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary-soft text-2xl text-primary">{initialsOf(member.name)}</AvatarFallback>
            </Avatar>
            <p className="mt-3 font-display text-lg font-bold text-foreground">{member.name}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className="bg-accent/10 text-accent">{member.plan}</Badge>
              <span className="font-mono text-[12px] text-slate-400">{member.memberCode}</span>
            </div>
          </div>

          <div className="mt-6 border-t border-border/70 pt-5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-foreground">Profile completeness</span>
              <span className="font-bold text-primary">{completion}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: completion + "%" }} />
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {completion < 100 ? "Add your phone number and home city to complete your profile." : "Your profile is complete."}
            </p>
          </div>
        </aside>

        {/* Form */}
        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} onSubmit={save} className="space-y-6 rounded-xl border border-border bg-white p-6 md:p-8" aria-label="Personal information">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pf-name">Full name</Label>
              <Input id="pf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-[50px] rounded-[10px] border-border bg-white" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-phone">Phone</Label>
              <Input id="pf-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256 7XX XXXXXX" className="h-[50px] rounded-[10px] border-border bg-white" />
              <p className="text-[12px] text-slate-400">Used for delivery updates on your shipments.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-city">Home city (Uganda)</Label>
              <select id="pf-city" value={form.homeCity} onChange={(e) => setForm({ ...form, homeCity: e.target.value })} className="h-[50px] w-full rounded-[10px] border border-border bg-white px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-country">Country</Label>
              <select id="pf-country" value={form.homeCountry} onChange={(e) => setForm({ ...form, homeCountry: e.target.value })} className="h-[50px] w-full rounded-[10px] border border-border bg-white px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="flex h-[50px] items-center justify-between rounded-[10px] border border-border bg-surface/60 px-4">
              <span className="text-[15px] text-slate-600">{member.email}</span>
              <span className="text-[12px] font-semibold text-emerald-600">Sign-in email</span>
            </div>
          </div>

          <div className="flex justify-end border-t border-border/70 pt-5">
            <Button type="submit" disabled={saving} className="h-[48px] rounded-[10px] bg-primary px-7 font-semibold text-primary-foreground hover:bg-primary/95">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}