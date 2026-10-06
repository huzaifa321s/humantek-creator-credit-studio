import { PackageDefinition, ServiceDefinition } from '@/types';

export const PACKAGES: PackageDefinition[] = [
  {
    id: 'creator-forge',
    name: 'Creator Forge',
    price: 1500,
    credits: 660,
    group: 'Foundation',
    bestFor: 'Basic services plus up to two Standard service units',
    maxLevel: 1,
    standardLimit: 2,
    eliteLimit: 0,
  },
  {
    id: 'studio-momentum',
    name: 'Studio Momentum',
    price: 2500,
    credits: 1160,
    group: 'Most Popular',
    bestFor: 'Basic and Standard services plus up to two Elite service units',
    maxLevel: 2,
    eliteLimit: 2,
  },
  {
    id: 'signature-collective',
    name: 'Signature Collective',
    price: 4000,
    credits: 1920,
    group: 'Full Access',
    bestFor: 'Full tier access controlled by the available credit balance',
    maxLevel: 2,
  },
];

export const TOP_UP_OPTIONS = {
  'topup-100': {
    usd: 100,
    credits: 40,
    label: '$100 top-up — 40 CR',
  },
};

export const TIER_NAMES = ['Basic', 'Standard', 'Elite'] as const;

export const DEFAULT_SCOPE_DETAILS = [
  'Starting scope · focused deliverables · final web-ready files',
  '2 concepts · 2 revisions · source file + platform sizes',
  '3 concepts · 3 revisions · premium detail + source files + priority review',
];

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'logo',
    name: 'Logo',
    category: 'Branding',
    description: 'Text, mascot or premium VTuber logo package.',
    prices: [32, 88, 180],
    scopeDetails: [
      'Text logo · 2 concepts · PNG file',
      'Mascot or text logo · 4 concepts · high-resolution and transparent PNG',
      'Premium VTuber logo · custom mascot · source files and commercial use',
    ],
  },
  {
    id: 'animated-logo',
    name: 'Animated Logo',
    category: 'Branding',
    description: 'A motion-ready version of your identity.',
    prices: [52, 84, 136],
  },
  {
    id: 'banner',
    name: 'Banner',
    category: 'Branding',
    description: 'A platform-ready branded channel header.',
    prices: [28, 72, 140],
    scopeDetails: [
      'Simple banner · one Twitch or YouTube size · basic design',
      'Custom social banner · matching theme · HD custom artwork',
      'Premium banner pack · advanced artwork · source files and commercial use',
    ],
  },
  {
    id: 'animated-banner',
    name: 'Animated Banner',
    category: 'Branding',
    description: 'A motion banner for supported platforms.',
    prices: [80, 136, 180],
  },
  {
    id: 'emote',
    name: 'Emotes Package',
    category: 'Stream',
    description: 'A coordinated custom emote bundle.',
    prices: [24, 64, 128],
    scopeDetails: [
      '3 custom emotes · chibi/anime style · stream-ready PNG',
      '7 custom emotes + 1 extra · multiple expressions · HD export',
      '15 custom emotes + 3 extras · premium anime style · commercial use',
    ],
  },
  {
    id: 'animated-emote',
    name: 'Animated Emotes Package',
    category: 'Stream',
    description: 'A coordinated animated emote bundle.',
    prices: [48, 128, 256],
    scopeDetails: [
      '3 custom animated emotes · chibi/anime style · stream-ready',
      '7 custom animated emotes + 1 extra · multiple expressions · HD export',
      '15 custom animated emotes + 3 extras · premium style · commercial use',
    ],
  },
  {
    id: 'alert',
    name: 'Alert',
    category: 'Stream',
    description: 'One static stream alert asset.',
    prices: [16, 24, 32],
  },
  {
    id: 'animated-alert',
    name: 'Animated Alert',
    category: 'Stream',
    description: 'One animated stream alert asset.',
    prices: [20, 32, 48],
  },
  {
    id: 'overlays',
    name: 'Overlays 3×',
    category: 'Stream',
    description: 'Face, chat and gameplay overlays.',
    prices: [40, 84, 120],
  },
  {
    id: 'animated-overlays',
    name: 'Animated Overlays 3×',
    category: 'Stream',
    description: 'Three coordinated animated overlays.',
    prices: [80, 136, 192],
  },
  {
    id: 'static-screen',
    name: 'Static Stream Screen',
    category: 'Stream',
    description: 'Starting, BRB or ending screen.',
    prices: [40, 76, 100],
  },
  {
    id: 'animated-screen',
    name: '2D Animation Package',
    category: 'Animation',
    description: 'A scoped 2D or Live2D-ready animation package.',
    prices: [72, 220, 440],
    scopeDetails: [
      'Simple 2D animation · idle/talking motion · simple expressions',
      'Live2D-ready animation · idle, talking and emotes · smooth loop',
      'Advanced Live2D animation · professional motion effects · full expression set',
    ],
  },
  {
    id: '3d-screen',
    name: '3D Animation Package',
    category: 'Animation',
    description: 'A scoped 3D character animation package.',
    prices: [100, 280, 600],
    scopeDetails: [
      'Simple 3D character animation · facial expressions · short HD loop',
      'Advanced 3D character animation · gestures, emotes and background effects',
      'Cinematic 3D animation · advanced tracking style · custom scenes and priority delivery',
    ],
  },
  {
    id: 'sub-badge',
    name: 'Sub Badges Package',
    category: 'Stream',
    description: 'A coordinated subscriber badge set.',
    prices: [20, 48, 100],
    scopeDetails: [
      '3 custom badge designs · matching style · PNG',
      '7 tier badges + 1 extra · matching style · HD PNG',
      '15 premium tier badges + 3 extras · commercial use',
    ],
  },
  {
    id: 'panel',
    name: 'Panels Package',
    category: 'Stream',
    description: 'A coordinated channel panel set.',
    prices: [24, 60, 120],
    scopeDetails: [
      '3 stream panels · simple theme · HD quality',
      '7 custom panels + 1 extra · matching stream style · HD',
      '15 premium panels + 3 extras · source files · professional branding',
    ],
  },
  {
    id: 'channel-point',
    name: 'Channel Point',
    category: 'Stream',
    description: 'One custom channel-point icon.',
    prices: [8, 16, 16],
  },
  {
    id: 'animated-channel-point',
    name: 'Animated Channel Point',
    category: 'Stream',
    description: 'A motion channel-point reward.',
    prices: [20, 35, 55],
  },
  {
    id: 'lower-third',
    name: 'Lower Third Animation',
    category: 'Animation',
    description: 'Animated name or information graphic.',
    prices: [48, 104, 160],
  },
  {
    id: 'pngtuber',
    name: 'PNGTuber',
    category: 'VTuber',
    description: 'A reactive illustrated avatar set.',
    prices: [140, 240, 380],
  },
  {
    id: 'vtuber-2d',
    name: 'VTuber Model Package',
    category: 'VTuber',
    description: 'A 2D or Live2D creator-model package.',
    prices: [260, 640, 1280],
    scopeDetails: [
      'Simple 2D VTuber model · basic rigging · 2 expressions',
      'Live2D model · smooth rigging · expressions and toggles',
      'Premium VTuber model · advanced rigging · full expressions, advanced toggles and commercial use',
    ],
  },
  {
    id: 'vtuber-3d',
    name: '3D Live VTuber Model',
    category: 'VTuber',
    description: 'A detailed 3D creator model.',
    prices: [572, 1172, 1800],
  },
  {
    id: 'toggle',
    name: 'Model Toggle',
    category: 'VTuber',
    description: 'One approved model toggle or variation.',
    prices: [100, 144, 180],
  },
  {
    id: 'illustration',
    name: 'Digital Illustration',
    category: 'Artwork',
    description: 'A polished illustration within approved scope.',
    prices: [40, 112, 220],
    scopeDetails: [
      'Simple character art · flat colors',
      'Full-color anime-style illustration · background included',
      'Premium detailed illustration · custom background · high resolution and commercial use',
    ],
  },
  {
    id: 'stream-avatar',
    name: 'Stream Avatar',
    category: 'Artwork',
    description: 'A channel-ready creator avatar.',
    prices: [80, 150, 240],
  },
  {
    id: 'character-art',
    name: 'Character / Furry Artwork',
    category: 'Artwork',
    description: 'Character work reviewed against content guidelines.',
    prices: [0, 0, 0],
    quoteOnly: true,
  },
  {
    id: 'oc-sheet',
    name: 'OC Reference Sheet',
    category: 'Artwork',
    description: 'A clear multi-view original-character reference.',
    prices: [220, 360, 520],
  },
  {
    id: 'thumbnail',
    name: 'Thumbnail',
    category: 'Content',
    description: 'A platform-ready video thumbnail.',
    prices: [20, 35, 55],
  },
  {
    id: 'montage',
    name: 'Montage',
    category: 'Content',
    description: 'Edited montage from supplied footage.',
    prices: [120, 220, 360],
  },
  {
    id: 'intro',
    name: 'Intro',
    category: 'Content',
    description: 'A branded video or stream introduction.',
    prices: [90, 160, 260],
  },
  {
    id: 'outro',
    name: 'Outro',
    category: 'Content',
    description: 'A branded closing sequence.',
    prices: [90, 160, 260],
  },
  {
    id: 'intermission',
    name: 'Intermission Screen',
    category: 'Content',
    description: 'A designed intermission scene.',
    prices: [60, 100, 150],
  },
  {
    id: 'channel-trailer',
    name: 'Channel Trailer',
    category: 'Content',
    description: 'A concise channel introduction edit.',
    prices: [180, 320, 520],
  },
  {
    id: 'merch',
    name: 'Merch Design',
    category: 'Branding',
    description: 'Artwork prepared for approved merchandise.',
    prices: [80, 160, 280],
  },
  {
    id: '3d-model',
    name: '3D Model',
    category: '3D',
    description: 'Starting scope; complexity requires team review.',
    prices: [900, 1300, 1800],
  },
  {
    id: 'reels-4',
    name: 'Video Editing — 4 Reels',
    category: 'Content',
    description: 'Four edited reels from supplied footage.',
    prices: [160, 240, 400],
  },
  {
    id: 'reels-8',
    name: 'Video Editing — 8 Reels',
    category: 'Content',
    description: 'Eight coordinated reels with volume value.',
    prices: [320, 480, 800],
  },
  {
    id: 'reels-12',
    name: 'Video Editing — 12 Reels',
    category: 'Content',
    description: 'A larger monthly short-form content batch.',
    prices: [480, 720, 1200],
  },
  {
    id: 'reels-16',
    name: 'Video Editing — 16 Reels',
    category: 'Content',
    description: 'High-volume short-form production for active creators.',
    prices: [640, 960, 1600],
  },
  {
    id: 'custom',
    name: 'Other Custom Request',
    category: 'Custom',
    description: 'Unlisted work; team review required.',
    prices: [0, 0, 0],
    quoteOnly: true,
  },
];

