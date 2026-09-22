/* eslint-disable react-refresh/only-export-components */
/**
 * CatalogProvider
 * Context provider for catalog data with adapter abstraction
 * Allows switching between local and OmniGrow data sources
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { CatalogAdapter } from './types';
import { createLocalStoreAdapter } from './localStoreAdapter';
import { createOmnigrowAdapter } from './omnigrowAdapter';

// Environment-based adapter selection
const CATALOG_SOURCE = import.meta.env.VITE_CATALOG_SOURCE || 'local';

interface CatalogContextValue {
  adapter: CatalogAdapter;
  source: 'local' | 'omnigrow';
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

interface CatalogProviderProps {
  children: React.ReactNode;
  forceSource?: 'local' | 'omnigrow';
}

export function CatalogProvider({ children, forceSource }: CatalogProviderProps) {
  const contextValue = useMemo<CatalogContextValue>(() => {
    const source = forceSource || (CATALOG_SOURCE as 'local' | 'omnigrow');
    
    const adapter = source === 'omnigrow' 
      ? createOmnigrowAdapter()
      : createLocalStoreAdapter();

    console.info(`[CatalogProvider] Using ${adapter.name} (source: ${source})`);

    return { adapter, source };
  }, [forceSource]);

  return (
    <CatalogContext.Provider value={contextValue}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalogContext(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalogContext must be used within a CatalogProvider');
  }
  return context;
}
