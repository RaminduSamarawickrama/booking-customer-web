import { useEffect, useState } from "react";

export type Route = "home" | "signin" | "signup" | "account";
const ROUTES: Route[] = ["home", "signin", "signup", "account"];

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, "") as Route;
  return ROUTES.includes(name) ? name : "home";
}

export function go(route: Route) {
  window.location.hash = route === "home" ? "/" : `/${route}`;
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
