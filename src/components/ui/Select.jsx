import React from 'react';

export const Select = ({ label, options, value, onChange, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
      <select
        value={value}
        onChange={onChange}
        className={`px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white ${className}`}
        {...props}
      >
        <option value="" disabled>Select an option</option>
        {options.map((opt, i) => (
          <option key={i} value={opt.value || opt}>{opt.label || opt}</option>
        ))}
      </select>
    </div>
  );
};
