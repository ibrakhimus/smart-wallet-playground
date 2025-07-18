import { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonProps = {
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  isLoading = false,
  loadingText,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const buttonText = isLoading && loadingText ? loadingText : children;
  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      className={`
        h-14 px-8 text-lg font-semibold rounded-2xl transition-all duration-200 transform
        ${!isDisabled ? 'hover:scale-[1.02] active:scale-[0.98]' : 'transform-none'}
        ${!className && !isDisabled ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white cursor-pointer shadow-lg shadow-blue-500/25' : ''}
        ${!className && isDisabled ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
        ${isDisabled && className ? 'opacity-50 cursor-not-allowed transform-none' : ''}
      `.trim()}
      {...props}
    >
      {isLoading && (
        <span className="inline-flex items-center">
          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
          {buttonText}
        </span>
      )}
      {!isLoading && buttonText}
    </button>
  );
}
