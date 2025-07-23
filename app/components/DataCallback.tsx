'use client';

import { useState, useCallback, useEffect } from 'react';
import { useHydration } from '../hooks/useHydration';
import { useAccount, useWalletClient } from 'wagmi';
import { numberToHex, encodeFunctionData } from 'viem';
import { Button } from './ui/Button';
import { ConnectWalletPrompt } from './ui/ConnectWalletPrompt';
import { FeatureLayout } from './ui/FeatureLayout';
import { Switch } from './ui/Switch';
import { useWallet } from '../context/WagmiContextProvider';

// TypeScript types following the documentation exactly
type DataCallbackType = 'email' | 'phoneNumber' | 'physicalAddress' | 'name' | 'onchainAddress';

type DataCallbackRequestType = {
  optional?: boolean;
  type: DataCallbackType;
};

type DataCallbackCapability = {
  requests: DataCallbackRequestType[];
  callbackURL?: string;
};

const TEST_CASES = [
  {
    id: 1,
    name: 'Test Case #1',
    data: { email: true, physicalAddress: false, onchainAddress: true, phoneNumber: false, name: true },
  },
  {
    id: 2,
    name: 'Test Case #2',
    data: { email: true, physicalAddress: true, onchainAddress: false, phoneNumber: true, name: false },
  },
  {
    id: 3,
    name: 'Test Case #3',
    data: { email: false, physicalAddress: true, onchainAddress: true, phoneNumber: true, name: true },
  },
  {
    id: 4,
    name: 'Test Case #4',
    data: { email: true, physicalAddress: true, onchainAddress: true, phoneNumber: true, name: true },
  },
  {
    id: 5,
    name: 'Test Case #5',
    data: { email: false, physicalAddress: false, onchainAddress: true, phoneNumber: false, name: false },
  },
  {
    id: 6,
    name: 'Test Case #6',
    data: { email: true, physicalAddress: false, onchainAddress: false, phoneNumber: true, name: true },
  },
  {
    id: 7,
    name: 'Test Case #7',
    data: { email: false, physicalAddress: true, onchainAddress: false, phoneNumber: false, name: true },
  },
];

type DataRequest = {
  email: boolean;
  physicalAddress: boolean;
  onchainAddress: boolean;
  phoneNumber: boolean;
  name: boolean;
};

type DataOptional = {
  email: boolean;
  physicalAddress: boolean;
  onchainAddress: boolean;
  phoneNumber: boolean;
  name: boolean;
};