export const EXTRAS_AND_ADDITIONS = [
  'Extra revision round',
  'Additional size / platform',
  'Additional concept',
  'Rush delivery request',
];

export const ADDITIONS_PRICING: Record<string, number> = {
  'Extra revision round': 20,
  'Additional size / platform': 15,
  'Additional concept': 25,
  'Rush delivery request': 50,
};

export const PROHIBITED_REGEX =
  /\b(nsfw|explicit|nudity|nude|sexual|pornographic|erotic|fetish|halloween|horns?|wine|alcohol|666|satanic|christmas|lgbtq|pride|cross|drugs?|bacon|pork|tarot)\b|single[ -]?eye|one[ -]?eye|overly revealing/i;

export const RESTRICTED_GUIDELINES = [
  'NSFW or sexually explicit content',
  'Nudity or overly revealing designs',
  'Halloween themes',
  'Horns or satanic imagery',
  'The number 666 or devil-star symbolism',
  'Christmas themes',
  'Single-eye or one-eye designs',
  'Pride or LGBTQ-themed content',
  'Crosses or religious cross imagery',
  'Wine or alcohol-focused artwork',
  'Drugs or drug-related imagery',
  'Bacon or pork-focused artwork',
  'Tarot cards or occult divination imagery',
];

export const REVISION_RULES = [
  'Extra revision round: 10%, minimum 4 CR. One consolidated feedback list after the included rounds.',
  'Minor text or color change: 5%, minimum 4 CR. Use this or a revision charge for the same work, not both.',
  'Additional size or platform: 15%, minimum 4 CR. Major redesign requires a new quote.',
  'New concept using the same brief: 60%, minimum 12 CR. It replaces the revision fee for that work.',
  'Direction change after approval: 35%, minimum 12 CR. A new brief and timeline are required.',
  'Rush delivery: 35%, minimum 12 CR per service unit and subject to production availability.',
  'Technical export variant: 5%, minimum 4 CR for an extra codec, resolution or format.',
  'Humantek Art error correction: 0 CR. Corrections required to meet the approved brief are free.',
];

