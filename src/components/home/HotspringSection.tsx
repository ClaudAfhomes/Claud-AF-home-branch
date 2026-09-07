import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";
import { ImageReveal } from "@/components/ui/ImageReveal";
import { Button } from "@/components/ui/Button";
import { getPlaceholder } from "@/lib/images";

const notes = [
  "Integrated ecofarm & farming education",
  "Nature-based & family experiences",
  "Mountain and countryside views",
  "Family & wellness experiences",
];

export function HotspringSection() {
  return (
    <section
      className="relative overflow-hidden bg-sage-200/60 py-24 sm:py-32 lg:py-36"
      aria-labelledby="hotspring-heading"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_90%_0%,rgba(87,171,75,0.12),transparent)]"
        aria-hidden="true"
      />

      <Container className="relative">
        {/* Wide, immersive landscape */}
        <Reveal y={40}>
          <ImageReveal
            spec={getPlaceholder("resort-valley")}
            ratio="aspect-[16/9] sm:aspect-[21/9]"
            className="rounded-[1.25rem]"
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>Hotspring &amp; Ecofarm Resort · Calauan, Laguna</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2
                id="hotspring-heading"
                className="text-h1 mt-6 text-balance text-navy-900"
              >
                60 hectares of nature, wellness &amp; possibility.
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="text-body-lg mt-7 max-w-xl text-ink-600 text-pretty">
                Our flagship project in Calauan, Laguna is a master-planned destination
                set against mountain and countryside views — built around more than ten
                natural geothermal springs, an integrated ecofarm, and memories made
                close to the land.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            {/* Editorial numbers */}
            <Reveal delay={0.1}>
              <dl className="grid grid-cols-2 gap-6 border-t-2 border-pine-800/15 pt-8 sm:gap-8">
                <div>
                  <CountUp
                    value={60}
                    className="font-display text-6xl leading-none font-medium text-pine-800 sm:text-8xl"
                  />
                  <dt className="label-caps mt-3 text-ink-500">Hectares of land</dt>
                </div>
                <div className="border-l border-pine-800/15 pl-6 sm:pl-8">
                  <CountUp
                    value={10}
                    suffix="+"
                    className="font-display text-6xl leading-none font-medium text-pine-800 sm:text-8xl"
                  />
                  <dt className="label-caps mt-3 text-ink-500">
                    Natural geothermal spring sources
                  </dt>
                </div>
              </dl>
            </Reveal>

            <Reveal delay={0.16}>
              <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {notes.map((note) => (
                  <li
                    key={note}
                    className="flex items-center gap-2.5 rounded-lg border border-leaf-500/15 bg-cream-50/70 px-4 py-3 text-sm font-medium text-ink-700"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" aria-hidden="true" />
                    {note}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.2}>
              <p className="mt-8 rounded-2xl border border-leaf-600/25 bg-leaf-100/60 p-5 text-sm leading-relaxed text-pine-900">
                <span className="font-semibold">Status: In Development.</span> The resort
                is being built phase by phase, with environmental and governmental
                compliance at the heart of every decision. We will share more as each
                phase takes shape.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <Button
                to="/experiences/hotspring-ecofarm-resort"
                variant="primary"
                size="md"
                withArrow
                className="mt-8"
              >
                Discover the Resort
              </Button>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}