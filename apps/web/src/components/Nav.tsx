import { useEffect, useState } from "react";
import { href, type Route } from "../router";
import { useVault } from "../lib/store";
import { scrollToElement } from "../lib/smooth";
import { Mark } from "./Mark";

const DEFAULT_FUND = import.meta.env.VITE_DEFAULT_FUND as string | undefined;

export function Nav({ route }: { route: Route }) {
  const vault = useVault();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const howItWorks = (e: React.MouseEvent) => {
    if (route.page !== "home") return;
    e.preventDefault();
    scrollToElement("#how");
  };

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="nav-inner" aria-label="Main">
        <a className="nav-brand" href="#/" aria-label="Zeryth home">
          <Mark size={26} />
          <span>Zeryth</span>
        </a>
        <div className="nav-links">
          <a href="#/" onClick={howItWorks} className="nav-link hide-sm">
            How it works
          </a>
          <a href={DEFAULT_FUND ? `#/give/${DEFAULT_FUND}` : "#/give/"} className="nav-link hide-sm">
            Give
          </a>
          <a href="#/doc" className="nav-link" aria-current={route.page === "doc" ? "page" : undefined}>
            Docs
          </a>
          {vault ? (
            <a href="#/vault" className={`btn small ${route.page === "vault" ? "" : "gold"}`}>
              {vault.name}
            </a>
          ) : (
            <a href="#/start" className="btn small gold">
              Start a fund
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}

export { href };
