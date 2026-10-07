import { useEffect, useId, useRef } from 'react';
import { CloseIcon } from './Icons.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Centered dialog on desktop, bottom sheet on phones (see .modal in styles.css).
export default function Modal({ title, onClose, children, variant = 'center', dismissable = true }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    // Focus the first field if there is one, otherwise the dialog itself.
    const target = dialogRef.current?.querySelector('input,textarea,select,[autofocus]') || dialogRef.current;
    target?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissable) onClose();
      // Keep Tab inside the dialog so keyboard focus can't wander to the page behind it.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, dismissable]);

  return (
    <div
      className={`modal-backdrop modal-${variant}`}
      onMouseDown={(e) => dismissable && e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef} tabIndex={-1}>
        <span className="modal-grabber" aria-hidden="true" />
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
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