export function DataCallback() {
  const { addLog } = useWallet();
  const { isConnected } = useAccount();
  const isHydrated = useHydration();
  // Display states to prevent hydration mismatch
  const displayIsConnected = isHydrated && isConnected;

  // Data request state
  const [dataRequests, setDataRequests] = useState<DataRequest>({
    email: true,
    physicalAddress: true,
    onchainAddress: false,
    phoneNumber: false,
    name: false,
  });

  const [dataOptional, setDataOptional] = useState<DataOptional>({
    email: true,
    physicalAddress: true,
    onchainAddress: false,
    phoneNumber: false,
    name: false,
  });

  const [callbackEnabled, setCallbackEnabled] = useState<boolean>(false);

  const { data: walletClient } = useWalletClient();
  const [isPending, setIsPending] = useState(false);
  const [callsId, setCallsId] = useState<string | null>(null);
  const [sendCallsError, setSendCallsError] = useState<Error | null>(null);

  const handleLoadTestCase = useCallback(
    (testCase: (typeof TEST_CASES)[0]) => {
      setDataRequests(testCase.data);
      addLog({
        type: 'message',
        data: `Loaded ${testCase.name} with data requests: ${Object.entries(testCase.data)
          .filter(([, value]) => value)
          .map(([key]) => key)
          .join(', ')}`,
      });
    },
    [addLog],
  );

  // Clear all selections
  const handleClearAll = useCallback(() => {
    setDataRequests({
      email: false,
      physicalAddress: false,
      onchainAddress: false,
      phoneNumber: false,
      name: false,
    });
    setDataOptional({
      email: false,
      physicalAddress: false,
      onchainAddress: false,
      phoneNumber: false,
      name: false,
    });
    addLog({
      type: 'message',
      data: 'Cleared all data requests',
    });
  }, [addLog]);

  const handleDataRequestToggle = useCallback((field: keyof DataRequest) => {
    setDataRequests((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }, []);

  const handleOptionalToggle = useCallback((field: keyof DataOptional) => {
    setDataOptional((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }, []);

  const handleSubmitTransaction = useCallback(async () => {
    if (!displayIsConnected || !walletClient) {
      addLog({
        type: 'error',
        data: 'Please connect your wallet first',
      });
      return;
    }

    const activeRequests = Object.entries(dataRequests)
      .filter(([, isActive]) => isActive)
      .map(([field]) => field);

    if (activeRequests.length === 0) {
      addLog({
        type: 'error',
        data: 'Please select at least one data request',
      });
      return;
    }

    setIsPending(true);
    setSendCallsError(null);

    try {
      // Build requests following the documentation format exactly
      const requests: DataCallbackRequestType[] = activeRequests.map((field) => ({
        type: field as DataCallbackType,
        optional: dataOptional[field as keyof DataOptional],
      }));

      const callbackURL = callbackEnabled
        ? `${process.env.NEXT_PUBLIC_CALLBACK_BASE_URL || window.location.origin}/api/data-callback`
        : undefined;

      addLog({
        type: 'message',
        data: `Submitting transaction with data callback requests: ${requests.map((r) => `${r.type}${r.optional ? ' (optional)' : ''}`).join(', ')}`,
      });

      if (callbackEnabled && callbackURL) {
        addLog({
          type: 'message',
          data: `Using callback URL: ${callbackURL}`,
        });
      }

      // Build dataCallback capability following docs format
      const dataCallbackCapability: DataCallbackCapability = {
        requests,
        ...(callbackEnabled && callbackURL && { callbackURL }),
      };

      // wallet_sendCalls params following docs format exactly
      const sendCallsParams = [
        {
          version: '1.0',
          chainId: numberToHex(84532), // Base Sepolia
          calls: [
            {
              to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC contract
              data: encodeFunctionData({
                abi: [
                  {
                    name: 'transfer',
                    type: 'function',
                    inputs: [
                      { name: 'to', type: 'address' },
                      { name: 'amount', type: 'uint256' },
                    ],
                    outputs: [{ name: '', type: 'bool' }],
                  },
                ],
                functionName: 'transfer',
                args: ['0xd8da6bf26964af9d7eed9e03e53415d37aa96045', BigInt('10000')], // 0.01 USDC
              }),
            },
          ],
          capabilities: {
            dataCallback: dataCallbackCapability,
          },
        },
      ];

      addLog({
        type: 'message',
        data: `Sending wallet_sendCalls with capabilities: ${JSON.stringify(dataCallbackCapability, null, 2)}`,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (walletClient as any)?.request({
        method: 'wallet_sendCalls',
        params: sendCallsParams,
      });

      setCallsId(JSON.stringify(response));
      addLog({
        type: 'message',
        data: `Transaction submitted successfully! Response: ${JSON.stringify(response, null, 2)}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setSendCallsError(error instanceof Error ? error : new Error(errorMessage));
      addLog({
        type: 'error',
        data: `Failed to submit data callback transaction: ${errorMessage}`,
      });
    } finally {
      setIsPending(false);
    }
  }, [displayIsConnected, walletClient, dataRequests, dataOptional, callbackEnabled, addLog]);

  // Log transaction results
  useEffect(() => {
    if (callsId) {
      addLog({
        type: 'message',
        data: `Data callback transaction initiated with response: ${callsId}`,
      });
    }
  }, [callsId, addLog]);

  useEffect(() => {
    if (sendCallsError) {
      addLog({
        type: 'error',
        data: `Data callback transaction failed: ${sendCallsError.message}`,
      });
    }
  }, [sendCallsError, addLog]);

  return (
    <FeatureLayout showCard={false}>
      {/* Connection Status */}
      {!displayIsConnected && <ConnectWalletPrompt />}

      {displayIsConnected && (
        <div className="space-y-8">
          {/* Load Test Case */}
          <div className="space-y-4">
            <h3 className="text-white text-lg font-semibold">Load Test Case</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TEST_CASES.map((testCase) => (
                <button
                  key={testCase.id}
                  onClick={() => handleLoadTestCase(testCase)}
                  className="border border-blue-400 text-blue-400 hover:bg-blue-500/20 rounded-2xl px-4 py-3 text-sm transition-colors"
                >
                  {testCase.name}
                </button>
              ))}
              <button
                onClick={handleClearAll}
                className="border border-gray-400 text-gray-400 hover:bg-gray-500/20 rounded-2xl px-4 py-3 text-sm transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Data Requests */}
          <div className="space-y-4">
            <h3 className="text-white text-lg font-semibold">Data Requests</h3>
            <p className="text-gray-400 text-sm">Select the data you&apos;d like to request from the user:</p>

            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={dataRequests.email}
                    onChange={() => handleDataRequestToggle('email')}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white font-medium">Email</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Optional</span>
                  <Switch checked={dataOptional.email} onChange={() => handleOptionalToggle('email')} />
                </div>
              </div>

              {/* Physical Address */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={dataRequests.physicalAddress}
                    onChange={() => handleDataRequestToggle('physicalAddress')}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white font-medium">Physical Address</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Optional</span>
                  <Switch
                    checked={dataOptional.physicalAddress}
                    onChange={() => handleOptionalToggle('physicalAddress')}
                  />
                </div>
              </div>

              {/* Onchain Address */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={dataRequests.onchainAddress}
                    onChange={() => handleDataRequestToggle('onchainAddress')}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white font-medium">Onchain Address</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Optional</span>
                  <Switch
                    checked={dataOptional.onchainAddress}
                    onChange={() => handleOptionalToggle('onchainAddress')}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={dataRequests.phoneNumber}
                    onChange={() => handleDataRequestToggle('phoneNumber')}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white font-medium">Phone Number</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Optional</span>
                  <Switch checked={dataOptional.phoneNumber} onChange={() => handleOptionalToggle('phoneNumber')} />
                </div>
              </div>

              {/* Name */}
              <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-2xl border border-gray-700">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={dataRequests.name}
                    onChange={() => handleDataRequestToggle('name')}
                    className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                  />
                  <span className="text-white font-medium">Name</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Optional</span>
                  <Switch checked={dataOptional.name} onChange={() => handleOptionalToggle('name')} />
                </div>
              </div>
            </div>
          </div>

          {/* Callback Configuration */}
          <div className="space-y-4">
            <h3 className="text-white text-lg font-semibold">Callback Configuration</h3>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={callbackEnabled}
                onChange={(e) => setCallbackEnabled(e.target.checked)}
                className="rounded bg-black border-gray-700 text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
              />
              <span className="text-white font-medium">Enable Callback</span>
            </div>
          </div>

          {/* Submit Button */}
          <Button onClick={handleSubmitTransaction} disabled={isPending} fullWidth>
            {isPending ? 'Submitting...' : 'Submit Transaction'}
          </Button>
        </div>
      )}
    </FeatureLayout>
  );
}
