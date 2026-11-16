import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiRepository, MockRepository, type CatalogRepository } from '../../shared/discovery/repository';
import type { Catalog } from '../../shared/discovery/types';
const mode = import.meta.env.VITE_P1_REPOSITORY || 'mock';
const defaultRepository: CatalogRepository = mode === 'api' ? new ApiRepository() : new MockRepository();
const Context = createContext<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
export function DiscoveryProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: CatalogRepository }) {
  const [state, setState] = useState<{ catalog: Catalog | null; error: string | null }>({ catalog: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ catalog: null, error: null });
    repository.load(controller.signal).then(catalog => { if (!controller.signal.aborted) setState({ catalog, error: null }); }).catch(error => { if (!controller.signal.aborted) setState({ catalog: null, error: String(error) }); });
    return () => controller.abort();
  }, [repository]);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useDiscovery = () => useContext(Context);
