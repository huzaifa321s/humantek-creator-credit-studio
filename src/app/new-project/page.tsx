'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PACKAGES,
  SERVICES,
  TIER_NAMES,
  DEFAULT_SCOPE_DETAILS,
  ADDITIONS_PRICING,
  RESTRICTED_GUIDELINES,
  REVISION_RULES,
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
import { useStepFocus, getStepAnnouncement } from '@/hooks/useStepNavigation';
import { useUnsavedChangesWarning, bypassUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { ScopeGuideModal } from '@/components/ScopeGuideModal';
import { StudioNoticeBanner } from '@/components/StudioNoticeBanner';
import { ServiceCategoryTabs } from '@/components/ServiceCategoryTabs';
import { CartSidebar } from '@/components/CartSidebar';
import { ServiceImageHoverCard } from '@/components/ServiceImageHoverCard';
import { PayPalButtonWrapper, type ClientCapturedPayment } from '@/components/PayPalButtonWrapper';
import { isPayPalClientConfigured } from '@/lib/paypal-config';
import { AuthModal } from '@/components/auth/AuthModal';
import { ClientOnly } from '@/components/ClientOnly';
import { FieldError } from '@/components/ui/field-error';
import { useBriefValidation, briefFieldId } from '@/lib/hooks/useBriefValidation';
import { BRIEF_LIMITS, PLATFORM_OPTIONS, REFERENCE_LIMITS } from '@/lib/validation';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
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
import { Skeleton } from '@/components/ui/skeleton';
import { UploadedAttachmentList } from '@/components/ui/reference-image-grid';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
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
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger, TabsBadge } from '@/components/ui/tabs';
import { IconTile } from '@/components/reui/icon-tile';
import { ColorPaletteInput, extractHexColors } from '@/components/reui/color-picker';
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
  getConfirmationState,
  type ConfirmationPaymentState,
} from '@/app/new-project/confirmation/[projectId]/ConfirmationContent';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Upload,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ShieldAlert,
  Check,
  Copy,
  X,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  PackageCheck,
  FolderKanban,
  Trash2,
  Lock,
  RotateCcw,
  RefreshCw,
  Clock,
  Coins,
  FileCheck,
  Plus,
  Info,
  Layers,
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
  Tv,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { useChatStore, GLOBAL_CHAT_ID } from '@/lib/chatStore';
import { ChatGate } from '@/components/chat/ChatGate';
import { useUserStore, refreshUserSession } from '@/lib/userStore';
import { useWalletQuery } from '@/lib/queries/wallet';
import { useCreateProject } from '@/lib/queries/projects';
import { STUDIO_WALLET_PACKAGE } from '@/lib/pricing';
import { useWizardStore } from '@/lib/wizardStore';
import { useNotificationStore } from '@/lib/notificationStore';

/** Same headings the confirmation page shows, so the hand-off reads as one continuous step. */
const OVERLAY_HEADINGS: Record<ConfirmationPaymentState, string> = {
  paid_credits: 'Project started',
  online_completed: 'Payment received',
  online_pending: 'Payment processing',
  manual_order: 'Order received',
};

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
    default:
      switch (category) {
        case 'Branding':
          return PenTool;
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
          return Layers;
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

const CORE_RESTRICTED_ITEMS = RESTRICTED_GUIDELINES.slice(0, 6);

type PriceFilterType = (typeof PRICE_FILTER_OPTIONS)[number]['id'];

/**
 * Client-side image compression:
 * Scales oversized images down to max 2048px and converts to WebP (quality 0.85).
 * Falls back safely to original file if unsupported or if original is already smaller.
 */
async function compressImageForUpload(file: File): Promise<File> {
  if (typeof window === 'undefined' || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return file;
  }
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX_DIM = 2048;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^.]+$/, '') + '.webp';
            const compressed = new File([blob], cleanName, { type: 'image/webp' });
            resolve(compressed);
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  });
}

