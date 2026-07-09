import { HeroScrollVideoSection } from "@/components/site/hero-scroll-video";
import { WORKS } from "@/data/works";

// Every work page is known at build time — pre-render them all so Vercel serves
// static HTML for deep links instead of rendering on demand.
export function generateStaticParams() {
  return WORKS.map((work) => ({ id: work.slug }));
}

export const dynamicParams = false;

export default function WorkSlidePage() {
  return (
    <main className="overflow-x-hidden bg-[#050505]">
      <HeroScrollVideoSection />
    </main>
  );
}
