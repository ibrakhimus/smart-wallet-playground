'use client';

import { InputHTMLAttributes } from 'react';

type InputProps = {
  label?: string;
  error?: string;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-4">
      {label && <label className="text-white text-sm font-medium">{label}</label>}
      <input
        className={`w-full p-4 bg-black border rounded-2xl text-white font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-500' : 'border-gray-700'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