export const HOW_CREDITS_WORK = [
  '1 CR represents $2.50 of listed service value before package bonuses.',
  'Package bonuses lower the effective USD cost per credit; credits have no cash-redemption value.',
  'This planner is an estimate. Humantek Art confirms the written brief, final credits and delivery date before work starts.',
  'Basic, Standard and Elite are complete alternative scopes. Choose one scope per service unit.',
  'Included revisions apply within the approved direction. Direction changes and added concepts use additional credits.',
  'Credits are deducted only after the team approves the service, content and final scope.',
  'High-value 3D, VTuber and custom work may require a production-allocation review even when sufficient credits are available.',
  'Use the current wallet balance confirmed by Humantek Art. Used, reserved or gifted credits reduce the available balance.',
];

export const TERMS_AND_CONDITIONS = [
  'Final unwatermarked files are delivered by email, WeTransfer, or another approved method after full payment.',
  'Clients may pay the full amount in advance.',
  'Revisions are limited to the package, invoice, or written agreement. Extra revisions may require extra credits or payment.',
  'Changes requested after approval and delivery are treated as new work.',
  'Payments are non-refundable after work begins, subject to the written agreement and applicable requirements.',
  'Once work begins, the project cannot be cancelled and paid amounts may cover committed work and resources.',
  'A change of mind is not a refund reason. Scope changes may require a revised quote or additional credits.',
  'Our team aims to respond to queries within two business days.',
  'Paying an invoice or accepting these website terms confirms acceptance of the applicable terms and conditions.',
  'Credits apply only to eligible services and content. A request may be declined even when enough credits are available.',
  'Credits are not deducted until the service and scope are approved by the team.',
];

