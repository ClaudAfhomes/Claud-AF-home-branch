import { inquirySchema } from "@/lib/inquiryValidation";
import { storeInquiry } from "@/api/inquiries";
import { hasSupabaseConfig, supabaseAnonKeyValue, supabaseUrlValue } from "@/lib/supabase";
import { sendClientMessage } from "@/lib/email";
import type { ContactFormValues, ContactSubmitResult } from "@/types/contact";

export const contactApi = {
  async submitInquiry(payload: ContactFormValues): Promise<ContactSubmitResult> {
    const checked = inquirySchema.safeParse(payload);
    if (!checked.success) throw new Error(checked.error.issues.map((issue) => issue.message).join(" "));
    const value = checked.data;

    if (hasSupabaseConfig) {
      const response = await fetch(`${supabaseUrlValue}/functions/v1/submit-inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKeyValue,
        },
        body: JSON.stringify(value),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; message?: string; reference?: string; ok?: boolean };
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to send your request. Please try again.");
      }
      return {
        ok: true,
        reference: body.reference ?? value.requestId,
        message: body.message ?? "Your inquiry has reached AFhomes. Our team will contact you using the details provided.",
      };
    }

    storeInquiry({ id: value.requestId, created_at: new Date().toISOString(), name: value.name, email: value.email,
      contact_number: value.contactNumber, inquiry_type: value.inquiryType, message: value.message,
      kind: value.kind, visit_date: value.visitDate ?? null, end_date: value.endDate ?? null,
      guests: value.guests ?? null, status: "new", notes: "" });

    sendClientMessage(value);

    return {
      ok: true,
      reference: value.requestId,
      message: "Your message was prepared in your email app and sent to AFhomes at claudmarsjimenez.afhomes@gmail.com.",
    };
  },
};
