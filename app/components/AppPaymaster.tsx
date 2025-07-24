import { useCallback, useState, useEffect, useMemo } from 'react';
import { useChainId, useSendCalls, useAccount } from 'wagmi';
import { useWallet } from '../context/WagmiContextProvider';
import { useHydration } from '../hooks/useHydration';
import { Button } from './ui/Button';
import { ConnectWalletPrompt } from './ui/ConnectWalletPrompt';
import { FeatureLayout } from './ui/FeatureLayout';
import { Input } from './ui/Input';

const PAYMASTER_SUPPORTED_CHAINS = {
  8453: 'Base',
  84532: 'Base Sepolia',
} as const;

export function AppPaymaster() {
  const { addLog } = useWallet();
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const isHydrated = useHydration();

  // Safe display states to prevent hydration mismatch
  const displayIsConnected = isHydrated && isConnected;
  const displayCurrentChainId = isHydrated ? currentChainId : undefined;

  // WAGMI hook for sponsored transactions
  const { sendCalls, data: callsResult, isPending: isSendingCalls, error: sendCallsError } = useSendCalls();

  const [sponsor, setSponsor] = useState<string>('');
  const callsId = callsResult?.id || '';

  const currentChainSupported = displayCurrentChainId ? displayCurrentChainId in PAYMASTER_SUPPORTED_CHAINS : false;

  // Log when sendCalls result is received
  useEffect(() => {
    if (callsResult) {
      addLog({
        type: 'message',
        data: `Sponsored transaction initiated with ID: ${callsResult.id}`,
      });
    }
  }, [callsResult, addLog]);

  // Log sendCalls errors
  useEffect(() => {
    if (sendCallsError) {
      addLog({
        type: 'error',
        data: `Sponsored transaction failed: ${sendCallsError.message}`,
      });
    }
  }, [sendCallsError, addLog]);

  const sendSponsoredTransaction = useCallback(async () => {
    if (!displayIsConnected || !currentChainSupported) return;

    try {
      const sponsorName = !sponsor ? 'Smart Wallet Playground' : sponsor;
      const paymasterUrl = `${document.location.origin}/api/paymaster/${encodeURIComponent(sponsorName)}`;

      addLog({
        type: 'message',
        data: `Sending sponsored empty transaction via WAGMI useSendCalls`,
      });

      addLog({
        type: 'message',
        data: `Using paymaster URL: ${paymasterUrl}`,
      });

      addLog({
        type: 'message',
        data: `Chain ID: ${currentChainId} (0x${currentChainId.toString(16)})`,
      });

      sendCalls({
        calls: [
          {
            to: '0x0000000000000000000000000000000000000000',
            data: '0x',
            // Empty transaction - no value
          },
        ],
        capabilities: {
          paymasterService: {
            url: paymasterUrl,
          },
        },
      });

      addLog({
        type: 'message',
        data: `WAGMI useSendCalls initiated for sponsored transaction`,
      });
    } catch (error) {
      addLog({
        type: 'error',
        data: `Sponsored transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }, [displayIsConnected, sponsor, addLog, currentChainSupported, sendCalls, currentChainId]);

  const getButtonText = useMemo(() => {
    if (!isHydrated) return 'Loading...';
    if (!displayIsConnected) return 'Connect Wallet';
    if (!currentChainSupported) return 'Unsupported Chain';
    if (isSendingCalls) return 'Sending...';
    if (callsId) return 'Transaction Submitted';
    return 'Send Transaction';
  }, [isHydrated, displayIsConnected, currentChainSupported, isSendingCalls, callsId]);

  const isButtonDisabled = !displayIsConnected || !currentChainSupported || isSendingCalls || !!callsId;

  return (
    <FeatureLayout showCard={false}>
      {/* Connection Status */}
      {!displayIsConnected && <ConnectWalletPrompt />}

      {displayIsConnected && (
        <div className="space-y-8">
          {/* Sponsor Configuration */}
          <div className="space-y-4">
            <Input
              label="Sponsor Name"
              type="text"
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              placeholder="Smart Wallet Playground"
              className="mt-2"
            />
            <p className="text-gray-400 text-xs">Used for paymaster service identification</p>
          </div>

          {/* Send Button */}
          <Button onClick={sendSponsoredTransaction} disabled={isButtonDisabled} fullWidth>
            {getButtonText}
          </Button>

          {/* Transaction Status */}
          {callsId && (
            <div className="space-y-2 p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
              <h4 className="text-white text-sm font-medium">Transaction Status</h4>
              <div className="text-xs font-mono text-gray-300">Calls ID: {callsId}</div>
              <div className="text-xs text-green-400">Status: Submitted</div>
            </div>
          )}
        </div>
      )}
    </FeatureLayout>
  );
}
