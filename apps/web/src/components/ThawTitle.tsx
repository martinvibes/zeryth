import { useLayoutEffect, useRef } from "react";
import { gsap, reducedMotion } from "../lib/smooth";

const FROZEN = '"wdth" 75, "wght" 300';
const THAWED = '"wdth" 112, "wght" 780';

/**
 * The headline arrives frozen: condensed, pale, warped by frost. Then it thaws letter
 * by letter into full width and full ink, and a few drops of gold run off it.
 */
export function ThawTitle({ text, onThawed }: { text: string; onThawed?: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const warp = useRef<SVGFEDisplacementMapElement>(null);

  useLayoutEffect(() => {
    const h1 = ref.current!;
    const words = Array.from(h1.querySelectorAll<HTMLElement>(".thaw-word"));
    const chars = Array.from(h1.querySelectorAll<HTMLElement>(".thaw-char"));

    if (reducedMotion()) {
      h1.style.opacity = "1";
      onThawed?.();
      return;
    }

    let tl: gsap.core.Timeline | null = null;
    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) return;
      // Lock each word to its thawed width first, so letters widening in place never
      // push a word onto the next line halfway through.
      for (const w of words) w.style.width = `${w.getBoundingClientRect().width}px`;

      gsap.set(chars, { fontVariationSettings: FROZEN, color: "#9db9d6", opacity: 0, filter: "blur(10px)", y: -6 });
      gsap.set(warp.current, { attr: { scale: 9 } });
      h1.style.opacity = "1";
      h1.classList.add("is-frozen");

      tl = gsap.timeline({
        onComplete: () => {
          for (const w of words) w.style.width = "";
          h1.classList.remove("is-frozen");
          gsap.set(chars, { clearProps: "filter,color,fontVariationSettings,transform" });
          onThawed?.();
        },
      });
      tl.to(chars, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.9, ease: "power2.out", stagger: 0.025 })
        .to({}, { duration: 0.35 })
        .to(warp.current, { attr: { scale: 0 }, duration: 1.5, ease: "power2.inOut" }, "thaw")
        .to(
          chars,
          { fontVariationSettings: THAWED, color: "#0f2340", duration: 1.15, ease: "expo.inOut", stagger: 0.035 },
          "thaw",
        )
        .add(() => drip(h1), "thaw+=1.1");
    });

    return () => {
      cancelled = true;
      tl?.kill();
    };
    // The headline text is static for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = text.split(" ");
  return (
    <h1 ref={ref} className="thaw" aria-label={text} style={{ opacity: 0 }}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <filter id="frost" x="-5%" y="-20%" width="110%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.6" numOctaves="2" seed="7" />
          <feDisplacementMap ref={warp} in="SourceGraphic" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {words.map((word, wi) => (
        <span key={wi} className="thaw-word" aria-hidden="true">
          {Array.from(word).map((ch, ci) => (
            <span key={ci} className="thaw-char">
              {ch}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

/** A few drops of gold run off the bottoms of random letters. */
function drip(h1: HTMLElement) {
  const chars = Array.from(h1.querySelectorAll<HTMLElement>(".thaw-char")).filter((c) => /[a-z]/i.test(c.textContent ?? ""));
  const box = h1.getBoundingClientRect();
  const picks = gsap.utils.shuffle(chars.slice()).slice(0, 5);
  picks.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const drop = document.createElement("span");
    drop.className = "drip";
    drop.style.left = `${r.left - box.left + r.width * (0.3 + Math.random() * 0.4)}px`;
    drop.style.top = `${r.bottom - box.top - r.height * 0.18}px`;
    h1.appendChild(drop);
    gsap
      .timeline({ delay: i * 0.22 + Math.random() * 0.2, onComplete: () => drop.remove() })
      .fromTo(drop, { scaleY: 0, scaleX: 0.6, opacity: 1 }, { scaleY: 1, scaleX: 1, duration: 0.5, ease: "power2.out" })
      .to(drop, { y: 70 + Math.random() * 90, scaleY: 1.5, duration: 0.85, ease: "power2.in" })
      .to(drop, { opacity: 0, duration: 0.25 }, "-=0.25");
  });
}
