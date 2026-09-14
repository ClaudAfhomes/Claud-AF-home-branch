import { createClient } from "npm:@supabase/supabase-js@2.116.0";

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const reply = (status: number, body: unknown) => Response.json(body, { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST" });
  const authorization = request.headers.get("authorization");
  if (!authorization) return reply(401, { error: "Authentication required" });

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: isAdmin, error: adminError } = await client.rpc("is_admin");
  if (adminError || !isAdmin) return reply(403, { error: "Administrator access required" });

  const deployHook = Deno.env.get("VERCEL_DEPLOY_HOOK_URL");
  if (!deployHook) return reply(503, { error: "Deployment hook is not configured" });
  const response = await fetch(deployHook, { method: "POST" });
  if (!response.ok) return reply(502, { error: "Deployment provider rejected the request" });
  return reply(200, { requested: true });
});
