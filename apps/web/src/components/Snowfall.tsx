import { useEffect, useRef } from "react";
import { reducedMotion } from "../lib/smooth";

/**
 * Slow snow behind the hero. Flakes fall at three depths; the near ones are larger,
 * faster and drift further with the scroll, which gives the sky its depth.
 */
export function Snowfall({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let visible = true;

    type Flake = { x: number; y: number; r: number; z: number; phase: number; speed: number };
    let flakes: Flake[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(((w * h) / 9000) * density);
      flakes = Array.from({ length: Math.min(count, 220) }, () => {
        const z = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          r: 0.6 + z * z * 2.6,
          phase: Math.random() * Math.PI * 2,
          speed: 0.18 + z * 0.75,
        };
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const scroll = window.scrollY;
      const span = h + 12;
      for (const f of flakes) {
        f.y += f.speed;
        f.phase += 0.008 + f.z * 0.01;
        if (f.y > span * 4) f.y -= span * 4;
        const x = f.x + Math.sin(f.phase + t * 0.0002) * (6 + f.z * 14);
        // Near flakes ride the scroll more than far ones.
        const y = ((((f.y - scroll * f.z * 0.25) % span) + span) % span) - 6;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,255,${0.45 + f.z * 0.5})`;
        ctx.arc(x, y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (reducedMotion()) {
      draw(0);
      cancelAnimationFrame(raf);
      return () => ro.disconnect();
    }

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was) raf = requestAnimationFrame(draw);
    });
    io.observe(canvas);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} className="snowfall" aria-hidden="true" />;
}
