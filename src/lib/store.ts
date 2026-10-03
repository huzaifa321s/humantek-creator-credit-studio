import { ProjectRecord, CreditLedgerEntry } from '@/types';

// In-memory persistent cache for demo / offline fallback
const globalStore = globalThis as unknown as {
  __HUMANTEK_PROJECTS__?: ProjectRecord[];
  __HUMANTEK_LEDGER__?: CreditLedgerEntry[];
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
        { id: 'animated-emote', name: 'Animated Emotes Package', level: 0, quantity: 1, credits: 48 },
        { id: 'overlays', name: 'Overlays 3×', level: 0, quantity: 1, credits: 40 },
        { id: 'banner', name: 'Banner', level: 1, quantity: 1, credits: 72 },
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

export function getProjects(): ProjectRecord[] {
  return globalStore.__HUMANTEK_PROJECTS__ || [];
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
