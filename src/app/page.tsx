'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  PACKAGES,
  SERVICES,
  TIER_NAMES,
  ADDITIONS_PRICING,
  RESTRICTED_GUIDELINES,
  PROHIBITED_REGEX,
  HOW_CREDITS_WORK,
  TERMS_AND_CONDITIONS,
} from '@/lib/catalog';
import {
  ServiceDefinition,
  ServiceSelection,
  SelectedServiceEntry,
  ProjectRecord,
  UploadedFile,
} from '@/types';
import { StudioCardLayout } from '@/components/StudioCardLayout';
import { ScopeGuideModal } from '@/components/ScopeGuideModal';
import { ServiceCategoryTabs } from '@/components/ServiceCategoryTabs';
import { CartSidebar } from '@/components/CartSidebar';
import { ServiceHoverCard } from '@/components/ServiceHoverCard';
import { ServiceQuickPreviewModal } from '@/components/ServiceQuickPreviewModal';
import { PayPalButtonWrapper } from '@/components/PayPalButtonWrapper';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreditValue } from '@/components/ui/credit-value';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/reui/number-field';
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
} from '@/components/ui/attachment';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { IconTile } from '@/components/reui/icon-tile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  CheckCircle,
  AlertTriangle,
  Upload,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Loader2,
  Check,
  X,
  ImageIcon,
  ChevronDown,
  PackageCheck,
  Zap,
  Trash2,
  Lock,
  RefreshCw,
  Clock,
  Coins,
  FileCheck,
  Plus,
  Eye,
  Layers,
  Sparkles,
  PenTool,
  Image,
  Smile,
  BellRing,
  Monitor,
  Clapperboard,
  Box,
  Award,
  LayoutGrid,
  Presentation,
  UserCheck,
  Bot,
  ToggleRight,
  Paintbrush,
  UserCircle,
  Palette,
  FileText,
  ImagePlus,
  Film,
  PlayCircle,
  Video,
  ShoppingBag,
  Smartphone,
  Wand2,
  Tv,
  MessageSquare,
} from 'lucide-react';
import { useStudioChat } from '@/lib/chatStore';

function getServiceIcon(serviceId: string, category: string) {
  switch (serviceId) {
    case 'logo':
    case 'animated-logo':
      return PenTool;
    case 'banner':
    case 'animated-banner':
      return Image;
    case 'emote':
    case 'animated-emote':
      return Smile;
    case 'alert':
    case 'animated-alert':
      return BellRing;
    case 'overlays':
    case 'animated-overlays':
      return Layers;
    case 'static-screen':
      return Monitor;
    case 'animated-screen':
      return Clapperboard;
    case '3d-screen':
    case '3d-model':
      return Box;
    case 'sub-badge':
      return Award;
    case 'panel':
      return LayoutGrid;
    case 'channel-point':
    case 'animated-channel-point':
      return Coins;
    case 'lower-third':
      return Presentation;
    case 'pngtuber':
      return UserCheck;
    case 'vtuber-2d':
    case 'vtuber-3d':
      return Bot;
    case 'toggle':
      return ToggleRight;
    case 'illustration':
      return Paintbrush;
    case 'stream-avatar':
      return UserCircle;
    case 'character-art':
      return Palette;
    case 'oc-sheet':
      return FileText;
    case 'thumbnail':
      return ImagePlus;
    case 'montage':
      return Film;
    case 'intro':
    case 'outro':
      return PlayCircle;
    case 'intermission':
      return Clock;
    case 'channel-trailer':
      return Video;
    case 'merch':
      return ShoppingBag;
    case 'reels-4':
    case 'reels-8':
    case 'reels-12':
    case 'reels-16':
      return Smartphone;
    case 'custom':
      return Wand2;
    default:
      switch (category) {
        case 'Branding':
          return Sparkles;
        case 'Stream':
          return Tv;
        case 'Animation':
          return Clapperboard;
        case 'VTuber':
          return Bot;
        case 'Artwork':
          return Paintbrush;
        case 'Content':
          return Video;
        case '3D':
          return Box;
        default:
          return Wand2;
      }
  }
}

const PRICE_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'under-50', label: 'Under 50 CR' },
  { id: '50-100', label: '50–100 CR' },
  { id: '100-200', label: '100–200 CR' },
  { id: '200-plus', label: '200+ CR' },
] as const;

const CORE_RESTRICTED_ITEMS = [
  'NSFW, sexually explicit, or adult content',
  'Nudity or overly revealing designs',
  'Occult, satanic, horns, 666, or Halloween themes',
  'Drugs, alcohol, wine, or pork/bacon imagery',
  'Religious crosses, political, or pride symbolism',
];

type PriceFilterType = (typeof PRICE_FILTER_OPTIONS)[number]['id'];

