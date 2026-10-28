import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Snowfall } from "../components/Snowfall";
import { ThawTitle } from "../components/ThawTitle";
import { Mark } from "../components/Mark";
import { gsap, reducedMotion, ScrollTrigger, scrollToElement } from "../lib/smooth";
import { liveBoard } from "../lib/board";
import type { Thaw } from "../components/IceVault";
import { HowItWorks } from "./landing/HowItWorks";
import { Board } from "./landing/Board";
import { Raid } from "./landing/Raid";
import { Cards } from "./landing/Cards";
import "../styles/landing.css";

const IceVault = lazy(() => import("../components/IceVault"));
const DEFAULT_FUND = (import.meta.env.VITE_DEFAULT_FUND as string | undefined) ?? "";

export function Landing() {
  return (
    <>
      <Hero />
      <Story />
      <HowItWorks />
      <Board />
      <Raid />
      <Cards />
      <Limits />
      <Finale />
      <Footer />
    </>
  );
}

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("webgl2") || c.getContext("webgl");
    // Hand the probe's context straight back: browsers cap how many a page may hold.
    ctx?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!ctx;
  } catch {
    return false;
  }
}

function Hero() {
  const section = useRef<HTMLElement>(null);
  const thaw: Thaw = useRef({ intro: 0, scroll: 0 });
  // Until the 3D block has drawn, and whenever WebGL is missing or lost, a photo of it stands in.
  const [gl, setGl] = useState<"off" | "loading" | "live">(() => (webglOk() ? "loading" : "off"));
  const [thawed, setThawed] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const still = useRef<HTMLImageElement>(null);

  // The photo turns toward the pointer the way the 3D block does.
  useEffect(() => {
    if (gl === "live" || reducedMotion()) return;
    const move = (e: PointerEvent) => {
      still.current?.style.setProperty("--px", ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
      still.current?.style.setProperty("--py", ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, [gl]);

  useEffect(() => {
    let alive = true;
    liveBoard()
      .then((drops) => {
        const day = Date.now() / 1000 - 7 * 86400;
        if (alive) setLive(drops.filter((d) => d.createdAt > day).length);
      })
      .catch(() => alive && setLive(null));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: section.current,
      start: "top top",
      end: "bottom top",
      onUpdate: (self) => (thaw.current.scroll = self.progress * 1.6),
    });
    return () => st.kill();
  }, []);

  const onThawed = () => {
    setThawed(true);
    if (reducedMotion()) thaw.current.intro = 1;
    else gsap.to(thaw.current, { intro: 1, duration: 2.4, ease: "power2.out" });
  };

  return (
    <section ref={section} className="hero">
      <div className="hero-sky" aria-hidden="true" />
      <div className={`ice-still ${gl === "live" ? "is-covered" : ""}`} aria-hidden="true">
        <img ref={still} src="hero/ice.jpg" alt="" />
      </div>
      {gl !== "off" && (
        <Suspense fallback={null}>
          <IceVault thaw={thaw} live={gl === "live"} onReady={() => setGl("live")} onLost={() => setGl("off")} />
        </Suspense>
      )}
      <Snowfall />
      <div className="wrap hero-inner">
        <ThawTitle text="The fund they can't freeze." onThawed={onThawed} />
        <div className={`hero-after ${thawed ? "is-in" : ""}`}>
          <p className="lead hero-lead">
            Give from almost any wallet, on almost any chain. It arrives as private Zcash that only the group can spend,
            and every key that could lead back to you is burned as they go.
          </p>
          <div className="hero-cta">
            <a className="btn gold" href={`#/give/${DEFAULT_FUND}`}>
              Give to a fund
            </a>
            <a className="btn ghost" href="#/start">
              Start a fund
            </a>
          </div>
          <p className="hero-live small">
            <span className={`dot ${live === null ? "" : "live"}`} />
            {live === null
              ? "Reading the public board…"
              : live === 0
                ? "The public board is quiet this week."
                : `${live} sealed ${live === 1 ? "gift" : "gifts"} on the public board this week.`}
          </p>
        </div>
      </div>
      <button className="hero-cue small" onClick={() => scrollToElement("#story")}>
        See why it exists
      </button>
    </section>
  );
}

const STORY = [
  "October 2020, Lagos. Young Nigerians fill the streets to end police brutality.",
  "The Feminist Coalition raises money for protesters' medical bills, legal aid and food. Then their donation link stops working.",
  "They move to Bitcoin and keep going. Weeks later, a court order freezes the bank accounts of twenty protesters.",
];

function Story() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      const words = gsap.utils.toArray<HTMLElement>(".story-text .w");
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: { trigger: ".story-text", start: "top 78%", end: "bottom 42%", scrub: 0.6 },
        },
      );
      gsap.fromTo(
        ".slip",
        { y: 80, rotate: 7 },
        { y: -60, rotate: -4, ease: "none", scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: 0.4 } },
      );
      gsap.fromTo(
        ".slip-frost",
        { opacity: 0 },
        { opacity: 1, ease: "none", scrollTrigger: { trigger: ".slip", start: "top 80%", end: "top 30%", scrub: 0.4 } },
      );
      gsap.from(".story-turn > *", {
        y: 30,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: { trigger: ".story-turn", start: "top 80%" },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="story" className="story">
      <div className="wrap story-grid">
        <div className="story-text">
          {STORY.map((p, i) => (
            <p key={i}>
              {p.split(" ").map((w, j) => (
                <span key={j} className="w">
                  {w}{" "}
                </span>
              ))}
            </p>
          ))}
        </div>
        <div className="slip" aria-label="A bank notice: account restricted">
          <div className="slip-head">
            <span className="slip-bank">Account notice</span>
            <span className="slip-stamp">Restricted</span>
          </div>
          <p className="slip-body">
            Incoming transfers to this account are suspended until further notice. Funds received will be returned to the
            sender.
          </p>
          <div className="slip-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="slip-frost" aria-hidden="true" />
        </div>
      </div>
      <div className="wrap story-turn">
        <p className="story-punch">Bitcoin kept the money moving. It also put every donor on a public ledger, forever.</p>
        <p className="story-answer">
          Zeryth keeps the first part and fixes the second. It's what we wish they'd had.
        </p>
      </div>
    </section>
  );
}

