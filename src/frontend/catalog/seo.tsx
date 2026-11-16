import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageMeta } from "../../shared/catalog/seo";
import { useCatalog } from "./context";
export function CatalogSEO() {
  const c = useCatalog();
  const location = useLocation();
  useEffect(() => {
    const origin =
      import.meta.env.VITE_SITE_URL ||
      document.head
        .querySelector('meta[name="oph-site-origin"]')
        ?.getAttribute("content") ||
      window.location.origin;
    const meta = pageMeta(c, location.pathname, location.search, origin);
    document.title = meta.title;
    const set = (
      selector: string,
      tag: string,
      attrs: Record<string, string>,
    ) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement(tag);
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
    };
    set('meta[name="description"]', "meta", {
      name: "description",
      content: meta.description,
    });
    set('meta[name="robots"]', "meta", {
      name: "robots",
      content: meta.noindex ? "noindex, follow" : "index, follow",
    });
    set('link[rel="canonical"]', "link", {
      rel: "canonical",
      href: meta.canonical,
    });
    for (const [key, value] of Object.entries({
      "og:title": meta.title,
      "og:description": meta.description,
      "og:url": meta.canonical,
      "og:type": "website",
    }))
      set(`meta[property="${key}"]`, "meta", { property: key, content: value });
    for (const [key, value] of Object.entries({
      "twitter:title": meta.title,
      "twitter:description": meta.description,
    }))
      set(`meta[name="${key}"]`, "meta", { name: key, content: value });
    let script = document.head.querySelector("#oph-schema");
    if (!script) {
      script = document.createElement("script");
      script.id = "oph-schema";
      script.setAttribute("type", "application/ld+json");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(meta.schema);
  }, [c, location.pathname, location.search]);
  return null;
}
