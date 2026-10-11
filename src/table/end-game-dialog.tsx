'use client';
import { useEffect, useRef } from 'react';

export function EndGameDialog({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className="leave-dialog" aria-labelledby="end-game-title" aria-describedby="end-game-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={(event) => { if (!busy && event.target === event.currentTarget) onCancel(); }}>
    <h2 id="end-game-title">End this game for everyone?</h2>
    <p id="end-game-description">The table will close for every player. Its saved history remains available, but this game cannot continue.</p>
    <div className="leave-dialog-actions"><button type="button" className="account-secondary" onClick={onCancel} disabled={busy}>Keep playing</button>
      <button type="button" className="account-primary" onClick={onConfirm} disabled={busy}>{busy ? 'Ending game…' : 'End game for everyone'}</button></div>
  </dialog>;
}
