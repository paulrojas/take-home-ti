import type { Size } from '../types';
import { MIN_VIEWPORT_HEIGHT, MIN_VIEWPORT_WIDTH } from '../utils/viewport';

interface ResolutionWarningProps {
  readonly viewport: Size;
}

export function ResolutionWarning({ viewport }: ResolutionWarningProps) {
  return (
    <div className="warning" role="alertdialog" aria-modal="true" aria-labelledby="warning-title">
      <div className="warning__card">
        <h2 id="warning-title">Your window is too small</h2>
        <p>
          Sticky Notes needs a window of at least{' '}
          <strong>
            {MIN_VIEWPORT_WIDTH} × {MIN_VIEWPORT_HEIGHT}
          </strong>{' '}
          pixels. The current size is{' '}
          <strong>
            {viewport.width} × {viewport.height}
          </strong>
          .
        </p>
        <p>Please enlarge or maximize the browser window, or zoom out (Ctrl/Cmd + minus). This message disappears automatically.</p>
      </div>
    </div>
  );
}
