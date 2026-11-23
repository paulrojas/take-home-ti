import { Board } from './components/Board';
import { ResolutionWarning } from './components/ResolutionWarning';
import { Toolbar } from './components/Toolbar';
import { UndoToast } from './components/UndoToast';
import { useUndoShortcut } from './hooks/useUndoShortcut';
import { useTooSmallViewport } from './hooks/useTooSmallViewport';

export function App() {
  const tooSmallViewport = useTooSmallViewport();
  useUndoShortcut();

  return (
    <div className="app">
      <Toolbar />
      <Board />
      <UndoToast />
      {tooSmallViewport && <ResolutionWarning viewport={tooSmallViewport} />}
    </div>
  );
}
