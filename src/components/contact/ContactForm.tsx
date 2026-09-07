import { useState } from "react";
import {
  FormField,
  FieldInput,
  FieldSelect,
  FieldTextarea,
} from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { INQUIRY_TYPES, type ContactFormValues, type SubmitStatus } from "@/types/contact";
import { contactService } from "@/services/contactService";

type Errors = Partial<Record<keyof ContactFormValues, string>>;

const initialValues: ContactFormValues = {
  name: "",
  email: "",
  contactNumber: "",
  inquiryType: "",
  message: "",
};

function validate(values: ContactFormValues): Errors {
  const errors: Errors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Please enter your name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (values.contactNumber.trim().length < 7) {
    errors.contactNumber = "Please enter a contact number.";
  }

  if (!values.inquiryType) {
    errors.inquiryType = "Please choose an inquiry type.";
  }

  if (values.message.trim().length < 10) {
    errors.message = "Please write a message of at least 10 characters.";
  }

  return errors;
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) return;

    setStatus("submitting");
    setNotice(null);

    try {
      const result = await contactService.submitInquiry(values);
      if (result.ok) {
        setStatus("success");
        setNotice(result.message);
      } else {
        setStatus("error");
        setNotice(result.message);
      }
    } catch (cause) {
      setStatus("error");
      setNotice(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div
        className="rounded-[1.25rem] border border-leaf-500/30 bg-leaf-100/60 p-10 text-center sm:p-14"
        role="status"
        aria-live="polite"
      >
        <p className="font-display text-4xl font-medium text-navy-900 text-balance">
          Message received.
        </p>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-600">{notice}</p>
        <button
          type="button"
          onClick={() => {
            setValues(initialValues);
            setStatus("idle");
            setNotice(null);
          }}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-navy-300 px-7 py-3.5 text-sm font-semibold text-navy-900 transition-colors hover:border-navy-800 hover:bg-navy-800 hover:text-cream-50"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField id="contact-name" label="Name" required error={errors.name}>
          <FieldInput
            id="contact-name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            invalid={Boolean(errors.name)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            placeholder="Your full name"
          />
        </FormField>

        <FormField id="contact-email" label="Email" required error={errors.email}>
          <FieldInput
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            invalid={Boolean(errors.email)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "contact-email-error" : undefined}
            placeholder="you@example.com"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FormField
          id="contact-number"
          label="Contact Number"
          required
          error={errors.contactNumber}
        >
          <FieldInput
            id="contact-number"
            name="contactNumber"
            type="tel"
            autoComplete="tel"
            value={values.contactNumber}
            onChange={(event) => update("contactNumber", event.target.value)}
            invalid={Boolean(errors.contactNumber)}
            aria-invalid={Boolean(errors.contactNumber)}
            aria-describedby={errors.contactNumber ? "contact-number-error" : undefined}
            placeholder="+63 …"
          />
        </FormField>

        <FormField id="contact-type" label="Inquiry Type" required error={errors.inquiryType}>
          <FieldSelect
            id="contact-type"
            name="inquiryType"
            value={values.inquiryType}
            onChange={(event) => update("inquiryType", event.target.value as ContactFormValues["inquiryType"])}
            invalid={Boolean(errors.inquiryType)}
            aria-invalid={Boolean(errors.inquiryType)}
            aria-describedby={errors.inquiryType ? "contact-type-error" : undefined}
          >
            <option value="" disabled>
              Choose an inquiry type…
            </option>
            {INQUIRY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </FieldSelect>
        </FormField>
      </div>

      <FormField id="contact-message" label="Message" required error={errors.message}>
        <FieldTextarea
          id="contact-message"
          name="message"
          value={values.message}
          onChange={(event) => update("message", event.target.value)}
          invalid={Boolean(errors.message)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
          placeholder="How can we help?"
        />
      </FormField>

      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          withArrow
          disabled={status === "submitting"}
          className="w-full sm:w-auto"
        >
          {status === "submitting" ? "Sending…" : "Send message"}
        </Button>
        {status === "error" && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {notice}
          </p>
        )}
      </div>

      <p className={cn("text-xs leading-relaxed text-ink-400")}>
        By submitting, you agree that AFhomes may contact you about your inquiry. Payments
        are never collected through this form — all official payments are handled directly by
        the AFhomes Finance Department through verified channels.
      </p>
    </form>
  );
}