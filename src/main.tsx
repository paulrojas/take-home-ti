import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createMockNotesApi } from './services/notesApi';
import { createLocalNotesCache } from './services/persistence';
import { SyncController } from './services/syncController';
import { AppProvider } from './store/AppContext';
import { createNotesStore } from './store/notesStore';
import './styles/app.css';

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getStorage();
const store = createNotesStore();
const sync = new SyncController(store, createMockNotesApi(storage), createLocalNotesCache('sticky-notes:cache', storage));
sync.start();

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <AppProvider store={store} sync={sync}>
      <App />
    </AppProvider>
  </StrictMode>,
);
