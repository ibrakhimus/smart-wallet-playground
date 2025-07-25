import { ComponentType } from 'react';
import {
  Wallet,
  DollarSign,
  PenTool,
  Ticket,
  Settings,
  ClipboardList,
  WalletCards,
  Cog,
  Bug,
  TestTube,
  FileCode,
  Database,
} from 'lucide-react';

// Import all feature components
import { SendETH } from '../../app/components/SendETH';
import { SendUSDC } from '../../app/components/SendUSDC';
import { AppPaymaster } from '../../app/components/AppPaymaster';
import { SDKConfig } from '../../app/components/SDKConfig';
import { EventLog } from '../../app/components/EventLog';
import { PersonalSign } from '../../app/components/PersonalSign';
import { SignTypedData } from '../../app/components/SignTypedData';
import { DataCallback } from '../../app/components/DataCallback';

export type Feature = {
  id: string;
  title: string;
  route: string;
  icon: ComponentType<{ className?: string }>;
  category: 'wallet' | 'config' | 'testing' | 'debugging';
  component: ComponentType;
  enabled?: boolean;
  priority?: number; // For ordering within categories
};

export const FEATURES: Feature[] = [
  // Wallet Operations
  {
    id: 'send-eth',
    title: 'Send ETH',
    route: '/wallet/send-eth',
    icon: Wallet,
    category: 'wallet',
    component: SendETH,
    priority: 1,
  },
  {
    id: 'send-usdc',
    title: 'Send USDC',
    route: '/wallet/send-usdc',
    icon: DollarSign,
    category: 'wallet',
    component: SendUSDC,
    priority: 2,
  },
  {
    id: 'personal-sign',
    title: 'Personal Sign',
    route: '/wallet/personal-sign',
    icon: PenTool,
    category: 'wallet',
    component: PersonalSign,
    priority: 3,
  },
  {
    id: 'sign-typed-data',
    title: 'Sign Typed Data',
    route: '/wallet/sign-typed-data',
    icon: FileCode,
    category: 'wallet',
    component: SignTypedData,
    priority: 4,
  },
  {
    id: 'app-paymaster',
    title: 'App Paymaster',
    route: '/wallet/paymaster',
    icon: Ticket,
    category: 'wallet',
    component: AppPaymaster,
    priority: 5,
  },
  {
    id: 'data-callback',
    title: 'Data Callback',
    route: '/wallet/data-callback',
    icon: Database,
    category: 'wallet',
    component: DataCallback,
    priority: 6,
  },

  // Configuration
  {
    id: 'sdk-config',
    title: 'SDK Configuration',
    route: '/config/sdk',
    icon: Settings,
    category: 'config',
    component: SDKConfig,
    priority: 1,
  },

  // Debugging Tools
  {
    id: 'event-log',
    title: 'Event Log',
    route: '/debug/events',
    icon: ClipboardList,
    category: 'debugging',
    component: EventLog,
    priority: 1,
  },
];

export const getFeatureByRoute = (route: string): Feature | undefined => {
  return FEATURES.find((feature) => feature.route === route);
};

export const getNavigationStructure = () => {
  const categories = ['config', 'wallet', 'debugging'] as const;

  return categories.map((category) => ({
    category,
    displayName: category.charAt(0).toUpperCase() + category.slice(1),
    features: FEATURES.filter((feature) => feature.category === category && feature.enabled !== false).sort(
      (a, b) => (a.priority || 0) - (b.priority || 0),
    ),
  }));
};

// Category metadata
export const CATEGORY_INFO = {
  wallet: {
    title: 'Wallet Operations',
    icon: WalletCards,
  },
  config: {
    title: 'Configuration',
    icon: Cog,
  },
  testing: {
    title: 'Testing Tools',
    icon: TestTube,
  },
  debugging: {
    title: 'Debugging',
    icon: Bug,
  },
} as const;
