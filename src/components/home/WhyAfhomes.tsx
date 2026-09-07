import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

const pillars = [
  {
    title: "A pioneer in homestyle hospitality",
    body: "AFhomes is a diversified hospitality and wellness group — homestyle hospitality across dining, stay, and escape. The warmth of home, held to a premium standard.",
  },
  {
    title: "Wellness-first philosophy",
    body: "Rest is designed into the experience, not added on. From smart sleep technology to the calm of natural thermal springs, every property starts from how the guest feels.",
  },
  {
    title: "Responsible development",
    body: "Every project moves phase by phase, with environmental and governmental compliance guiding us. We build the way the land we build on deserves.",
  },
  {
    title: "Immediate value",
    body: "Hospitality that's open today, and a VIP Privilege program built to reward guests from the very first visit — with fixed discounts, priority reservations, and welcome gifts.",
  },
  {
    title: "Strategic location",
    body: "Rooted in Laguna — dining and stay experiences in Alaminos, and a future nature destination in Calauan — close enough to feel familiar, far enough to feel away.",
  },
];

export function WhyAfhomes() {
  return (
    <section className="bg-cream-100 py-24 sm:py-32" aria-labelledby="why-heading">
      <Container>
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              id="why-heading"
              eyebrow="Why AFhomes"
              title="Hospitality that feels like it belongs to you."
            />
          </div>

          <div className="lg:col-span-7">
            <div className="border-t border-line">
              {pillars.map((pillar, index) => (
                <Reveal key={pillar.title} delay={index * 0.06} y={20}>
                  <div className="group grid grid-cols-1 gap-2 border-b border-line py-8 transition-colors duration-300 hover:bg-cream-50 sm:grid-cols-12 sm:gap-6 sm:px-3">
                    <span className="font-display text-sm text-ink-400 italic sm:col-span-1">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="sm:col-span-11">
                      <h3 className="font-display text-2xl leading-snug font-medium text-navy-900 transition-colors duration-300 group-hover:text-leaf-700 sm:text-3xl">
                        {pillar.title}
                      </h3>
                      <p className="mt-2 max-w-xl leading-relaxed text-ink-600 text-pretty sm:mt-3">
                        {pillar.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}