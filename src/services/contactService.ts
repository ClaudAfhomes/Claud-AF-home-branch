import { contactApi } from "@/api/contact";
import type { ContactFormValues, ContactSubmitResult } from "@/types/contact";

export const contactService = {
  submitInquiry(payload: ContactFormValues): Promise<ContactSubmitResult> {
    return contactApi.submitInquiry(payload);
  },
};