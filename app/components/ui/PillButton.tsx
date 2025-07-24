'use client';

type PillButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
};

export function PillButton({ children, onClick, className = '' }: PillButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer border border-blue-400 text-blue-400 hover:bg-blue-500/20 rounded-full px-4 py-2 text-sm transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
