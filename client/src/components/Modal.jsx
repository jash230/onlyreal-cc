import { useEffect, useRef } from 'react';
import { CloseIcon } from './Icons.jsx';

// Centered dialog on desktop, bottom sheet on phones (see .modal in styles.css).
export default function Modal({ title, onClose, children, variant = 'center', dismissable = true }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    // Focus the first field if there is one, otherwise the dialog itself.
    const target = dialogRef.current?.querySelector('input,textarea,select,[autofocus]') || dialogRef.current;
    target?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className={`modal-backdrop modal-${variant}`}
      onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} tabIndex={-1}>
        <span className="modal-grabber" aria-hidden="true" />
        <header className="modal-head">
          <h2>{title}</h2>
          {dismissable && (
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
