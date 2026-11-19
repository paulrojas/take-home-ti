import { createContext, useContext, type ReactNode } from 'react';
import type { SyncController } from '../services/syncController';
import type { NotesStore } from './notesStore';

interface AppServices {
  readonly store: NotesStore;
  readonly sync: SyncController;
}

const AppContext = createContext<AppServices | null>(null);

interface AppProviderProps extends AppServices {
  readonly children: ReactNode;
}

export function AppProvider({ store, sync, children }: AppProviderProps) {
  // Services are created once outside React, so the context value never changes after mount.
  return <AppContext.Provider value={{ store, sync }}>{children}</AppContext.Provider>;
}

function useServices(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('AppProvider is missing');
  return services;
}

export function useStore(): NotesStore {
  return useServices().store;
}

export function useSync(): SyncController {
  return useServices().sync;
}
