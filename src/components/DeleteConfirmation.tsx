import { memo, useId, type RefObject } from 'react';

interface DeleteConfirmationProps {
  readonly cancelRef: RefObject<HTMLButtonElement>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function DeleteConfirmationImpl({ cancelRef, onConfirm, onCancel }: DeleteConfirmationProps) {
  const messageId = useId();

  return (
    <div className="note__confirm" role="alertdialog" aria-modal="true" aria-describedby={messageId}>
      <p id={messageId}>Delete this note?</p>
      <div className="note__confirm-actions">
        <button type="button" className="confirm-button confirm-button--danger" onClick={onConfirm}>
          Delete
        </button>
        {/* Cancel takes focus so a stray Enter never destroys content. */}
        <button type="button" className="confirm-button" ref={cancelRef} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export const DeleteConfirmation = memo(DeleteConfirmationImpl);
