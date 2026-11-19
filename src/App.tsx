import { Board } from './components/Board';
import { ResolutionWarning } from './components/ResolutionWarning';
import { Toolbar } from './components/Toolbar';
import { useTooSmallViewport } from './hooks/useTooSmallViewport';

export function App() {
  const tooSmallViewport = useTooSmallViewport();

  return (
    <div className="app">
      <Toolbar />
      <Board />
      {tooSmallViewport && <ResolutionWarning viewport={tooSmallViewport} />}
    </div>
  );
}
