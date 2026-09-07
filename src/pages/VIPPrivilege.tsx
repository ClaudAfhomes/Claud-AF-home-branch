import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { VipTierCard } from "@/components/vip/VipTierCard";
import { LoadingState, ErrorState } from "@/components/ui/Feedback";
import { Seo } from "@/lib/seo";
import { useAsync } from "@/hooks/useAsync";
import { vipService } from "@/services/vipService";

const included = [
  {
    title: "Free entrance for the cardholder",
    body: "Walk into the AFhomes experience with the entrance fee waived for the named cardholder.",
  },
  {
    title: "Priority reservation rights",
    body: "Book ahead with priority across AFhomes reservations — dining, stays, and future experiences.",
  },
  {
    title: "Annual welcome gift",
    body: "A small gift each year, our way of welcoming you back to your home away from home.",
  },
];

export default function VIPPrivilege() {
  const { data: plans, loading, error, retry } = useAsync(() => vipService.getPlans());

  return (
    <>
      <Seo
        title="VIP Privilege — Gold, Silver & Bronze"
        description="AFhomes VIP Privilege — fixed VIP discounts, priority reservation rights, welcome gifts, and loyalty stay points across the AFhomes experience."
        path="/vip"
      />

      <PageHeader
        eyebrow="VIP Privilege"
        title="Your passport to the AFhomes experience."
        lede="Fixed VIP discounts. Priority reservations. Welcome gifts. Loyalty stay points. One program that follows you across dine, stay, and escape."
        className="bg-navy-950"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_85%_10%,rgba(251,199,94,0.14),transparent)]"
          aria-hidden="true"
        />
      </PageHeader>

      {/* Tiers */}
      <section className="bg-cream-100 py-24 sm:py-32" aria-labelledby="vip-tiers-heading">
        <Container>
          <SectionHeading
            id="vip-tiers-heading"
            eyebrow="Choose your tier"
            title="Three tiers of belonging."
            lede="Each tier shares the same essential benefits — the difference is the depth of the reward, chosen to match you."
          />

          <div className="mt-14 lg:mt-20">
            {loading && <LoadingState label="Loading tiers…" />}
            {error && (
              <ErrorState
                title="Couldn't load VIP tiers"
                message={error.message}
                onRetry={retry}
              />
            )}
            {plans && (
              <div className="grid grid-cols-1 gap-8 pb-10 md:grid-cols-3 md:gap-6 lg:gap-8 lg:pb-14">
                {plans.map((plan, index) => (
                  <Reveal key={plan.id} delay={index * 0.08} y={32}>
                    <VipTierCard plan={plan} />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-cream-50 py-20 sm:py-24" aria-label="How VIP Privilege works">
        <Container>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
            {[
              {
                number: "01",
                title: "Choose your tier",
                body: "Gold, Silver, or Bronze — every tier shares the same essential privileges; only the depth of the reward differs.",
              },
              {
                number: "02",
                title: "Register with AFhomes",
                body: "Registration details and cardholder rules are shared when you enquire — always through official AFhomes channels.",
              },
              {
                number: "03",
                title: "Enjoy your privileges",
                body: "Fixed discounts, priority reservation rights, and welcome gifts follow you across dine, stay, and escape.",
              },
            ].map((step, index) => (
              <Reveal key={step.number} delay={index * 0.08} y={24}>
                <div className="border-t border-line pt-6">
                  <span className="font-display text-sm text-gold-600 italic">
                    {step.number}
                  </span>
                  <h3 className="font-display mt-2 text-2xl font-medium text-navy-900">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Included benefits */}
      <section className="bg-cream-200/70 py-24 sm:py-28" aria-labelledby="vip-included-heading">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeading
                id="vip-included-heading"
                eyebrow="In every tier"
                title="The fundamentals of welcome."
                lede="Whatever tier you choose, these privileges come with the card. Registration details and cardholder rules are shared when you enquire."
              />
              <Reveal delay={0.15}>
                <Button to="/contact" variant="primary" size="md" withArrow className="mt-8">
                  Ask about registration
                </Button>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <div className="space-y-4">
                {included.map((item, index) => (
                  <Reveal key={item.title} delay={index * 0.07} y={24}>
                    <div className="group flex gap-6 rounded-2xl border border-line bg-cream-50 p-7 transition-colors hover:border-gold-500/40 sm:p-8">
                      <span className="font-display text-lg text-gold-600 italic">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="font-display text-2xl font-medium text-navy-900">
                          {item.title}
                        </h3>
                        <p className="mt-2 max-w-xl leading-relaxed text-ink-600">{item.body}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Transparency */}
      <section className="bg-navy-950 py-24 text-cream-100 sm:py-28" aria-labelledby="vip-transparency-heading">
        <Container>
          <div className="max-w-3xl">
            <SectionHeading
              id="vip-transparency-heading"
              tone="dark"
              eyebrow="Read carefully"
              title="What the program is — and what it is not."
            />
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-8">
                <p className="label-caps text-gold-400">A loyalty program, not an investment</p>
                <p className="mt-4 leading-relaxed text-cream-200/80">
                  AFHOMES is a hospitality and resort developer and operator. It does not
                  offer real estate investments, timeshares, club shares, or securities. The
                  VIP Privilege Program grants loyalty privileges and discounts only.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-8">
                <p className="label-caps text-gold-400">Payments &amp; official channels</p>
                <p className="mt-4 leading-relaxed text-cream-200/80">
                  Payments must be made directly to the AFhomes Finance Department through
                  official and verified channels. Always confirm payment instructions with
                  AFhomes directly before transferring funds.
                </p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12}>
            <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-[1.25rem] bg-gradient-to-br from-navy-800 to-navy-900 p-10 sm:p-12 lg:flex-row lg:items-center">
              <div>
                <h3 className="font-display text-3xl font-medium text-balance sm:text-4xl">
                  Ready to become part of the AFhomes family?
                </h3>
                <p className="mt-3 max-w-xl text-cream-200/75">
                  Tell us which tier you're interested in and our team will walk you through
                  the details.
                </p>
              </div>
              <Button to="/contact" variant="accent" size="lg" withArrow>
                Get in touch
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}