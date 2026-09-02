/**
 * DeleteModal Component
 * Renders Screen 7 (Manual Delete Confirmation Dialog)
 */

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-[320px] p-5 rounded-2xl bg-surface border border-subtle shadow-2xl">
        <div className="flex items-center gap-3 mb-3 text-red-400">
          <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-100">Delete Meeting Data?</h3>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          Are you sure you want to permanently delete this local recording and transcript? This action <span className="text-red-400 font-semibold">cannot be undone</span>.
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-elevated hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-sm transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Confirm Wipe</span>
          </button>
        </div>
      </div>
    </div>
  );
};
