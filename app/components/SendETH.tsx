import { useCallback, useState, useEffect } from 'react';
import { useWagmiTransactions } from '../hooks/useWagmiTransactions';
import { isAddress } from 'viem';
import { useHydration } from '../hooks/useHydration';
import { Button } from './ui/Button';
import { ConnectWalletPrompt } from './ui/ConnectWalletPrompt';
import { FeatureLayout } from './ui/FeatureLayout';
import { PillButton } from './ui/PillButton';
import { Input } from './ui/Input';

const VITALIK_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045' as const;

const AMOUNT_SHORTCUTS = {
  '0.00001Ξ': '0.00001',
  '0.0001Ξ': '0.0001',
  '0.001Ξ': '0.001',
} as const;

export function SendETH() {
  const {
    sendETH,
    isSendingETH,
    ethTxHash,
    ethTxReceipt,
    isWaitingForETH,
    ethTxError,
    ethBalance,
    currentChain,
    isConnected,
  } = useWagmiTransactions();

  const isHydrated = useHydration();

  // Safe display states to prevent hydration mismatch
  const displayIsConnected = isHydrated && isConnected;

  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // Log transaction status changes
  useEffect(() => {
    if (ethTxHash) {
      console.log('ETH transaction hash:', ethTxHash);
    }
  }, [ethTxHash]);

  useEffect(() => {
    if (ethTxReceipt) {
      console.log('ETH transaction confirmed:', ethTxReceipt);
    }
  }, [ethTxReceipt]);

  useEffect(() => {
    if (ethTxError) {
      console.error('ETH transaction error:', ethTxError);
    }
  }, [ethTxError]);

  const handleSendETH = useCallback(async () => {
    if (!amount) return;
    if (!toAddress || !isAddress(toAddress)) return;
    if (!currentChain || !displayIsConnected) return;

    try {
      await sendETH(toAddress, amount);
    } catch (error) {
      console.error('Failed to send ETH:', error);
    }
  }, [amount, toAddress, currentChain, displayIsConnected, sendETH]);

  const getButtonText = () => {
    if (isSendingETH) return 'Sending...';
    if (isWaitingForETH) return 'Confirming...';
    return 'Send ETH';
  };

  const isButtonDisabled = () => {
    return !amount || !currentChain || !displayIsConnected || isSendingETH || isWaitingForETH || !isAddress(toAddress);
  };

  return (
    <FeatureLayout showCard={false}>
      {/* Connection Status */}
      {!displayIsConnected && <ConnectWalletPrompt />}

      {displayIsConnected && (
        <div className="space-y-8">
          {/* Balance Display */}
          <div className="text-white text-xl font-bold">
            {isHydrated ? `Balance: ${parseFloat(ethBalance).toFixed(6)} ETH` : 'Loading...'}
          </div>

          {/* To Address Section */}
          <div>
            <label className="text-white text-sm font-medium">To Address</label>
            <div className="flex gap-2 mb-4 mt-2">
              <PillButton onClick={() => setToAddress(VITALIK_ADDRESS)}>vitalik.eth</PillButton>
            </div>
            <Input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
              error={toAddress && !isAddress(toAddress) ? 'Invalid address' : undefined}
            />
          </div>

          {/* Amount Section */}
          <div>
            <label className="text-white text-sm font-medium">Amount (ETH)</label>
            <div className="flex gap-2 mb-4 mt-2">
              {Object.entries(AMOUNT_SHORTCUTS).map(([label, value]) => (
                <PillButton key={value} onClick={() => setAmount(value)}>
                  {label}
                </PillButton>
              ))}
            </div>
            <Input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSendETH}
              disabled={isButtonDisabled()}
              isLoading={isSendingETH || isWaitingForETH}
              loadingText={isSendingETH ? 'Sending...' : 'Confirming...'}
              fullWidth
            >
              {getButtonText()}
            </Button>
          </div>

          {/* Transaction Status */}
          {ethTxHash && (
            <div className="space-y-2">
              <div className="text-white text-base">
                Hash: {ethTxHash.slice(0, 10)}...{ethTxHash.slice(-8)}
              </div>
              {ethTxReceipt && <div className="text-green-400 text-base">✓ Confirmed</div>}
            </div>
          )}

          {ethTxError && (
            <div className="text-red-400 text-base">Error: {ethTxError.message || 'Transaction failed'}</div>
          )}
        </div>
      )}
    </FeatureLayout>
  );
}
