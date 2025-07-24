import { ReactNode } from 'react';

type FeatureLayoutProps = {
  children: ReactNode;
  className?: string;
  showCard?: boolean;
};

export function FeatureLayout({ children, className = '', showCard = true }: FeatureLayoutProps) {
  return (
    <div className="h-full bg-black flex items-center justify-center overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 w-full">
        {showCard ? (
          <div
            className={`bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-sm ${className}`}
          >
            {children}
          </div>
        ) : (
          <div className={className}>{children}</div>
        )}
      </div>
    </div>
  );
}
