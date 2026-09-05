// Empirical probe of the installed better-auth contract (offline, memory adapter).
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { bearer } from "better-auth/plugins/bearer";

const auth = betterAuth({
  appName: "probe",
  baseURL: "http://localhost:5174",
  secret: "probe-secret-0123456789abcdef0123456789abcdef",
  database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
  emailAndPassword: { enabled: true },
  plugins: [bearer()],
});

const signUp = await auth.api.signUpEmail({
  body: { name: "Probe Admin", email: "probe@example.com", password: "Probe123" },
});
console.log("signUp keys:", Object.keys(signUp));
const signIn = await auth.api.signInEmail({
  body: { email: "probe@example.com", password: "Probe123" },
});
console.log("signIn keys:", Object.keys(signIn));
const token = signIn.token;
console.log("signIn.token present:", Boolean(token), "| session present:", Boolean(signIn.session));
const viaBearer = await auth.api.getSession({
  headers: { authorization: "Bearer " + token },
});
console.log("getSession via Bearer user:", viaBearer ? viaBearer.user.email : null);
const viaCookie = await auth.api.getSession({
  headers: { cookie: "better-auth.session_token=" + token },
});
console.log("getSession via cookie user:", viaCookie ? viaCookie.user.email : null);
try {
  await auth.api.signInEmail({ body: { email: "probe@example.com", password: "nope" } });
  console.log("wrong-password: NO ERROR (unexpected)");
} catch (e) {
  console.log("wrong-password throws:", Boolean(e && e.message));
}
console.log("signUp user has id field:", Boolean(signUp && signUp.user && signUp.user.id));
console.log("DONE");
