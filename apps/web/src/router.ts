/**
 * Hash routing, so the site works as plain files from any host or IPFS gateway, and
 * so a claim card's key in the URL never reaches a server: everything after `#` stays
 * in the browser.
 */

import { useEffect, useState } from "react";

export type Route =
  | { page: "home" }
  | { page: "give"; fund: string }
  | { page: "start" }
  | { page: "vault" }
  | { page: "claim"; fragment: string }
  | { page: "print"; batch: string }
  | { page: "doc"; section: string };

export function parse(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, ...rest] = path.split("/");
  const tail = rest.join("/");
  switch (head) {
    case "give":
      return { page: "give", fund: tail };
    case "start":
      return { page: "start" };
    case "vault":
      return { page: "vault" };
    case "claim":
      return { page: "claim", fragment: tail };
    case "print":
      return { page: "print", batch: tail };
    case "doc":
    case "docs":
      return { page: "doc", section: tail };
    default:
      return { page: "home" };
  }
}

export function href(route: Route): string {
  switch (route.page) {
    case "home":
      return "#/";
    case "give":
      return `#/give/${route.fund}`;
    case "claim":
      return `#/claim/${route.fragment}`;
    case "print":
      return `#/print/${route.batch}`;
    case "doc":
      return route.section ? `#/doc/${route.section}` : "#/doc";
    default:
      return `#/${route.page}`;
  }
}

export function go(route: Route) {
  window.location.hash = href(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

/** The site's own address, for links that leave this browser (cards, fund links). */
export function siteOrigin(): string {
  return window.location.href.split("#")[0].replace(/\/index\.html$/, "").replace(/\/$/, "");
}