export default function CreatorStudioPage() {
  // User store & TanStack Query synchronized server state
  const { user, isHydrated, addCredits, deductCredits, signOut } = useUserStore();
  const userBalance = user?.walletBalance ?? 0;
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const router = useRouter();

  const handleSwitchAccount = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    signOut();
    setShowAuthModal(true);
  };
  const walletQuery = useWalletQuery(userEmail);
  const isWalletLoading = !isHydrated || walletQuery.isPending;
  const createProjectMutation = useCreateProject();

  // Place 4: Wizard Zustand Store (Global Wizard & Cart State)
  const wizard = useWizardStore();
  const {
    projectId,
    currentStep,
    selectedPackageId,
    fundingSource,
    applyWalletCredits,
    activeCategory,
    priceFilter,
    selections,
    additions,
    policyAccepted,
    openPolicyAccordion,
    showAllRestricted,
    termsAccepted,
    isTermsExpanded,
    brief: wizardBrief,
    uploadedFiles,
    isSubmitting,
    errorMessage,
    submittedProject,
    setStep: setCurrentStep,
    setSelectedPackageId,
    setFundingSource,
    setApplyWalletCredits,
    setActiveCategory,
    setPriceFilter,
    setSelections,
    setAdditions,
    setPolicyAccepted,
    setOpenPolicyAccordion,
    setShowAllRestricted,
    setTermsAccepted,
    setIsTermsExpanded,
    setUploadedFiles,
    setIsSubmitting,
    setErrorMessage,
    setSubmittedProject,
    resetWizard,
  } = wizard;

  // Brief fields & ergonomic setters mapped to wizardStore
  const { channelName, platform, style, colors, instructions } = wizardBrief;

  const setChannelName = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('channelName', typeof val === 'function' ? val(wizardBrief.channelName) : val);
  };
  const setPlatform = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('platform', typeof val === 'function' ? val(wizardBrief.platform) : val);
  };
  const setStyle = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('style', typeof val === 'function' ? val(wizardBrief.style) : val);
  };
  const setColors = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('colors', typeof val === 'function' ? val(wizardBrief.colors) : val);
  };
  const setInstructions = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('instructions', typeof val === 'function' ? val(wizardBrief.instructions) : val);
  };

  // Auth gate modal for guest review step
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Upload transient DOM interaction state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mobileScopeOpen, setMobileScopeOpen] = useState(false);
  const [deliverablesExpandedMobile, setDeliverablesExpandedMobile] = useState(false);
  const [briefExpandedMobile, setBriefExpandedMobile] = useState(false);
  const [costBreakdownExpandedMobile, setCostBreakdownExpandedMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submittedProjectId, setSubmittedProjectId] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<{ message: string; showProjectsLink?: boolean } | null>(null);
  const [serviceSelectionError, setServiceSelectionError] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [isNavigatingToConfirmation, setIsNavigatingToConfirmation] = useState(false);
  const [confirmationState, setConfirmationState] = useState<ConfirmationPaymentState>('online_completed');
  const confirmationIsPending = confirmationState === 'online_pending' || confirmationState === 'manual_order';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ensure deterministic, client-only generation of projectId if not yet assigned
  useEffect(() => {
    if (mounted && !projectId) {
      wizard.generateNewProjectId();
    }
  }, [mounted, projectId, wizard]);

  // Prefetch confirmation route so assets, chunks, and skeletons are ready instantly
  useEffect(() => {
    if (projectId && currentStep >= 4) {
      router.prefetch(`/new-project/confirmation/${projectId}`);
    }
  }, [projectId, currentStep, router]);

  // Step focus & accessibility navigation hook (scrolls to top on step or confirmation change)
  const headingRef = useStepFocus(currentStep, Boolean(submittedProject));

  // Track if user has active unsaved draft progress
  const hasUnsavedProgress = useMemo(() => {
    if (submittedProject || submittedProjectId) return false;
    return Boolean(
      selectedPackageId ||
      Object.keys(selections).length > 0 ||
      channelName.trim() ||
      instructions.trim() ||
      uploadedFiles.length > 0
    );
  }, [submittedProject, submittedProjectId, selectedPackageId, selections, channelName, instructions, uploadedFiles.length]);

  // Standard production browser exit guard ("Leave site? Changes you made may not be saved.")
  useUnsavedChangesWarning(hasUnsavedProgress);

  const isStepMountedRef = useRef(false);
  const hasRestoredToastShownRef = useRef(false);

  // 1. Initial URL Step Synchronization & Prerequisite Guard on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ensure wizard store is rehydrated from localStorage
    if (!useWizardStore.persist.hasHydrated()) {
      void useWizardStore.persist.rehydrate();
    }

    // Quiet restoration feedback toast: show only once when an existing draft is restored
    if (!hasRestoredToastShownRef.current) {
      try {
        const stored = localStorage.getItem('humantek_wizard_cart');
        if (stored) {
          const parsed = JSON.parse(stored);
          const state = parsed?.state;
          const hasExistingDraft = Boolean(
            state?.selectedPackageId ||
            (state?.selections && Object.keys(state.selections).length > 0) ||
            state?.brief?.channelName?.trim() ||
            state?.brief?.instructions?.trim()
          );
          if (hasExistingDraft) {
            hasRestoredToastShownRef.current = true;
            toast.info('Restored your draft from earlier session', { duration: 3000 });
          }
        }
      } catch {}
    }

    const url = new URL(window.location.href);
    const stepParam = url.searchParams.get('step');
    let parsedStep = stepParam ? parseInt(stepParam, 10) : null;

    if (!parsedStep || isNaN(parsedStep)) {
      try {
        const stored = localStorage.getItem('humantek_wizard_cart');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.state?.currentStep) {
            parsedStep = parsed.state.currentStep;
          }
        }
      } catch {}
    }

    if (submittedProjectId) {
      // Post-submission in flight: skip URL sync and bounce guards completely
      return;
    }

    if (parsedStep && !isNaN(parsedStep)) {
      const clamped = Math.max(1, Math.min(5, parsedStep));
      // Prerequisite: if target step > 1 and no package/wallet selected, bounce to step 1
      let savedPkg = useWizardStore.getState().selectedPackageId;
      let savedFunding = useWizardStore.getState().fundingSource;
      if (!savedPkg) {
        try {
          const stored = localStorage.getItem('humantek_wizard_cart');
          if (stored) {
            const parsed = JSON.parse(stored);
            savedPkg = parsed?.state?.selectedPackageId;
            savedFunding = parsed?.state?.fundingSource || savedFunding;
          }
        } catch {}
      }
      let savedSelections = useWizardStore.getState().selections;
      if (!savedSelections || Object.keys(savedSelections).length === 0) {
        try {
          const stored = localStorage.getItem('humantek_wizard_cart');
          if (stored) {
            const parsed = JSON.parse(stored);
            savedSelections = parsed?.state?.selections || savedSelections;
          }
        } catch {}
      }
      const hasPkg = Boolean(savedPkg || savedFunding === 'wallet');
      const isCartEmpty = !hasPkg;

      // Empty-cart rule: If someone opens ?step=5 with an empty cart, redirect to /projects
      if (clamped === 5 && isCartEmpty && !submittedProjectId) {
        router.replace('/projects');
        return;
      }

      if (clamped > 1 && !hasPkg && !submittedProjectId) {
        setCurrentStep(1);
        url.searchParams.set('step', '1');
        window.history.replaceState({}, '', url.pathname + url.search);
        return;
      }

      if (savedPkg && !useWizardStore.getState().selectedPackageId) {
        setSelectedPackageId(savedPkg);
      }
      if (savedFunding && useWizardStore.getState().fundingSource !== savedFunding) {
        setFundingSource(savedFunding as any);
      }

      let activeUserEmail = user?.email || useUserStore.getState().user?.email;
      if (!activeUserEmail) {
        try {
          const storedUser = localStorage.getItem('humantek_studio_user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            activeUserEmail = parsed?.state?.user?.email;
            if (activeUserEmail && !useUserStore.getState().user) {
              useUserStore.setState({ user: parsed.state.user, isHydrated: true });
            }
          }
        } catch {}
      }

      // Prerequisite: if target is step 5 and user is unauthenticated, place on step 4 and open auth modal/drawer
      if (clamped === 5 && !activeUserEmail) {
        setCurrentStep(4);
        url.searchParams.set('step', '4');
        window.history.replaceState({}, '', url.pathname + url.search);
        setShowAuthModal(true);
        return;
      }

      setCurrentStep(clamped);
      url.searchParams.set('step', String(clamped));
      window.history.replaceState({}, '', url.pathname + url.search);
    } else {
      url.searchParams.set('step', String(currentStep));
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    return () => {
      isStepMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Keep URL searchParam synchronized when currentStep changes (only after initial mount sync)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isStepMountedRef.current) {
      isStepMountedRef.current = true;
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('step') !== String(currentStep)) {
      url.searchParams.set('step', String(currentStep));
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [currentStep]);

  // Guard: If currentStep is 5 and there is no package selected (empty cart), redirect to /projects
  useEffect(() => {
    if (!isStepMountedRef.current) return;
    if (currentStep === 5 && !selectedPackageId && fundingSource !== 'wallet' && !submittedProjectId) {
      router.replace('/projects');
    }
  }, [currentStep, selectedPackageId, fundingSource, submittedProjectId, router]);


  // Derived package & credit calculations
  const isWalletFunding = selectedPackageId === 'studio-wallet' || fundingSource === 'wallet';
  const isPackageSelected = Boolean(selectedPackageId && selectedPackageId !== 'studio-wallet');
  const effectiveApplyWallet = applyWalletCredits && userBalance > 0 && isPackageSelected;
  const appliedWalletCredits = isWalletFunding ? userBalance : (effectiveApplyWallet ? userBalance : 0);

  // Step 1 2-Tab Mode Switcher state ('wallet' | 'packages')
  const [step1TabMode, setStep1TabMode] = useState<'wallet' | 'packages'>(() =>
    selectedPackageId && selectedPackageId !== 'studio-wallet' ? 'packages' : 'wallet'
  );
  const hasAutoSelectedWalletRef = useRef(false);

  // Default to Tab 1 ("Use My Existing Credits") when returning client has userBalance > 0 and hasn't explicitly picked a paid package
  useEffect(() => {
    if (!mounted || isWalletLoading || userBalance <= 0) return;
    if (hasAutoSelectedWalletRef.current) return;
    hasAutoSelectedWalletRef.current = true;

    const currentPkgId = useWizardStore.getState().selectedPackageId;
    if (!currentPkgId || currentPkgId === 'studio-wallet') {
      setStep1TabMode('wallet');
      setFundingSource('wallet');
      setSelectedPackageId('studio-wallet');
    } else {
      setStep1TabMode('packages');
    }
  }, [mounted, isWalletLoading, userBalance, setFundingSource, setSelectedPackageId]);

  // Keep step1TabMode synced if user switches funding mode from Step 2 ("Switch Funding Mode")
  useEffect(() => {
    if (selectedPackageId === 'studio-wallet' || fundingSource === 'wallet') {
      setStep1TabMode('wallet');
    } else if (selectedPackageId) {
      setStep1TabMode('packages');
    }
  }, [selectedPackageId, fundingSource]);

  const currentPackage = useMemo(() => {
    if (isWalletFunding) {
      return {
        ...STUDIO_WALLET_PACKAGE,
        credits: userBalance,
      };
    }
    return PACKAGES.find((p) => p.id === selectedPackageId);
  }, [isWalletFunding, selectedPackageId, userBalance]);

  const selectedEntries: SelectedServiceEntry[] = Object.entries(selections).flatMap(
    ([serviceId, choice]) => {
      const s = SERVICES.find((item) => item.id === serviceId);
      if (!s) return [];
      const cost = s.quoteOnly ? 0 : s.prices[choice.level] * choice.quantity;
      return [{ service: s, choice, credits: cost }];
    }
  );

  useEffect(() => {
    if (selectedEntries.length > 0 && serviceSelectionError) {
      setServiceSelectionError(false);
    }
  }, [selectedEntries.length, serviceSelectionError]);

  const servicesCredits = selectedEntries.reduce((sum, item) => sum + item.credits, 0);
  const additionsCredits = additions.reduce(
    (sum, extra) => sum + (ADDITIONS_PRICING[extra] || 0),
    0
  );
  const usedCredits = servicesCredits + additionsCredits;

  const totalUsableCredits = useMemo(() => {
    if (!currentPackage) return 0;
    if (isWalletFunding) return userBalance;
    return currentPackage.credits + (effectiveApplyWallet ? userBalance : 0);
  }, [currentPackage, isWalletFunding, userBalance, effectiveApplyWallet]);

  const totalPackageCredits = totalUsableCredits;
  const remainingCredits = totalUsableCredits - usedCredits;

  const standardUnits = selectedEntries
    .filter((e) => e.choice.level === 1)
    .reduce((sum, e) => sum + e.choice.quantity, 0);

  const eliteUnits = selectedEntries
    .filter((e) => e.choice.level === 2)
    .reduce((sum, e) => sum + e.choice.quantity, 0);

  // Tier limit violations
  const isTierRestricted = Boolean(
    !isWalletFunding &&
    currentPackage &&
    ((currentPackage.standardLimit !== undefined && standardUnits > currentPackage.standardLimit) ||
      (currentPackage.eliteLimit !== undefined && eliteUnits > currentPackage.eliteLimit))
  );

  // Prohibited words check
  const hasPolicyViolation = PROHIBITED_REGEX.test(instructions);

  // Step 4 brief — validated with the same Zod schema the API enforces
  const brief = useBriefValidation({
    channelName,
    platform,
    style,
    colors,
    instructions,
  });

  // Form validity for steps
  const isStep1Valid = isWalletFunding ? userBalance > 0 : Boolean(selectedPackageId);
  const isStep2Valid = selectedEntries.length > 0 && remainingCredits >= 0 && !isTierRestricted;
  const isStep3Valid = policyAccepted;
  const isStep4Valid = brief.isValid && termsAccepted;

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
    setFundingSource(userBalance > 0 && applyWalletCredits ? 'hybrid' : 'package');
    toast.success('Selected package to expand your credit budget');
  };

  // Navigation handlers
  const goToStep = (step: number) => {
    const target = Math.max(1, Math.min(5, step));

    // Moving forward requires every step in between to be valid.
    if (target > currentStep) {
      const validity = [isStep1Valid, isStep2Valid, isStep3Valid, isStep4Valid];
      for (let s = currentStep; s < target; s++) {
        if (validity[s - 1]) continue;

        if (s === 1) {
          toast.error('Please choose a package or use your Studio Wallet balance to continue.');
        } else if (s === 2) {
          if (selectedEntries.length === 0) {
            setServiceSelectionError(true);
            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
            const targetEl = isDesktop
              ? document.getElementById('no-services-sidebar-card')
              : document.getElementById('step2-inline-error') || document.getElementById('catalog-services-container');
            targetEl?.scrollIntoView({ behavior: 'smooth', block: isDesktop ? 'nearest' : 'start' });
            return;
          } else if (remainingCredits < 0) {
            toast.error(
              isWalletFunding
                ? `Studio Wallet balance exceeded by ${Math.abs(remainingCredits)} CR. Adjust your scope or select a package.`
                : `Credit budget exceeded by ${Math.abs(remainingCredits)} CR. Adjust your scope or upgrade package.`
            );
          } else if (isTierRestricted) {
            if (currentPackage?.standardLimit !== undefined && standardUnits > currentPackage.standardLimit) {
              toast.error(
                `Standard tier limit reached (${standardUnits}/${currentPackage.standardLimit} units). Upgrade your package to add more.`
              );
            } else if (currentPackage?.eliteLimit !== undefined && eliteUnits > currentPackage.eliteLimit) {
              toast.error(
                `Elite tier limit reached (${eliteUnits}/${currentPackage.eliteLimit} units). Upgrade your package to add more.`
              );
            } else {
              toast.error('Tier unit limit reached for this package. Adjust your services or upgrade package.');
            }
          } else {
            toast.error('Adjust your services — check your credit budget and tier limits.');
          }
        } else if (s === 3) {
          setPolicyError(true);
          const el = document.getElementById('policy-ack') || document.getElementById('policy-ack-card');
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.focus({ preventScroll: true });
        } else if (s === 4) {
          if (!brief.validateAll()) {
            toast.error(
              brief.errorCount === 1
                ? 'Please complete the highlighted mandatory field.'
                : `Please complete all ${brief.errorCount} highlighted mandatory fields.`
            );
          } else if (!termsAccepted) {
            setTermsError(true);
            const el = document.getElementById('terms-ack') || document.getElementById('terms-ack-card');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus({ preventScroll: true });
            toast.error('Please accept the Terms & Conditions to proceed.');
          }
        }
        return;
      }
    }

    const activeAuthEmail = user?.email || useUserStore.getState().user?.email;
    if (target === 5 && !activeAuthEmail) {
      authModalIntentRef.current = 'checkout';
      setShowAuthModal(true);
      return;
    }

    setCurrentStep(target);
  };

  const authModalIntentRef = useRef<'checkout' | 'upload'>('checkout');

  const handleSelectWallet = () => {
    setStep1TabMode('wallet');
    setFundingSource('wallet');
    setSelectedPackageId('studio-wallet');
    setPriceFilter('all');
  };

  const handleSelectPackage = (packageId: string) => {
    setStep1TabMode('packages');
    setSelectedPackageId(packageId);
    setFundingSource(userBalance > 0 && applyWalletCredits ? 'hybrid' : 'package');
    setPriceFilter('all');
  };

  const handleSwitchStep1Tab = (mode: 'wallet' | 'packages') => {
    setStep1TabMode(mode);
    if (mode === 'wallet') {
      setFundingSource('wallet');
      setSelectedPackageId('studio-wallet');
      setPriceFilter('all');
    } else {
      // Switching to Buy a Package tab: ensure applyWalletCredits is enabled by default if balance > 0, and pre-select Studio Momentum if none chosen yet
      if (userBalance > 0) {
        setApplyWalletCredits(true);
      }
      const nextPkgId =
        selectedPackageId && selectedPackageId !== 'studio-wallet'
          ? selectedPackageId
          : 'studio-momentum';
      setSelectedPackageId(nextPkgId);
      setFundingSource(userBalance > 0 ? 'hybrid' : 'package');
      setPriceFilter('all');
    }
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

  const handleClearAllSelections = () => {
    setSelections({});
    toast.info('Cleared all service selections');
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
    if (!incoming.length) return;
    if (!projectId) {
      toast.error('Your draft is still loading. Please try again in a moment.');
      return;
    }

    const currentUser = useUserStore.getState().user;
    if (!currentUser) {
      toast.error('Please sign in to upload reference images, or paste reference links in your brief instructions.');
      authModalIntentRef.current = 'upload';
      setShowAuthModal(true);
      return;
    }
    if (!currentUser.emailVerified) {
      toast.error('Please verify your email address to upload reference images.');
      return;
    }

    const allowed = REFERENCE_LIMITS.allowedTypes as readonly string[];
    const maxMb = REFERENCE_LIMITS.maxFileBytes / (1024 * 1024);
    const accepted: File[] = [];
    let slots = REFERENCE_LIMITS.maxFiles - uploadedFiles.length;
    let totalBytes = uploadedFiles.reduce((sum, f) => sum + (f.size || 0), 0);

    for (const rawFile of incoming) {
      if (rawFile.type === 'image/svg+xml' || rawFile.name.toLowerCase().endsWith('.svg')) {
        toast.error(`${rawFile.name}: SVG vector files cannot be uploaded as references. Please use PNG, JPG or WebP.`);
        continue;
      }

      // Compress and resize raster images before preparing upload
      const file = await compressImageForUpload(rawFile);

      if (!allowed.includes(file.type)) {
        toast.error(`${file.name}: only PNG, JPG or WebP images are allowed`);
        continue;
      }
      if (file.size === 0 || file.size > REFERENCE_LIMITS.maxFileBytes) {
        toast.error(`${file.name}: images must be ${maxMb} MB or smaller`);
        continue;
      }
      if (slots <= 0) {
        toast.error(`You can attach up to ${REFERENCE_LIMITS.maxFiles} reference images`);
        break;
      }
      if (totalBytes + file.size > REFERENCE_LIMITS.maxTotalBytes) {
        toast.error(`Reference images can total up to ${REFERENCE_LIMITS.maxTotalBytes / (1024 * 1024)} MB`);
        break;
      }
      accepted.push(file);
      slots--;
      totalBytes += file.size;
    }
    if (!accepted.length) return;

    setIsUploading(true);
    setErrorMessage('');
    const storage = createBrowserSupabaseClient().storage.from(REFERENCE_LIMITS.bucket);

    for (const file of accepted) {
      setUploadingNames((prev) => [...prev, file.name]);
      try {
        // 1. Server validates limits and issues a 2-hour signed upload URL.
        const res = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, filename: file.name, size: file.size, mimeType: file.type }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not prepare the upload');

        // 2. Browser uploads straight to Supabase Storage (bypasses the app server).
        const { error: uploadErr } = await storage.uploadToSignedUrl(data.upload.storagePath, data.upload.token, file, {
          contentType: file.type,
        });
        if (uploadErr) throw new Error(uploadErr.message || 'Upload failed');

        // 3. Draft keeps only metadata + a local preview (never the image bytes).
        setUploadedFiles((prev) => [
          ...prev,
          {
            id: data.file.id,
            filename: data.file.filename,
            size: data.file.size,
            mimeType: data.file.mimeType,
            storagePath: data.file.storagePath,
            url: URL.createObjectURL(file),
          },
        ]);
        toast.success(`Uploaded ${file.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        toast.error(`${file.name}: ${msg}`);
        if (/limit|up to|already submitted/i.test(msg)) break;
      } finally {
        setUploadingNames((prev) => prev.filter((n) => n !== file.name));
      }
    }

    setUploadingNames([]);
    setIsUploading(false);
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

  const removeUploadedFile = async (fileId: string) => {
    const file = uploadedFiles.find((f) => f.id === fileId);
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (file?.url?.startsWith('blob:')) URL.revokeObjectURL(file.url);

    if (file?.storagePath && projectId) {
      try {
        const res = await fetch('/api/uploads', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, storagePath: file.storagePath }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // The draft no longer references it, so it won't be attached; the daily cleanup removes leftovers.
        console.warn('Could not delete reference image from storage:', file.storagePath);
      }
    }
    toast.info('Removed reference image');
  };

  // Blob previews die on reload: once per draft, refresh the previews of files
  // restored from the saved draft with fresh signed URLs.
  const refreshedPreviewsFor = useRef<string | null>(null);
  useEffect(() => {
    if (!wizard.isHydrated || !projectId || submittedProject) return;
    if (refreshedPreviewsFor.current === projectId) return;
    refreshedPreviewsFor.current = projectId; // decide once, even if there is nothing to restore

    // Restored entries have no preview URL (the store persists metadata only).
    const restored = uploadedFiles.filter((f) => !f.url);
    if (restored.length === 0) return;
    const restoredIds = new Set(restored.map((f) => f.id));

    void (async () => {
      try {
        const res = await fetch(`/api/uploads?projectId=${encodeURIComponent(projectId)}`);
        if (!res.ok) return;
        const { files } = (await res.json()) as { files: UploadedFile[] };
        const byPath = new Map(files.map((f) => [f.storagePath, f]));
        setUploadedFiles((prev) =>
          prev
            // Only judge files that were restored; anything uploaded meanwhile is kept as-is.
            // Restored entries missing from storage (incl. legacy stub uploads) are dropped.
            .filter((f) => !restoredIds.has(f.id) || (f.storagePath && byPath.has(f.storagePath)))
            .map((f) =>
              restoredIds.has(f.id) && f.storagePath
                ? { ...f, url: byPath.get(f.storagePath)?.url || f.url }
                : f
            )
        );
      } catch {
        // Previews are cosmetic; submission re-verifies files server-side.
      }
    })();
  }, [wizard.isHydrated, projectId, submittedProject, uploadedFiles, setUploadedFiles]);

  const completeCheckout = async (project: ProjectRecord | null) => {
    // 1. Validate response has a project id
    if (!project || !project.id) {
      console.error('[Checkout] Submission response missing project id:', project);
      const err = {
        message: 'Your order was received, but we could not confirm the project ID. Your draft is preserved.',
        showProjectsLink: true,
      };
      setSubmissionError(err);
      toast.error('Project verification incomplete. Your draft has been kept safe.');
      setIsSubmitting(false);
      return;
    }

    // 2. Set submittedProjectId and activate immediate transition state
    setSubmittedProjectId(project.id);
    setConfirmationState(getConfirmationState(project));
    setIsNavigatingToConfirmation(true);

    // 3. Synchronize server session and register project in client stores
    void refreshUserSession();
    useChatStore.getState().registerProject({
      id: project.id,
      projectCode: project.projectCode,
      packageName: project.packageName,
      clientName: project.clientName,
      status: project.status,
      price: project.packagePrice,
      credits: project.packageCredits,
    });
    const formattedCode = project.projectCode?.startsWith('HT-')
      ? project.projectCode
      : `HT-${project.projectCode}`;
    const isPaidCheckout =
      project.paymentStatus === 'paid' ||
      Boolean(project.instructions?.includes('[PAYMENT RECEIVED via PayPal]'));
    useNotificationStore.getState().addNotification({
      title: isPaidCheckout ? 'Project Launched' : 'Project Submitted for Review',
      description: `Project ${formattedCode} (${project.packageName}) is now in our studio system.`,
      iconType: isPaidCheckout ? 'check' : 'sparkles',
      link: `/new-project/confirmation/${project.id}`,
    });

    // 4. Navigate using router.replace to the dedicated confirmation route
    // Note: Wizard draft is cleared ONLY by ConfirmationContent after it loads
    try {
      await router.replace(`/new-project/confirmation/${project.id}`);
    } catch (navErr) {
      console.error('[Checkout] Navigation to confirmation failed:', navErr);
      setIsNavigatingToConfirmation(false);
      setIsSubmitting(false);
      setSubmissionError({
        message: 'Order created successfully! Click below to view your project in My Projects.',
        showProjectsLink: true,
      });
    }
  };

  const handleSubmitForReview = () => submitProjectBrief();

  /**
   * Client-id-only PayPal checkout: the browser captured the payment, so register the brief for
   * studio review with the PayPal transaction attached. The studio verifies it in PayPal and
   * marks the project paid.
   */
  const handleClientCapturedPayment = (payment: ClientCapturedPayment) => {
    bypassUnsavedChangesWarning(true);
    toast.success('Thank you for your payment!', { description: 'Payment Successful' });
    const paymentNote = [
      '[PAYMENT RECEIVED via PayPal]',
      `Amount: $${payment.amount} USD`,
      `PayPal Order ID: ${payment.orderId}`,
      payment.captureId ? `Capture ID: ${payment.captureId}` : '',
      `Status: ${payment.status}`,
      payment.payerEmail ? `Payer: ${payment.payerEmail}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    void submitProjectBrief(paymentNote);
  };

  const submitProjectBrief = async (paymentNote?: string) => {
    if (!user?.email) {
      setShowAuthModal(true);
      return;
    }
    if (!currentPackage || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSubmissionError(null);

    try {
      const data = await createProjectMutation.mutateAsync({
        projectId,
        packageId: isWalletFunding ? 'studio-wallet' : currentPackage.id,
        fundingSource: isWalletFunding ? 'wallet' : (appliedWalletCredits > 0 ? 'hybrid' : 'package'),
        walletBalance: userBalance,
        applyWalletCredits: effectiveApplyWallet,
        appliedWalletCredits,
        selections: selectedEntries.map((e) => ({
          id: e.service.id,
          name: e.service.name,
          level: e.choice.level,
          quantity: e.choice.quantity,
          credits: e.credits,
        })),
        additions,
        channelName,
        platform,
        style,
        colors,
        instructions: paymentNote
          ? `${paymentNote}\n\n${instructions}`.slice(0, BRIEF_LIMITS.instructions.max)
          : instructions,
        uploadedFiles,
        paymentStatus: 'unpaid',
        status: 'pending_review',
      });

      await completeCheckout(data?.project ?? null);
    } catch (err: unknown) {
      let msg = err instanceof Error ? err.message : 'Submission failed';
      if (msg.includes('Authentication required') || msg.includes('401')) {
        msg = 'Please sign in to submit your project brief for studio review.';
      }
      if (paymentNote) {
        msg = `Your payment was received, but we couldn't register the brief (${msg}). Please contact us with these details: ${paymentNote}`;
      }
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  const handleLaunchWithWallet = async () => {
    if (!currentPackage || isSubmitting) return;
    if (userBalance < usedCredits) {
      toast.error(`Insufficient credits. You need ${usedCredits} CR but only have ${userBalance} CR.`);
      return;
    }
    bypassUnsavedChangesWarning(true);
    setIsSubmitting(true);
    setErrorMessage('');
    setSubmissionError(null);

    try {
      const data = await createProjectMutation.mutateAsync({
        projectId,
        packageId: 'studio-wallet',
        fundingSource: 'wallet',
        walletBalance: userBalance,
        selections: selectedEntries.map((e) => ({
          id: e.service.id,
          name: e.service.name,
          level: e.choice.level,
          quantity: e.choice.quantity,
          credits: e.credits,
        })),
        additions,
        channelName,
        platform,
        style,
        colors,
        instructions,
        uploadedFiles,
      });

      if (data?.project && typeof data.newWalletBalance === 'number') {
        useUserStore.getState().updateUser({
          walletBalance: data.newWalletBalance,
        });
      } else if (data?.project) {
        deductCredits(usedCredits, `Launched project ${data.project.projectCode}`);
      }

      await completeCheckout(data?.project ?? null);
    } catch (err: unknown) {
      bypassUnsavedChangesWarning(false);
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  // Global action to reset selections and start fresh from Step 1
  const handleResetDraft = () => {
    resetWizard();
    setCurrentStep(1);
    const url = new URL(window.location.href);
    url.searchParams.set('step', '1');
    window.history.replaceState({}, '', url.pathname + url.search);
    toast.success('Selections cleared. Starting from Step 1.', { duration: 2500 });
  };

  // Determine top right actions on header while in wizard
  const headerActions = (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {hasUnsavedProgress && !submittedProject && (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-full text-2xs sm:text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/80 hover:border-destructive/30 transition-all cursor-pointer select-none gap-1 shrink-0"
                title="Reset selections and return to Step 1"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            }
          />
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <RotateCcw className="size-5" />
              </AlertDialogMedia>
              <AlertDialogTitle>Reset your project setup?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear your selected package, services, and project details, returning you to Step 1.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleResetDraft}
              >
                Reset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );

  // Dedicated mobile chat launcher button, strictly gated by <ChatGate>
  const renderMobileChat = (label = 'Chat with Team') => (
    <ChatGate>
      <Button
        data-chat-entry="mobile-footer"
        type="button"
        variant="outline"
        size="sm"
        onClick={() => useChatStore.getState().setIsOpen(true, GLOBAL_CHAT_ID)}
        className="md:hidden h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
        title={label}
        aria-label={label}
      >
        <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
        <span className="hidden min-[360px]:inline">{label}</span>
        <span className="min-[360px]:hidden">Chat</span>
      </Button>
    </ChatGate>
  );

  // Footer navigation actions
  const renderFooterActions = () => {
    if (submittedProject) return null;

    return (
      <div className="flex items-center justify-between gap-3 sm:gap-4 w-full">
        {/* Left Side: Back button, Mobile Chat, or status info */}
        <div className={cn(
          "flex items-center gap-2",
          currentStep === 1 && "hidden sm:flex"
        )}>
          {currentStep > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() => goToStep(currentStep - 1)}
                className="gap-1.5 text-xs font-semibold cursor-pointer h-10 sm:h-9 px-3.5 sm:px-4 shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </Button>
              {renderMobileChat('Chat')}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {renderMobileChat('Chat with Team')}
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
                {currentPackage && isStep1Valid ? (
                  isWalletFunding ? (
                    <>
                      <Check className="size-3.5 text-emerald-600 inline shrink-0" />
                      <span className="text-foreground font-semibold">Using Wallet only</span>
                      <span>·</span>
                      <span className="font-mono font-bold text-foreground">{userBalance.toLocaleString('en-US')} CR</span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">$0</span>
                      <span className="hidden md:inline">· Click Next to pick services</span>
                    </>
                  ) : effectiveApplyWallet ? (
                    <>
                      <Check className="size-3.5 text-emerald-600 inline shrink-0" />
                      <span className="text-foreground font-semibold">{currentPackage.name} + Wallet</span>
                      <span>·</span>
                      <span className="font-mono font-bold text-foreground">{totalUsableCredits.toLocaleString('en-US')} CR</span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-foreground">${currentPackage.price.toLocaleString('en-US')}</span>
                      <span className="hidden md:inline">· Click Next to pick services</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5 text-emerald-600 inline shrink-0" />
                      <span className="text-foreground font-semibold">{currentPackage.name}</span>
                      <span>·</span>
                      <span className="font-mono font-bold text-foreground">{currentPackage.credits.toLocaleString('en-US')} CR</span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-foreground">${currentPackage.price.toLocaleString('en-US')}</span>
                      <span className="hidden md:inline">· Click Next to pick services</span>
                    </>
                  )
                ) : (
                  <>
                    <Coins className="size-3.5 text-brand-text dark:text-amber-400 inline shrink-0" />
                    <span>Choose your Studio Wallet or a package to continue</span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Primary Next Button matching reference image */}
        <div className={cn(
          "flex items-center gap-2 sm:gap-3",
          currentStep === 1 ? "w-full sm:w-auto sm:ml-auto" : "flex-1 sm:flex-none justify-end"
        )}>
          {currentStep === 1 && (
            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              {!isStep1Valid && (
                <span className="text-xs text-muted-foreground hidden md:inline">
                  Select wallet or package to continue
                </span>
              )}
              <Button
                type="button"
                variant="default"
                size="default"
                disabled={!isStep1Valid}
                onClick={() => goToStep(2)}
                title={!isStep1Valid ? 'Select wallet or package to continue' : 'Continue to Step 2: Pick your services'}
                className={cn(
                  'font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center',
                  !isStep1Valid && 'opacity-60 cursor-not-allowed'
                )}
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <Button
              type="button"
              variant="default"
              size="default"
              aria-disabled={!isStep2Valid}
              onClick={() => goToStep(3)}
              className={cn(
                'font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center',
                !isStep2Valid && 'opacity-60'
              )}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              type="button"
              variant="default"
              size="default"
              aria-disabled={!isStep3Valid}
              onClick={() => goToStep(4)}
              className={cn(
                'font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center',
                !isStep3Valid && 'opacity-60'
              )}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}

          {currentStep === 4 && (
            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end">
              {!userEmail && (
                <span className="text-2xs sm:text-xs text-muted-foreground hidden sm:inline">
                  You&apos;ll sign in on the next step
                </span>
              )}
              <Button
                type="button"
                variant="default"
                size="default"
                aria-disabled={!isStep4Valid}
                onClick={() => goToStep(5)}
                className={cn(
                  'font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm cursor-pointer w-full sm:w-auto justify-center',
                  !isStep4Valid && 'opacity-60'
                )}
              >
                <span>Review & Pay</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
            </div>
          )}

          {currentStep === 5 && currentPackage && (
            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end">
              {!user?.email ? (
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  onClick={() => setShowAuthModal(true)}
                  className="font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm cursor-pointer w-full sm:w-auto justify-center"
                >
                  <span>Sign In to Complete Order</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              ) : isWalletFunding ? (
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  loading={isSubmitting}
                  loadingText="Starting project..."
                  disabled={userBalance < usedCredits}
                  onClick={handleLaunchWithWallet}
                  className="font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm cursor-pointer w-full sm:w-auto justify-center"
                >
                  <span>Confirm &amp; Launch</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="default"
                  loading={isSubmitting}
                  loadingText="Submitting order..."
                  onClick={() => {
                    const isOffline = !isPayPalClientConfigured();
                    if (isOffline) {
                      handleSubmitForReview();
                    } else {
                      document.getElementById('studio-checkout-section')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="font-semibold px-5 sm:px-6 h-10 sm:h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm cursor-pointer w-full sm:w-auto justify-center"
                >
                  <span>Review &amp; Pay (${currentPackage.price.toLocaleString('en-US')})</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              )}
            </div>
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
      onSignInClick={() => setShowAuthModal(true)}
      isPackageSelected={isStep1Valid}
      selectedPackageName={
        isWalletFunding
          ? 'Studio Wallet'
          : effectiveApplyWallet && currentPackage
            ? `${currentPackage.name} + Wallet`
            : currentPackage?.name
      }
      selectedPackagePrice={currentPackage?.price}
      selectedPackageCredits={totalUsableCredits}
      selectedServicesCount={selectedEntries.length}
      usedCredits={usedCredits}
      remainingCredits={remainingCredits}
      isPolicyAccepted={policyAccepted}
      isBriefCompleted={brief.isValid && termsAccepted}
      userEmail={user?.email || null}
      topRightBadge={submittedProject ? null : headerActions}
      hideStepper={Boolean(submittedProject)}
      showBack={!submittedProject}
      footerActions={renderFooterActions()}
    >
      {/* Screen reader live region step announcement */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {getStepAnnouncement(currentStep, Boolean(submittedProject))}
      </p>

      {/* Hand-off overlay while the confirmation page loads (mirrors its status icon) */}
      {isNavigatingToConfirmation && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
        >
          <Card className="w-full max-w-sm rounded-2xl border border-border/80 bg-card shadow-sm">
            <Empty className="gap-5 p-6 sm:p-8">
              <EmptyHeader>
                <EmptyMedia
                  className={cn(
                    'size-12 rounded-full ring-8',
                    confirmationIsPending
                      ? 'bg-amber-400/15 text-brand-text dark:text-amber-400 ring-amber-400/10'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/10'
                  )}
                >
                  {confirmationIsPending ? (
                    <Clock className="size-6 stroke-[2.5]" />
                  ) : (
                    <Check className="size-6 stroke-[2.5]" />
                  )}
                </EmptyMedia>
                <EmptyTitle className="text-xl font-extrabold tracking-tight text-foreground">
                  {OVERLAY_HEADINGS[confirmationState]}
                </EmptyTitle>
                <EmptyDescription className="text-xs sm:text-sm">
                  Opening your confirmation…
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Spinner className="size-5 text-brand-text dark:text-amber-400" />
              </EmptyContent>
            </Empty>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: CHOOSE A PACKAGE OR USE WALLET                       */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200" data-hydrated={mounted ? "true" : undefined}>
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-b border-border/60 pb-2.5 sm:pb-4">
            <div>
              <div className="text-2xs sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1">
                STEP 1 OF 5 · {userBalance > 0 ? 'CHOOSE PROJECT FUNDING' : 'CHOOSE A PACKAGE'}
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-xl sm:text-3xl font-extrabold tracking-tight text-foreground outline-none"
              >
                Start with the right credit wallet.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 leading-relaxed">
                {userBalance > 0
                  ? 'Use your existing Studio Wallet balance with $0 checkout, or purchase a new package and combine credits.'
                  : 'Choose a package, then build a multi-service project and see your remaining credits in real time.'}
              </p>
            </div>
          </div>

          {/* ReUI Standardized Announcement & Status Banner */}
          <StudioNoticeBanner type="step1-scope" />

          {/* Returning Client Funding Choice: Clean, Beginner-Friendly Radio Cards */}
          {userBalance > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Choose how to fund this project:
                </span>

                <ChatGate>
                  <button
                    type="button"
                    onClick={() => useChatStore.getState().setIsOpen(true, GLOBAL_CHAT_ID)}
                    data-chat-entry="package-questions-chat"
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand-text dark:hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                  >
                    <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
                    <span>
                      Have questions?{' '}
                      <span className="font-semibold underline decoration-amber-400/40 underline-offset-2">
                        Chat with our team
                      </span>
                    </span>
                  </button>
                </ChatGate>
              </div>

              {/* Funding Choice 1: Use Studio Wallet Balance */}
              <Card
                onClick={() => handleSwitchStep1Tab('wallet')}
                className={cn(
                  'rounded-xl p-4 sm:p-5 transition-all duration-200 cursor-pointer select-none shadow-2xs',
                  isWalletFunding
                    ? 'border-2 border-amber-400 bg-amber-400/[0.06] dark:bg-amber-950/20 shadow-md ring-2 ring-amber-400/20'
                    : 'border border-border/80 bg-card hover:border-amber-400/50'
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        'size-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors',
                        isWalletFunding
                          ? 'bg-amber-400 text-zinc-950 font-bold shadow-xs'
                          : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      <Wallet className="size-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-foreground">
                          Option 1: Use Existing Studio Wallet ({userBalance.toLocaleString('en-US')} CR)
                        </h2>
                        <Badge variant="success" size="sm">
                          $0 Checkout Today
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Start your project using your available balance. No extra payment required. Unused credits stay in your wallet.
                      </p>
                    </div>
                  </div>

                  <Badge
                    variant={isWalletFunding ? 'gold' : 'secondary'}
                    size="sm"
                    className="self-start sm:self-center shrink-0 font-bold"
                  >
                    {isWalletFunding ? (
                      <>
                        <Check className="size-3 mr-1 stroke-[2.5]" />
                        Selected
                      </>
                    ) : (
                      'Use Wallet'
                    )}
                  </Badge>
                </div>
              </Card>

              {/* Funding Choice 2: Buy a New Package Header & Optional Wallet Boost */}
              <div className="pt-1 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Option 2: Buy a New Credit Package
                  </span>
                  {!isWalletFunding && (
                    <Badge variant="outline" size="sm" className="font-semibold text-2xs text-muted-foreground border-border/70">
                      Pick a package below
                    </Badge>
                  )}
                </div>

                {/* Clear, Optional Checkbox to apply wallet on top of purchased package */}
                <div
                  onClick={() => {
                    if (isWalletFunding) {
                      handleSwitchStep1Tab('packages');
                      setApplyWalletCredits(true);
                      setFundingSource('hybrid');
                    } else {
                      const next = !applyWalletCredits;
                      setApplyWalletCredits(next);
                      setFundingSource(next ? 'hybrid' : 'package');
                    }
                  }}
                  className={cn(
                    'p-3 sm:px-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col sm:flex-row sm:items-center justify-between gap-2.5',
                    !isWalletFunding && applyWalletCredits
                      ? 'border-amber-400/60 bg-amber-400/[0.04] shadow-2xs'
                      : 'border-border/80 bg-card hover:bg-secondary/40'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Checkbox
                      id="apply-wallet-toggle"
                      checked={!isWalletFunding && applyWalletCredits}
                      onCheckedChange={(checked) => {
                        const next = Boolean(checked);
                        if (isWalletFunding) {
                          handleSwitchStep1Tab('packages');
                        }
                        setApplyWalletCredits(next);
                        setFundingSource(next ? 'hybrid' : 'package');
                      }}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="apply-wallet-toggle"
                      className="text-xs font-medium text-foreground cursor-pointer select-none leading-normal"
                    >
                      Also add my <strong className="font-mono font-bold text-brand-text dark:text-amber-300">{userBalance.toLocaleString('en-US')} CR</strong> wallet to this new project
                    </label>
                  </div>

                  {!isWalletFunding && currentPackage && (
                    <Badge variant="gold" size="sm" className="font-mono tabular-nums font-bold self-start sm:self-center shrink-0">
                      {applyWalletCredits
                        ? `Total: ${(currentPackage.credits + userBalance).toLocaleString('en-US')} CR`
                        : `${currentPackage.credits.toLocaleString('en-US')} CR (Package only)`}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Contextual chat link when userBalance === 0 (desktop only, mobile has sticky bottom button) */
            <ChatGate>
              <div className="hidden sm:flex items-center justify-end px-1 -mt-1 sm:-mt-2" data-chat-entry="package-questions-chat">
                <button
                  type="button"
                  onClick={() => useChatStore.getState().setIsOpen(true, GLOBAL_CHAT_ID)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand-text dark:hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <MessageSquare className="size-3.5 text-brand-text dark:text-amber-400" />
                  <span>Have questions about packages or credits? <span className="font-semibold underline decoration-amber-400/40 underline-offset-2">Chat with our team</span></span>
                </button>
              </div>
            </ChatGate>
          )}

          {/* Centered 3 Compact Package Cards Grid (Always visible for clarity, highlighted when package is chosen) */}
          {(userBalance <= 0 || !isWalletFunding || step1TabMode === 'packages') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 items-stretch">
                {PACKAGES.map((pkg) => {
                  const pkgCredits = pkg.credits;
                  const isSelected = selectedPackageId === pkg.id;
                  const isPopular = pkg.id === 'studio-momentum';
                  const showHybridAddition = userBalance > 0 && applyWalletCredits;
                  const combinedBudget = showHybridAddition ? pkgCredits + userBalance : pkgCredits;
                  const tierRuleLabel =
                    pkg.id === 'creator-forge'
                      ? 'Basic services + up to 2 Standard units (Elite locked)'
                      : pkg.id === 'studio-momentum'
                        ? 'Basic & Standard services + up to 2 Elite units'
                        : 'All Basic, Standard & Elite tiers across 39 services';
                  const bestForSummary =
                    pkg.id === 'creator-forge'
                      ? 'Ideal for essential channel branding, emotes, and stream graphics.'
                      : pkg.id === 'studio-momentum'
                        ? 'Balanced credit budget for multi-asset rebrands and animated packages.'
                        : 'Full-scale production access for VTuber models, 3D work, and complete overhauls.';

                  return (
                    <Card
                      key={pkg.id}
                      onClick={() => handleSelectPackage(pkg.id)}
                      className={cn(
                        'relative flex flex-col justify-between rounded-xl transition-all duration-200 cursor-pointer select-none overflow-hidden shadow-2xs py-0 gap-0',
                        isSelected
                          ? 'border-2 border-amber-400 bg-amber-400/[0.06] dark:bg-amber-950/20 shadow-md ring-2 ring-amber-400/25'
                          : 'border border-border/80 bg-card hover:border-border hover:shadow-xs'
                      )}
                    >
                      {isPopular && (
                        <div className="absolute top-0 right-0">
                          <div
                            className={cn(
                              'font-bold text-2xs uppercase tracking-wider py-0.5 px-2.5 rounded-bl-lg transition-colors',
                              isSelected
                                ? 'bg-amber-400 text-zinc-950 font-black'
                                : 'bg-secondary text-muted-foreground border-b border-l border-border/70'
                            )}
                          >
                            Most Popular
                          </div>
                        </div>
                      )}

                      <CardHeader className="p-4 pb-2">
                        {!isPopular ? (
                          <Badge variant="secondary" className="w-fit text-xs font-semibold uppercase tracking-wider mb-1 px-2.5 py-0.5">
                            {pkg.group}
                          </Badge>
                        ) : (
                          <div className="h-5 mb-1" />
                        )}
                        <CardTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
                          {pkg.name}
                        </CardTitle>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono tabular-nums">
                            ${pkg.price.toLocaleString('en-US')}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">USD</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <CreditValue value={combinedBudget} size="sm" variant="pill" />
                          {showHybridAddition && (
                            <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                              ({pkgCredits.toLocaleString('en-US')} + {userBalance.toLocaleString('en-US')} Wallet)
                            </span>
                          )}
                        </div>
                        <CardDescription className="text-xs leading-relaxed text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-1">
                          {bestForSummary}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 pt-2.5 space-y-2 text-xs text-muted-foreground border-t border-border/50 flex-1">
                        <div className="flex items-start gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            {showHybridAddition
                              ? `${combinedBudget.toLocaleString('en-US')} CR combined budget (${pkgCredits.toLocaleString('en-US')} CR + ${userBalance.toLocaleString('en-US')} CR wallet)`
                              : `${pkgCredits.toLocaleString('en-US')} CR package allocation`}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{tierRuleLabel}</span>
                        </div>
                        <div className="flex items-start gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>Unused package credits roll over into your Studio Wallet</span>
                        </div>
                      </CardContent>

                      <div className="p-4 pt-0">
                        <Button
                          type="button"
                          variant={isSelected ? 'default' : 'secondary'}
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPackage(pkg.id);
                          }}
                          className={cn(
                            'w-full text-xs font-bold gap-1.5 h-9 rounded-lg cursor-pointer transition-colors',
                            isSelected
                              ? 'bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground shadow-xs'
                              : 'hover:bg-secondary/80 text-foreground'
                          )}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Selected
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

              {/* Centered Bottom Fine Print */}
              <p className="text-center text-xs text-muted-foreground pt-1 pb-2">
                Base service value: <span className="font-semibold text-foreground/90">$2.50 per CR</span> before package bonuses. Higher packages receive a stronger effective rate.
              </p>
            </>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: MULTI-ASSET CONFIGURATOR                             */}
      {/* ============================================================ */}
      {currentStep === 2 && currentPackage && (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-border/60 pb-2.5 sm:pb-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-0.5 sm:mb-1">
                <div className="text-2xs sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  STEP 2 OF 5 · ASSET BOX
                </div>
                {/* Mobile Available Budget Badge (visible in header before and during service selection) */}
                <div className="sm:hidden inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/10 dark:bg-amber-400/15 border border-amber-400/30 text-2xs font-semibold text-brand-text dark:text-amber-300">
                  <Coins className="size-3 text-amber-500 dark:text-amber-400" />
                  <span className="font-mono font-bold">{totalUsableCredits.toLocaleString('en-US')} CR</span>
                  <span className="text-muted-foreground/80 font-normal">available</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="scroll-mt-[140px] text-xl sm:text-3xl font-extrabold tracking-tight text-foreground outline-none"
                >
                  <span className="hidden sm:inline">Choose multiple services at once.</span>
                  <span className="sm:hidden">Choose multiple services</span>
                </h1>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="sm:hidden text-2xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 shrink-0 cursor-pointer"
                >
                  {isWalletFunding ? 'Switch funding' : 'Change package'}
                </button>
              </div>
              <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Pick every asset you need, set its scope and quantity, and watch your credit balance update instantly.
              </p>
            </div>

            {/* Desktop Action Controls */}
            <div className="hidden sm:flex items-center gap-2.5 shrink-0">
              <ScopeGuideModal />
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStep(1)}
                className="text-xs font-semibold rounded-xl h-9 cursor-pointer"
              >
                {isWalletFunding ? 'Switch Funding Mode' : 'Change Package'}
              </Button>
            </div>
          </div>

          {/* Compact Sticky Cart & Budget Summary Bar (Slides in on mobile when 1+ services selected) */}
          {selectedEntries.length > 0 && (
            <div className="lg:hidden sticky top-[53px] sm:top-[61px] z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 py-1.5 sm:py-2 bg-background/95 backdrop-blur-md border-b border-border/70 shadow-2xs animate-in slide-in-from-top-2 fade-in duration-200">
              <button
                type="button"
                onClick={() => setMobileScopeOpen(true)}
                className="w-full flex items-center justify-between gap-2.5 p-2 sm:p-2.5 px-3 rounded-xl bg-card hover:bg-secondary/60 border border-border/80 text-foreground transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <div
                    className={cn(
                      'size-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs',
                      remainingCredits < 0
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-amber-400/20 text-brand-text dark:text-amber-400'
                    )}
                  >
                    <Coins className="size-4" />
                  </div>
                  <div className="min-w-0 flex flex-col justify-center text-left">
                    <div className="text-xs truncate flex items-center gap-1.5 font-semibold text-foreground leading-tight">
                      <span className="font-bold">
                        {selectedEntries.length} {selectedEntries.length === 1 ? 'service' : 'services'}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="font-mono tabular-nums text-foreground/80">
                        {usedCredits.toLocaleString('en-US')} CR
                      </span>
                    </div>
                    <div className="text-2xs leading-tight mt-0.5">
                      <span
                        className={cn(
                          'font-mono font-bold tabular-nums',
                          remainingCredits >= 0
                            ? 'text-brand-text dark:text-amber-400'
                            : 'text-destructive font-black'
                        )}
                      >
                        {remainingCredits >= 0
                          ? `${remainingCredits.toLocaleString('en-US')} CR left`
                          : `${Math.abs(remainingCredits).toLocaleString('en-US')} CR over`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-2xs sm:text-xs font-bold text-brand-text dark:text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 px-2 sm:px-2.5 py-1 rounded-lg shrink-0 transition-colors shadow-2xs">
                  <span>View Cart</span>
                  <ChevronRight className="w-3 h-3 text-brand-text dark:text-amber-400" />
                </div>
              </button>
            </div>
          )}

          {isWalletFunding && remainingCredits < 0 && (
            <Alert variant="warning" className="rounded-xl border-amber-400/35 bg-amber-400/[0.08]">
              <AlertTriangle className="w-4 h-4 text-brand-text dark:text-amber-400" />
              <AlertTitle className="text-xs sm:text-sm font-bold text-foreground">
                Wallet Budget Exceeded by {Math.abs(remainingCredits)} CR
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                <span>
                  Your active Studio Wallet balance is <strong>{userBalance} CR</strong>, but your selected scope requires <strong>{usedCredits} CR</strong>. Adjust your services or choose a package to fund the difference.
                </span>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => handleUpgradePackage('creator-forge')}
                  className="shrink-0 text-xs font-semibold h-8 rounded-lg cursor-pointer"
                >
                  Top Up with Creator Forge (660 CR)
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* 2-Column Layout */}
          <div id="catalog-services-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start scroll-mt-24">
            {/* LEFT COLUMN: AVAILABLE SERVICES & ADDITIONS (~65% / 8 cols) */}
            <div className="lg:col-span-8 space-y-4 sm:space-y-6">
              {/* Mobile / Inline Error Banner when no services are selected */}
              {serviceSelectionError && selectedEntries.length === 0 && (
                <div
                  id="step2-inline-error"
                  tabIndex={-1}
                  className="p-3.5 rounded-xl bg-rose-500/10 border-2 border-rose-500/50 dark:border-rose-500/60 text-rose-700 dark:text-rose-300 flex items-start sm:items-center gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs"
                  role="alert"
                >
                  <div className="size-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-rose-700 dark:text-rose-300">
                      Please select at least one creative service to continue
                    </p>
                    <p className="text-2xs text-rose-600/90 dark:text-rose-400/90 font-normal mt-0.5">
                      Browse catalog categories below and click &ldquo;Add to Cart&rdquo; on the services you need.
                    </p>
                  </div>
                </div>
              )}

              {/* Category & Price Filters */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Browse Catalog Categories
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Mobile Price Filter Dropdown (compact single button) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          'sm:hidden inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer',
                          priceFilter !== 'all'
                            ? 'bg-amber-400/20 border-amber-400/40 text-brand-text dark:text-amber-300 font-bold'
                            : 'bg-secondary/60 border-border/80 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <SlidersHorizontal className="size-3" />
                        <span>
                          {priceFilter === 'all'
                            ? 'Price'
                            : PRICE_FILTER_OPTIONS.find((p) => p.id === priceFilter)?.label}
                        </span>
                        <ChevronDown className="size-3 opacity-60" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-44 rounded-xl p-1 shadow-md bg-popover text-popover-foreground border border-border"
                      >
                        {PRICE_FILTER_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.id}
                            onClick={() => setPriceFilter(opt.id)}
                            className={cn(
                              'flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer',
                              priceFilter === opt.id &&
                                'bg-amber-400/20 text-brand-text dark:text-amber-300 font-bold'
                            )}
                          >
                            <span>{opt.label}</span>
                            {priceFilter === opt.id && (
                              <Check className="size-3.5 text-brand-text dark:text-amber-400 shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {(activeCategory !== 'All' || priceFilter !== 'all') && (
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => {
                          setActiveCategory('All');
                          setPriceFilter('all');
                        }}
                        className="h-auto px-0 text-2xs sm:text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                <ServiceCategoryTabs
                  categories={serviceCategories}
                  activeCategory={activeCategory}
                  onSelectCategory={setActiveCategory}
                  categoryCounts={serviceCategoryCounts}
                />

                {/* Price / Budget Filter Bar (Desktop only) */}
                <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none]">
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
                        className="h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium text-muted-foreground bg-secondary/50 border border-transparent hover:bg-secondary/80 hover:text-foreground data-[pressed]:bg-amber-400/20 data-[pressed]:text-brand-text dark:data-[pressed]:text-amber-300 data-[pressed]:font-bold data-[pressed]:border-amber-400/40 data-[pressed]:shadow-2xs"
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
                        'group rounded-xl transition-all duration-200 overflow-hidden flex flex-col justify-between py-0 gap-0 shadow-2xs',
                        isSelected
                          ? 'border-amber-400/80 bg-amber-400/[0.04] ring-1 ring-amber-400/25 shadow-xs'
                          : 'border-border/80 bg-card hover:border-amber-400/40 hover:shadow-xs'
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
                                  'rounded-lg transition-all duration-200',
                                  isSelected
                                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-zinc-950 font-black shadow-xs shadow-amber-400/25'
                                    : 'bg-secondary/80 border-border/80 text-muted-foreground group-hover:border-amber-400/50 group-hover:text-brand-text dark:group-hover:text-amber-400'
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
                              <ServiceImageHoverCard service={svc}>
                                <span
                                  className="inline-flex items-center gap-1.5 cursor-pointer group/title"
                                  title="Hover for service scope &amp; tier details"
                                >
                                  <h3 className="text-sm font-bold text-foreground leading-snug truncate group-hover/title:text-brand-text dark:group-hover/title:text-amber-400 transition-colors">
                                    {svc.name}
                                  </h3>
                                  <Info className="size-3.5 text-muted-foreground/75 group-hover/title:text-brand-text dark:group-hover/title:text-amber-400 transition-colors shrink-0" />
                                </span>
                              </ServiceImageHoverCard>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                                {svc.description}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end">
                            <Badge variant="secondary" className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 mb-1">
                              {svc.category}
                            </Badge>

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
                            className="w-full text-xs font-semibold h-8 rounded-lg border-dashed hover:border-amber-400 hover:text-brand-text dark:hover:text-amber-400 hover:bg-amber-400/[0.04] gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Cart
                          </Button>
                        )}
                      </div>

                      {/* Card Bottom Drawer (Ultra-Compact Responsive Action Bar + Real Scope Details) */}
                      {isSelected && choice && (
                        <div className="bg-secondary/40 border-t border-border/80 px-3 sm:px-3.5 py-2 sm:py-2.5 space-y-2">
                          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-2.5">
                            {/* Tier Selector */}
                            <div className="flex-1 min-w-[125px] sm:max-w-[200px]">
                              <Select
                                value={choice.level === 2 ? 'elite' : choice.level === 1 ? 'standard' : 'basic'}
                                onValueChange={(val) => {
                                  if (val !== null && val !== undefined) {
                                    const level: 0 | 1 | 2 = val === 'elite' ? 2 : val === 'standard' ? 1 : 0;
                                    updateServiceTier(svc.id, level);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full h-8 text-xs font-semibold bg-card rounded-lg border-border py-0 px-2 sm:px-2.5 shadow-2xs">
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

                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                              {/* Quantity — ReUI Number Field with Clamped 1-20 range */}
                              <NumberField
                                size="sm"
                                min={1}
                                max={20}
                                value={currentQty}
                                onValueChange={(val) => updateServiceQuantity(svc.id, Math.max(1, Math.min(20, val ?? 1)))}
                                className="w-auto shrink-0 gap-0"
                                aria-label={`${svc.name} quantity`}
                              >
                                <NumberFieldGroup className="w-[78px] sm:w-[84px] rounded-lg border-border/80 bg-card shadow-2xs">
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
                                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2 shrink-0 rounded-lg transition-colors gap-1 cursor-pointer"
                                      aria-label="Remove from cart"
                                    />
                                  }
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="text-xs font-semibold hidden md:inline">Remove</span>
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
                          </div>

                          {!svc.quoteOnly && (
                            <p className="text-2xs text-muted-foreground leading-snug pt-1.5 border-t border-border/60">
                              <strong className="font-semibold text-foreground/90">
                                {TIER_NAMES[choice.level]} includes:
                              </strong>{' '}
                              {svc.scopeDetails?.[choice.level] ?? DEFAULT_SCOPE_DETAILS[choice.level]}
                            </p>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              {filteredServices.length === 0 && (
                <Empty className="rounded-xl border border-dashed border-border/80 bg-secondary/20 py-12">
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
                        ? 'Browse catalog categories and click "Add to Cart" to build your custom package.'
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

            {/* RIGHT COLUMN: REUSABLE CART SIDEBAR (~35% / 4 cols) - Desktop Only */}
            <div id="studio-cart-sidebar" className="hidden lg:block lg:col-span-4 lg:sticky lg:top-[8.75rem] lg:h-[calc(100vh-15.5rem)] lg:min-h-[500px]">
              <CartSidebar
                pack={currentPackage}
                entries={selectedEntries}
                usedCredits={usedCredits}
                remainingCredits={remainingCredits}
                totalAvailableCredits={totalUsableCredits}
                appliedWalletCredits={appliedWalletCredits}
                standardUnits={standardUnits}
                eliteUnits={eliteUnits}
                recommendedPack={recommendedPack}
                onUpgradePackage={handleUpgradePackage}
                onRemoveService={toggleService}
                isTierRestricted={isTierRestricted}
                additions={additions}
                onToggleAddition={toggleAddition}
                onClearAll={handleClearAllSelections}
                hasServiceError={serviceSelectionError && selectedEntries.length === 0}
                className="h-full"
              />
            </div>
          </div>

          {/* Mobile Scope & Budget Bottom Drawer (Base UI Drawer) */}
          <Drawer open={mobileScopeOpen} onOpenChange={setMobileScopeOpen} showSwipeHandle>
            <DrawerContent className="h-[88vh] max-h-[88vh] p-0 rounded-t-2xl border-t border-border flex flex-col bg-background overflow-hidden">
              <DrawerHeader className="p-3.5 pb-2.5 border-b border-border/70 flex flex-row items-center justify-between shrink-0 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-7 rounded-lg bg-amber-400/20 text-brand-text dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Coins className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <DrawerTitle className="text-sm font-bold truncate">
                      Your Order &amp; Credits
                    </DrawerTitle>
                    <DrawerDescription className="text-2xs text-muted-foreground truncate">
                      {selectedEntries.length} {selectedEntries.length === 1 ? 'service' : 'services'} selected · {usedCredits.toLocaleString('en-US')} CR used · {remainingCredits >= 0 ? `${remainingCredits.toLocaleString('en-US')} CR remaining` : `${Math.abs(remainingCredits).toLocaleString('en-US')} CR over budget`}
                    </DrawerDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ScopeGuideModal />
                  <DrawerClose className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer" aria-label="Close drawer">
                    <X className="size-4" />
                  </DrawerClose>
                </div>
              </DrawerHeader>

              <div className="flex-1 overflow-y-auto min-h-0">
                <CartSidebar
                  pack={currentPackage}
                  entries={selectedEntries}
                  usedCredits={usedCredits}
                  remainingCredits={remainingCredits}
                  totalAvailableCredits={totalUsableCredits}
                  appliedWalletCredits={appliedWalletCredits}
                  standardUnits={standardUnits}
                  eliteUnits={eliteUnits}
                  recommendedPack={recommendedPack}
                  onUpgradePackage={handleUpgradePackage}
                  onRemoveService={toggleService}
                  isTierRestricted={isTierRestricted}
                  additions={additions}
                  onToggleAddition={toggleAddition}
                  onClearAll={handleClearAllSelections}
                  hasServiceError={serviceSelectionError && selectedEntries.length === 0}
                  className="border-0 shadow-none rounded-none h-auto"
                />
              </div>

              <DrawerFooter className="sticky bottom-0 z-20 p-3 sm:p-3.5 px-4 border-t border-border/80 bg-card/95 backdrop-blur-md shrink-0 flex flex-row items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'size-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs',
                      remainingCredits < 0
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-amber-400/20 text-brand-text dark:text-amber-400'
                    )}
                  >
                    <Coins className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold block">Remaining</span>
                    <strong className={cn(
                      'font-mono font-bold text-xs sm:text-sm tabular-nums block leading-tight',
                      remainingCredits >= 0 ? 'text-brand-text dark:text-amber-400' : 'text-destructive font-black'
                    )}>
                      {remainingCredits >= 0
                        ? `${remainingCredits.toLocaleString('en-US')} CR`
                        : `${Math.abs(remainingCredits).toLocaleString('en-US')} CR over`}
                    </strong>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setMobileScopeOpen(false)}
                  className="h-8.5 px-4 text-xs font-semibold rounded-xl cursor-pointer shadow-2xs shrink-0"
                >
                  Close Cart
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: CREDIT SCOPE & ELIGIBILITY                           */}
      {/* ============================================================ */}
      {currentStep === 3 && currentPackage && (
        <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 3 OF 5 · CREDIT ELIGIBILITY
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Confirm what credits can cover.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Creator Credits are a controlled wallet for approved Humantek Art services—not a blank cheque for any content.
              </p>
            </div>

            <Badge variant="secondary" className="w-fit text-xs font-semibold px-3 py-1 rounded-xl">
              Credit Eligibility
            </Badge>
          </div>

          {/* ReUI Standardized Announcement & Status Banner */}
          <StudioNoticeBanner type="step3-coverage" />

          {/* Two Equal Neutral Cards: Included | Not supported */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
            {/* Included Card */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="font-bold text-base text-foreground">
                        &#10003; Included
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                        Approved Humantek Art services covered by Creator Credits
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-0 px-2.5 py-0.5">
                    Covered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3.5 flex flex-col justify-between flex-1">
                <ul className="text-sm text-foreground/90 space-y-3">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-normal">Stream graphics, overlays and alerts</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-normal">Emotes, badges, avatars and channel assets</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-normal">Character or furry artwork within our guidelines</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-normal">Animations, branding, VTuber work and approved edits</span>
                  </li>
                </ul>

                <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="size-4" />
                    Approved Humantek Art services
                  </span>
                  <span className="font-semibold text-foreground/80">39 catalog services</span>
                </div>
              </CardContent>
            </Card>

            {/* Not supported Card */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="font-bold text-base text-foreground">
                        &times; Not supported
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                        Strictly prohibited across all Humantek Art orders and briefs
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 border-0 px-2.5 py-0.5">
                    Prohibited
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3.5 flex flex-col justify-between flex-1">
                {showAllRestricted ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-foreground/90">
                    {RESTRICTED_GUIDELINES.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-500/90 dark:text-rose-400 font-bold shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="text-sm text-foreground/90 space-y-2.5">
                    {CORE_RESTRICTED_ITEMS.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <X className="w-4 h-4 text-rose-500/90 dark:text-rose-400 font-bold shrink-0 mt-0.5" />
                        <span className="leading-normal">{item}</span>
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
                    className="h-auto px-0 text-xs sm:text-sm font-semibold text-brand-text dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <span>
                      {showAllRestricted
                        ? 'Show fewer restrictions'
                        : `Show all ${RESTRICTED_GUIDELINES.length} restrictions`}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 transition-transform duration-200',
                        showAllRestricted && 'rotate-180'
                      )}
                    />
                  </Button>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    Non-compliant briefs declined
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Studio Policies & Service Framework (Clean Neutral Accordion) */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
            <CardHeader className="p-5 sm:p-6 pb-3.5 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-foreground">
                    Studio Policies &amp; Service Framework
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Inspect exact revision &amp; change rules and how Creator Credits work.
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="w-fit text-xs font-semibold px-2.5 py-0.5">
                  Official Rules
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Accordion
                value={openPolicyAccordion}
                onValueChange={(val) => setOpenPolicyAccordion(val)}
                className="divide-y divide-border/60"
              >
                {/* Accordion Item 1: Revision & change rules */}
                <AccordionItem
                  value="revisions"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-400 data-[open]:border-l-amber-400"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400 transition-colors flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-brand-text dark:group-hover:text-amber-400 transition-colors">
                          Revision &amp; change rules
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Included rounds by tier &amp; post-approval change rates
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/90 pt-1">
                      {REVISION_RULES.map((rule) => (
                        <li
                          key={rule}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/25 border border-border/50"
                        >
                          <Check className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                {/* Accordion Item 2: How credits work */}
                <AccordionItem
                  value="credits"
                  className="border-l-4 border-l-transparent transition-colors data-open:border-l-amber-400 data-[open]:border-l-amber-400"
                >
                  <AccordionTrigger className="px-5 sm:px-6 py-4 hover:bg-secondary/40 transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary/80 text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400 transition-colors flex items-center justify-center shrink-0">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block group-hover:text-brand-text dark:group-hover:text-amber-400 transition-colors">
                          How credits work
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          Credit valuation, deduction timing, scope tiers, and approval rules
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 sm:px-6 pb-6 pt-1">
                    <ol className="space-y-2.5 text-xs sm:text-sm text-foreground/90 pt-1">
                      {HOW_CREDITS_WORK.map((rule, idx) => (
                        <li
                          key={rule}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-secondary/25 border border-border/50"
                        >
                          <span className="inline-flex items-center justify-center size-5 rounded-md bg-amber-400/20 text-brand-text dark:text-amber-400 font-mono text-xs font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{rule}</span>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Required Acknowledgement Checkbox Card */}
          <Card
            id="policy-ack-card"
            className={cn(
              'rounded-xl border transition-all cursor-pointer select-none scroll-mt-[140px]',
              policyError && !policyAccepted
                ? 'border-rose-500 bg-rose-500/[0.04] ring-2 ring-rose-500/25 shadow-xs'
                : policyAccepted
                ? 'border-amber-400/80 bg-amber-400/[0.04] ring-1 ring-amber-400/25 shadow-xs'
                : 'border-border/80 bg-card hover:border-amber-400/40 hover:shadow-2xs'
            )}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, input, label')) return;
              const nextVal = !policyAccepted;
              setPolicyAccepted(nextVal);
              if (nextVal) setPolicyError(false);
            }}
          >
            <CardContent className="p-4 sm:p-4.5 flex items-start gap-3">
              <Checkbox
                id="policy-ack"
                checked={policyAccepted}
                onCheckedChange={(checked) => {
                  const val = Boolean(checked);
                  setPolicyAccepted(val);
                  if (val) setPolicyError(false);
                }}
                className={cn(
                  'mt-0.5 shrink-0 scroll-mt-[140px]',
                  policyError && !policyAccepted && 'border-rose-500 data-[state=unchecked]:border-rose-500 ring-2 ring-rose-500/30'
                )}
              />
              <div className="space-y-1 w-full">
                <Label
                  htmlFor="policy-ack"
                  className={cn(
                    'text-sm font-bold cursor-pointer block transition-colors',
                    policyError && !policyAccepted ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                  )}
                >
                  Required acknowledgement <span className={policyError && !policyAccepted ? 'text-rose-600 dark:text-rose-400' : 'text-destructive font-semibold'}>*</span>
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I understand that credits can only be used for services and content supported by Humantek Art, and that certain requests may be declined even if I have sufficient credits.
                </p>
                <p className={cn(
                  'text-2xs font-medium pt-0.5',
                  policyAccepted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                )}>
                  {policyAccepted
                    ? 'Acknowledgement complete. Final eligibility remains subject to team approval.'
                    : 'Confirm the acknowledgement to continue.'}
                </p>
                {policyError && !policyAccepted && (
                  <div
                    className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in-50 duration-150"
                    role="alert"
                  >
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>Please accept the studio policy to continue.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: PROJECT DETAILS & CREATIVE BRIEF                     */}
      {/* ============================================================ */}
      {currentStep === 4 && currentPackage && (
        <div className="w-full space-y-4 md:space-y-6 pb-28 md:pb-10 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                STEP 4 OF 5 · PROJECT DETAILS
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Tell us what every asset should include.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Add your brief, reference images, optional wallet tools, and confirm the project terms.
              </p>
            </div>

            <span className="hidden md:inline-flex items-center gap-1.5 text-2xs font-mono text-muted-foreground/60 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40 select-all tracking-tight">
              <span className="text-muted-foreground/40 font-sans uppercase text-[10px] tracking-wider">ID</span>
              <span>{mounted && projectId ? projectId : 'Pending'}</span>
            </span>
          </div>

          {/* Centered Main Form Card (Compact Layout Skeleton to Minimize Scrolling) */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Channel / Brand Name */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('channelName')} className="text-xs font-semibold text-foreground">
                  Channel / Brand Name <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input
                  {...brief.fieldProps('channelName')}
                  autoComplete="organization"
                  maxLength={BRIEF_LIMITS.channelName.max}
                  placeholder="e.g. KiraOfficial, PixelGamer"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('channelName')} message={brief.getError('channelName')} />
              </div>

              {/* Primary Platform */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('platform')} className="text-xs font-semibold text-foreground">
                  Primary Platform <span className="text-destructive font-semibold">*</span>
                </Label>
                <Select
                  value={platform}
                  onValueChange={(val) => {
                    setPlatform(val as string);
                    brief.markTouched('platform');
                  }}
                >
                  <SelectTrigger
                    {...brief.fieldProps('platform')}
                    className="w-full h-9 bg-background/50 rounded-lg text-xs sm:text-sm font-medium scroll-mt-[140px]"
                  >
                    <SelectValue placeholder="Select Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-xs sm:text-sm">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id={briefFieldId('platform')} message={brief.getError('platform')} />
              </div>

              {/* Preferred Art Style */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('style')} className="text-xs font-semibold text-foreground">
                  Preferred Art Style <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input
                  {...brief.fieldProps('style')}
                  maxLength={BRIEF_LIMITS.style.max}
                  placeholder="e.g. Cyberpunk Anime, Chibi, Dark Fantasy, 3D"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('style')} message={brief.getError('style')} />
              </div>

              {/* Color Palette */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('colors')} className="text-xs font-semibold text-foreground">
                  Color Palette / Themes <span className="text-destructive font-semibold">*</span>
                </Label>
                <ColorPaletteInput
                  {...brief.fieldProps('colors')}
                  maxLength={BRIEF_LIMITS.colors.max}
                  placeholder="e.g. #FF007F Neon Pink, Cyan, Deep Slate"
                  value={colors}
                  onChange={setColors}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('colors')} message={brief.getError('colors')} />
              </div>

              {/* Instructions Full Width */}
              <div className="space-y-1 sm:col-span-2 scroll-mt-[140px]">
                <div className="flex items-center justify-between">
                  <Label htmlFor={briefFieldId('instructions')} className="text-xs font-semibold text-foreground">
                    Project Brief & Instructions <span className="text-destructive font-semibold">*</span>
                  </Label>
                  <span
                    className={cn(
                      'text-xs font-mono tabular-nums',
                      instructions.trim().length < BRIEF_LIMITS.instructions.min
                        ? 'text-muted-foreground'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {instructions.trim().length.toLocaleString('en-US')} / {BRIEF_LIMITS.instructions.max.toLocaleString('en-US')}
                  </span>
                </div>
                <Textarea
                  {...brief.fieldProps('instructions')}
                  maxLength={BRIEF_LIMITS.instructions.max}
                  placeholder="Share any key text, expressions, poses, or instructions. You can also refine further with our team in project messages..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={4}
                  className="rounded-lg text-xs sm:text-sm leading-relaxed bg-background/50 py-2.5 min-h-[120px] md:min-h-[160px] resize-y scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('instructions')} message={brief.getError('instructions')} />
              </div>
            </div>

            {/* Reference Art & Files Panel */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col justify-between gap-2">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-brand-text dark:text-amber-400 shrink-0" />
                    <b className="text-xs font-bold text-foreground">
                      Reference Art &amp; Files
                    </b>
                    <Badge variant="outline" className="text-3xs font-medium py-0 px-1.5 text-muted-foreground border-border/60">
                      Optional
                    </Badge>
                    <span
                      className={cn(
                        'text-3xs font-mono tabular-nums',
                        uploadedFiles.length >= REFERENCE_LIMITS.maxFiles ? 'text-brand-text dark:text-amber-400 font-semibold' : 'text-muted-foreground'
                      )}
                      aria-label={`${uploadedFiles.length} of ${REFERENCE_LIMITS.maxFiles} images attached`}
                    >
                      {uploadedFiles.length}/{REFERENCE_LIMITS.maxFiles}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    id="reference-file-input"
                    type="file"
                    multiple
                    accept={REFERENCE_LIMITS.allowedTypes.join(',')}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    id="reference-upload-button"
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={isUploading || uploadedFiles.length >= REFERENCE_LIMITS.maxFiles}
                    onClick={() => {
                      if (!user) {
                        authModalIntentRef.current = 'upload';
                        setShowAuthModal(true);
                      } else if (!user.emailVerified) {
                        toast.error('Please verify your email address to upload reference images.');
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className="w-full sm:w-auto mt-1 sm:mt-0 shrink-0 rounded-lg font-semibold shadow-2xs h-8 sm:h-7"
                  >
                    {isUploading ? (
                      <Spinner className="size-3" />
                    ) : !user ? (
                      <Lock className="size-3 text-muted-foreground" />
                    ) : (
                      <Upload className="size-3 text-brand-text dark:text-amber-400" />
                    )}
                    {!user ? 'Sign in to Upload' : 'Upload Images'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  Up to {REFERENCE_LIMITS.maxFiles} images · {REFERENCE_LIMITS.maxFileBytes / (1024 * 1024)} MB each · PNG, JPG or WebP.
                </p>
              </div>

              {/* Guest / Unverified Notice OR Active Dropzone */}
              {!user ? (
                <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Lock className="size-3.5 shrink-0 text-brand-text dark:text-amber-400" />
                    <span className="leading-snug">
                      Sign in with a verified account to upload files, or paste links (Google Drive, Pinterest, Figma) in your instructions.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      authModalIntentRef.current = 'upload';
                      setShowAuthModal(true);
                    }}
                    className="shrink-0 font-semibold h-7 text-3xs text-brand-text dark:text-amber-400 hover:bg-amber-400/10"
                  >
                    Sign In
                  </Button>
                </div>
              ) : !user.emailVerified ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Lock className="size-3.5 shrink-0" />
                  <span className="leading-snug">
                    Please verify your email address to unlock file uploads, or paste reference links directly in the brief.
                  </span>
                </div>
              ) : uploadedFiles.length < REFERENCE_LIMITS.maxFiles ? (
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
                  className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-xs text-muted-foreground text-center sm:text-left cursor-pointer outline-none transition-colors hover:border-amber-400/70 hover:bg-amber-400/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400/40 data-[dragging]:border-amber-400 data-[dragging]:bg-amber-400/15 data-[dragging]:text-brand-text dark:hover:bg-amber-400/5 dark:data-[dragging]:bg-amber-400/15"
                >
                  <ImageIcon className="size-3.5 shrink-0 text-brand-text dark:text-amber-400" />
                  <span className="leading-snug">
                    <span className="font-semibold text-foreground">Drag &amp; drop</span>{' '}
                    images here, or click to browse
                  </span>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-2.5 text-xs text-muted-foreground text-center">
                  Limit reached. Remove an image to add another, or share more in project chat after submitting.
                </p>
              )}

              <UploadedAttachmentList
                files={uploadedFiles}
                uploadingNames={uploadingNames}
                onRemove={removeUploadedFile}
              />
            </div>

            {/* Policy Conflict Alert */}
            {hasPolicyViolation ? (
              <Alert variant="destructive" className="rounded-xl p-3">
                <ShieldAlert className="w-4 h-4" />
                <AlertTitle className="text-xs sm:text-sm font-bold">Policy Restriction Detected</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed mt-0.5">
                  This request isn’t eligible for credits. Please choose an approved service or contact the team for clarification.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium py-2 px-3 rounded-lg bg-secondary/20 border border-border/50">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>No obvious policy conflict detected. The team still completes final scope review.</span>
              </div>
            )}

            {/* Collapsible Terms & Conditions */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
              <Collapsible open={isTermsExpanded} onOpenChange={setIsTermsExpanded}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left font-bold text-foreground text-xs sm:text-sm hover:bg-secondary/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-xs select-none transition-transform duration-200">
                      {isTermsExpanded ? '▼' : '▶'}
                    </span>
                    <span className="font-bold tracking-tight">Read Terms &amp; Conditions</span>
                  </div>
                  <span className="text-2xs font-semibold text-muted-foreground">
                    {isTermsExpanded ? 'Collapse' : 'Click to read (11 items)'}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t border-border/60 bg-muted/15 px-5 sm:px-6 py-4 space-y-2.5">
                    {TERMS_AND_CONDITIONS.map((term, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground leading-relaxed pl-3 border-l-2 border-amber-400/40">
                        {term}
                      </p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Terms & Conditions Checkbox (Compact and Direct) */}
            <Card
              id="terms-ack-card"
              className={cn(
                'rounded-xl border transition-all cursor-pointer select-none scroll-mt-[140px]',
                termsError && !termsAccepted
                  ? 'border-rose-500 bg-rose-500/[0.04] ring-2 ring-rose-500/25 shadow-xs'
                  : termsAccepted
                  ? 'border-amber-400/80 bg-amber-400/[0.04] ring-1 ring-amber-400/25 shadow-xs'
                  : 'border-border/80 bg-card hover:border-amber-400/50 hover:shadow-2xs'
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, input, label')) return;
                const nextVal = !termsAccepted;
                setTermsAccepted(nextVal);
                if (nextVal) setTermsError(false);
              }}
            >
              <CardContent className="p-4 sm:p-4.5 flex items-start gap-3">
                <Checkbox
                  id="terms-ack"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => {
                    const val = Boolean(checked);
                    setTermsAccepted(val);
                    if (val) setTermsError(false);
                  }}
                  className={cn(
                    'mt-0.5 shrink-0 scroll-mt-[140px]',
                    termsError && !termsAccepted && 'border-rose-500 data-[state=unchecked]:border-rose-500 ring-2 ring-rose-500/30'
                  )}
                />
                <div className="space-y-0.5 w-full">
                  <Label
                    htmlFor="terms-ack"
                    className={cn(
                      'text-xs font-bold cursor-pointer block transition-colors',
                      termsError && !termsAccepted ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                    )}
                  >
                    Required confirmation <span className={termsError && !termsAccepted ? 'text-rose-600 dark:text-rose-400' : 'text-destructive font-semibold'}>*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I have read and agree to the Terms &amp; Conditions, revision limits, and credit eligibility rules.
                  </p>
                  {termsError && !termsAccepted && (
                    <div
                      className="flex items-center gap-1.5 pt-1 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in-50 duration-150"
                      role="alert"
                    >
                      <AlertCircle className="size-3.5 shrink-0" />
                      <span>Please accept the Terms &amp; Conditions to continue.</span>
                    </div>
                  )}
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
        <div className="space-y-6 animate-in fade-in duration-200 pb-36 sm:pb-16">
            <>
              {/* Step Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    STEP 5 OF 5 · REVIEW
                  </div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
                  >
                    Ready to submit?
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Check the package, assets, brief, balance, and policy status before sending your request.
                  </p>
                </div>

                <Badge variant="gold" className="text-sm font-mono font-bold px-3.5 py-1.5">
                  {isWalletFunding
                    ? `${usedCredits.toLocaleString('en-US')} CR FROM WALLET · $0 USD`
                    : `TOTAL: $${currentPackage.price.toLocaleString('en-US')} USD`}
                </Badge>
              </div>

              {/* 2-Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
                {/* Left Column: Complete Order & Scope Summary */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Package Summary Card */}
                  <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          {isWalletFunding ? 'Funding Summary' : 'Package Summary'}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
                        {currentPackage.group}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg bg-secondary/40 border border-border/60 text-center">
                      <div className="min-w-0">
                        <span className="text-2xs sm:text-xs text-muted-foreground uppercase font-bold block truncate">Selected Plan</span>
                        <b className="text-2xs sm:text-sm text-foreground mt-0.5 block truncate">{currentPackage.name}</b>
                      </div>
                      <div className="min-w-0">
                        <span className="text-2xs sm:text-xs text-muted-foreground uppercase font-bold block truncate">
                          {isWalletFunding ? 'Due Today' : 'Package Value'}
                        </span>
                        <b className="text-2xs sm:text-sm text-brand-text dark:text-amber-400 font-black mt-0.5 block font-mono tabular-nums truncate">
                          ${currentPackage.price.toLocaleString('en-US')} USD
                        </b>
                      </div>
                      <div className="min-w-0">
                        <span className="text-2xs sm:text-xs text-muted-foreground uppercase font-bold block truncate">Total Credits</span>
                        <div className="mt-0.5 flex items-center justify-center">
                          <CreditValue value={totalPackageCredits} size="sm" />
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Configured Assets / Deliverables List */}
                  <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                    <CardHeader className="p-3.5 sm:p-5 pb-2.5 border-b border-border/60 flex flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0" />
                        <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                          Deliverables ({selectedEntries.length})
                        </CardTitle>
                      </div>
                      <CreditValue value={usedCredits} size="sm" variant="pill" suffix="CR Used" className="shrink-0" />
                    </CardHeader>

                    {/* Mobile View: Collapsed by default */}
                    <div className="block md:hidden">
                      {selectedEntries.length === 0 ? (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          No specific services pre-allocated · Full balance in wallet
                        </div>
                      ) : (
                        <>
                          {!deliverablesExpandedMobile && (
                            <div className="px-3.5 py-2 text-2xs text-muted-foreground truncate bg-secondary/15">
                              {selectedEntries.map((e) => e.service.name).join(', ')}
                            </div>
                          )}

                          {deliverablesExpandedMobile && (
                            <div className="p-3 pt-2">
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
                                        <TableCell wrap className="py-2 text-xs font-bold text-foreground">
                                          {service.name}
                                        </TableCell>
                                        <TableCell className="py-2 text-xs text-muted-foreground">
                                          {service.quoteOnly
                                            ? 'Custom Scope'
                                            : `${TIER_NAMES[choice.level]} × ${choice.quantity}`}
                                        </TableCell>
                                        <TableCell className="py-2 text-xs text-right">
                                          {service.quoteOnly ? (
                                            <span className="font-bold text-brand-text dark:text-amber-400 text-xs">TBC</span>
                                          ) : (
                                            <CreditValue value={credits} size="sm" />
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </ScrollArea>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setDeliverablesExpandedMobile(!deliverablesExpandedMobile)}
                            className="w-full py-2 px-3.5 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between border-t border-border/50 bg-secondary/20 cursor-pointer transition-colors"
                          >
                            <span>{deliverablesExpandedMobile ? 'Hide deliverables' : `View all ${selectedEntries.length} deliverables`}</span>
                            <ChevronDown className={cn("size-3.5 transition-transform text-muted-foreground", deliverablesExpandedMobile && "rotate-180")} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Desktop View: Always expanded */}
                    <CardContent className="hidden md:block p-4 sm:p-5 pt-3">
                      {selectedEntries.length === 0 ? (
                        <div className="py-6 px-4 text-center rounded-xl bg-secondary/20 border border-dashed border-border/80 space-y-2">
                          <Layers className="w-5 h-5 text-brand-text/80 dark:text-amber-400/80 mx-auto" />
                          <b className="text-xs sm:text-sm font-semibold text-foreground block">
                            No specific services pre-allocated
                          </b>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            Your full balance of <b className="font-mono tabular-nums">{totalPackageCredits} Credits</b> will remain active in your studio wallet, ready to deploy on any approved creative request.
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
                                  <TableCell wrap className="py-2 text-xs font-bold text-foreground">
                                    {service.name}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-muted-foreground">
                                    {service.quoteOnly
                                      ? 'Custom Scope'
                                      : `${TIER_NAMES[choice.level]} × ${choice.quantity}`}
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-right">
                                    {service.quoteOnly ? (
                                      <span className="font-bold text-brand-text dark:text-amber-400 text-xs">TBC</span>
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
                  <Card className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-5 space-y-3 sm:space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 sm:pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-brand-text dark:text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                          Production Brief
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-2xs sm:text-xs font-medium px-2 py-0.5 max-w-[110px] truncate">
                          {platform || 'Multi-Platform'}
                        </Badge>
                        <Button
                          id="edit-brief-button"
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() => goToStep(4)}
                          className="h-auto px-0 text-xs font-semibold text-primary shrink-0"
                        >
                          Edit Brief
                        </Button>
                      </div>
                    </div>

                    {/* Mobile View: Collapsed by default */}
                    <div className="block md:hidden space-y-2">
                      <div className="p-2.5 rounded-lg bg-secondary/25 border border-border/50 text-2xs text-muted-foreground space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground truncate max-w-[180px]">{channelName || 'Brand not specified'}</span>
                          <span className="shrink-0">{platform || 'Multi-Platform'}</span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {style || 'Studio Selected'}{colors ? ` · ${colors}` : ''}
                        </div>
                      </div>

                      {briefExpandedMobile && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                          {instructions && (
                            <div className="p-2.5 rounded-lg bg-secondary/30 border border-border/60 space-y-1 text-xs">
                              <span className="text-2xs font-semibold text-muted-foreground block">Production Notes:</span>
                              <p className="text-xs text-foreground/90 italic leading-relaxed whitespace-pre-wrap">
                                &ldquo;{instructions}&rdquo;
                              </p>
                            </div>
                          )}
                          {uploadedFiles.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-border/40">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Upload className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span>{uploadedFiles.length} reference file(s) attached</span>
                              </div>
                              <UploadedAttachmentList files={uploadedFiles} />
                            </div>
                          )}
                        </div>
                      )}

                      {(instructions || uploadedFiles.length > 0) && (
                        <button
                          type="button"
                          onClick={() => setBriefExpandedMobile(!briefExpandedMobile)}
                          className="w-full py-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center justify-between pt-1 border-t border-border/40 cursor-pointer transition-colors"
                        >
                          <span>{briefExpandedMobile ? 'Hide brief details' : 'View full notes & files'}</span>
                          <ChevronDown className={cn("size-3.5 transition-transform text-muted-foreground", briefExpandedMobile && "rotate-180")} />
                        </button>
                      )}
                    </div>

                    {/* Desktop View: Always expanded */}
                    <div className="hidden md:block space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                          <span className="text-xs font-medium text-muted-foreground block">Channel / Brand</span>
                          <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                            {channelName || 'Not specified'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                          <span className="text-xs font-medium text-muted-foreground block">Primary Platform</span>
                          <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                            {platform || 'Multi-Platform'}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50 sm:col-span-2">
                          <span className="text-xs font-medium text-muted-foreground block">Art Style &amp; Palette</span>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs font-semibold text-foreground break-words">
                              {style || 'Studio Selected'}{colors ? ` · ${colors}` : ''}
                            </p>
                            {extractHexColors(colors).length > 0 && (
                              <span className="inline-flex items-center gap-1 shrink-0">
                                {extractHexColors(colors).map((hex) => (
                                  <span
                                    key={hex}
                                    title={hex}
                                    className="size-3 rounded-full ring-1 ring-black/15 dark:ring-white/20 shadow-2xs"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {instructions && (
                        <div className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-1 text-xs">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-muted-foreground">Production Notes & Direction:</span>
                            <span className="text-xs text-muted-foreground">Attached to brief</span>
                          </div>
                          <div className="max-h-24 overflow-y-auto pr-1">
                            <p className="text-xs text-foreground/90 italic leading-relaxed whitespace-pre-wrap">
                              &ldquo;{instructions}&rdquo;
                            </p>
                          </div>
                        </div>
                      )}

                      {uploadedFiles.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-2 font-medium text-foreground">
                              <Upload className="w-3.5 h-3.5 text-brand-text dark:text-amber-400 shrink-0" />
                              <span>{uploadedFiles.length} reference file(s) attached to brief</span>
                            </span>
                            <span className="text-2xs text-muted-foreground">Click to preview</span>
                          </div>
                          <UploadedAttachmentList files={uploadedFiles} />
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Right Column: Checkout & Actions */}
                <div id="studio-checkout-section" className="lg:col-span-6 space-y-4">
                  <Card className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {isWalletFunding ? 'Instant Wallet Launch' : 'Checkout & Launch'}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {isWalletFunding
                          ? 'Launch your project instantly using your available studio credits ($0.00 USD).'
                          : 'Complete your order securely with PayPal or card to start production.'}
                      </p>
                    </div>

                    {/* Order Line-Item Breakdown */}
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
                      {isWalletFunding ? (
                        <>
                          {/* Mobile View: Concise wallet debits */}
                          <div className="space-y-2 md:hidden">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Funding Source</span>
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-brand-text dark:text-amber-400" /> Wallet Balance
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-brand-text dark:text-amber-400 font-medium">
                              <span>Scope Debited</span>
                              <span className="font-mono tabular-nums">-{usedCredits} CR</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Remaining Wallet</span>
                              <span className="font-mono tabular-nums">{Math.max(0, userBalance - usedCredits)} CR</span>
                            </div>
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                              <span>Total Due</span>
                              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                                $0.00 USD
                              </span>
                            </div>
                          </div>

                          {/* Desktop View: Full itemized wallet details */}
                          <div className="hidden md:block space-y-2">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Funding Source</span>
                              <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5 text-brand-text dark:text-amber-400" /> Wallet Balance
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Available Balance</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">{userBalance} CR</span>
                            </div>
                            <div className="flex items-center justify-between text-brand-text dark:text-amber-400 font-medium">
                              <span>Project Scope Debited</span>
                              <span className="font-mono tabular-nums">-{usedCredits} CR</span>
                            </div>
                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Remaining Wallet Balance</span>
                              <span className="font-mono tabular-nums">{Math.max(0, userBalance - usedCredits)} CR</span>
                            </div>
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                              <span>Total Due Today</span>
                              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                                $0.00 USD
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Mobile View: Clean, non-repetitive essential numbers */}
                          <div className="space-y-2 md:hidden">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>{currentPackage.name} Package</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">${currentPackage.price.toLocaleString('en-US')} USD</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Scope Used</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">{usedCredits} of {totalUsableCredits} CR</span>
                            </div>
                            {appliedWalletCredits > 0 && (
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Applied from Wallet</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">+{appliedWalletCredits} CR</span>
                              </div>
                            )}
                            {totalUsableCredits > usedCredits && (
                              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span>Rollover to Wallet</span>
                                <span className="font-semibold font-mono tabular-nums">+{totalUsableCredits - usedCredits} CR</span>
                              </div>
                            )}
                            {costBreakdownExpandedMobile && (
                              <div className="pt-1.5 border-t border-border/40 space-y-1 text-2xs text-muted-foreground animate-in fade-in duration-150">
                                <div className="flex items-center justify-between">
                                  <span>Base Package Allocation</span>
                                  <span className="font-mono tabular-nums">+{currentPackage.credits} CR</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Total Usable Budget</span>
                                  <span className="font-mono tabular-nums">{totalUsableCredits} CR</span>
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setCostBreakdownExpandedMobile(!costBreakdownExpandedMobile)}
                              className="w-full pt-1 text-2xs font-medium text-muted-foreground hover:text-foreground text-left cursor-pointer transition-colors"
                            >
                              {costBreakdownExpandedMobile ? 'Hide calculation details' : 'View full credit breakdown'}
                            </button>
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                              <span>Total Due</span>
                              <span className="text-base font-black text-brand-text dark:text-amber-400 font-mono tabular-nums">
                                ${currentPackage.price.toLocaleString('en-US')} USD
                              </span>
                            </div>
                          </div>

                          {/* Desktop View: Full itemized calculation */}
                          <div className="hidden md:block space-y-2">
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>{currentPackage.name} Package</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">${currentPackage.price.toLocaleString('en-US')} USD</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Package Allocation</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">+{currentPackage.credits} CR</span>
                            </div>
                            {appliedWalletCredits > 0 && (
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Applied from Studio Wallet</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">+{appliedWalletCredits} CR</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between text-muted-foreground font-medium pt-1 border-t border-border/40">
                              <span>Total Usable Project Budget</span>
                              <span className="font-semibold text-foreground font-mono tabular-nums">{totalUsableCredits} CR</span>
                            </div>
                            <div className="flex items-center justify-between text-brand-text dark:text-amber-400 font-medium">
                              <span>Service Scope Used</span>
                              <span className="font-semibold font-mono tabular-nums">-{usedCredits} CR</span>
                            </div>
                            {totalUsableCredits > usedCredits && (
                              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span>Rollover to Global Wallet</span>
                                <span className="font-mono tabular-nums">+{totalUsableCredits - usedCredits} CR</span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                              <span>Total Due</span>
                              <span className="text-base sm:text-lg font-black text-brand-text dark:text-amber-400 font-mono tabular-nums">
                                ${currentPackage.price.toLocaleString('en-US')} USD
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Payment / Wallet Settlement Action */}
                    <div className="space-y-3">
                      {submissionError && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-xs leading-snug">{submissionError.message}</p>
                            {submissionError.showProjectsLink && (
                              <Link href="/projects" className="inline-flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline">
                                View in My Projects &rarr;
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                      {!user?.email ? (
                        <div className="p-4 sm:p-5 rounded-xl border border-amber-400/40 bg-amber-400/10 space-y-3 text-center sm:text-left">
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="size-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-brand-text dark:text-amber-400 shrink-0">
                              <UserCheck className="size-4" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <h3 className="text-sm font-bold text-foreground">Sign in to complete your order</h3>
                              <p className="text-xs text-muted-foreground">
                                Sign in or create an account to activate your project and access studio communication.
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="lg"
                            onClick={() => {
                              authModalIntentRef.current = 'checkout';
                              setShowAuthModal(true);
                            }}
                            className="w-full h-11 bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-bold rounded-xl shadow-md shadow-amber-400/25 cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>Sign In or Create Account</span>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/60 text-xs">
                            <div className="min-w-0 pr-2">
                              <span className="text-2xs text-muted-foreground block font-medium">Order will be registered to:</span>
                              <span className="font-semibold text-foreground truncate block">
                                {user.name && user.name.trim().toLowerCase() !== 'client' && user.name.trim().toLowerCase() !== 'creator'
                                  ? user.name
                                  : user.email.split('@')[0]}{' '}
                                <span className="text-muted-foreground font-normal">({user.email})</span>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={handleSwitchAccount}
                              className="text-xs text-brand-text dark:text-amber-400 hover:underline shrink-0 font-medium cursor-pointer"
                            >
                              Not you? Switch account
                            </button>
                          </div>

                          {isWalletFunding ? (
                            <div className="space-y-2">
                              <Button
                                type="button"
                                size="lg"
                                loading={isSubmitting}
                                loadingText="Starting project..."
                                disabled={userBalance < usedCredits}
                                onClick={handleLaunchWithWallet}
                                className="w-full h-11 bg-primary hover:bg-[oklch(0.769_0.188_70.08)] text-primary-foreground font-black rounded-xl shadow-md shadow-amber-400/25 cursor-pointer flex items-center justify-center gap-2"
                              >
                                <span>Confirm &amp; Launch with {usedCredits} Credits ($0.00 USD)</span>
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              <p className="text-2xs text-center text-muted-foreground leading-normal">
                                Instantly debits {usedCredits} CR from your Studio Wallet. Project moves directly to active production.
                              </p>
                            </div>
                          ) : (
                            <>
                              {/* Prominent Creator Benefit: Credit Rollover */}
                          {totalUsableCredits > usedCredits && (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs">
                              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="leading-snug">
                                <strong className="font-semibold text-emerald-900 dark:text-emerald-100">+{totalUsableCredits - usedCredits} CR Rollover Benefit:</strong> Any unused package credits automatically roll over into your Global Studio Wallet upon payment!
                              </span>
                            </div>
                          )}

                          <PayPalButtonWrapper
                            packageId={currentPackage.id}
                            packagePrice={currentPackage.price}
                            packageName={currentPackage.name}
                            packageCredits={currentPackage.credits}
                            customer={{
                              name:
                                user.name && user.name.trim().toLowerCase() !== 'client' && user.name.trim().toLowerCase() !== 'creator'
                                  ? user.name
                                  : user.email.split('@')[0],
                              email: user.email,
                            }}
                            onClientCaptured={handleClientCapturedPayment}
                            projectPayload={{
                              projectId,
                              packageId: currentPackage.id,
                              fundingSource: appliedWalletCredits > 0 ? 'hybrid' : 'package',
                              walletBalance: userBalance,
                              applyWalletCredits: effectiveApplyWallet,
                              appliedWalletCredits,
                              selections: selectedEntries.map((e) => ({
                                id: e.service.id,
                                name: e.service.name,
                                level: e.choice.level,
                                quantity: e.choice.quantity,
                                credits: e.credits,
                              })),
                              additions,
                              channelName,
                              platform,
                              style,
                              colors,
                              instructions,
                              uploadedFiles,
                            }}
                            onSuccess={(proj) => {
                              if (proj && proj.id) {
                                void completeCheckout(proj);
                              } else {
                                // PayPal succeeded and credits deposited in wallet; launch project via wallet
                                handleLaunchWithWallet();
                              }
                            }}
                            onError={(err) => {
                              const sanitized = err.includes('undefined') || err.includes('reading') || err.includes('null')
                                ? 'Payment was received, but brief creation took longer than usual. Your credits are stored in your Studio Wallet.'
                                : err;
                              setErrorMessage(sanitized);
                              toast.error(sanitized);
                            }}
                          />

                          {/* Instant contextual error alert placed directly below payment options */}
                          {errorMessage && (
                            <Alert variant="destructive" className="rounded-xl p-3">
                              <AlertTriangle className="w-4 h-4" />
                              <AlertTitle className="text-xs sm:text-sm font-bold">Payment Notice</AlertTitle>
                              <AlertDescription className="text-xs mt-0.5 leading-relaxed">{errorMessage}</AlertDescription>
                            </Alert>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                    {/* Secondary Alternative Path: Quiet link for users needing PO / sponsor sign-off */}
                    <div className="pt-1.5 border-t border-border/60 text-center">
                      <button
                        type="button"
                        onClick={handleSubmitForReview}
                        disabled={isSubmitting}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer underline-offset-4 hover:underline py-1 group"
                      >
                        <span>Need sponsor or agency PO approval first?</span>
                        <span className="font-semibold text-foreground group-hover:text-brand-text dark:group-hover:text-amber-400">
                          {isSubmitting ? 'Submitting review...' : 'Request review (no payment yet) →'}
                        </span>
                      </button>
                    </div>

                    {/* Direct Producer Chat Trigger */}
                    <ChatGate>
                      <div className="pt-1.5 text-center" data-chat-entry="brief-questions-chat">
                        <Button
                          id="chat-with-producer-button"
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => useChatStore.getState().setIsOpen(true)}
                          className="h-auto py-1 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-brand-text dark:hover:text-amber-400 hover:bg-secondary/40 whitespace-normal"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-brand-text dark:text-amber-400" />
                          <span>Have questions about this brief? Chat with our team →</span>
                        </Button>
                      </div>
                    </ChatGate>

                    {/* Scope Protection Note */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-center gap-2 text-2xs text-muted-foreground text-center">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        <strong className="font-semibold text-foreground/90">Full scope protection</strong> — Unused credits stay in your Studio Wallet, and credits are refunded if any request cannot be fulfilled.
                      </span>
                    </div>
                  </Card>
                </div>
              </div>
            </>
        </div>
      )}

      {/* Auth Gate Modal for Unauthenticated Guests */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSuccess={() => {
          if (authModalIntentRef.current === 'checkout' && isStep4Valid) {
            setCurrentStep(5);
          }
        }}
      />
    </StudioCardLayout>
  );
}