const LIMITS = [
  {
    title: "Your side of the swap",
    body: "The payment you send on Base, Solana or any other chain is public there, like every payment on that chain. What it can't show is where the money went once it became Zcash.",
  },
  {
    title: "The swap itself",
    body: "NEAR Intents runs the swap, so it sees it. Zeryth adds no fee and no tag, so nothing marks it as a gift to anyone.",
  },
  {
    title: "A group that keeps copies",
    body: "Burning deletes the keys in the app. A group that copied them somewhere else could still open old rounds. Burning protects donors from raids, not from the group.",
  },
  {
    title: "Timing",
    body: "A gift sent minutes before a payout is easier to guess at. Rounds and round amounts make matching hard, not impossible. Bigger, slower rounds hide more.",
  },
];

function Limits() {
  return (
    <section className="limits">
      <div className="wrap">
        <h2>What Zeryth can't hide.</h2>
        <p className="lead">Privacy tools that oversell get people hurt. Here is exactly where the edges are.</p>
        <dl className="limits-list">
          {LIMITS.map((l) => (
            <div key={l.title} className="limit">
              <dt>{l.title}</dt>
              <dd>{l.body}</dd>
            </div>
          ))}
        </dl>
        <a className="limits-more" href="#/doc/limits">
          All the limits, in detail
        </a>
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section className="finale">
      <Snowfall density={0.6} />
      <div className="wrap finale-inner">
        <Mark size={56} tone="frost" />
        <h2>Start a fund in two minutes.</h2>
        <p className="lead">
          You need a name, a Zcash wallet to receive into, and this page. No account, no sign-up, no server of ours in the
          middle.
        </p>
        <div className="hero-cta">
          <a className="btn gold" href="#/start">
            Start a fund
          </a>
          <a className="btn ghost" href={`#/give/${DEFAULT_FUND}`}>
            Give to a fund
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <Mark size={22} tone="frost" />
          <span>Zeryth</span>
        </div>
        <p className="small muted">
          Built for ZECATHON 2026. Runs on Zcash Ironwood, NEAR Intents and Nostr. The wallet engine is adapted from
          Zenvelope (MIT). Everything here runs in your browser; there is no Zeryth server.
        </p>
        <nav className="footer-links" aria-label="More">
          <a href="#/doc">Docs</a>
          <a href="https://github.com/martinvibes/zeryth" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
