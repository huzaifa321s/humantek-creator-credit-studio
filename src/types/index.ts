export type ServiceCategory =
  | 'Branding'
  | 'Stream'
  | 'Animation'
  | 'VTuber'
  | 'Artwork'
  | 'Content'
  | '3D'
  | 'Custom';

export type ServiceTierLevel = 0 | 1 | 2; // 0 = Basic, 1 = Standard, 2 = Elite

export interface PackageDefinition {
  id: string;
  name: string;
  price: number;
  credits: number;
  group: string;
  bestFor: string;
  maxLevel: number; // 1 = Basic/Standard, 2 = Elite
  standardLimit?: number;
  eliteLimit?: number;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  prices: [number, number, number]; // [Basic, Standard, Elite] credit prices
  scopeDetails?: [string, string, string];
  quoteOnly?: boolean;
  bestFor?: string;
  deliverables?: string[];
  exampleImage?: string;
}

export interface ServiceSelection {
  level: ServiceTierLevel;
  quantity: number;
}

export interface SelectedServiceEntry {
  service: ServiceDefinition;
  choice: ServiceSelection;
  credits: number;
}

export interface ProjectBrief {
  clientName: string;
  channelName: string;
  email: string;
  platform: string;
  style: string;
  colors: string;
  instructions: string;
}

export interface UploadedFile {
  id: string;
  filename: string;
  size: number;
  url: string;
}

export interface ProjectRecord {
  id: string;
  projectCode: string;
  packageId: string;
  packageName: string;
  packagePrice: number;
  packageCredits: number;
  usedCredits: number;
  remainingCredits: number;
  status: 'pending_review' | 'payment_confirmed' | 'in_production' | 'review_round' | 'delivered' | 'declined' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  paymentMethod?: 'credits' | 'paypal' | 'unpaid' | 'manual' | string;
  fundingSource?: 'wallet' | 'package' | 'hybrid';
  appliedWalletCredits?: number;
  clientName: string;
  channelName: string;
  email: string;
  platform: string;
  style: string;
  colors: string;
  instructions: string;
  redeemCode?: string;
  additions: string[];
  selections: {
    id: string;
    name: string;
    level: ServiceTierLevel;
    quantity: number;
    credits: number;
  }[];
  uploadedFiles: UploadedFile[];
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  createdAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  userId?: string;
  userEmail: string;
  type: 'package_purchase' | 'service_deduction' | 'manual_topup' | 'redeem_code' | 'promo_credit';
  creditsDelta: number;
  usdAmount: number;
  referenceId: string;
  description: string;
  createdAt: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  url: string;
  size?: string;
  type: 'image' | 'file';
  previewUrl?: string;
}

export interface ChatOrderCard {
  projectCode: string;
  packageName: string;
  credits: number;
  status: string;
  price: number;
}

export interface ChatReaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}

export interface ChatAudioNote {
  duration: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  clientMessageId?: string;
  projectId: string;
  sender: 'client' | 'agent' | 'system';
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  orderCard?: ChatOrderCard;
  isRead?: boolean;
  reactions?: ChatReaction[];
  audioNote?: ChatAudioNote;
  status?: 'sending' | 'sent' | 'failed';
  errorReason?: string;
}

