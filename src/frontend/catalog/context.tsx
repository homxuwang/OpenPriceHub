import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Catalog } from "../../shared/catalog/types";
import { bundledCatalog, validateCatalog } from "../../shared/catalog/logic";
const Context = createContext({ catalog: bundledCatalog, live: false });
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(bundledCatalog);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      fetch("/api/catalog", { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          if (
            !response.ok ||
            !response.headers.get("content-type")?.includes("application/json")
          )
            return;
          const body = await response.json();
          if (body.success && !validateCatalog(body.data.catalog).length) {
            setCatalog(body.data.catalog);
            setLive(body.data.storage === "database");
          }
        })
        .catch(() => {
          /* Keep the last verified snapshot if the API is temporarily unavailable. */
        });
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("oph:catalog-published", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("oph:catalog-published", refresh);
    };
  }, []);
  return (
    <Context.Provider value={{ catalog, live }}>{children}</Context.Provider>
  );
}
export const useCatalog = () => useContext(Context).catalog;