export const SERVICE_METADATA_EXTRAS: Record<
  string,
  { bestFor: string; deliverables: string[]; previewImage?: string }
> = {
  'oc-sheet': {
    bestFor: 'VTubers & original character creators',
    previewImage: '/previews/oc-sheet.jpg',
    deliverables: [
      'Front + side + back views',
      'Color palette & callouts',
      'Expression sheet',
      'High-res transparent PNG & source reference',
    ],
  },
  'character-art': {
    bestFor: 'VTubers & digital creators needing character designs',
    previewImage: '/previews/oc-sheet.jpg',
    deliverables: [
      'Custom character concept sketch & refinement',
      'Full color render & shading',
      'High-res transparent PNG & social crops',
      'Commercial usage license',
    ],
  },
  'logo': {
    bestFor: 'Channel identity & brand revamp',
    previewImage: '/previews/animated-logo.jpg',
    deliverables: [
      'Custom typography / mascot design',
      'Transparent PNG (dark & light variants)',
      'Social profile icon crops',
      'Commercial usage license',
    ],
  },
  'animated-logo': {
    bestFor: 'Stream intros & YouTube openers',
    previewImage: '/previews/animated-logo.jpg',
    deliverables: [
      'Transparent WebM / MOV animation',
      'Smooth 60 FPS motion graphics',
      'Looping and sting transition variants',
    ],
  },
  'banner': {
    bestFor: 'Twitch, YouTube & Twitter profile headers',
    previewImage: '/previews/animated-logo.jpg',
    deliverables: [
      'Responsive multi-platform crops',
      'Custom illustrated / graphic theme',
      'Social links & schedule formatting',
    ],
  },
  'animated-banner': {
    bestFor: 'Dynamic header displays & Twitch banner loops',
    previewImage: '/previews/animated-logo.jpg',
    deliverables: [
      'Smooth animated WebM / MP4 loop',
      'Subtle lighting & particle effects',
      'Channel brand typography integration',
    ],
  },
  'emote': {
    bestFor: 'Twitch, Discord & Kick community engagement',
    deliverables: [
      'Custom chibi / anime expression art',
      'Optimized 28px, 56px, 112px sizes',
      'Platform-ready transparent PNGs',
    ],
  },
  'animated-emote': {
    bestFor: 'Subscriber perks & Discord Nitro rewards',
    deliverables: [
      'Looping animated GIF & APNG formats',
      'Fluid keyframed character animations',
      'Optimized chat resolution exports',
    ],
  },
  'alert': {
    bestFor: 'Follower, sub, tip & raid stream notifications',
    deliverables: [
      'Platform-ready graphic card',
      'Streamlabs / OBS compatible layout',
      'High-contrast broadcast art',
    ],
  },
  'animated-alert': {
    bestFor: 'High-energy live stream event popups',
    deliverables: [
      'Transparent alpha channel WebM',
      'Sound effect sync markers',
      'OBS browser source ready',
    ],
  },
  'intermission': {
    bestFor: 'Live stream BRB, chat & starting soon scenes',
    deliverables: [
      '1920x1080 / 4K custom scene',
      'Chatbox & webcam cutout integration',
      'Coordinated channel aesthetic',
    ],
  },
  'thumbnail': {
    bestFor: 'YouTube gaming & podcast CTR optimization',
    deliverables: [
      'Focal face / character cutout pop',
      'Bold readability-tested typography',
      'High-contrast layered PSD export',
    ],
  },
  'montage': {
    bestFor: 'Gameplay highlights & viral TikTok/Reels edits',
    deliverables: [
      'Beat-synced pacing & sound FX design',
      'Custom speed ramps & zoom transitions',
      'Color graded 1080p 60fps export',
    ],
  },
  'intro': {
    bestFor: 'Video series branding & viewer retention',
    deliverables: [
      '5–10 second dynamic motion opener',
      'Logo animation with SFX polish',
      'Broadcast-quality MP4/MOV export',
    ],
  },
  'outro': {
    bestFor: 'Video endings & playlist click-through cards',
    deliverables: [
      'Endscreen element placement guides',
      'Matching channel audio & motion loop',
      'Social handles & subscriber calls-to-action',
    ],
  },
  'channel-trailer': {
    bestFor: 'New visitor onboarding & sponsorship pitches',
    deliverables: [
      '30–60 second high-energy channel overview',
      'Script pacing & footage curation',
      'Licensed background music & mix',
    ],
  },
  'vtuber-2d': {
    bestFor: 'Virtual streamers & anime content creators',
    deliverables: [
      'High-resolution layered PSD art',
      'Physics-ready hair, eye & clothing cuts',
      'Basic to full Live2D rig parameters',
    ],
  },
  'pngtuber': {
    bestFor: 'Low-overhead reactive avatar streaming',
    deliverables: [
      'Idle, talking, blinking & happy states',
      'Veadotube / Discord Reactive ready',
      'Transparent PNG character sprites',
    ],
  },
  '3d-screen': {
    bestFor: '3D virtual environments & cinematic animations',
    deliverables: [
      'Clean topology 3D character mesh',
      'PBR materials & cinematic studio lighting',
      'Rigged and animation-ready format',
    ],
  },
};

