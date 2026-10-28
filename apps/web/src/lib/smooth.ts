/**
 * Scrolling is the browser's own: it is already smooth on a trackpad, and nested lists,
 * find-in-page and anchors all behave. GSAP's ScrollTrigger reads it directly.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "instant" });
}

export function scrollToElement(el: HTMLElement | string, offset = -24) {
  const target = typeof el === "string" ? document.querySelector<HTMLElement>(el) : el;
  if (!target) return;
  const top = target.getBoundingClientRect().top + window.scrollY + offset;
  window.scrollTo({ top, behavior: reducedMotion() ? "instant" : "smooth" });
}

export { gsap, ScrollTrigger };
