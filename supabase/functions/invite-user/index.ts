// HWC Trainer Suite — invite-user Edge Function
// Actions:
//   invite      { email, full_name?, role, facility_ids[], app_url }  → creates invitation + one-time invite link
//   reset_link  { user_id, app_url }                                  → one-time "set password" link for an existing user
// The service-role key never leaves this function. Callers are verified from their own JWT.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("APP_ORIGINS") ??
  "https://paulmmoore3416.github.io,http://localhost:5173,http://localhost:4173")
  .split(",").map((s) => s.trim()).filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = corsHeaders(origin);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let callerId: string | null = null;
  let callerEmail: string | null = null;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) throw new HttpError(401, "Not signed in");
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new HttpError(401, "Session expired — please sign in again");
    callerId = userData.user.id;
    callerEmail = userData.user.email ?? null;

    // Caller context through their own RLS view of the world.
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ctx, error: ctxErr } = await asCaller.rpc("my_context");
    if (ctxErr) throw ctxErr;
    const caller = ctx?.profile;
    if (!caller || !caller.active) throw new HttpError(403, "Your account is not active");
    const isSuper: boolean = !!ctx.is_super_admin;
    const myFacilityIds = new Set<string>((ctx.facilities ?? []).map((f: { id: string }) => f.id));

    const body = await req.json().catch(() => ({}));
    const appUrl = String(body.app_url ?? "");
    if (!ALLOWED_ORIGINS.some((o) => appUrl.startsWith(o + "/") || appUrl === o)) {
      throw new HttpError(400, "Invalid application URL");
    }
    const base = appUrl.split("#")[0];

    if (body.action === "invite") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim().slice(0, 120);
      const role = String(body.role ?? "instructor");
      const facilityIds: string[] = Array.isArray(body.facility_ids) ? body.facility_ids.map(String) : [];

      if (!EMAIL_RE.test(email) || email.length > 254) throw new HttpError(400, "Enter a valid email address");
      if (!["instructor", "admin"].includes(role)) throw new HttpError(400, "Invalid role");
      if (role === "admin" && !(isSuper || caller.role === "admin")) {
        throw new HttpError(403, "Only admins can invite other admins");
      }
      if (facilityIds.length === 0) throw new HttpError(400, "Choose at least one facility");
      if (!facilityIds.every((id) => myFacilityIds.has(id))) {
        throw new HttpError(403, "You can only invite instructors to your own facilities");
      }

      const { data: existing } = await admin.from("profiles").select("id, last_sign_in_at").eq("email", email).maybeSingle();
      if (existing) {
        throw new HttpError(409, existing.last_sign_in_at
          ? "This person already has an account"
          : "This person was already invited — use “Resend link” on the Users page");
      }

      await admin.from("invitations").update({ status: "revoked" }).eq("email", email).eq("status", "pending");
      const { data: inv, error: invErr } = await admin.from("invitations").insert({
        email, full_name: fullName || null, role, facility_ids: facilityIds, invited_by: callerId,
      }).select("id").single();
      if (invErr) throw invErr;

      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "invite", email, options: { data: { full_name: fullName }, redirectTo: base },
      });
      if (linkErr || !link?.properties?.hashed_token) {
        await admin.from("invitations").update({ status: "failed" }).eq("id", inv.id);
        throw linkErr ?? new Error("Could not create invite link");
      }

      await admin.from("auth_events").insert({
        event: "invite_sent", email, actor_id: callerId,
        detail: { role, facility_ids: facilityIds, invitation_id: inv.id },
      });

      return json(200, {
        ok: true,
        email,
        link: `${base}#/accept?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=invite`,
        valid_for: "24 hours",
      });
    }

    if (body.action === "reset_link") {
      const userId = String(body.user_id ?? "");
      const { data: target } = await admin.from("profiles")
        .select("id, email, role, active, invited_by, last_sign_in_at").eq("id", userId).maybeSingle();
      if (!target) throw new HttpError(404, "User not found");
      if (!target.active) throw new HttpError(400, "Reactivate this user first");

      let allowed = isSuper;
      if (!allowed) {
        const { data: theirs } = await admin.from("facility_members").select("facility_id").eq("profile_id", target.id);
        const shares = (theirs ?? []).some((m: { facility_id: string }) => myFacilityIds.has(m.facility_id));
        allowed = (caller.role === "admin" && target.role === "instructor" && shares) ||
          (target.invited_by === callerId && !target.last_sign_in_at);
      }
      if (!allowed) throw new HttpError(403, "Not authorized to create a link for this user");

      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery", email: target.email, options: { redirectTo: base },
      });
      if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("Could not create link");

      await admin.from("auth_events").insert({
        event: "reset_link_created", email: target.email, user_id: target.id, actor_id: callerId,
      });
      return json(200, {
        ok: true,
        email: target.email,
        link: `${base}#/accept?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery`,
        valid_for: "24 hours",
      });
    }

    throw new HttpError(400, "Unknown action");
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : String(err);
    if (status >= 500) {
      await admin.from("app_errors").insert({
        level: "error", source: "edge:invite-user", message: message.slice(0, 2000),
        stack: err instanceof Error ? (err.stack ?? "").slice(0, 8000) : null,
        user_id: callerId, user_email: callerEmail,
      }).then(() => {}, () => {});
    }
    return json(status, { error: status >= 500 ? "Something went wrong creating the link. It has been logged." : message });
  }
});
