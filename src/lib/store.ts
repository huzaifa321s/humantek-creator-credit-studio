import { ProjectRecord, CreditLedgerEntry, ChatMessage } from '@/types';
import type { OrderQuote } from '@/lib/pricing';
import type { OrderRequest } from '@/lib/validation';

/** An order created server-side, awaiting PayPal capture. */
export interface PendingOrder {
  orderId: string;
  request: OrderRequest;
  quote: OrderQuote;
  createdAt: number;
  /** Set once captured — makes capture idempotent. */
  projectId?: string;
}

// In-memory persistent cache for demo / offline fallback
const globalStore = globalThis as unknown as {
  __HUMANTEK_PROJECTS__?: ProjectRecord[];
  __HUMANTEK_LEDGER__?: CreditLedgerEntry[];
  __HUMANTEK_PENDING_ORDERS__?: Map<string, PendingOrder>;
  __HUMANTEK_PROJECT_MESSAGES__?: Map<string, ChatMessage[]>;
  __HUMANTEK_USER_BALANCES__?: Map<string, number>;
};

if (!globalStore.__HUMANTEK_PROJECTS__) {
  globalStore.__HUMANTEK_PROJECTS__ = [
    {
      id: 'proj-demo-1',
      projectCode: 'HT-9428-FORGE',
      packageId: 'creator-forge',
      packageName: 'Creator Forge',
      packagePrice: 1500,
      packageCredits: 660,
      usedCredits: 580,
      remainingCredits: 80,
      status: 'in_production',
      paymentStatus: 'paid',
      clientName: 'Kira Streams',
      channelName: 'KiraOfficial',
      email: 'kira@example.com',
      platform: 'Twitch',
      style: 'Cyberpunk Chibi Anime',
      colors: '#ff007f, #00f0ff, #111',
      instructions: 'Looking for a cyberpunk neon text logo, 3 custom animated emotes (hype, cry, gg), and 3 channel overlays.',
      additions: ['Extra revision round'],
      selections: [
        { id: 'logo', name: 'Logo', level: 1, quantity: 1, credits: 88 },
        { id: 'illustration', name: 'Character Illustration Package', level: 1, quantity: 1, credits: 200 },
        { id: 'static-screen', name: 'Stream Screen Package', level: 1, quantity: 1, credits: 88 },
        { id: 'banner', name: 'Banner', level: 1, quantity: 1, credits: 72 },
        { id: 'animated-emote', name: 'Animated Emotes Package', level: 0, quantity: 1, credits: 48 },
        { id: 'alert', name: 'Custom Sound & Alert FX', level: 0, quantity: 1, credits: 44 },
        { id: 'overlays', name: 'Overlays 3×', level: 0, quantity: 1, credits: 40 },
      ],
      uploadedFiles: [
        { id: 'u1', filename: 'cyberpunk-moodboard.png', size: 1420500, url: '#' },
      ],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
}

if (!globalStore.__HUMANTEK_LEDGER__) {
  globalStore.__HUMANTEK_LEDGER__ = [
    {
      id: 'led-1',
      userEmail: 'kira@example.com',
      type: 'package_purchase',
      creditsDelta: 660,
      usdAmount: 1500,
      referenceId: 'HT-9428-FORGE',
      description: 'Purchased Creator Forge Package',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'led-2',
      userEmail: 'kira@example.com',
      type: 'service_deduction',
      creditsDelta: -580,
      usdAmount: 0,
      referenceId: 'HT-9428-FORGE',
      description: 'Allocated credits for KiraOfficial launch assets',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];
}

if (!globalStore.__HUMANTEK_PROJECT_MESSAGES__) {
  const demoMessages: ChatMessage[] = [
    {
      id: 'msg-proj-demo-1',
      projectId: 'proj-demo-1',
      sender: 'system',
      senderName: 'Humantek Studio System',
      content: 'Project HT-9428-FORGE Workspace Initialized · Assigned to Sarah Miller (Lead Producer)',
      timestamp: 'Yesterday at 10:14 AM',
      isRead: true,
    },
    {
      id: 'msg-proj-demo-2',
      projectId: 'proj-demo-1',
      sender: 'agent',
      senderName: 'Sarah Miller',
      senderRole: 'Senior Creative Producer',
      content:
        "Hi Kira! Welcome to your project workspace for Creator Forge (HT-9428-FORGE). I've reviewed your brief for the cyberpunk neon theme and custom animated emotes. Our production queue is active and Milestone 1 is in progress!",
      timestamp: 'Yesterday at 10:15 AM',
      isRead: true,
    },
    {
      id: 'msg-proj-demo-3',
      projectId: 'proj-demo-1',
      sender: 'client',
      senderName: 'Kira Streams',
      content:
        "Thanks Sarah! Here is the moodboard reference for the magenta/cyan neon lighting we want for the stream overlays.",
      timestamp: 'Yesterday at 10:18 AM',
      attachments: [
        {
          id: 'ref-1',
          name: 'cyberpunk-neon-moodboard.png',
          url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
          size: '2.4 MB',
          type: 'image',
          previewUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
        },
      ],
      isRead: true,
    },
    {
      id: 'msg-proj-demo-4',
      projectId: 'proj-demo-1',
      sender: 'agent',
      senderName: 'Sarah Miller',
      senderRole: 'Senior Creative Producer',
      content:
        "This neon palette is locked in! We are on track for the concept preview. Let me know if you need any adjustments to the twitch badges as well.",
      timestamp: 'Today at 09:30 AM',
      orderCard: {
        projectCode: 'HT-9428-FORGE',
        packageName: 'Creator Forge',
        credits: 660,
        status: 'In Production',
        price: 1500,
      },
      isRead: true,
    },
  ];

  const map = new Map<string, ChatMessage[]>();
  map.set('proj-demo-1', demoMessages);
  map.set('HT-9428-FORGE', demoMessages);
  globalStore.__HUMANTEK_PROJECT_MESSAGES__ = map;
}

export function getProjects(): ProjectRecord[] {
  const list = globalStore.__HUMANTEK_PROJECTS__ || [];
  const demo = list.find((p) => p.id === 'proj-demo-1');
  if (demo && demo.selections.length <= 4) {
    demo.selections = [
      { id: 'logo', name: 'Logo', level: 1, quantity: 1, credits: 88 },
      { id: 'illustration', name: 'Character Illustration Package', level: 1, quantity: 1, credits: 200 },
      { id: 'static-screen', name: 'Stream Screen Package', level: 1, quantity: 1, credits: 88 },
      { id: 'banner', name: 'Banner', level: 1, quantity: 1, credits: 72 },
      { id: 'animated-emote', name: 'Animated Emotes Package', level: 0, quantity: 1, credits: 48 },
      { id: 'alert', name: 'Custom Sound & Alert FX', level: 0, quantity: 1, credits: 44 },
      { id: 'overlays', name: 'Overlays 3×', level: 0, quantity: 1, credits: 40 },
    ];
    demo.usedCredits = 580;
    demo.remainingCredits = 80;
  }
  return list;
}

export function addProject(project: ProjectRecord) {
  if (!globalStore.__HUMANTEK_PROJECTS__) {
    globalStore.__HUMANTEK_PROJECTS__ = [];
  }
  globalStore.__HUMANTEK_PROJECTS__.unshift(project);
}

export function updateProjectStatus(
  id: string,
  status: ProjectRecord['status'],
  paymentStatus?: ProjectRecord['paymentStatus']
) {
  const list = globalStore.__HUMANTEK_PROJECTS__ || [];
  const found = list.find((p) => p.id === id || p.projectCode === id);
  if (found) {
    found.status = status;
    if (paymentStatus) {
      found.paymentStatus = paymentStatus;
    }
    return found;
  }
  return null;
}

export function getLedger(): CreditLedgerEntry[] {
  return globalStore.__HUMANTEK_LEDGER__ || [];
}

export function addLedgerEntry(entry: CreditLedgerEntry) {
  if (!globalStore.__HUMANTEK_LEDGER__) {
    globalStore.__HUMANTEK_LEDGER__ = [];
  }
  globalStore.__HUMANTEK_LEDGER__.unshift(entry);
}

// ─── Pending PayPal orders ───────────────────────────────────────────────
const PENDING_TTL_MS = 1000 * 60 * 60 * 3; // 3h — PayPal approvals expire well before this

function pendingMap(): Map<string, PendingOrder> {
  if (!globalStore.__HUMANTEK_PENDING_ORDERS__) {
    globalStore.__HUMANTEK_PENDING_ORDERS__ = new Map();
  }
  return globalStore.__HUMANTEK_PENDING_ORDERS__;
}

export function addPendingOrder(order: PendingOrder) {
  const map = pendingMap();
  const now = Date.now();
  // Opportunistic cleanup of stale, uncaptured orders.
  for (const [id, o] of map) {
    if (!o.projectId && now - o.createdAt > PENDING_TTL_MS) map.delete(id);
  }
  map.set(order.orderId, order);
}

export function getPendingOrder(orderId: string): PendingOrder | undefined {
  return pendingMap().get(orderId);
}

export function markOrderCaptured(orderId: string, projectId: string) {
  const order = pendingMap().get(orderId);
  if (order) order.projectId = projectId;
}

export function getProjectById(id: string): ProjectRecord | undefined {
  return getProjects().find((p) => p.id === id || p.projectCode === id);
}

export function getProjectMessages(projectIdOrCode: string): ChatMessage[] {
  if (!globalStore.__HUMANTEK_PROJECT_MESSAGES__) {
    globalStore.__HUMANTEK_PROJECT_MESSAGES__ = new Map();
  }
  const map = globalStore.__HUMANTEK_PROJECT_MESSAGES__;
  return map.get(projectIdOrCode) || [];
}

export function addProjectMessage(projectIdOrCode: string, message: ChatMessage): ChatMessage {
  if (!globalStore.__HUMANTEK_PROJECT_MESSAGES__) {
    globalStore.__HUMANTEK_PROJECT_MESSAGES__ = new Map();
  }
  const map = globalStore.__HUMANTEK_PROJECT_MESSAGES__;
  const project = getProjectById(projectIdOrCode);
  const ids = new Set([projectIdOrCode]);
  if (project) {
    ids.add(project.id);
    ids.add(project.projectCode);
  }

  const existing = map.get(projectIdOrCode) || [];
  const updated = [...existing, message];

  for (const id of ids) {
    map.set(id, updated);
  }
  return message;
}

export function markProjectMessagesRead(projectIdOrCode: string): void {
  if (!globalStore.__HUMANTEK_PROJECT_MESSAGES__) return;
  const map = globalStore.__HUMANTEK_PROJECT_MESSAGES__;
  const project = getProjectById(projectIdOrCode);
  const ids = new Set([projectIdOrCode]);
  if (project) {
    ids.add(project.id);
    ids.add(project.projectCode);
  }

  for (const id of ids) {
    const list = map.get(id);
    if (list) {
      map.set(
        id,
        list.map((m) => ({ ...m, isRead: true }))
      );
    }
  }
}

// ─── Global Studio Credit System Balance Resolver ─────────────────────────
const INITIAL_DEMO_STARTER_CREDITS = 80;

export function ensureUserStarterLedger(email: string): void {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) return;

  const ledger = getLedger().filter((e) => (e.userEmail || '').toLowerCase().trim() === normEmail);
  if (ledger.length === 0) {
    addLedgerEntry({
      id: `led-starter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      userEmail: normEmail,
      type: 'promo_credit',
      creditsDelta: INITIAL_DEMO_STARTER_CREDITS,
      usdAmount: 0,
      referenceId: 'WELCOME-STUDIO',
      description: 'Studio Starter Credit Grant',
      createdAt: new Date().toISOString(),
    });
  }
}

export function getUserBalance(email: string): number {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) return 0;

  // Guarantee any active client/creator email has initial starter credits in the ledger
  ensureUserStarterLedger(normEmail);

  const ledger = getLedger().filter((e) => (e.userEmail || '').toLowerCase().trim() === normEmail);
  const net = ledger.reduce((sum, e) => sum + e.creditsDelta, 0);
  return Math.max(0, net);
}

export function adjustUserBalance(email: string, delta: number, description?: string): number {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail || delta === 0) return getUserBalance(normEmail);

  addLedgerEntry({
    id: `led-${crypto.randomUUID()}`,
    userEmail: normEmail,
    type: delta > 0 ? 'promo_credit' : 'service_deduction',
    creditsDelta: delta,
    usdAmount: 0,
    referenceId: `ADJ-${Date.now().toString(36).toUpperCase()}`,
    description: description || (delta > 0 ? `Credit deposit (+${delta} CR)` : `Credit deduction (${delta} CR)`),
    createdAt: new Date().toISOString(),
  });

  return getUserBalance(normEmail);
}

export function setUserBalance(email: string, targetBalance: number, description?: string): void {
  const normEmail = (email || '').toLowerCase().trim();
  if (!normEmail) return;
  const current = getUserBalance(normEmail);
  const delta = targetBalance - current;
  if (delta !== 0) {
    adjustUserBalance(normEmail, delta, description || `Balance set to ${targetBalance} CR`);
  }
}

export { recordPaidProject, recordWalletFundedProject } from '@/lib/orders';

