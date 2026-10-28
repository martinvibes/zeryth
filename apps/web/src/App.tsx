import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { href, useRoute, type Route } from "./router";
import { scrollToTop, ScrollTrigger } from "./lib/smooth";
import { Nav } from "./components/Nav";
import { Landing } from "./pages/Landing";

const Give = lazy(() => import("./pages/Give").then((m) => ({ default: m.Give })));
const Start = lazy(() => import("./pages/Start").then((m) => ({ default: m.Start })));
const Vault = lazy(() => import("./pages/Vault").then((m) => ({ default: m.Vault })));
const Claim = lazy(() => import("./pages/Claim").then((m) => ({ default: m.Claim })));
const Print = lazy(() => import("./pages/Print").then((m) => ({ default: m.Print })));
const Doc = lazy(() => import("./pages/Doc").then((m) => ({ default: m.Doc })));

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "home":
      return <Landing />;
    case "give":
      return <Give fund={route.fund} />;
    case "start":
      return <Start />;
    case "vault":
      return <Vault />;
    case "claim":
      return <Claim fragment={route.fragment} />;
    case "print":
      return <Print batch={route.batch} />;
    case "doc":
      return <Doc section={route.section} />;
  }
}

export function App() {
  const route = useRoute();
  // A claim card's key or a doc section changes the hash without being a new page.
  const key = route.page === "claim" || route.page === "doc" ? route.page : href(route);

  useEffect(() => {
    scrollToTop();
    // Pages mount after the exit animation; measure again once they have.
    const t = setTimeout(() => ScrollTrigger.refresh(), 700);
    return () => clearTimeout(t);
  }, [key]);

  const bare = route.page === "print";

  return (
    <>
      {!bare && <Nav route={route} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
            // A leftover transform would make `position: fixed` children fixed to this
            // element instead of the screen.
            transitionEnd: { transform: "none" },
          }}
          exit={{ opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          onAnimationComplete={() => ScrollTrigger.refresh()}
        >
          <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
            <Page route={route} />
          </Suspense>
        </motion.main>
      </AnimatePresence>
    </>
  );
}
