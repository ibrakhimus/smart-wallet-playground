import { ComponentType } from 'react';

// Import all feature components
import { SendETH } from '../../app/components/SendETH';
import { SendUSDC } from '../../app/components/SendUSDC';
import { AppPaymaster } from '../../app/components/AppPaymaster';
import { ChainConfig } from '../../app/components/ChainConfig';
import { SDKConfig } from '../../app/components/SDKConfig';
import { EventLog } from '../../app/components/EventLog';

export interface Feature {
  id: string;
  title: string;
  route: string;
  icon: string;
  category: 'wallet' | 'config' | 'testing' | 'debugging';
  component: ComponentType;
  enabled?: boolean;
  priority?: number; // For ordering within categories
}

export const FEATURES: Feature[] = [
  // Wallet Operations
  {
    id: 'send-eth',
    title: 'Send ETH',
    route: '/wallet/send-eth',
    icon: '💰',
    category: 'wallet',
    component: SendETH,
    priority: 1,
  },
  {
    id: 'send-usdc',
    title: 'Send USDC',
    route: '/wallet/send-usdc',
    icon: '💵',
    category: 'wallet',
    component: SendUSDC,
    priority: 2,
  },
  {
    id: 'app-paymaster',
    title: 'Sponsored Transactions',
    route: '/wallet/paymaster',
    icon: '🎫',
    category: 'wallet',
    component: AppPaymaster,
    priority: 3,
  },

  // Configuration
  {
    id: 'chain-config',
    title: 'Chain Configuration',
    route: '/config/chains',
    icon: '⛓️',
    category: 'config',
    component: ChainConfig,
    priority: 1,
  },
  {
    id: 'sdk-config',
    title: 'SDK Configuration',
    route: '/config/sdk',
    icon: '⚙️',
    category: 'config',
    component: SDKConfig,
    priority: 2,
  },

  // Debugging Tools
  {
    id: 'event-log',
    title: 'Event Log',
    route: '/debug/events',
    icon: '📋',
    category: 'debugging',
    component: EventLog,
    priority: 1,
  },
];

// Helper functions for working with features
export const getFeatureById = (id: string): Feature | undefined => {
  return FEATURES.find((feature) => feature.id === id);
};

export const getFeatureByRoute = (route: string): Feature | undefined => {
  return FEATURES.find((feature) => feature.route === route);
};

export const getFeaturesByCategory = (category: Feature['category']): Feature[] => {
  return FEATURES.filter((feature) => feature.category === category && feature.enabled !== false).sort(
    (a, b) => (a.priority || 0) - (b.priority || 0),
  );
};

export const getAllEnabledFeatures = (): Feature[] => {
  return FEATURES.filter((feature) => feature.enabled !== false);
};

export const getNavigationStructure = () => {
  const categories = ['wallet', 'config', 'debugging'] as const;

  return categories.map((category) => ({
    category,
    displayName: category.charAt(0).toUpperCase() + category.slice(1),
    features: getFeaturesByCategory(category),
  }));
};

// Category metadata
export const CATEGORY_INFO = {
  wallet: {
    title: 'Wallet Operations',
    icon: '👛',
  },
  config: {
    title: 'Configuration',
    icon: '⚙️',
  },
  testing: {
    title: 'Testing Tools',
    icon: '🧪',
  },
  debugging: {
    title: 'Debugging',
    icon: '🐛',
  },
} as const;
