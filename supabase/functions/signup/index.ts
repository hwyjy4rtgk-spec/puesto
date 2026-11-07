// Registro sin correo de confirmación.
// - Si el puesto aún no tiene dueño, la cuenta nueva queda como dueño.
// - Si ya hay dueño, exige el código del puesto y la cuenta queda como vendedor.
// Es público (sin JWT) porque se usa antes de tener sesión; hace su propia validación.
// Límites por IP: 5 códigos malos cada 15 min y 10 registros por hora.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: { email?: string; password?: string; name?: string; code?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 60);
  const code = String(body.code || "").trim().toUpperCase().slice(0, 16);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "bad_email" }, 400);
  if (password.length < 6 || password.length > 200) return json({ error: "weak_password" }, 400);
  if (!name) return json({ error: "no_name" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "?").split(",")[0].trim();
  const since = (min: number) => new Date(Date.now() - min * 60e3).toISOString();
  const count = async (ok: boolean | null, min: number) => {
    let q = admin.from("auth_attempts").select("id", { count: "exact", head: true }).eq("kind", "signup").eq("key", ip).gte("at", since(min));
    if (ok !== null) q = q.eq("ok", ok);
    const { count: n } = await q;
    return n || 0;
  };
  const note = (ok: boolean) => admin.from("auth_attempts").insert({ kind: "signup", key: ip, ok });
  if ((await count(false, 15)) >= 5 || (await count(true, 60)) >= 10) return json({ error: "too_many" }, 429);

  const { data: owners, error: oErr } = await admin.from("members").select("user_id").eq("role", "owner").limit(1);
  if (oErr) return json({ error: "server" }, 500);
  let role: "owner" | "seller" = "owner";
  if (owners && owners.length) {
    if (!code) return json({ error: "need_code" }, 400);
    const { data: sec } = await admin.from("secrets").select("invite_code").eq("id", 1).single();
    if (!sec || sec.invite_code !== code) { await note(false); return json({ error: "bad_code" }, 400); }
    role = "seller";
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (cErr || !created.user) {
    const m = String(cErr?.message || "");
    if (/already|registered|exists/i.test(m)) return json({ error: "exists" }, 409);
    return json({ error: "server" }, 500);
  }
  await note(true);

  // Si dos personas se registran como dueño a la vez, solo una gana; la otra queda sin rol
  // y podrá unirse con el código desde la app.
  if (role === "owner") {
    const { data: again } = await admin.from("members").select("user_id").eq("role", "owner").limit(1);
    if (again && again.length) return json({ ok: true, role: "none" });
  }
  const { error: mErr } = await admin.from("members").insert({ user_id: created.user.id, role, name });
  if (mErr) return json({ ok: true, role: "none" });
  return json({ ok: true, role });
});
