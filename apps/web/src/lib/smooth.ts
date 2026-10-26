/**
 * One Lenis instance drives scrolling, and GSAP's ticker drives Lenis, so ScrollTrigger
 * and the smoothed scroll position never disagree by a frame.
 */

import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let lenis: Lenis | null = null;

export function startSmoothScroll(): () => void {
  if (reducedMotion()) return () => {};
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis?.destroy();
    lenis = null;
  };
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

export function scrollToElement(el: HTMLElement | string, offset = -24) {
  if (lenis) {
    // A page that just mounted may be taller than Lenis last measured; a stale limit
    // would clamp the scroll short of the target.
    lenis.resize();
    lenis.scrollTo(el, { offset, duration: 1.4 });
  } else (typeof el === "string" ? document.querySelector(el) : el)?.scrollIntoView({ behavior: "smooth" });
}

export { gsap, ScrollTrigger };
