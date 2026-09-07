import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { ImageReveal } from "@/components/ui/ImageReveal";
import { getPlaceholder } from "@/lib/images";

const ingredients = [
  "Homestyle hospitality",
  "Wellness",
  "Dining",
  "Nature",
  "Entertainment",
  "Technology",
  "Family experiences",
];

export function BrandIntro() {
  return (
    <section
      className="bg-cream-100 py-28 sm:py-36 lg:py-44"
      aria-labelledby="brand-intro-heading"
    >
      <Container>
        {/* Editorial statement */}
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow>More than a destination</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h2
                id="brand-intro-heading"
                className="text-h1 mt-6 max-w-3xl text-balance text-navy-900"
              >
                A new way to experience hospitality.
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="text-body-lg mt-8 max-w-2xl text-ink-600 text-pretty">
                AFhomes brings the warmth of home into everything it creates. We weave
                homestyle hospitality, wellness, dining, nature, entertainment, and
                technology into experiences built around how people actually live,
                connect, and restore.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={0.1} y={40}>
              <div className="border-t border-line pt-8">
                <p className="label-caps text-ink-400">What AFhomes brings together</p>
                <ul
                  className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
                  aria-label="What AFhomes brings together"
                >
                  {ingredients.map((ingredient, index) => (
                    <li key={ingredient} className="flex items-baseline gap-3">
                      <span className="font-display text-sm text-leaf-600 italic">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[0.95rem] font-medium text-navy-800">
                        {ingredient}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.16}>
              <blockquote className="font-display mt-10 border-l-2 border-leaf-500 pl-6 text-2xl leading-snug text-navy-800 italic sm:text-[1.7rem]">
                “From the table to the rest that follows, every AFhomes stay, meal, and
                escape is designed to feel like coming home.”
              </blockquote>
            </Reveal>
          </div>
        </div>

        {/* Wide landscape */}
        <Reveal delay={0.15} y={48}>
          <ImageReveal
            spec={getPlaceholder("brand-field")}
            ratio="aspect-[4/3] sm:aspect-[21/9]"
            className="mt-20 rounded-[1.25rem] lg:mt-28"
          />
        </Reveal>
      </Container>
    </section>
  );
}