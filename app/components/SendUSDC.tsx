import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
  useCallsStatus,
  useSendCalls,
  useAccount,
} from 'wagmi';
import { useWallet } from '../context/WagmiContextProvider';
import { encodeFunctionData, erc20Abi, isAddress, parseUnits } from 'viem';
import { Switch } from './ui/Switch';
import { Button } from './ui/Button';
import { ConnectWalletPrompt } from './ui/ConnectWalletPrompt';
import { FeatureLayout } from './ui/FeatureLayout';
import { PillButton } from './ui/PillButton';
import { Input } from './ui/Input';

import { useHydration } from '../hooks/useHydration';

const VITALIK_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045' as const;

const AMOUNT_SHORTCUTS = {
  '1¢': '0.01',
  '10¢': '0.10',
  $1: '1.00',
} as const;

const CHAIN_TO_USDC_ADDRESS = {
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
} as const;

const CHAIN_NAMES = {
  8453: 'Base',
  84532: 'Base Sepolia',
} as const;

const CHAIN_TO_EXPLORER = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
} as const;

export function SendUSDC() {
  const { addLog } = useWallet();
  const { isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const isHydrated = useHydration();

  // WAGMI hooks for contract interaction
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { sendCalls, data: wagmiCallsId, error: sendCallsError } = useSendCalls();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const [toAddress, setToAddress] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [useSendCallsMode, setUseSendCallsMode] = useState(false); // Default to useWriteContract
  const [isSponsored, setIsSponsored] = useState(false);
  const [targetChainId, setTargetChainId] = useState<keyof typeof CHAIN_TO_USDC_ADDRESS | null>(null);

  // Use WAGMI callsId when available, otherwise empty string
  const activeCallsId = wagmiCallsId?.id || '';
  const { data: callsStatus } = useCallsStatus({ id: activeCallsId });

  useEffect(() => {
    // USDC sends can be sponsored on supported chains (Base, Base Sepolia)
    const supportsPaymaster = [8453, 84532].includes(currentChainId);
    setIsSponsored(supportsPaymaster);
  }, [currentChainId]);

  useEffect(() => {
    if (writeError) {
      addLog({
        type: 'error',
        data: `USDC transfer failed: ${writeError.message}`,
      });
    }
  }, [writeError, addLog]);

  useEffect(() => {
    if (sendCallsError) {
      addLog({
        type: 'error',
        data: `sendCalls failed: ${sendCallsError.message}`,
      });
    }
  }, [sendCallsError, addLog]);

  useEffect(() => {
    if (isConfirmed && hash) {
      addLog({
        type: 'message',
        data: `USDC transfer confirmed: ${hash}`,
      });
    }
  }, [isConfirmed, hash, addLog]);

  useEffect(() => {
    if (wagmiCallsId) {
      addLog({
        type: 'message',
        data: `sendCalls initiated with ID: ${wagmiCallsId.id}`,
      });
    }
  }, [wagmiCallsId, addLog]);

  // Safe display states to prevent hydration mismatch
  const displayIsConnected = isHydrated && isConnected;
  const displayCurrentChainId = isHydrated ? currentChainId : undefined;
  const isDisabled = !amount || !toAddress || !isAddress(toAddress) || !displayIsConnected;

  const sendUSDCWithWagmi = useCallback(
    async (chainId: keyof typeof CHAIN_TO_USDC_ADDRESS) => {
      if (isDisabled) return;

      try {
        // Switch chain if needed
        if (currentChainId !== chainId) {
          addLog({
            type: 'message',
            data: `Switching to chain ${chainId} for USDC transfer`,
          });
          switchChain({ chainId });
          return;
        }

        const usdcAddress = CHAIN_TO_USDC_ADDRESS[chainId];
        setTargetChainId(chainId);

        addLog({
          type: 'message',
          data: `Sending ${amount} USDC to ${toAddress} on ${CHAIN_NAMES[chainId]}`,
        });

        writeContract({
          address: usdcAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, parseUnits(amount, 6)],
        });
      } catch (error) {
        addLog({
          type: 'error',
          data: `Failed to send USDC: ${error}`,
        });
      }
    },
    [isDisabled, currentChainId, switchChain, amount, toAddress, writeContract, addLog],
  );

  // WAGMI-based sendCalls functionality (EIP-5792)
  const sendUSDCWithCalls = useCallback(
    async (chainId: keyof typeof CHAIN_TO_USDC_ADDRESS) => {
      if (isDisabled) {
        addLog({
          type: 'error',
          data: 'Form validation failed',
        });
        return;
      }

      const usdcAddress = CHAIN_TO_USDC_ADDRESS[chainId];
      setTargetChainId(chainId);

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        addLog({
          type: 'error',
          data: 'Invalid amount: must be a positive number',
        });
        return;
      }

      try {
        // Switch chain if needed
        if (currentChainId !== chainId) {
          addLog({
            type: 'message',
            data: `Switching to chain ${chainId} for USDC transfer`,
          });
          switchChain({ chainId });
          return;
        }

        const callData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [toAddress as `0x${string}`, parseUnits(amount, 6)],
        });

        // Paymaster is supported on: Base (8453), Base Sepolia (84532)
        const supportsPaymaster = [8453, 84532].includes(chainId);

        if (isSponsored && !supportsPaymaster) {
          addLog({
            type: 'error',
            data: `Sponsored transactions not supported on ${CHAIN_NAMES[chainId]}`,
          });
          return;
        }

        const capabilities =
          isSponsored && supportsPaymaster
            ? {
                paymasterService: {
                  url: `${document.location.origin}/api/paymaster/${encodeURIComponent('Smart Wallet Playground')}`,
                },
              }
            : {};

        // Use WAGMI's useSendCalls hook instead of manual provider.request
        sendCalls({
          calls: [
            {
              to: usdcAddress as `0x${string}`,
              data: callData,
            },
          ],
          capabilities,
        });

        addLog({
          type: 'message',
          data: `WAGMI sendCalls initiated for USDC transfer`,
        });
      } catch (error) {
        console.error('sendCalls error:', error);
        addLog({
          type: 'error',
          data: `sendCalls failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [isDisabled, isSponsored, toAddress, amount, addLog, currentChainId, switchChain, sendCalls],
  );

  const sendUSDC = useSendCallsMode ? sendUSDCWithCalls : sendUSDCWithWagmi;

  const buttonText = useMemo(() => {
    if (!isHydrated) return 'Loading...';
    if (!displayIsConnected) return 'Connect Wallet';
    if (!displayCurrentChainId || !(displayCurrentChainId in CHAIN_TO_USDC_ADDRESS)) {
      return 'Unsupported Chain';
    }

    if (useSendCallsMode) {
      return 'Send USDC';
    }

    if (isWritePending) return 'Sending...';
    if (isConfirming) return 'Confirming...';
    return 'Send USDC';
  }, [isHydrated, displayIsConnected, displayCurrentChainId, useSendCallsMode, isWritePending, isConfirming]);

  const handleSend = useCallback(() => {
    if (!displayCurrentChainId || !(displayCurrentChainId in CHAIN_TO_USDC_ADDRESS)) {
      addLog({
        type: 'error',
        data: `USDC not supported on current chain (${displayCurrentChainId}). Please switch to Base or Base Sepolia.`,
      });
      return;
    }

    sendUSDC(displayCurrentChainId as keyof typeof CHAIN_TO_USDC_ADDRESS);
  }, [displayCurrentChainId, addLog, sendUSDC]);

  const getTransactionHash = useMemo(() => {
    if (useSendCallsMode && callsStatus?.status === 'success') {
      return callsStatus.receipts?.[0]?.transactionHash;
    }
    return hash;
  }, [useSendCallsMode, callsStatus?.status, callsStatus?.receipts, hash]);

  const getTransactionStatus = useMemo(() => {
    if (useSendCallsMode) {
      if (callsStatus?.status === 'success') return 'CONFIRMED';
      if (callsStatus?.status === 'failure') return 'FAILED';
      return 'PENDING';
    }
    if (isConfirmed) return 'CONFIRMED';
    if (isConfirming) return 'CONFIRMING';
    if (isWritePending) return 'PENDING';
    return null;
  }, [useSendCallsMode, callsStatus?.status, isConfirmed, isConfirming, isWritePending]);

  return (
    <FeatureLayout showCard={false}>
      {/* Connection Status */}
      {!displayIsConnected && <ConnectWalletPrompt />}

      {displayIsConnected && (
        <div className="space-y-8">
          {/* Mode Selection */}
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={useSendCallsMode}
                onChange={setUseSendCallsMode}
                leftLabel="useWriteContract"
                rightLabel="useSendCalls"
              />
              {/* Info Icon with Tooltip */}
              <div className="relative group">
                <svg
                  className="w-4 h-4 text-gray-400 hover:text-white cursor-help"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12,16v-4"></path>
                  <path d="M12,8h.01"></path>
                </svg>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-80 z-10">
                  <div className="space-y-2">
                    <div>
                      <span className="font-semibold text-blue-300">useWriteContract:</span>
                      <div className="text-gray-300">• Standard Ethereum transactions</div>
                      <div className="text-gray-300">• User pays gas fees</div>
                      <div className="text-gray-300">• Works with all wallets (MetaMask, WalletConnect, etc.)</div>
                      <div className="text-gray-300">• Single transaction at a time</div>
                    </div>
                    <div>
                      <span className="font-semibold text-green-300">useSendCalls (WAGMI):</span>
                      <div className="text-gray-300">• Advanced smart wallet features (EIP-5792)</div>
                      <div className="text-gray-300">• Can be sponsored (app pays gas)</div>
                      <div className="text-gray-300">• Batch multiple transactions</div>
                      <div className="text-gray-300">• Requires smart wallet (Coinbase Wallet, etc.)</div>
                    </div>
                  </div>
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sponsored Checkbox */}
            <div className="h-6 flex items-center">
              {useSendCallsMode && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSponsored}
                    onChange={(e) => setIsSponsored(e.target.checked)}
                    disabled={!displayCurrentChainId || ![8453, 84532].includes(displayCurrentChainId)}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white text-sm">
                    Sponsored
                    {!displayCurrentChainId || ![8453, 84532].includes(displayCurrentChainId)
                      ? ' (Not available)'
                      : ' (Requires env variables)'}
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* To Address Input */}
          <div className="space-y-4">
            <label className="text-white text-sm font-medium">To Address</label>
            <div className="flex gap-2 mb-3 mt-2">
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

          {/* Amount Input */}
          <div className="space-y-4">
            <label className="text-white text-sm font-medium">Amount (USDC)</label>
            <div className="flex gap-2 mb-3 mt-2">
              {Object.entries(AMOUNT_SHORTCUTS).map(([label, value]) => (
                <PillButton key={value} onClick={() => setAmount(value)}>
                  {label}
                </PillButton>
              ))}
            </div>
            <Input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>

          {/* Send Button */}
          <Button onClick={handleSend} disabled={isDisabled || isWritePending || isConfirming} fullWidth>
            {buttonText}
          </Button>

          {/* Transaction Status */}
          <div className="min-h-[1.5rem] text-center">
            {getTransactionHash && targetChainId && (
              <div className="flex flex-col items-center space-y-1">
                <a
                  href={`${CHAIN_TO_EXPLORER[targetChainId]}/tx/${getTransactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm font-mono underline"
                  data-testid="send-usdc-tx-explorer-link"
                >
                  View on {CHAIN_NAMES[targetChainId]} Explorer
                </a>
                <span
                  className={`text-xs ${getTransactionStatus === 'CONFIRMED' ? 'text-green-400' : 'text-yellow-400'}`}
                >
                  Status: {getTransactionStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </FeatureLayout>
  );
}
