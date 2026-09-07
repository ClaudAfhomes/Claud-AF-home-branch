import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { Seo } from "@/lib/seo";
import { siteConfig } from "@/data/mock/site";
import { ContactForm } from "@/components/contact/ContactForm";
import { getPlaceholder } from "@/lib/images";

export default function Contact() {
  return (
    <>
      <Seo
        title="Contact AFhomes"
        description="Get in touch with AFhomes — VIP Privilege, Smart Wellness Hotel, ALM Japanese Restaurant, and the Hotspring & Ecofarm Resort."
        path="/contact"
      />

      <PageHeader
        eyebrow="Contact"
        title="Let's connect."
        lede="Questions, reservations, or just to say hello — the AFhomes team would love to hear from you."
        imageSpec={getPlaceholder("hotel-lounge")}
      />

      <section className="bg-cream-100 py-20 sm:py-28">
        <Container>
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
            {/* Contact details */}
            <div className="lg:col-span-5">
              <div className="space-y-6">
                <Reveal>
                  <a
                    href={`mailto:${siteConfig.email}`}
                    className="group block rounded-[1.25rem] border border-line bg-cream-50 p-8 shadow-soft transition-shadow hover:shadow-lift"
                  >
                    <p className="label-caps flex items-center gap-3 text-ink-400">
                      <span className="font-display text-gold-600 italic">01</span>
                      Email
                    </p>
                    <p className="font-display mt-3 text-2xl font-medium text-navy-900 transition-colors group-hover:text-leaf-700">
                      {siteConfig.email}
                    </p>
                  </a>
                </Reveal>

                <Reveal delay={0.05}>
                  <a
                    href={`tel:${siteConfig.phone}`}
                    className="group block rounded-[1.25rem] border border-line bg-cream-50 p-8 shadow-soft transition-shadow hover:shadow-lift"
                  >
                    <p className="label-caps flex items-center gap-3 text-ink-400">
                      <span className="font-display text-gold-600 italic">02</span>
                      Phone
                    </p>
                    <p className="font-display mt-3 text-2xl font-medium text-navy-900 transition-colors group-hover:text-leaf-700">
                      {siteConfig.phoneDisplay}
                    </p>
                  </a>
                </Reveal>

                {siteConfig.offices.map((office, index) => (
                  <Reveal key={office.name} delay={0.08 + index * 0.04}>
                    <div className="rounded-[1.25rem] border border-line bg-cream-50 p-8 shadow-soft">
                      <p className="label-caps flex items-center gap-3 text-ink-400">
                        <span className="font-display text-gold-600 italic">
                          {String(index + 3).padStart(2, "0")}
                        </span>
                        {office.role}
                      </p>
                      <p className="font-display mt-2 text-2xl font-medium text-navy-900">
                        {office.name}
                      </p>
                      <address className="mt-3 space-y-1 text-sm leading-relaxed text-ink-600 not-italic">
                        {office.lines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </address>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-7">
              <Reveal delay={0.1} y={30}>
                <div className="rounded-[1.25rem] border border-line bg-cream-50 p-8 shadow-soft sm:p-12">
                  <Reveal>
                    <h2 className="font-display text-3xl font-medium text-navy-900 sm:text-4xl">
                      Send us a message.
                    </h2>
                    <p className="mt-3 mb-10 text-ink-600">
                      Choose the experience you're interested in and we'll route your inquiry
                      to the right team.
                    </p>
                  </Reveal>
                  <ContactForm />
                </div>
              </Reveal>
            </div>
          </div>
        </Container>
      </section>

      {/* FAQ nudge */}
      <section className="bg-navy-950 py-20 text-cream-50">
        <Container>
          <div className="flex flex-col items-start justify-between gap-8 rounded-[1.25rem] border border-white/10 bg-navy-900/60 p-10 sm:p-14 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-4xl leading-tight font-medium text-balance sm:text-5xl">
                Looking for a quick answer?
              </h2>
              <p className="mt-4 max-w-xl text-lg text-cream-200/75">
                Common questions about the group, the experiences, and the VIP program are
                answered in our FAQ.
              </p>
            </div>
            <Button to="/faq" variant="outline-light" size="lg" withArrow>
              Browse the FAQ
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}