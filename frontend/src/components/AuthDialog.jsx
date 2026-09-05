import { useState } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { loginThunk, signupThunk } from "@/features/auth/authSlice";

export default function AuthDialog({ open, onOpenChange, initialMode = "signin" }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const switchMode = (m) => {
    setMode(m);
    setForm({ name: "", email: "", password: "" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "signin") {
      const res = await dispatch(loginThunk({ email: form.email, password: form.password }));
      if (loginThunk.fulfilled.match(res)) onOpenChange(false);
    } else {
      const res = await dispatch(signupThunk({ name: form.name, email: form.email, password: form.password }));
      if (signupThunk.fulfilled.match(res)) onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "signin" ? "Welcome back" : "Create your free account"}</DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to manage your mailboxes and shipments."
              : "Get your personal mailbox addresses in the US and UK instantly."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm font-medium mb-4">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={"rounded-md py-1.5 transition-colors " + (mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={"rounded-md py-1.5 transition-colors " + (mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground")}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input placeholder="Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
          )}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </div>

          <motion.div whileTap={{ scale: 0.98 }}>
            <Button type="submit" disabled={loading} className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {loading ? (mode === "signin" ? "Signing in..." : "Creating account...") : mode === "signin" ? "Sign In" : "Create free account"}
            </Button>
          </motion.div>
          {mode === "signup" && (
            <p className="text-xs text-muted-foreground">
              You get two mailbox addresses right away (USA + UK). More hubs unlock as you use the service.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
