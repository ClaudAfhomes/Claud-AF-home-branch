import { apiClient, isApiEnabled } from "./client";
import type { ContactFormValues, ContactSubmitResult } from "@/types/contact";

/**
 * Contact API — conceptual contract:
 *   POST /api/contact/inquiries
 * Until a backend exists, submissions are acknowledged locally rather than
 * pretending to reach a server.
 */
export const contactApi = {
  submitInquiry(payload: ContactFormValues): Promise<ContactSubmitResult> {
    if (isApiEnabled) {
      return apiClient.post<ContactSubmitResult>("/api/contact/inquiries", payload);
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          reference: `MOCK-${Date.now().toString(36).toUpperCase()}`,
          message:
            "This is a development environment. Your message was recorded locally and has not been sent to AFhomes. Connect the AFhomes API to enable real submissions.",
        });
      }, 900);
    });
  },
};