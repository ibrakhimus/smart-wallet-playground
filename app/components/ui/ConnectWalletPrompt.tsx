type ConnectWalletPromptProps = {
  title?: string;
  description?: string;
  className?: string;
};

export function ConnectWalletPrompt({
  title = 'Connect Your Wallet',
  description = 'Connect your smart wallet to start signing messages',
  className = '',
}: ConnectWalletPromptProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h3 className="text-2xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-gray-400 text-lg">{description}</p>
    </div>
  );
}
