import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { Resend } from "npm:resend@6.26.0";
import { createTransport } from "npm:nodemailer@6.9.16";
import { inquirySchema } from "./inquiryValidation.ts";

const TEMP_EMAIL_TO = "claudmarsjimenez.afhomes@gmail.com";
const PRODUCTION_ORIGINS = new Set([
  "https://claud-af-home-branch.vercel.app",
  "https://claud-af-home-branch-git-claud-afhomes.vercel.app",
  "https://claud-af-home-branch-9cr7tlazh-afhomes.vercel.app",
]);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendContactEmail(payload: { name: string; email: string; contactNumber: string; inquiryType: string; message: string; kind: string; requestId: string; visitDate?: string | null; endDate?: string | null; guests?: number | null; }) {
  const toAddress = Deno.env.get("EMAIL_TO") || TEMP_EMAIL_TO;
  const smtpUser = Deno.env.get("SMTP_USER");
  const fromAddress = Deno.env.get("EMAIL_FROM") || (smtpUser ? `AFhomes Contact <${smtpUser}>` : "AFhomes Contact <noreply@afhomes.com.ph>");

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (resendApiKey) {
    const resend = new Resend(resendApiKey);
    const response = await resend.emails.send({
      from: fromAddress,
      to: [toAddress],
      replyTo: payload.email,
      subject: `AFhomes contact form: ${payload.inquiryType}`,
      html: `
        <h2>New AFhomes inquiry</h2>
        <p><strong>Request ID:</strong> ${escapeHtml(payload.requestId)}</p>
        <p><strong>Type:</strong> ${escapeHtml(payload.kind)}</p>
        <p><strong>Inquiry type:</strong> ${escapeHtml(payload.inquiryType)}</p>
        <p><strong>Name:</strong> ${escapeHtml(payload.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(payload.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(payload.contactNumber)}</p>
        ${payload.visitDate ? `<p><strong>Visit date:</strong> ${escapeHtml(payload.visitDate)}</p>` : ""}
        ${payload.endDate ? `<p><strong>End date:</strong> ${escapeHtml(payload.endDate)}</p>` : ""}
        ${typeof payload.guests === "number" ? `<p><strong>Guests:</strong> ${escapeHtml(String(payload.guests))}</p>` : ""}
        <p><strong>Message:</strong></p>
        <div>${escapeHtml(payload.message).replace(/\n/g, "<br />")}</div>
      `,
    });

    if (response.error) {
      console.error("Resend email send failed", response.error);
      return false;
    }
    return true;
  }

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (smtpHost && smtpUser && smtpPass) {
    const transporter = createTransport({
      host: smtpHost,
      port: Number(Deno.env.get("SMTP_PORT") || 587),
      secure: Number(Deno.env.get("SMTP_PORT") || 587) === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toAddress,
      replyTo: payload.email,
      subject: `AFhomes contact form: ${payload.inquiryType}`,
      text: `Request ID: ${payload.requestId}\n\nName: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.contactNumber}\nType: ${payload.kind}\nInquiry type: ${payload.inquiryType}\n${payload.visitDate ? `Visit date: ${payload.visitDate}\n` : ""}${payload.endDate ? `End date: ${payload.endDate}\n` : ""}${typeof payload.guests === "number" ? `Guests: ${payload.guests}\n` : ""}\nMessage:\n${payload.message}`,
    });
    return true;
  }

  return false;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const allowed = new Set([
    ...PRODUCTION_ORIGINS,
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (!origin || !allowed.has(origin)) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { error: "Use POST" });
  try {
    if (Number(request.headers.get("content-length")) > 20000) return reply(413, { error: "Request too large" });
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "Missing form data" });
    let total = 0; const chunks: Uint8Array[] = [];
    while (true) { const part = await reader.read(); if (part.done) break; total += part.value.length; if (total > 20000) { await reader.cancel(); return reply(413, { error: "Request too large" }); } chunks.push(part.value); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    const parsed = inquirySchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return reply(400, { error: "Please check the form fields and dates." });
    const payload = parsed.data;
    const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
    const secret = legacySecret || (secretKeys ? JSON.parse(secretKeys).default : undefined);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!secret || !supabaseUrl) {
      console.error("Supabase server credentials are unavailable");
      return reply(500, { error: "Inquiry service is not configured." });
    }
    const client = createClient(supabaseUrl, secret);
    const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${address}`));
    const fingerprint = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data, error } = await client.rpc("submit_public_inquiry", { payload, fingerprint, request_id: payload.requestId });
    if (error) return reply(error.message.includes("Too many") ? 429 : 500, { error: error.message.includes("Too many") ? error.message : "Unable to save your request. Please try again." });

    let emailSent = false;
    try {
      emailSent = await sendContactEmail(payload);
    } catch (error) {
      console.error("Inquiry saved, but notification email failed", error);
    }
    return reply(200, {
      ok: true,
      reference: data,
      emailSent,
      message: payload.kind === "reservation"
        ? "Your reservation request has reached AFhomes. Our team will contact you to confirm availability. This is not a confirmed booking."
        : "Your inquiry has reached AFhomes. Our team will contact you using the details provided.",
    });
  } catch { return reply(400, { error: "Unable to process this request. Please check the form and try again." }); }
});
