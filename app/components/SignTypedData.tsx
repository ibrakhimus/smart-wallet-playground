'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSignTypedData, useAccount, useChainId } from 'wagmi';
import { serialize } from '@wagmi/core';
import { useWallet } from '../context/WagmiContextProvider';
import { useHydration } from '../hooks/useHydration';
import { useConfig } from '../context/ConfigContext';
import { Switch } from './Switch';

const EIP712_TYPES = ['string', 'bytes', 'bytes32', 'uint256', 'uint8', 'int256', 'bool', 'address'] as const;

// Helper function to generate cryptographically secure random nonce
const generateRandomNonce = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return '0x' + Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

type EIP712Type = (typeof EIP712_TYPES)[number];

type TypeField = {
  name: string;
  type: EIP712Type | string;
};

type CustomType = {
  name: string;
  fields: TypeField[];
};

type DomainConfig = {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: `0x${string}`;
};

type MessageField = {
  key: string;
  value: string;
  type: EIP712Type | string;
};

// EIP-3009 and Spend Permissions shortcuts
const SHORTCUT_TEMPLATES = {
  'EIP-3009 TransferWithAuthorization': {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    messageFields: [
      { key: 'from', value: '0x0000000000000000000000000000000000000000', type: 'address' },
      { key: 'to', value: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', type: 'address' },
      { key: 'value', value: '1000000', type: 'uint256' },
      { key: 'validAfter', value: '0', type: 'uint256' },
      { key: 'validBefore', value: Math.floor(Date.now() / 1000) + 3600, type: 'uint256' }, // Valid for 1 hour
      {
        key: 'nonce',
        value: generateRandomNonce(),
        type: 'bytes32',
      },
    ],
  },
  'EIP-3009 ReceiveWithAuthorization': {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ReceiveWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'ReceiveWithAuthorization',
    messageFields: [
      { key: 'from', value: '0x0000000000000000000000000000000000000000', type: 'address' },
      { key: 'to', value: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', type: 'address' },
      { key: 'value', value: '1000000', type: 'uint256' },
      { key: 'validAfter', value: '0', type: 'uint256' },
      { key: 'validBefore', value: Math.floor(Date.now() / 1000) + 3600, type: 'uint256' }, // Valid for 1 hour
      {
        key: 'nonce',
        value: generateRandomNonce(),
        type: 'bytes32',
      },
    ],
  },

  'Spend Permissions': {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      SpendPermission: [
        { name: 'account', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'allowance', type: 'uint160' },
        { name: 'period', type: 'uint48' },
        { name: 'start', type: 'uint48' },
        { name: 'end', type: 'uint48' },
        { name: 'salt', type: 'uint256' },
        { name: 'extraData', type: 'bytes' },
      ],
    },
    primaryType: 'SpendPermission',
    messageFields: [
      { key: 'account', value: '0x0000000000000000000000000000000000000000', type: 'address' },
      { key: 'spender', value: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', type: 'address' },
      { key: 'token', value: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', type: 'address' }, // USDC
      { key: 'allowance', value: '1000000', type: 'uint160' },
      { key: 'period', value: '86400', type: 'uint48' }, // 1 day in seconds
      { key: 'start', value: Math.floor(Date.now() / 1000), type: 'uint48' },
      { key: 'end', value: Math.floor(Date.now() / 1000) + 86400 * 30, type: 'uint48' }, // 30 days from now
      { key: 'salt', value: Math.floor(Math.random() * 1000000), type: 'uint256' },
      { key: 'extraData', value: '0x', type: 'bytes' },
    ],
  },
};

export function SignTypedData() {
  const { addLog } = useWallet();
  const { isConnected, address: connectedAddress } = useAccount();
  const isHydrated = useHydration();
  const { signTypedData, data: signature, error, isPending } = useSignTypedData();
  const chainId = useChainId();
  const { appName } = useConfig();

  const displayIsConnected = isHydrated && isConnected;

  // State for custom types
  const [customTypes, setCustomTypes] = useState<CustomType[]>([
    {
      name: 'Person',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'wallet', type: 'address' },
      ],
    },
    {
      name: 'Mail',
      fields: [
        { name: 'from', type: 'Person' },
        { name: 'to', type: 'Person' },
        { name: 'contents', type: 'string' },
      ],
    },
  ]);

  const [domain, setDomain] = useState<DomainConfig>({
    name: appName,
    version: '2', // ERC-3009 example uses version "2" for USD Coin
    chainId: chainId,
    verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract address from ERC-3009 spec
  });

  // State for message construction
  const [primaryType, setPrimaryType] = useState('Mail');
  const [messageFields, setMessageFields] = useState<MessageField[]>([
    { key: 'from.name', value: 'Alice', type: 'string' },
    { key: 'from.wallet', value: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826', type: 'address' },
    { key: 'to.name', value: 'Bob', type: 'string' },
    { key: 'to.wallet', value: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', type: 'address' },
    { key: 'contents', value: 'Hello, Bob!', type: 'string' },
  ]);

  const [mode, setMode] = useState<'builder' | 'json'>('builder');
  const [jsonInput, setJsonInput] = useState('');
  const [showAsString, setShowAsString] = useState(false);
  const [showDomainConfig, setShowDomainConfig] = useState(false);

  // Sync domain with context changes (only if not using template-specific domain)
  useEffect(() => {
    setDomain((prev) => {
      // Don't override template-specific domains
      if (prev.name === 'USD Coin' || prev.name === 'Spend Permission Manager') {
        return {
          ...prev,
          chainId: chainId, // Still sync chainId
        };
      }

      // Sync with SDK for default/custom domains
      return {
        ...prev,
        name: appName,
        chainId: chainId,
      };
    });
  }, [appName, chainId]);

  // Convert custom types to EIP-712 format
  const eip712Types = useMemo(() => {
    const types: Record<string, Array<{ name: string; type: string }>> = {};
    customTypes.forEach((customType) => {
      types[customType.name] = customType.fields.map((field) => ({
        name: field.name,
        type: field.type,
      }));
    });
    return types;
  }, [customTypes]);

  // Convert message fields to nested object
  const messageObject = useMemo(() => {
    const message: Record<string, unknown> = {};
    messageFields.forEach((field) => {
      const keys = field.key.split('.');
      let current: Record<string, unknown> = message;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]] as Record<string, unknown>;
      }

      const finalKey = keys[keys.length - 1];

      current[finalKey] = field.value;
    });
    return message;
  }, [messageFields]);

  // Load shortcut template
  const loadShortcut = useCallback(
    (templateName: keyof typeof SHORTCUT_TEMPLATES) => {
      const template = SHORTCUT_TEMPLATES[templateName];

      // Convert types to CustomType format
      const newTypes: CustomType[] = Object.entries(template.types).map(([name, fields]) => ({
        name,
        fields: fields as TypeField[],
      }));

      // Smart defaults: auto-fill fields with connected address
      const messageFields = template.messageFields.map((field) => {
        if (templateName.startsWith('EIP-3009') && field.key === 'from' && connectedAddress) {
          return {
            ...field,
            value: connectedAddress,
          };
        }
        if (templateName === 'Spend Permissions' && field.key === 'account' && connectedAddress) {
          return {
            ...field,
            value: connectedAddress,
          };
        }
        return {
          ...field,
          value: String(field.value),
        };
      });

      // Set domain based on template type
      if (templateName === 'Spend Permissions') {
        setDomain({
          name: 'Spend Permission Manager',
          version: '1',
          chainId: chainId,
          verifyingContract: '0x0000000000000000000000000000000000000000', // Placeholder contract
        });
      } else if (templateName.startsWith('EIP-3009')) {
        setDomain({
          name: 'USD Coin',
          version: '2',
          chainId: chainId,
          verifyingContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract
        });
      }

      setCustomTypes(newTypes);
      setPrimaryType(template.primaryType);
      setMessageFields(messageFields);
    },
    [connectedAddress, chainId],
  );

  const addCustomType = useCallback(() => {
    setCustomTypes((prev) => [
      ...prev,
      {
        name: `CustomType${prev.length + 1}`,
        fields: [{ name: 'value', type: 'string' }],
      },
    ]);
  }, []);

  const removeCustomType = useCallback((index: number) => {
    setCustomTypes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addFieldToType = useCallback((typeIndex: number) => {
    setCustomTypes((prev) =>
      prev.map((type, i) =>
        i === typeIndex ? { ...type, fields: [...type.fields, { name: 'newField', type: 'string' }] } : type,
      ),
    );
  }, []);

  const removeFieldFromType = useCallback((typeIndex: number, fieldIndex: number) => {
    setCustomTypes((prev) =>
      prev.map((type, i) =>
        i === typeIndex ? { ...type, fields: type.fields.filter((_, j) => j !== fieldIndex) } : type,
      ),
    );
  }, []);

  const updateCustomType = useCallback((typeIndex: number, updates: Partial<CustomType>) => {
    setCustomTypes((prev) => prev.map((type, i) => (i === typeIndex ? { ...type, ...updates } : type)));
  }, []);

  const updateTypeField = useCallback((typeIndex: number, fieldIndex: number, updates: Partial<TypeField>) => {
    setCustomTypes((prev) =>
      prev.map((type, i) =>
        i === typeIndex
          ? {
              ...type,
              fields: type.fields.map((field, j) => (j === fieldIndex ? { ...field, ...updates } : field)),
            }
          : type,
      ),
    );
  }, []);

  const addMessageField = useCallback(() => {
    setMessageFields((prev) => [...prev, { key: 'newField', value: '', type: 'string' }]);
  }, []);

  const removeMessageField = useCallback((index: number) => {
    setMessageFields((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateMessageField = useCallback((index: number, updates: Partial<MessageField>) => {
    setMessageFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...updates } : field)));
  }, []);

  const handleBuilderSubmit = useCallback(() => {
    if (!displayIsConnected) {
      addLog({
        type: 'error',
        data: 'Wallet not connected',
      });
      return;
    }

    const typedData = {
      domain,
      types: eip712Types,
      primaryType,
      message: messageObject,
    };

    if (showAsString) {
      // Sign the JSON stringified version
      signTypedData({
        domain: { name: 'String Message' },
        types: {
          Message: [{ name: 'data', type: 'string' }],
        },
        primaryType: 'Message',
        message: { data: JSON.stringify(typedData) },
      });
    } else {
      // Sign the structured data
      signTypedData(typedData);
    }
  }, [signTypedData, domain, eip712Types, primaryType, messageObject, displayIsConnected, addLog, showAsString]);

  // Generate JSON preview
  const jsonPreview = useMemo(() => {
    const typedData = {
      domain,
      types: eip712Types,
      primaryType,
      message: messageObject,
    };

    if (showAsString) {
      return serialize(
        {
          domain: { name: 'String Message' },
          types: {
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'Message',
          message: { data: serialize(typedData) },
        },
        null,
        2,
      );
    }

    return serialize(typedData, null, 2);
  }, [domain, eip712Types, primaryType, messageObject, showAsString]);

  const handleJsonSubmit = useCallback(() => {
    if (!displayIsConnected) {
      addLog({
        type: 'error',
        data: 'Wallet not connected',
      });
      return;
    }

    try {
      // Use jsonInput if user has typed something, otherwise use the generated jsonPreview
      const jsonToUse = jsonInput || jsonPreview;
      const parsed = JSON.parse(jsonToUse);

      if (showAsString) {
        // Sign the JSON stringified version
        signTypedData({
          domain: { name: 'String Message' },
          types: {
            Message: [{ name: 'data', type: 'string' }],
          },
          primaryType: 'Message',
          message: { data: JSON.stringify(parsed) },
        });
      } else {
        signTypedData(parsed);
      }
    } catch (err) {
      addLog({
        type: 'error',
        data: `Invalid JSON: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }, [jsonInput, jsonPreview, signTypedData, displayIsConnected, addLog, showAsString]);

  useEffect(() => {
    if (signature) {
      addLog({
        type: 'message',
        data: `EIP-712 signature successful: ${signature}`,
      });
    }
  }, [signature, addLog]);

  useEffect(() => {
    if (error) {
      addLog({
        type: 'error',
        data: `EIP-712 signature failed: ${error.message}`,
      });
    }
  }, [error, addLog]);

  return (
    <div className="h-full text-white">
      <div className="max-w-none mx-auto space-y-8 h-full">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-white">Custom EIP-712 Signing</h2>
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('builder')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'builder' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'
              }`}
            >
              Form Builder
            </button>
            <button
              onClick={() => setMode('json')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'json' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-300 hover:text-white'
              }`}
            >
              JSON Editor
            </button>
          </div>
        </div>

        {!displayIsConnected && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
            <p className="text-yellow-200 text-sm">Connect your wallet to sign EIP-712 messages</p>
          </div>
        )}

        {/* Shortcuts */}
        <div className="p-2">
          <div className="flex gap-3 flex-wrap">
            {Object.keys(SHORTCUT_TEMPLATES).map((templateName) => (
              <button
                key={templateName}
                onClick={() => loadShortcut(templateName as keyof typeof SHORTCUT_TEMPLATES)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              >
                {templateName}
              </button>
            ))}
          </div>
        </div>

        {mode === 'builder' ? (
          <div className="space-y-8">
            {/* Domain Configuration - Collapsible */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg">
              <button
                onClick={() => setShowDomainConfig(!showDomainConfig)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-750 transition-colors"
              >
                <h3 className="text-lg font-semibold text-white">Domain Configuration</h3>
                <span className="text-gray-400">{showDomainConfig ? '−' : '+'}</span>
              </button>
              {showDomainConfig && (
                <div className="px-6 pb-6 border-t border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                      <input
                        type="text"
                        value={domain.name || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Version</label>
                      <input
                        type="text"
                        value={domain.version || ''}
                        onChange={(e) => setDomain((prev) => ({ ...prev, version: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Chain ID (synced with wallet)
                      </label>
                      <input
                        type="number"
                        value={domain.chainId || ''}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Verifying Contract</label>
                      <input
                        type="text"
                        value={domain.verifyingContract || ''}
                        onChange={(e) =>
                          setDomain((prev) => ({ ...prev, verifyingContract: e.target.value as `0x${string}` }))
                        }
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                        placeholder="0x..."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Types Configuration */}
              <div className="space-y-6">
                {/* Custom Types */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Custom Types</h3>
                    <button onClick={addCustomType} className="px-3 py-1 bg-green-600 text-white text-sm rounded-md">
                      Add Type
                    </button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {customTypes.map((customType, typeIndex) => (
                      <div key={typeIndex} className="bg-gray-700 rounded-md p-4 border border-gray-600">
                        <div className="flex items-center justify-between mb-3">
                          <input
                            type="text"
                            value={customType.name}
                            onChange={(e) => updateCustomType(typeIndex, { name: e.target.value })}
                            className="font-medium text-sm border border-gray-600 bg-gray-800 text-white rounded px-2 py-1 focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => addFieldToType(typeIndex)}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded border border-green-500"
                            >
                              Add Field
                            </button>
                            <button
                              onClick={() => removeCustomType(typeIndex)}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 border border-red-500"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {customType.fields.map((field, fieldIndex) => (
                            <div key={fieldIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={field.name}
                                onChange={(e) => updateTypeField(typeIndex, fieldIndex, { name: e.target.value })}
                                placeholder="Field name"
                                className="flex-1 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-white focus:outline-none"
                              />
                              <select
                                value={field.type}
                                onChange={(e) => updateTypeField(typeIndex, fieldIndex, { type: e.target.value })}
                                className="px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-white focus:outline-none"
                              >
                                {EIP712_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                                {customTypes.map((ct) => (
                                  <option key={ct.name} value={ct.name}>
                                    {ct.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeFieldFromType(typeIndex, fieldIndex)}
                                className="text-red-400 hover:text-red-300 text-sm border border-red-500 rounded px-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/*Message Construction */}
              <div className="space-y-6">
                {/* Primary Type */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Primary Type</h3>
                  <select
                    value={primaryType}
                    onChange={(e) => setPrimaryType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none"
                  >
                    {customTypes.map((type) => (
                      <option key={type.name} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message Fields */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Message Data</h3>
                    <button
                      onClick={addMessageField}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-md border border-green-500"
                    >
                      Add Field
                    </button>
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-6">
                    {messageFields.map((field, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <input
                          type="text"
                          value={field.key}
                          onChange={(e) => updateMessageField(index, { key: e.target.value })}
                          placeholder="Field path (e.g., from.name)"
                          className="flex-1 px-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none"
                        />
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateMessageField(index, { value: e.target.value })}
                          placeholder="Value"
                          className="flex-1 px-3 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => updateMessageField(index, { type: e.target.value })}
                          className="px-2 py-2 text-sm border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none"
                        >
                          {EIP712_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                          {customTypes.map((ct) => (
                            <option key={ct.name} value={ct.name}>
                              {ct.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMessageField(index)}
                          className="text-red-400 hover:text-red-300 border border-red-500 rounded px-1 flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Signing Option */}
            <div className="rounded-lg p-6">
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex items-center justify-center">
                  <Switch
                    checked={showAsString}
                    onChange={setShowAsString}
                    leftLabel="Structured Data"
                    rightLabel="JSON String"
                  />
                </div>

                <button
                  onClick={handleBuilderSubmit}
                  disabled={isPending || !displayIsConnected}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isPending ? 'Signing...' : !displayIsConnected ? 'Connect Wallet' : 'Sign Typed Data'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg p-6">
              <textarea
                value={jsonInput || jsonPreview}
                onChange={(e) => setJsonInput(e.target.value)}
                className="w-full h-96 px-4 py-3 border border-gray-600 rounded-md font-mono text-sm bg-gray-900 text-green-400 resize-none focus:outline-none"
                placeholder="Paste your EIP-712 JSON configuration here..."
              />
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-center">
                  <Switch
                    checked={showAsString}
                    onChange={setShowAsString}
                    leftLabel="Structured Data"
                    rightLabel="JSON String"
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleJsonSubmit}
                    disabled={isPending || !displayIsConnected}
                    className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isPending ? 'Signing...' : !displayIsConnected ? 'Connect Wallet' : 'Sign JSON Data'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {signature && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">Signature Generated</h3>
            <p className="text-sm text-green-700 font-mono break-all">{signature}</p>
          </div>
        )}
      </div>
    </div>
  );
}
