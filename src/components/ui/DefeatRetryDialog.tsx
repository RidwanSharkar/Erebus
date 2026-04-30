'use client';

import React from 'react';

interface DefeatRetryDialogProps {
  open: boolean;
}

export default function DefeatRetryDialog({ open }: DefeatRetryDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="defeat-retry-title"
      className="fixed inset-0 z-[500] flex items-center justify-center px-4 py-6 pointer-events-auto"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.94) 100%)',
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl border-2 border-red-900/55 bg-gray-950/85 px-8 py-10 text-center shadow-xl shadow-black/60"
        style={{ boxShadow: '0 0 40px rgba(127, 29, 29, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <h2
          id="defeat-retry-title"
          className="text-2xl font-bold tracking-[0.25em] uppercase text-red-200/95 mb-8"
        >
          Defeated
        </h2>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="w-full rounded-lg border border-red-700/60 bg-red-950/50 px-6 py-3 text-sm font-bold tracking-[0.2em] uppercase text-red-100 hover:bg-red-950/80 hover:border-red-500/70 transition-colors"
        >
          RETRY
        </button>
      </div>
    </div>
  );
}