export default function CreatorStudioPage() {
  // Navigation & Step state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [priceFilter, setPriceFilter] = useState<PriceFilterType>('all');
  const [priorityPassEnabled, setPriorityPassEnabled] = useState(false);
  const { setIsOpen: setChatOpen } = useStudioChat();

  // Asset selections & additions
  const [selections, setSelections] = useState<Record<string, ServiceSelection>>({});
  const [additions, setAdditions] = useState<string[]>([]);
  const [previewService, setPreviewService] = useState<ServiceDefinition | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [openPolicyAccordion, setOpenPolicyAccordion] = useState<string[]>(['revisions']);
  const [showAllRestricted, setShowAllRestricted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Creative brief form
  const [clientName, setClientName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState('');
  const [style, setStyle] = useState('');
  const [colors, setColors] = useState('');
  const [instructions, setInstructions] = useState('');

  // Uploads & wallet tools
  const [projectId] = useState(
    () => `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeemCodeAttached, setRedeemCodeAttached] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedProject, setSubmittedProject] = useState<ProjectRecord | null>(null);

  // Derived package & credit calculations
  const currentPackage = PACKAGES.find((p) => p.id === selectedPackageId);

  const selectedEntries: SelectedServiceEntry[] = Object.entries(selections).flatMap(
    ([serviceId, choice]) => {
      const s = SERVICES.find((item) => item.id === serviceId);
      if (!s) return [];
      const cost = s.quoteOnly ? 0 : s.prices[choice.level] * choice.quantity;
      return [{ service: s, choice, credits: cost }];
    }
  );

  const servicesCredits = selectedEntries.reduce((sum, item) => sum + item.credits, 0);
  const additionsCredits = additions.reduce(
    (sum, extra) => sum + (ADDITIONS_PRICING[extra] || 0),
    0
  );
  const usedCredits = servicesCredits + additionsCredits;
  const bonusCredits = priorityPassEnabled ? 50 : 0;
  const totalPackageCredits = (currentPackage?.credits ?? 0) + bonusCredits;
  const remainingCredits = totalPackageCredits - usedCredits;

  const standardUnits = selectedEntries
    .filter((e) => e.choice.level === 1)
    .reduce((sum, e) => sum + e.choice.quantity, 0);

  const eliteUnits = selectedEntries
    .filter((e) => e.choice.level === 2)
    .reduce((sum, e) => sum + e.choice.quantity, 0);

  // Tier limit violations
  const isTierRestricted = Boolean(
    currentPackage &&
    ((currentPackage.standardLimit !== undefined && standardUnits > currentPackage.standardLimit) ||
      (currentPackage.eliteLimit !== undefined && eliteUnits > currentPackage.eliteLimit))
  );

  // Prohibited words check
  const hasPolicyViolation = PROHIBITED_REGEX.test(instructions);

  // Form validity for steps
  const isStep1Valid = Boolean(selectedPackageId);
  const isStep2Valid = selectedEntries.length > 0 && remainingCredits >= 0 && !isTierRestricted;
  const isStep3Valid = policyAccepted;
  const isStep4Valid =
    clientName.trim() !== '' &&
    instructions.trim() !== '' &&
    !hasPolicyViolation &&
    termsAccepted;

  const serviceCategories = useMemo(() => {
    const cats = Array.from(new Set(SERVICES.map((s) => s.category)));
    return ['All', 'Selected', ...cats];
  }, []);

  const serviceCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: SERVICES.length,
      Selected: selectedEntries.length,
    };
    SERVICES.forEach((s) => {
      counts[s.category] = (counts[s.category] ?? 0) + 1;
    });
    return counts;
  }, [selectedEntries.length]);

  const recommendedPack = useMemo(() => {
    return PACKAGES.find(
      (p) => p.credits >= usedCredits && p.id !== selectedPackageId
    );
  }, [usedCredits, selectedPackageId]);

  const filteredServices = useMemo(() => {
    return SERVICES.filter((s) => {
      // 1. Category filter
      if (activeCategory === 'Selected') {
        if (!selections[s.id]) return false;
      } else if (activeCategory !== 'All') {
        if (s.category !== activeCategory) return false;
      }

      // 2. Price/Budget filter
      if (priceFilter !== 'all') {
        if (s.quoteOnly) return false;
        const basePrice = s.prices[0];
        if (priceFilter === 'under-50' && basePrice >= 50) return false;
        if (priceFilter === '50-100' && (basePrice < 50 || basePrice > 100)) return false;
        if (priceFilter === '100-200' && (basePrice < 101 || basePrice > 200)) return false;
        if (priceFilter === '200-plus' && basePrice <= 200) return false;
      }

      return true;
    });
  }, [activeCategory, selections, priceFilter]);

  const handleUpgradePackage = (packageId: string) => {
    setSelectedPackageId(packageId);
    toast.success('Package updated to support your credit scope');
  };

  // Navigation handlers
  const goToStep = (step: number) => {
    setCurrentStep(Math.max(1, Math.min(5, step)));
  };

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId);
    setSelections({});
    setAdditions([]);
    setPriceFilter('all');
    setPolicyAccepted(false);
    setOpenPolicyAccordion(['revisions']);
    setShowAllRestricted(false);
    setTermsAccepted(false);
  };

  const toggleService = (serviceId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[serviceId]) {
        delete next[serviceId];
      } else {
        next[serviceId] = { level: 0, quantity: 1 };
      }
      return next;
    });
  };

  const updateServiceTier = (serviceId: string, level: 0 | 1 | 2) => {
    setSelections((prev) => {
      if (!prev[serviceId]) return prev;
      return {
        ...prev,
        [serviceId]: { ...prev[serviceId], level },
      };
    });
  };

  const updateServiceQuantity = (serviceId: string, quantity: number) => {
    setSelections((prev) => {
      if (!prev[serviceId]) return prev;
      return {
        ...prev,
        [serviceId]: { ...prev[serviceId], quantity: Math.max(1, quantity) },
      };
    });
  };

  const toggleAddition = (extra: string) => {
    setAdditions((prev) =>
      prev.includes(extra) ? prev.filter((item) => item !== extra) : [...prev, extra]
    );
  };

  const uploadFiles = async (incoming: File[]) => {
    const files = incoming.filter((f) => f.type.startsWith('image/'));
    if (incoming.length && !files.length) {
      toast.error('Only image files (PNG, JPG, WebP) are supported');
      return;
    }
    if (!files.length) return;

    setIsUploading(true);
    setErrorMessage('');
    try {
      for (const file of files) {
        setUploadingNames((prev) => [...prev, file.name]);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', projectId);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'File upload failed');

        setUploadedFiles((prev) => [
          ...prev,
          {
            id: data.file.id,
            filename: data.file.filename,
            size: data.file.size,
            url: data.file.url,
          },
        ]);
        setUploadingNames((prev) => prev.filter((n) => n !== file.name));
        toast.success(`Uploaded ${file.name}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setUploadingNames([]);
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadFiles(files);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    void uploadFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeUploadedFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    toast.info('Removed reference file');
  };

  const handleSubmitForReview = async () => {
    if (!currentPackage) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          packageId: currentPackage.id,
          selections: selectedEntries.map((e) => ({
            id: e.service.id,
            name: e.service.name,
            level: e.choice.level,
            quantity: e.choice.quantity,
            credits: e.credits,
          })),
          additions,
          clientName,
          channelName,
          email,
          platform,
          style,
          colors,
          instructions,
          redeemCode: redeemCodeAttached ? redeemCodeInput : '',
          uploadedFiles,
          paymentStatus: 'unpaid',
          status: 'pending_review',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      setSubmittedProject(data.project);
      toast.success('Project request submitted for studio review!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine top right badge on header
  const headerBadge = currentPackage ? (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-xs">
      <span className="text-amber-800 dark:text-amber-300 font-semibold">{currentPackage.name}</span>
      <span className="text-muted-foreground font-normal">·</span>
      <span className="font-extrabold text-amber-700 dark:text-amber-400 tabular-nums">
        {remainingCredits} / {totalPackageCredits} CR
      </span>
    </div>
  ) : null;

  // Footer navigation actions
  const renderFooterActions = () => {
    if (submittedProject) return null;

    return (
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Back button or status info */}
        <div>
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => goToStep(currentStep - 1)}
              className="gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Step 1: Choose your creative package to start
            </span>
          )}
        </div>

        {/* Right Side: Primary Next Button matching reference image */}
        <div className="flex items-center gap-3">
          {currentStep === 1 && (
            <Button
              type="button"
              variant="default"
              size="default"
              disabled={!isStep1Valid}
              onClick={() => goToStep(2)}
              className="font-semibold px-6 gap-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              type="button"
              variant="default"
              size="default"
              disabled={!isStep2Valid}
              onClick={() => goToStep(3)}
              className="font-semibold px-6 gap-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              type="button"
              variant="default"
              size="default"
              disabled={!isStep3Valid}
              onClick={() => goToStep(4)}
              className="font-semibold px-6 gap-2"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}

          {currentStep === 4 && (
            <Button
              type="button"
              variant="default"
              size="default"
              disabled={!isStep4Valid}
              onClick={() => goToStep(5)}
              className="font-semibold px-6 gap-2"
            >
              <span>Review & Pay</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <StudioCardLayout
      mode="wizard"
      currentStep={currentStep}
      onSelectStep={goToStep}
      isPackageSelected={Boolean(selectedPackageId)}
      walletBalance={remainingCredits >= 0 ? remainingCredits : 0}
      userEmail={email || null}
      topRightBadge={headerBadge}
      footerActions={renderFooterActions()}
    >
      {/* ============================================================ */}
      {/* STEP 1: CHOOSE A PACKAGE                                     */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 1/5
              </div>
              <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl">
                Package Selection
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Select your creative package tier below to unlock scope credits, bonuses, and asset slots.
              </p>
            </div>

            {/* Fast-Track Toggle */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="flex items-center gap-2 p-1.5 px-3 bg-secondary/60 border border-border/80 rounded-xl text-xs cursor-pointer select-none">
                    <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="font-semibold text-foreground text-xs">
                      Priority Fast-Track (+50 CR)
                    </span>
                    <Switch
                      checked={priorityPassEnabled}
                      onCheckedChange={setPriorityPassEnabled}
                    />
                  </div>
                }
              />
              <TooltipContent side="bottom" className="text-xs max-w-xs">
                Activate express studio queue processing and earn 50 additional bonus credits.
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Slim Full-Width Info & Scope Matrix Banner */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/40 border border-border/70 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <h3 className="text-sm font-bold text-foreground">
                    Customised Creator Services
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  Prepaid studio credits allocated directly to your account. Our directors immediately begin tailoring custom concepts for your channel.
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>$2.50 base rate per CR</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Included multi-round revisions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Full commercial streaming rights</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 self-start lg:self-center">
                <ScopeGuideModal />
              </div>
            </div>
          </div>

          {/* Centered 3 Compact Package Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 items-stretch">
            {PACKAGES.map((pkg) => {
              const pkgCredits = pkg.credits + (priorityPassEnabled ? 50 : 0);
              const effectiveRate = (pkg.price / pkgCredits).toFixed(2);
              const isSelected = selectedPackageId === pkg.id;
              const isPopular = pkg.id === 'studio-momentum';

              return (
                <Card
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={cn(
                    'relative flex flex-col justify-between rounded-xl transition-all duration-200 cursor-pointer select-none overflow-hidden shadow-2xs py-0 gap-0',
                    isSelected
                      ? 'border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                      : isPopular
                        ? 'border-2 border-amber-400/80 bg-card hover:border-amber-500 shadow-sm'
                        : 'border border-border/80 bg-card hover:border-zinc-400'
                  )}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-amber-500 text-white font-bold text-[10px] uppercase tracking-wider py-0.5 px-2.5 rounded-bl-lg">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <CardHeader className="p-4 pb-2">
                    <Badge variant="secondary" className="w-fit text-[10px] font-bold uppercase tracking-wider mb-1 px-2 py-0.2">
                      {pkg.group}
                    </Badge>
                    <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
                      {pkg.name}
                    </CardTitle>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                        ${pkg.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">USD</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <CreditValue value={pkgCredits} size="sm" variant="pill" />
                      <span className="text-xs text-muted-foreground font-medium">
                        ${effectiveRate}/CR
                      </span>
                    </div>
                    <CardDescription className="text-xs leading-normal text-muted-foreground line-clamp-1 mt-1">
                      {pkg.bestFor}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2.5 space-y-1.5 text-xs text-muted-foreground border-t border-border/50 flex-1">
                    <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">
                        {pkg.maxLevel === 1
                          ? 'Basic + up to 2 Standard units'
                          : pkg.eliteLimit
                            ? 'Basic, Standard + 2 Elite units'
                            : 'Full access to all 39 tiers'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Priority review queue included</span>
                    </div>
                  </CardContent>

                  <div className="p-4 pt-0">
                    <Button
                      type="button"
                      variant={isSelected ? 'default' : isPopular ? 'default' : 'secondary'}
                      size="sm"
                      className="w-full text-xs font-semibold gap-1.5 h-9 rounded-xl cursor-pointer"
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Selected
                        </>
                      ) : (
                        'Select Package'
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Centered Bottom Tip */}
          <p className="text-center text-xs text-muted-foreground pt-0.5">
            Tip: Higher packages include volume credit multipliers. You can re-allocate credits anytime before final checkout.
          </p>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: MULTI-ASSET CONFIGURATOR                             */}
      {/* ============================================================ */}
      {currentStep === 2 && currentPackage && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 2/5
              </div>
              <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl">
                Multi-Asset Configurator
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Choose multiple services at once, configure scope tiers and quantities, and watch your credit balance update in real time.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <ScopeGuideModal />
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(1)}
                className="text-xs font-semibold rounded-xl h-9 cursor-pointer"
              >
                Change Package
              </Button>
            </div>
          </div>

          {/* 2-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* LEFT COLUMN: AVAILABLE SERVICES & ADDITIONS (~65% / 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Active Package Notice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">
                        {currentPackage.name} Plan Active
                      </span>
                      <Badge variant="gold" className="text-[10px] py-0 px-2 font-bold uppercase tracking-wider">
                        {totalPackageCredits} CR Budget
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Basic, Standard, and Elite tier options available — governed by your package limits and credit allocation.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap">
                  <Badge variant="secondary" className="text-xs font-semibold">
                    {selectedEntries.length} {selectedEntries.length === 1 ? 'service' : 'services'} selected
                  </Badge>
                  {additions.length > 0 && (
                    <Badge variant="gold" className="text-xs font-semibold">
                      +{additions.length} {additions.length === 1 ? 'extra' : 'extras'}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Category & Price Filters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Browse Catalog Categories
                  </span>
                  {(activeCategory !== 'All' || priceFilter !== 'all') && (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => {
                        setActiveCategory('All');
                        setPriceFilter('all');
                      }}
                      className="h-auto px-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Reset all filters
                    </Button>
                  )}
                </div>

                <ServiceCategoryTabs
                  categories={serviceCategories}
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                  categoryCounts={serviceCategoryCounts}
                />

                {/* Price / Budget Filter Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none]">
                  <span className="text-xs font-semibold text-muted-foreground mr-1 shrink-0">
                    Filter by price:
                  </span>
                  <ToggleGroup
                    value={[priceFilter]}
                    onValueChange={(vals) => {
                      const next = (vals as string[])[0];
                      if (next) setPriceFilter(next as typeof priceFilter);
                    }}
                    size="sm"
                    spacing={1}
                    aria-label="Filter by price"
                  >
                    {PRICE_FILTER_OPTIONS.map((opt) => (
                      <ToggleGroupItem
                        key={opt.id}
                        value={opt.id}
                        className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium text-muted-foreground bg-secondary/50 border border-transparent hover:bg-secondary/80 hover:text-foreground data-[pressed]:bg-amber-500/15 data-[pressed]:text-amber-800 dark:data-[pressed]:text-amber-300 data-[pressed]:font-bold data-[pressed]:border-amber-500/35 data-[pressed]:shadow-2xs"
                      >
                        {opt.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>

              {/* Services Grid (2 Columns with increased breathing room) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {filteredServices.map((svc) => {
                  const choice = selections[svc.id];
                  const isSelected = Boolean(choice);
                  const currentLevel = choice?.level ?? 0;
                  const currentQty = choice?.quantity ?? 1;
                  const currentCost = svc.prices[currentLevel] * currentQty;

                  const isStandardDisabled =
                    currentPackage.standardLimit !== undefined &&
                    standardUnits >= currentPackage.standardLimit &&
                    choice?.level !== 1;

                  const isEliteDisabled =
                    currentPackage.maxLevel < 2 ||
                    (currentPackage.eliteLimit !== undefined &&
                      eliteUnits >= currentPackage.eliteLimit &&
                      choice?.level !== 2);

                  const Icon = getServiceIcon(svc.id, svc.category);

                  return (
                    <Card
                      key={svc.id}
                      className={cn(
                        'group rounded-2xl transition-all duration-200 overflow-hidden flex flex-col justify-between py-0 gap-0 shadow-2xs',
                        isSelected
                          ? 'border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/25 shadow-xs'
                          : 'border-border/80 bg-card hover:border-amber-500/40 hover:shadow-xs'
                      )}
                    >
                      {/* Card Top / Header Area */}
                      <div className="p-4 sm:p-4.5 flex-1 flex flex-col justify-between space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Service Vector Icon Tile */}
                            <div className="relative shrink-0">
                              <IconTile
                                variant={isSelected ? 'solid' : 'outline'}
                                size="default"
                                className={cn(
                                  'rounded-xl transition-all duration-200',
                                  isSelected
                                    ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs shadow-amber-500/20'
                                    : 'bg-secondary/80 border-border/80 text-muted-foreground group-hover:border-amber-500/40 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                                )}
                              >
                                <Icon />
                              </IconTile>
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-card shadow-xs animate-in zoom-in-75">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <ServiceHoverCard service={svc}>
                                <h3
                                  onClick={() => setPreviewService(svc)}
                                  className="text-sm font-bold text-foreground leading-snug truncate hover:underline hover:decoration-dotted hover:underline-offset-4 hover:decoration-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer inline-block"
                                  title="Hover or click for deliverable preview"
                                >
                                  {svc.name}
                                </h3>
                              </ServiceHoverCard>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                                {svc.description}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0">
                                {svc.category}
                              </Badge>
                              {/* Quick Preview Eye Icon Button with Tooltip */}
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewService(svc);
                                      }}
                                      className="size-6 rounded-md text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 border-border/70 hover:border-amber-400/60 shadow-none"
                                      aria-label="Quick preview"
                                    />
                                  }
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </TooltipTrigger>
                                <TooltipContent side="top">Quick preview</TooltipContent>
                              </Tooltip>
                            </div>

                            <div>
                              {isSelected ? (
                                <CreditValue value={currentCost} size="sm" />
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  from <span className="font-bold text-foreground">{svc.prices[0]} CR</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Toggle if Not Selected */}
                        {!isSelected && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => toggleService(svc.id)}
                            className="w-full text-xs font-semibold h-8 rounded-lg border-dashed hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Scope
                          </Button>
                        )}
                      </div>

                      {/* Card Bottom Drawer (Ultra-Compact Single-Row Action Bar) */}
                      {isSelected && choice && (
                        <div className="bg-secondary/40 border-t border-border/80 px-3.5 py-2.5 flex items-center justify-between gap-2.5">
                          {/* Tier Selector */}
                          <div className="flex-1 min-w-0 max-w-[170px] sm:max-w-[200px]">
                            <Select
                              value={choice.level === 2 ? 'elite' : choice.level === 1 ? 'standard' : 'basic'}
                              onValueChange={(val) => {
                                if (val !== null && val !== undefined) {
                                  const level: 0 | 1 | 2 = val === 'elite' ? 2 : val === 'standard' ? 1 : 0;
                                  updateServiceTier(svc.id, level);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full h-7 text-xs font-semibold bg-card rounded-lg border-border py-0 px-2.5 shadow-2xs">
                                <SelectValue placeholder="Tier">
                                  {TIER_NAMES[choice.level]} ({svc.prices[choice.level]} CR)
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="text-xs">
                                <SelectItem value="basic" className="text-xs">
                                  Basic — {svc.prices[0]} CR
                                </SelectItem>
                                <SelectItem value="standard" disabled={isStandardDisabled} className="text-xs">
                                  Standard — {svc.prices[1]} CR {isStandardDisabled ? '(Plan limit)' : ''}
                                </SelectItem>
                                <SelectItem value="elite" disabled={isEliteDisabled} className="text-xs">
                                  Elite — {svc.prices[2]} CR {isEliteDisabled ? '(Plan limit)' : ''}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quantity — ReUI Number Field */}
                          <NumberField
                            size="sm"
                            min={1}
                            max={99}
                            value={currentQty}
                            onValueChange={(val) => updateServiceQuantity(svc.id, Math.max(1, val ?? 1))}
                            className="w-auto shrink-0 gap-0"
                            aria-label={`${svc.name} quantity`}
                          >
                            <NumberFieldGroup className="w-[84px] rounded-lg border-border/80 bg-card shadow-2xs">
                              <NumberFieldDecrement className="text-muted-foreground hover:text-foreground disabled:opacity-30" />
                              <NumberFieldInput className="px-0 text-xs font-bold" />
                              <NumberFieldIncrement className="text-muted-foreground hover:text-foreground" />
                            </NumberFieldGroup>
                          </NumberField>

                          {/* Quick Remove Action Button */}
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 px-2 shrink-0 rounded-lg transition-colors ml-auto gap-1"
                                  aria-label="Remove from scope"
                                />
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-medium hidden sm:inline">Remove</span>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                              <AlertDialogHeader>
                                <AlertDialogMedia className="bg-destructive/10 text-destructive">
                                  <Trash2 />
                                </AlertDialogMedia>
                                <AlertDialogTitle>Remove {svc.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This frees up <b className="text-foreground">{currentCost} CR</b> from your package. You can add it back anytime.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep it</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => toggleService(svc.id)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {filteredServices.length === 0 && (
                <Empty className="rounded-2xl border border-dashed border-border/80 bg-secondary/20 py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Layers />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">
                      {activeCategory === 'Selected'
                        ? 'No services selected yet'
                        : priceFilter !== 'all'
                          ? `No services found in "${PRICE_FILTER_OPTIONS.find((p) => p.id === priceFilter)?.label}"`
                          : `No services found in "${activeCategory}"`}
                    </EmptyTitle>
                    <EmptyDescription className="text-xs">
                      {activeCategory === 'Selected'
                        ? 'Browse catalog categories and click "Add to Scope" to build your custom package.'
                        : 'Try adjusting your price filter or selecting another category.'}
                    </EmptyDescription>
                  </EmptyHeader>
                  {(activeCategory !== 'All' || priceFilter !== 'all') && (
                    <EmptyContent>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveCategory('All');
                          setPriceFilter('all');
                        }}
                        className="text-xs font-semibold"
                      >
                        Reset all filters
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )}
            </div>

            {/* RIGHT COLUMN: REUSABLE CART SIDEBAR (~35% / 4 cols) */}
            <div className="lg:col-span-4 lg:sticky lg:top-[8.75rem] lg:h-[calc(100vh-14rem)] lg:min-h-[540px]">
              <CartSidebar
                pack={currentPackage}
                entries={selectedEntries}
                usedCredits={usedCredits}
                remainingCredits={remainingCredits}
                standardUnits={standardUnits}
                eliteUnits={eliteUnits}
                recommendedPack={recommendedPack}
                onUpgradePackage={handleUpgradePackage}
                onRemoveService={toggleService}
                isTierRestricted={isTierRestricted}
                additions={additions}
                onToggleAddition={toggleAddition}
                className="h-full"
              />
            </div>
          </div>

          {/* Quick Preview Modal for Desktop and Mobile */}
          <ServiceQuickPreviewModal
            service={previewService}
            isOpen={previewService !== null}
            onClose={() => setPreviewService(null)}
            isSelected={previewService ? Boolean(selections[previewService.id]) : false}
            currentLevel={
              previewService && selections[previewService.id]
                ? selections[previewService.id].level
                : 0
            }
            onSelectService={(id, level) => {
              setSelections((prev) => ({
                ...prev,
                [id]: { level, quantity: prev[id]?.quantity ?? 1 },
              }));
            }}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: CREDIT SCOPE & ELIGIBILITY                           */}
      {/* ============================================================ */}
      {currentStep === 3 && currentPackage && (
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 3/5
              </div>
              <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl">
                Credit Scope & Eligibility Rules
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Review scope guidelines and eligibility rules to ensure smooth, uninterrupted studio production.
              </p>
            </div>

            <Badge variant="secondary" className="w-fit text-xs font-semibold px-3 py-1 rounded-xl">
              Studio Policy Compliance
            </Badge>
          </div>

          {/* Slim Full-Width Scope & Matrix Banner (Matching Step 1 & 2 Design System) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/40 border border-border/70 shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <h3 className="text-sm font-bold text-foreground">
                    Clear Scopes, Fast Delivery
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-normal">
                  Transparent production scopes protect design quality and honor our 3–7 business day turnaround guarantee.
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-0.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>2–3 revision rounds included</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Stream-ready PNG, WebM & master files</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>12-month credit validity & rollover</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 self-start lg:self-center">
                <ScopeGuideModal />
              </div>
            </div>
          </div>

          {/* Two Equal Neutral Cards: Supported Deliverables | Restricted Guidelines (5-to-5 Symmetry) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
            {/* Supported Deliverables Card */}
            <Card className="rounded-2xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-5 sm:p-6 pb-3.5 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="font-bold text-sm text-foreground">
                        Supported Deliverables
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Assets fully covered by your studio credit balance
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-0">
                    Covered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 pt-4">
                <ul className="text-xs text-foreground/90 space-y-3">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Stream graphics, overlays, alerts & static scenes</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Custom emotes, sub badges, channel avatars & panels</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Approved character art, VTuber model designs & rigging</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>2D/3D motion animations, stream stingers & video reels</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>Logo marks, typography & master source files (PSD/AI/AE)</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Restricted Content Card (Symmetrical 5-Item Rhythm & Collapsible) */}
            <Card className="rounded-2xl border border-border/80 bg-card shadow-2xs flex flex-col justify-between overflow-hidden">
              <CardHeader className="p-5 sm:p-6 pb-3.5 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="font-bold text-sm text-foreground">
                        Restricted Guidelines
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground">
                        Strictly prohibited across all studio orders and briefs
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 border-0">
                    Prohibited
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 pt-4 flex flex-col justify-between flex-1">
                {showAllRestricted ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-foreground/90">
                    {RESTRICTED_GUIDELINES.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <X className="w-3.5 h-3.5 text-rose-500/90 dark:text-rose-400 font-bold shrink-0 mt-0.5" />
                        <span className="leading-snug text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="text-xs text-foreground/90 space-y-3">
                    {CORE_RESTRICTED_ITEMS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <X className="w-3.5 h-3.5 text-rose-500/90 dark:text-rose-400 font-bold shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between">
                  <Button
                    id="toggle-restricted-guidelines"
                    type="button"
                    variant="link"
                    size="xs"
                    aria-expanded={showAllRestricted}
                    onClick={() => setShowAllRestricted(!showAllRestricted)}
                    className="h-auto px-0 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:no-underline"
                  >
                    <span>
                      {showAllRestricted
                        ? 'Show core 5 restrictions'
                        : `View all ${RESTRICTED_GUIDELINES.length} detailed guidelines`}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-200',
                        showAllRestricted && 'rotate-180'
                      )}
                    />
                  </Button>
                  <span className="text-[11px] text-muted-foreground">
                    Non-compliant briefs declined
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Studio Policies & Service Framework (Clean Neutral Accordion) */}
          <Card className="rounded-2xl border border-border/80 bg-card shadow-2xs overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3.5 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                    Studio Policies & Service Framework
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Inspect exact revision schedules, credit deduction rules, turnaround times, and commercial rights.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="w-fit text-xs font-semibold px-2.5 py-0.5">
                  Official Terms
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Accordion
                value={openPolicyAccordion}
                onValueChange={(val) => setOpenPolicyAccordion(val)}
                className="divide-y divide-border/60"
              >
                {/* Accordion Item 1: Revision & Change Rules */}
                <AccordionItem
                  value="revisions"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-500 data-[open]:border-l-amber-500"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-amber-600 transition-colors flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-amber-600 transition-colors">
                          Revision & Change Rules
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Standard 2–3 rounds included · Scope changes from 5% to 60%
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Every creative service includes 2–3 structured revision rounds within the approved direction. Modifications after approvals or outside scope adhere to the following rates:
                      </p>
                      <div className="rounded-xl border border-border/70 overflow-hidden bg-background">
                        <Table className="w-full text-xs">
                          <TableHeader className="bg-muted/40">
                            <TableRow className="border-b border-border/70 hover:bg-transparent">
                              <TableHead className="font-semibold text-foreground py-2.5 px-3.5">Modification Scope</TableHead>
                              <TableHead className="font-semibold text-foreground py-2.5 px-3.5 text-right">Fee Rate</TableHead>
                              <TableHead className="font-semibold text-foreground py-2.5 px-3.5 hidden sm:table-cell">Policy Guideline</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Humantek Art error correction</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 py-2.5 px-3.5">0 CR (Free)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Corrections required to meet approved brief</TableCell>
                            </TableRow>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Minor text or colour change</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">5% (min 4 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Applies to finalized typography or palette tweaks</TableCell>
                            </TableRow>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Extra revision round</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">10% (min 4 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">One consolidated feedback list after included rounds</TableCell>
                            </TableRow>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Additional size or platform</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">15% (min 4 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Formatting approved design for an extra platform</TableCell>
                            </TableRow>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Direction change after approval</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">35% (min 12 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Requires a new brief and revised timeline</TableCell>
                            </TableRow>
                            <TableRow className="border-b border-border/50">
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">New concept using same brief</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">60% (min 12 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Replaces standard revision fee for that unit</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Rush delivery request</TableCell>
                              <TableCell className="text-right font-semibold text-foreground py-2.5 px-3.5">35% (min 12 CR)</TableCell>
                              <TableCell className="text-muted-foreground py-2.5 px-3.5 hidden sm:table-cell">Subject to studio production availability</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion Item 2: How Credits & Scopes Operate (Structured Micro-Cards) */}
                <AccordionItem
                  value="credits"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-500 data-[open]:border-l-amber-500"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-amber-600 transition-colors flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-amber-600 transition-colors">
                          How Credits & Scopes Operate
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Credit valuation, deduction timing, and brief approvals
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Credit Valuation</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-[11px]">
                          1 CR = $2.50 listed service value. Credits are deducted only after the studio confirms and approves the final brief.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Scope Tiers</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-[11px]">
                          Basic, Standard, and Elite are distinct alternative scopes. Select one tier per service item.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Included Revisions</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-[11px]">
                          Multi-round revisions apply within the approved direction. Major concept changes adhere to scope rates.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>12-Month Rollover</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-[11px]">
                          Credits remain active for 12 months. Package bonuses offer lower effective USD rates per credit.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion Item 3: Turnaround Timelines & Delivery Formats */}
                <AccordionItem
                  value="turnaround"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-500 data-[open]:border-l-amber-500"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-amber-600 transition-colors flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-amber-600 transition-colors">
                          Turnaround Timelines & Delivery Formats
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          3–5 days standard · 5–7 days video · 10–14 days VTuber
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60">
                          <b className="text-foreground text-xs block mb-1">Standard Assets</b>
                          <span className="text-amber-600 font-bold block mb-1">3–5 Business Days</span>
                          <span className="text-[11px] leading-snug">Logos, emotes, badges, banners, and static screens.</span>
                        </div>
                        <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60">
                          <b className="text-foreground text-xs block mb-1">Motion & Video</b>
                          <span className="text-amber-600 font-bold block mb-1">5–7 Business Days</span>
                          <span className="text-[11px] leading-snug">Animated screens, alerts, video reels, and stingers.</span>
                        </div>
                        <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60">
                          <b className="text-foreground text-xs block mb-1">VTuber & 3D Work</b>
                          <span className="text-amber-600 font-bold block mb-1">10–14 Business Days</span>
                          <span className="text-[11px] leading-snug">Full Live2D model art & rigging with milestone reviews.</span>
                        </div>
                      </div>
                      <p className="pt-1 text-[11px]">
                        • <b>Deliverable Formats:</b> Stream-ready transparent PNGs, 60fps WebM with alpha channels, and full HD/4K MP4s. Standard and Elite scopes include layered master files (PSD, AI, or After Effects project packages).
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion Item 4: Commercial Rights & Terms of Service */}
                <AccordionItem
                  value="terms"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-500 data-[open]:border-l-amber-500"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-amber-600 transition-colors flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-amber-600 transition-colors">
                          Commercial Rights & Terms of Service
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Full commercial license, delivery protocols & client rights
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <ul className="space-y-2.5 text-xs text-foreground/90 leading-relaxed">
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>Full commercial streaming & broadcasting license across all monetized creator channels.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>100% intellectual property ownership of delivered master art, 3D, and video assets upon delivery.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>Strict human-crafted production guarantee with zero unauthorized generative AI replication.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>Encrypted agency cloud project vaults with lifetime asset backup and re-download capability.</span>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Required Acknowledgement Checkbox Card */}
          <Card
            className={cn(
              'rounded-2xl border transition-all cursor-pointer select-none',
              policyAccepted
                ? 'border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/25 shadow-xs'
                : 'border-border/80 bg-card hover:border-amber-500/40 hover:shadow-2xs'
            )}
            onClick={() => setPolicyAccepted(!policyAccepted)}
          >
            <CardContent className="p-5 sm:p-6 flex items-start gap-4">
              <Checkbox
                id="policy-ack"
                checked={policyAccepted}
                onCheckedChange={(checked) => setPolicyAccepted(Boolean(checked))}
                className="mt-0.5 shrink-0"
              />
              <div className="space-y-0.5">
                <Label htmlFor="policy-ack" className="text-sm font-bold text-foreground cursor-pointer block">
                  Required Acknowledgement *
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I understand that credits can only be applied to eligible creative services supported by Humantek Art,
                  and that briefs with non-compliant content may be declined even if sufficient credits are available.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: PROJECT DETAILS & CREATIVE BRIEF                     */}
      {/* ============================================================ */}
      {currentStep === 4 && currentPackage && (
        <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 4/5
              </div>
              <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl">
                Creative Brief & Production Details
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Provide specifications, reference art, and target platform details for your design team.
              </p>
            </div>

            <Badge variant="outline" className="w-fit text-xs font-semibold px-3 py-1 rounded-xl">
              Project ID: {projectId}
            </Badge>
          </div>

          {/* Centered Main Form Card (Compact Layout Skeleton to Minimize Scrolling) */}
          <Card className="rounded-2xl border border-border/80 bg-card shadow-2xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Your Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Your Name <span className="text-amber-600">*</span>
                </Label>
                <Input
                  placeholder="Your full legal or creator name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50"
                />
              </div>

              {/* Channel / Brand Name */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Channel / Brand Name
                </Label>
                <Input
                  placeholder="e.g. KiraOfficial, PixelGamer"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Email Address <span className="text-amber-600">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="creator@channel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50"
                />
              </div>

              {/* Primary Platform */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Primary Platform
                </Label>
                <Select
                  value={platform}
                  onValueChange={(val) => setPlatform(val as string)}
                >
                  <SelectTrigger className="w-full h-9 bg-background/50 rounded-lg text-xs sm:text-sm font-medium">
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Twitch" className="text-xs sm:text-sm">Twitch</SelectItem>
                    <SelectItem value="YouTube" className="text-xs sm:text-sm">YouTube</SelectItem>
                    <SelectItem value="Kick" className="text-xs sm:text-sm">Kick</SelectItem>
                    <SelectItem value="Discord" className="text-xs sm:text-sm">Discord</SelectItem>
                    <SelectItem value="TikTok / Reels" className="text-xs sm:text-sm">TikTok / Reels</SelectItem>
                    <SelectItem value="Multi-Platform" className="text-xs sm:text-sm">Multi-Platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred Art Style */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Preferred Art Style
                </Label>
                <Input
                  placeholder="e.g. Cyberpunk Anime, Chibi, Dark Fantasy, 3D"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50"
                />
              </div>

              {/* Color Palette */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Color Palette / Themes
                </Label>
                <Input
                  placeholder="e.g. #FF007F Neon Pink, Cyan, Deep Slate"
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50"
                />
              </div>

              {/* Instructions Full Width */}
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Creative Brief & Asset Instructions <span className="text-amber-600">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {instructions.length} characters
                  </span>
                </div>
                <Textarea
                  placeholder="Detail exact text, expressions for emotes, character poses, references, and delivery formats..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  className="rounded-lg text-xs sm:text-sm leading-relaxed bg-background/50 py-2 resize-y"
                />
              </div>
            </div>

            {/* Side-by-Side: Reference Art & Promo Voucher (Significant Vertical Space Savings) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              {/* Reference Art & Files Panel */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <b className="text-xs font-bold text-foreground">
                        Reference Art &amp; Files
                      </b>
                    </div>
                    <input
                      ref={fileInputRef}
                      id="reference-file-input"
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      id="reference-upload-button"
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 rounded-lg font-semibold shadow-2xs"
                    >
                      {isUploading ? (
                        <Spinner className="size-3" />
                      ) : (
                        <Upload className="size-3 text-amber-600" />
                      )}
                      Upload
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    Attach PNG, JPG, or WebP references up to 10MB (optional).
                  </p>
                </div>

                {/* Drag & drop zone */}
                <div
                  id="reference-dropzone"
                  role="button"
                  tabIndex={0}
                  aria-label="Drop reference images here or click to browse"
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isDragOver) setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  data-dragging={isDragOver || undefined}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-[11px] text-muted-foreground cursor-pointer outline-none transition-colors hover:border-amber-400/70 hover:bg-amber-50/40 focus-visible:ring-2 focus-visible:ring-amber-500/40 data-[dragging]:border-amber-500 data-[dragging]:bg-amber-50/70 data-[dragging]:text-amber-700 dark:hover:bg-amber-500/5 dark:data-[dragging]:bg-amber-500/10"
                >
                  <ImageIcon className="size-3.5 shrink-0 text-amber-600" />
                  <span>
                    <span className="font-semibold text-foreground">Drag &amp; drop</span>{' '}
                    images here, or click to browse
                  </span>
                </div>

                {(uploadedFiles.length > 0 || uploadingNames.length > 0) && (
                  <AttachmentGroup className="pt-0.5">
                    {uploadedFiles.map((f) => (
                      <Attachment
                        key={f.id}
                        size="xs"
                        className="min-w-0 max-w-[200px] border-border/80 shadow-2xs"
                      >
                        <AttachmentMedia variant="image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url} alt={f.filename} />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle className="text-[11px]">{f.filename}</AttachmentTitle>
                          <AttachmentDescription className="text-[10px]">
                            {f.size >= 1024 * 1024
                              ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
                              : `${Math.max(1, Math.round(f.size / 1024))} KB`}
                          </AttachmentDescription>
                        </AttachmentContent>
                        <AttachmentActions>
                          <AttachmentAction
                            aria-label={`Remove ${f.filename}`}
                            onClick={() => removeUploadedFile(f.id)}
                            className="text-muted-foreground hover:text-rose-600"
                          >
                            <X />
                          </AttachmentAction>
                        </AttachmentActions>
                      </Attachment>
                    ))}
                    {uploadingNames.map((name) => (
                      <Attachment
                        key={`uploading-${name}`}
                        size="xs"
                        state="uploading"
                        className="min-w-0 max-w-[200px] border-border/80 shadow-2xs"
                      >
                        <AttachmentMedia>
                          <Spinner />
                        </AttachmentMedia>
                        <AttachmentContent>
                          <AttachmentTitle className="text-[11px]">{name}</AttachmentTitle>
                          <AttachmentDescription className="text-[10px]">
                            Uploading…
                          </AttachmentDescription>
                        </AttachmentContent>
                      </Attachment>
                    ))}
                  </AttachmentGroup>
                )}
              </div>

              {/* Promo Voucher Panel */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <b className="text-xs font-bold text-foreground">
                      Redeem Promo Voucher
                    </b>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    Have a sponsor or VIP voucher code? Attach it to your order.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <Input
                    placeholder="e.g. HT-VIP-2026"
                    value={redeemCodeInput}
                    onChange={(e) => {
                      setRedeemCodeInput(e.target.value.toUpperCase());
                      setRedeemCodeAttached(false);
                    }}
                    className="h-8 text-xs font-mono rounded-lg bg-card"
                  />
                  <Button
                    type="button"
                    variant={redeemCodeAttached ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => {
                      if (redeemCodeInput.length >= 4) {
                        setRedeemCodeAttached(true);
                        toast.success(`Voucher attached: ${redeemCodeInput}`);
                      } else {
                        toast.error('Please enter a valid code');
                      }
                    }}
                    className="text-xs shrink-0 font-semibold h-8 px-3 rounded-lg"
                  >
                    {redeemCodeAttached ? 'Attached ✓' : 'Attach'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Policy Conflict Alert */}
            {hasPolicyViolation ? (
              <Alert variant="destructive" className="rounded-xl p-3">
                <ShieldAlert className="w-4 h-4" />
                <AlertTitle className="text-xs sm:text-sm font-bold">Policy Restriction Detected</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-0.5">
                  Your brief contains terms prohibited by studio standards (NSFW, occult, unlicensed trademarks).
                  Please adjust your description to proceed.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium py-2 px-3 rounded-lg bg-secondary/20 border border-border/50">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>No policy conflicts detected. Studio team will review upon submission.</span>
              </div>
            )}

            {/* Terms & Conditions Checkbox (Compact and Direct) */}
            <Card
              className={cn(
                'rounded-xl border transition-all cursor-pointer select-none',
                termsAccepted
                  ? 'border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/25 shadow-xs'
                  : 'border-border/80 bg-card hover:border-amber-500/40 hover:shadow-2xs'
              )}
              onClick={() => setTermsAccepted(!termsAccepted)}
            >
              <CardContent className="p-3 sm:p-3.5 flex items-start gap-3">
                <Checkbox
                  id="terms-ack"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                  className="mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="terms-ack" className="text-xs font-bold text-foreground cursor-pointer block">
                    Terms Confirmation *
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    I agree to the Humantek Studio Terms & Conditions, revision policies, and understand
                    that production commences upon scope confirmation and payment verification.
                  </p>
                </div>
              </CardContent>
            </Card>

            {errorMessage && (
              <Alert variant="destructive" className="rounded-xl p-3">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle className="text-xs sm:text-sm font-bold">Error</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-0.5">{errorMessage}</AlertDescription>
              </Alert>
            )}
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 5: REVIEW & CHECKOUT                                    */}
      {/* ============================================================ */}
      {currentStep === 5 && currentPackage && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {submittedProject ? (
            /* Celebration Screen on Success */
            <div className="p-8 sm:p-12 text-center rounded-3xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-b from-card via-card to-emerald-50/40 dark:to-emerald-950/20 shadow-xl max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto mb-2 shadow-sm">
                <PackageCheck className="w-8 h-8" />
              </div>
              <Badge variant="success" className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5">
                Order Logged & Confirmed
              </Badge>
              <h2 className="text-3xl font-black text-foreground">
                Your Creative Project is Active!
              </h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Project Code: <b className="font-mono text-amber-700 dark:text-amber-400 font-bold">{submittedProject.projectCode}</b>.
                Your request has been routed to our agency art director for initial concept briefing.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                <Button
                  variant="default"
                  size="default"
                  className="text-sm font-semibold h-10 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white gap-2 cursor-pointer shadow-md shadow-amber-500/20"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat with Sarah Miller (Lead Producer)
                </Button>
                <Link href="/projects">
                  <Button variant="outline" size="default" className="text-sm font-semibold h-10 px-5">
                    View Project Milestones
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="default"
                  className="text-sm font-semibold h-10 px-4 text-muted-foreground"
                  onClick={() => window.location.reload()}
                >
                  Configure Another
                </Button>
              </div>
            </div>
          ) : (
            /* Order Review and Payment View */
            <>
              {/* Step Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    STEP 5/5
                  </div>
                  <h1 className="scroll-m-20 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl">
                    Final Review & Payment
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Verify your package scope breakdown and finalize with verified PayPal checkout.
                  </p>
                </div>

                <Badge variant="gold" className="text-sm font-mono font-bold px-3.5 py-1.5">
                  TOTAL: ${currentPackage.price.toLocaleString()} USD
                </Badge>
              </div>

              {/* 2-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
                {/* Left Column: Complete Order & Scope Summary */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Package Summary Card */}
                  <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Package Summary
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
                        {currentPackage.group}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/40 border border-border/60 text-center">
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-bold block">Selected Plan</span>
                        <b className="text-xs sm:text-sm text-foreground mt-0.5 block truncate">{currentPackage.name}</b>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-bold block">Package Value</span>
                        <b className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-black mt-0.5 block tabular-nums">
                          ${currentPackage.price.toLocaleString()} USD
                        </b>
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground uppercase font-bold block">Total Credits</span>
                        <div className="mt-0.5 flex items-center justify-center">
                          <CreditValue value={totalPackageCredits} size="sm" />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Configured Assets / Deliverables List */}
                  <Card className="rounded-2xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <CardHeader className="p-4 sm:p-5 pb-2.5 border-b border-border/60 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Configured Deliverables ({selectedEntries.length})
                        </CardTitle>
                      </div>
                      <CreditValue value={usedCredits} size="sm" variant="pill" suffix="CR Used" />
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-3">
                      {selectedEntries.length === 0 ? (
                        <div className="py-6 px-4 text-center rounded-xl bg-secondary/20 border border-dashed border-border/80 space-y-2">
                          <Sparkles className="w-5 h-5 text-amber-600/80 mx-auto" />
                          <b className="text-xs sm:text-sm font-semibold text-foreground block">
                            No specific services pre-allocated
                          </b>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            Your full balance of <b>{totalPackageCredits} Credits</b> will remain active in your studio wallet for 12 months, ready to deploy on any creative request on-demand.
                          </p>
                          <div className="pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => goToStep(2)}
                              className="text-xs font-semibold h-8 rounded-lg cursor-pointer"
                            >
                              ← Select Services in Step 2 (Optional)
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-56">
                          <Table containerClassName="overflow-visible">
                            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-xs z-10 border-b border-border/70 shadow-2xs">
                              <TableRow className="hover:bg-transparent border-b border-border/60">
                                <TableHead className="text-xs font-semibold py-2 bg-card/95">Service</TableHead>
                                <TableHead className="text-xs font-semibold py-2 bg-card/95">Scope</TableHead>
                                <TableHead className="text-xs font-semibold py-2 text-right bg-card/95">Credits</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedEntries.map(({ service, choice, credits }) => (
                                <TableRow key={service.id} className="hover:bg-secondary/30 border-b border-border/40">
                                  <TableCell className="py-2 text-xs font-bold text-foreground">
                                    {service.name}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-muted-foreground">
                                    {service.quoteOnly
                                      ? 'Custom Scope'
                                      : `${TIER_NAMES[choice.level]} × ${choice.quantity}`}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-right">
                                    {service.quoteOnly ? (
                                      <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">TBC</span>
                                    ) : (
                                      <CreditValue value={credits} size="sm" />
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {/* Client & Production Brief Details (Clean Structured Unclipped Display) */}
                  <Card className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Client & Production Brief
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {platform || 'Multi-Platform'}
                        </Badge>
                        <Button
                          id="edit-brief-button"
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() => goToStep(4)}
                          className="h-auto px-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                        >
                          Edit Brief
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-[11px] font-medium text-muted-foreground block">Creator / Client</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {clientName || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-[11px] font-medium text-muted-foreground block">Email Address</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-all">
                          {email || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-[11px] font-medium text-muted-foreground block">Channel / Brand</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {channelName || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-[11px] font-medium text-muted-foreground block">Art Style & Palette</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {style || 'Studio Selected'}{colors ? ` · ${colors}` : ''}
                        </p>
                      </div>
                    </div>

                    {instructions && (
                      <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-muted-foreground">Production Notes & Direction:</span>
                          <span className="text-[10px] text-muted-foreground">Attached to brief</span>
                        </div>
                        <div className="max-h-24 overflow-y-auto pr-1">
                          <p className="text-xs text-foreground/90 italic leading-relaxed whitespace-pre-wrap">
                            &ldquo;{instructions}&rdquo;
                          </p>
                        </div>
                      </div>
                    )}

                    {uploadedFiles.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                        <Upload className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{uploadedFiles.length} reference file(s) attached to brief</span>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Right Column: Checkout & Actions */}
                <div className="lg:col-span-6 space-y-4">
                  <Card className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        Secure Studio Checkout
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Pay with PayPal, credit/debit card, or submit for agency invoice.
                      </p>
                    </div>

                    {/* Order Line-Item Breakdown */}
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>{currentPackage.name} Base Package</span>
                        <span className="font-semibold text-foreground">${currentPackage.price.toLocaleString()} USD</span>
                      </div>
                      {priorityPassEnabled && (
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
                          <span>Priority Production Pass (+50 CR Bonus)</span>
                          <span>Included</span>
                        </div>
                      )}
                      {redeemCodeAttached && (
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Voucher Applied: {redeemCodeInput}</span>
                          <span>Active</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                        <span>Total Due</span>
                        <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">
                          ${currentPackage.price.toLocaleString()} USD
                        </span>
                      </div>
                    </div>

                    {/* PayPal Payment Action */}
                    <div className="space-y-3">
                      <PayPalButtonWrapper
                        packageId={currentPackage.id}
                        packagePrice={currentPackage.price}
                        projectPayload={{
                          projectId,
                          packageId: currentPackage.id,
                          selections: selectedEntries.map((e) => ({
                            id: e.service.id,
                            name: e.service.name,
                            level: e.choice.level,
                            quantity: e.choice.quantity,
                            credits: e.credits,
                          })),
                          additions,
                          clientName,
                          channelName,
                          email,
                          platform,
                          style,
                          colors,
                          instructions,
                          redeemCode: redeemCodeAttached ? redeemCodeInput : '',
                          uploadedFiles,
                        }}
                        onSuccess={(proj) => {
                          setSubmittedProject(proj);
                          toast.success('Payment verified! Project created.');
                        }}
                        onError={(err) => {
                          setErrorMessage(err);
                          toast.error(err);
                        }}
                      />
                    </div>

                    {/* Fallback Review Submission (Alternative Path - Softened Hierarchy) */}
                    <div className="pt-2 border-t border-border/60 text-center space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        Need sponsor or agency PO approval before payment?
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={handleSubmitForReview}
                        className="w-full text-xs font-semibold rounded-xl cursor-pointer h-9 hover:bg-secondary/60 text-muted-foreground hover:text-foreground border-border/80"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Submitting...
                          </>
                        ) : (
                          'Submit Brief for Manual Agency Review'
                        )}
                      </Button>
                    </div>

                    {/* Direct Producer Chat Trigger */}
                    <div className="pt-1.5 text-center">
                      <Button
                        id="chat-with-producer-button"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setChatOpen(true)}
                        className="h-auto py-1 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-secondary/40 whitespace-normal"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                        <span>Have questions about this brief? Chat with Studio Producer →</span>
                      </Button>
                    </div>

                    {/* Security & SLA Badges */}
                    <div className="pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" /> 256-Bit SSL
                      </span>
                      <span>PayPal Protection</span>
                      <span>Verified Studio SLA</span>
                    </div>

                    {errorMessage && (
                      <Alert variant="destructive" className="rounded-xl p-3">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertTitle className="text-xs sm:text-sm font-bold">Checkout Error</AlertTitle>
                        <AlertDescription className="text-xs mt-0.5 leading-relaxed">{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </StudioCardLayout>
  );
}
