import { useEffect, useRef } from "react";
import { ClaimCard } from "../../components/ClaimCard";
import { gsap, reducedMotion } from "../../lib/smooth";
import { siteOrigin } from "../../router";

export function Cards() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".fan .claim-card",
        { rotate: 0, x: 0, y: 40 },
        {
          rotate: (i: number) => [-12, 0, 12][i],
          x: (i: number) => [-120, 0, 120][i],
          y: (i: number) => [26, 0, 26][i],
          ease: "power3.out",
          scrollTrigger: { trigger: ".fan", start: "top 85%", end: "center 55%", scrub: 0.8 },
        },
      );
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="cards">
      <div className="wrap cards-grid">
        <div className="cards-copy">
          <h2>Hand out help, not account numbers.</h2>
          <p className="lead">
            Print a sheet of claim cards, each holding a little Zcash. Whoever scans one can keep it as private Zcash or cash
            it out as USDC on Solana.
          </p>
          <p className="muted">
            The group pays one QR code from its wallet, and the app splits it across every card in a single transaction. No
            list of who got what ever exists.
          </p>
        </div>
        <div className="fan" aria-hidden="true">
          <ClaimCard amount="0.02 ZEC" label="Bail fund" link={siteOrigin()} />
          <ClaimCard amount="0.05 ZEC" label="Medical" link={siteOrigin()} />
          <ClaimCard amount="0.02 ZEC" label="Food and water" link={siteOrigin()} />
        </div>
      </div>
    </section>
  );
}
