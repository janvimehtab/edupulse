import React from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-none md:rounded-xl shadow-xl w-full h-full md:h-auto max-h-[100vh] md:max-h-[90vh] max-w-3xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="flex items-center gap-1 p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="text-sm font-medium hidden sm:inline">Close</span>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