export const CATEGORY_DEFAULT_METADATA: Record<
  string,
  { bestFor: string; deliverables: string[] }
> = {
  Branding: {
    bestFor: 'Creator identity & professional channel presence',
    deliverables: [
      'High-resolution production files',
      'Vector & transparent web exports',
      'Commercial usage license',
    ],
  },
  Stream: {
    bestFor: 'Twitch, YouTube & Kick live broadcasting',
    deliverables: [
      'OBS / Streamlabs ready formats',
      'Platform-approved resolutions',
      'Layered source assets',
    ],
  },
  Animation: {
    bestFor: 'High-motion stream assets & video polish',
    deliverables: [
      'Transparent 60 FPS motion render',
      'Seamless looping playback',
      'WebM & MP4 delivery formats',
    ],
  },
  VTuber: {
    bestFor: 'Virtual content creation & avatar streaming',
    deliverables: [
      'Layered character production artwork',
      'Model parameter preparation',
      'Tracking software compatibility',
    ],
  },
  Artwork: {
    bestFor: 'Character illustration & community merchandise',
    deliverables: [
      'Full resolution digital illustration',
      'Color palette & character sheets',
      'Print-ready high DPI exports',
    ],
  },
  Content: {
    bestFor: 'YouTube, TikTok & short-form video editors',
    deliverables: [
      'High-CTR composition & pacing',
      'Web-ready export formats',
      'Layered project sources',
    ],
  },
  '3D': {
    bestFor: 'Advanced 3D assets & metaverse production',
    deliverables: [
      'Optimized 3D geometry & UV maps',
      'Custom stylized or PBR textures',
      'FBX / OBJ / Blend formats',
    ],
  },
  Custom: {
    bestFor: 'Bespoke agency projects & special scopes',
    deliverables: [
      'Tailored milestone deliverables',
      'Dedicated art director review',
      'Full commercial rights transfer',
    ],
  },
};

const CATEGORY_TURNAROUND: Record<string, string> = {
  Branding: '3–5 days',
  Stream: '2–4 days',
  Animation: '4–7 days',
  VTuber: '7–14 days',
  Artwork: '5–7 days',
  Content: '2–3 days',
  '3D': '7–10 days',
  Custom: 'Custom schedule',
};

export function getServiceMetadata(svc: ServiceDefinition) {
  const custom = SERVICE_METADATA_EXTRAS[svc.id];
  const catDefault = CATEGORY_DEFAULT_METADATA[svc.category] || CATEGORY_DEFAULT_METADATA.Custom;

  return {
    bestFor: svc.bestFor || custom?.bestFor || catDefault.bestFor,
    deliverables: svc.deliverables || custom?.deliverables || catDefault.deliverables,
    previewImage: svc.exampleImage || custom?.previewImage,
    turnaround: CATEGORY_TURNAROUND[svc.category] || '3–5 days',
    revisions: '2 rounds included',
  };
}

