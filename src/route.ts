import { useEffect, useState } from "react";

/** Hash routes: #/, #/signin, #/signup, #/account, #/book, #/booking/TR7K4P9Q?t=<manage token> */
export type Route =
  | { name: "home" }
  | { name: "signin" }
  | { name: "signup" }
  | { name: "account" }
  | { name: "book" }
  | { name: "booking"; reference: string; token?: string };

export function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case "signin":
    case "signup":
    case "account":
    case "book":
      return { name: parts[0] };
    case "booking":
      return parts[1] ? { name: "booking", reference: decodeURIComponent(parts[1]), token: params.get("t") ?? undefined } : { name: "home" };
    default:
      return { name: "home" };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "booking":
      return `#/booking/${encodeURIComponent(route.reference)}${route.token ? `?t=${encodeURIComponent(route.token)}` : ""}`;
    default:
      return `#/${route.name}`;
  }
}

export function go(route: Route | Route["name"]) {
  const target = typeof route === "string" ? ({ name: route } as Route) : route;
  window.location.hash = href(target).slice(1);
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
