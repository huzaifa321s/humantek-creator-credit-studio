'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
import { useStepFocus, getStepAnnouncement } from '@/hooks/useStepNavigation';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import { ScopeGuideModal } from '@/components/ScopeGuideModal';
import { StudioNoticeBanner } from '@/components/StudioNoticeBanner';
import { ServiceCategoryTabs } from '@/components/ServiceCategoryTabs';
import { CartSidebar } from '@/components/CartSidebar';
import { ServiceImageHoverCard } from '@/components/ServiceImageHoverCard';
import { PayPalButtonWrapper } from '@/components/PayPalButtonWrapper';
import { FieldError } from '@/components/ui/field-error';
import { useBriefValidation, briefFieldId } from '@/lib/hooks/useBriefValidation';
import { BRIEF_LIMITS, PLATFORM_OPTIONS, redeemCodeSchema } from '@/lib/validation';
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
  ArrowDown,
  ShieldAlert,
  Check,
  Copy,
  X,
  ImageIcon,
  ChevronDown,
  PackageCheck,
  FolderKanban,
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
  Wallet,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStudioChat } from '@/lib/chatStore';
import { useUserStore } from '@/lib/userStore';
import { useWalletQuery, useRedeemPromoCode } from '@/lib/queries/wallet';
import { useCreateProject } from '@/lib/queries/projects';
import { STUDIO_WALLET_PACKAGE } from '@/lib/pricing';
import { useWizardStore } from '@/lib/wizardStore';
import { useNotificationStore } from '@/lib/notificationStore';

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
  // User store & TanStack Query synchronized server state
  const { user, isHydrated, addCredits, deductCredits } = useUserStore();
  const userBalance = user?.walletBalance ?? 0;
  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const walletQuery = useWalletQuery(userEmail);
  const isWalletLoading = !isHydrated || walletQuery.isPending;
  const createProjectMutation = useCreateProject();
  const redeemPromoMutation = useRedeemPromoCode();

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
    redeemCodeInput,
    redeemCodeAttached,
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
    setRedeemCodeInput,
    setRedeemCodeAttached,
    setIsSubmitting,
    setErrorMessage,
    setSubmittedProject,
    resetWizard,
  } = wizard;

  const { setIsOpen: setChatOpen, registerProject } = useStudioChat();

  // Brief fields & ergonomic setters mapped to wizardStore
  const { clientName, channelName, email, platform, style, colors, instructions } = wizardBrief;

  const setClientName = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('clientName', typeof val === 'function' ? val(wizardBrief.clientName) : val);
  };
  const setChannelName = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('channelName', typeof val === 'function' ? val(wizardBrief.channelName) : val);
  };
  const setEmail = (val: string | ((prev: string) => string)) => {
    wizard.updateBriefField('email', typeof val === 'function' ? val(wizardBrief.email) : val);
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

  // Upload transient DOM interaction state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step focus & accessibility navigation hook (scrolls to top on step or confirmation change)
  const headingRef = useStepFocus(currentStep, Boolean(submittedProject));

  // Track if user has active unsaved draft progress
  const hasUnsavedProgress = useMemo(() => {
    if (submittedProject) return false;
    return Boolean(
      selectedPackageId ||
      Object.keys(selections).length > 0 ||
      clientName.trim() ||
      email.trim() ||
      instructions.trim() ||
      uploadedFiles.length > 0
    );
  }, [submittedProject, selectedPackageId, selections, clientName, email, instructions, uploadedFiles.length]);

  // Standard production browser exit guard ("Leave site? Changes you made may not be saved.")
  useUnsavedChangesWarning(hasUnsavedProgress);

  // Clean URL to keep it pristine (Approach 1: clean single-page URL)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('step')) {
      url.searchParams.delete('step');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, []);

  // Derived package & credit calculations
  const isWalletFunding = selectedPackageId === 'studio-wallet' || fundingSource === 'wallet';
  const isPackageSelected = Boolean(selectedPackageId && selectedPackageId !== 'studio-wallet');
  const effectiveApplyWallet = applyWalletCredits && userBalance > 0 && isPackageSelected;
  const appliedWalletCredits = isWalletFunding ? userBalance : (effectiveApplyWallet ? userBalance : 0);

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
    clientName,
    channelName,
    email,
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
            toast.error('Please select at least one creative service to continue.');
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
          const el = document.getElementById('policy-ack') || document.getElementById('policy-ack-card');
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.focus({ preventScroll: true });
          toast.error('Please accept the scope policy to continue.');
        } else if (s === 4) {
          if (!brief.validateAll()) {
            toast.error(
              brief.errorCount === 1
                ? 'Please fix the highlighted field.'
                : `Please fix the ${brief.errorCount} highlighted fields.`
            );
          } else if (!termsAccepted) {
            const el = document.getElementById('terms-ack') || document.getElementById('terms-ack-card');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus({ preventScroll: true });
            toast.error('Please accept the Terms & Conditions to continue.');
          }
        }
        return;
      }
    }

    if (target === 5 && email.trim()) {
      const activeRole = useUserStore.getState().user?.role;
      useUserStore.getState().updateUser({
        email: email.trim(),
        name: clientName.trim() || undefined,
        role: activeRole === 'admin' || activeRole === 'producer' || activeRole === 'staff' ? activeRole : 'client',
      });
    }

    setCurrentStep(target);
  };

  const handleSelectWallet = () => {
    setFundingSource('wallet');
    setSelectedPackageId('studio-wallet');
    setPriceFilter('all');
  };

  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId);
    setFundingSource(userBalance > 0 && applyWalletCredits ? 'hybrid' : 'package');
    setPriceFilter('all');
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

        const res = await fetch('/api/uploads', {
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
      });

      setSubmittedProject(data.project);
      registerProject({
        id: data.project.id,
        projectCode: data.project.projectCode,
        packageName: data.project.packageName,
        clientName: data.project.clientName,
        status: data.project.status,
        price: data.project.packagePrice,
        credits: data.project.packageCredits,
      });
      useUserStore.getState().updateUser({
        email: email.trim() || userEmail,
        name: clientName.trim() || userName,
      });
      useNotificationStore.getState().addNotification({
        title: 'Project Submitted for Review',
        description: `Project HT-${data.project.projectCode} (${data.project.packageName}) submitted to creative operations.`,
        iconType: 'sparkles',
        link: '/projects',
      });
      toast.success('Project request submitted for studio review!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchWithWallet = async () => {
    if (!currentPackage) return;
    if (userBalance < usedCredits) {
      toast.error(`Insufficient credits. You need ${usedCredits} CR but only have ${userBalance} CR.`);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage('');

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
        clientName,
        channelName,
        email,
        platform,
        style,
        colors,
        instructions,
        redeemCode: redeemCodeAttached ? redeemCodeInput : '',
        uploadedFiles,
      });

      const activeRole = useUserStore.getState().user?.role;
      const verifiedRole = activeRole === 'admin' || activeRole === 'producer' || activeRole === 'staff' ? activeRole : 'client';
      if (typeof data.newWalletBalance === 'number') {
        useUserStore.getState().updateUser({
          walletBalance: data.newWalletBalance,
          email: email.trim() || userEmail,
          name: clientName.trim() || userName,
          role: verifiedRole,
        });
      } else {
        deductCredits(usedCredits, `Launched project ${data.project.projectCode}`);
        useUserStore.getState().updateUser({
          email: email.trim() || userEmail,
          name: clientName.trim() || userName,
          role: verifiedRole,
        });
      }

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      setSubmittedProject(data.project);
      registerProject({
        id: data.project.id,
        projectCode: data.project.projectCode,
        packageName: data.project.packageName,
        clientName: data.project.clientName,
        status: data.project.status,
        price: data.project.packagePrice,
        credits: data.project.packageCredits,
      });
      useNotificationStore.getState().addNotification({
        title: 'Project Launched with Credits',
        description: `Project HT-${data.project.projectCode} active in production. ${usedCredits} CR deducted from wallet.`,
        iconType: 'credits',
        link: '/projects',
      });

      toast.success(`Success! Project launched instantly with ${usedCredits} Studio Wallet credits.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine top right badge on header while in wizard: "Scope: 608 / 660 CR"
  const headerBadge = currentPackage ? (
    <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 h-7 sm:h-7.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-2xs sm:text-xs font-medium shadow-2xs select-none shrink-0">
      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span className="text-zinc-300 font-medium hidden md:inline">Scope:</span>
      <span className="font-bold text-amber-300 tabular-nums font-mono">
        <span className="hidden sm:inline">{remainingCredits} / {totalPackageCredits} CR</span>
        <span className="sm:hidden">{remainingCredits} CR</span>
      </span>
    </div>
  ) : null;

  // Footer navigation actions
  const renderFooterActions = () => {
    if (submittedProject) return null;

    return (
      <div className="flex items-center justify-between gap-3 sm:gap-4 w-full">
        {/* Left Side: Back button or status info */}
        <div>
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => goToStep(currentStep - 1)}
              className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3.5 sm:px-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
              {currentPackage && isStep1Valid ? (
                <>
                  <Check className="size-3.5 text-emerald-600 inline shrink-0" />
                  <span className="text-foreground font-semibold">{currentPackage.name}</span>
                  <span>({currentPackage.credits} CR) selected · Click Next to pick services</span>
                </>
              ) : (
                <>
                  <Coins className="size-3.5 text-amber-600 inline shrink-0" />
                  <span>Choose your Studio Wallet or a package to continue</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Right Side: Primary Next Button matching reference image */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
          {currentStep === 1 && (
            <div className="flex items-center gap-2 sm:gap-2.5">
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
                className={cn('font-semibold px-5 sm:px-6 h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm', !isStep1Valid && 'opacity-60 cursor-not-allowed')}
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
              className={cn('font-semibold px-5 sm:px-6 h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm', !isStep2Valid && 'opacity-60')}
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
              className={cn('font-semibold px-5 sm:px-6 h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm', !isStep3Valid && 'opacity-60')}
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}

          {currentStep === 4 && (
            <Button
              type="button"
              variant="default"
              size="default"
              aria-disabled={!isStep4Valid}
              onClick={() => goToStep(5)}
              className={cn('font-semibold px-5 sm:px-6 h-9 gap-1.5 sm:gap-2 text-xs sm:text-sm', !isStep4Valid && 'opacity-60')}
            >
              <span>Review & Pay</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
      isPackageSelected={isStep1Valid}
      selectedPackageName={currentPackage?.name}
      selectedPackagePrice={currentPackage?.price}
      selectedPackageCredits={currentPackage?.credits}
      selectedServicesCount={selectedEntries.length}
      usedCredits={usedCredits}
      remainingCredits={remainingCredits}
      isPolicyAccepted={policyAccepted}
      isBriefCompleted={brief.isValid && termsAccepted}
      userEmail={email || null}
      topRightBadge={submittedProject ? null : headerBadge}
      hideStepper={Boolean(submittedProject)}
      showBack={!submittedProject}
      footerActions={renderFooterActions()}
    >
      {/* Screen reader live region step announcement */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {getStepAnnouncement(currentStep, Boolean(submittedProject))}
      </p>

      {/* ============================================================ */}
      {/* STEP 1: CHOOSE A PACKAGE OR USE WALLET                       */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                1 OF 5 · FUNDING SOURCE &amp; PACKAGE SELECTION
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Choose how to fund your creative project.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Deploy instantly with your available Studio Wallet balance ($0 USD checkout), select a new package, or combine both for higher project scopes.
              </p>
            </div>
          </div>

          {/* ReUI Standardized Announcement & Status Banner */}
          <StudioNoticeBanner type="step1-scope" />

          {/* Dedicated Studio Wallet Balance Status & Hybrid Management Card */}
          {userBalance > 0 ? (
            <Card
              className={cn(
                'relative flex flex-col p-4 sm:p-5 rounded-xl transition-all duration-200 select-none overflow-hidden shadow-2xs gap-3',
                isWalletFunding
                  ? 'border-2 border-emerald-500 bg-emerald-500/[0.06] dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                  : 'border border-border/80 bg-card hover:border-border hover:shadow-xs'
              )}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'size-11 sm:size-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-colors',
                      isWalletFunding
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    )}
                  >
                    <Wallet className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={isWalletFunding ? 'default' : 'secondary'}
                        className={cn(
                          'text-2xs font-bold uppercase tracking-wider py-0 px-2',
                          isWalletFunding && 'bg-emerald-600 hover:bg-emerald-600 text-white'
                        )}
                      >
                        Global Studio Wallet
                      </Badge>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        {isWalletLoading ? (
                          <Skeleton className="h-4 w-12 rounded-xs" />
                        ) : (
                          `${userBalance} CR Active Balance`
                        )}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight">
                      {isWalletFunding
                        ? 'Funding with Existing Studio Wallet Balance'
                        : 'Active Studio Credit Balance Available'}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isWalletFunding
                        ? `Deploy your project with $0.00 USD checkout using your current ${userBalance} CR. Any unused credits remain preserved in your wallet.`
                        : `You have ${userBalance} CR available. You can apply these credits alongside a package below to increase your total project purchasing power.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
                  <div className="text-left sm:text-right">
                    <div className="flex items-baseline sm:justify-end gap-1">
                      {isWalletLoading ? (
                        <Skeleton className="h-7 sm:h-8 w-14 rounded-xs inline-block" />
                      ) : (
                        <span className="text-xl sm:text-2xl font-black text-foreground font-mono tabular-nums">
                          {userBalance}
                        </span>
                      )}
                      <span className="text-xs font-bold text-muted-foreground">CR Available</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block font-mono">
                      {isWalletFunding ? '$0.00 USD Checkout' : 'Prepaid & Ready'}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant={isWalletFunding ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleSelectWallet}
                    className={cn(
                      'text-xs font-semibold gap-1.5 h-9 px-4 rounded-lg cursor-pointer transition-colors',
                      isWalletFunding
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'border-border hover:bg-secondary text-foreground'
                    )}
                  >
                    {isWalletFunding ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Wallet Only ($0)
                      </>
                    ) : (
                      'Use Wallet Only ($0)'
                    )}
                  </Button>
                </div>
              </div>

              {/* Hybrid Wallet Integration Toggle when a Package is selected */}
              {isPackageSelected && (
                <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-500/5 dark:bg-amber-950/20 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-xl">
                  <div className="flex items-center gap-2.5">
                    <Checkbox
                      id="apply-wallet-toggle"
                      checked={applyWalletCredits}
                      onCheckedChange={(checked) => setApplyWalletCredits(Boolean(checked))}
                      className="cursor-pointer"
                    />
                    <label
                      htmlFor="apply-wallet-toggle"
                      className="text-xs font-medium text-foreground cursor-pointer select-none"
                    >
                      Apply my <strong className="font-mono">{userBalance} CR</strong> wallet balance to this project ({currentPackage?.name} + Wallet)
                    </label>
                  </div>
                  <Badge variant="gold" className="text-2xs font-mono font-bold self-start sm:self-auto py-0 px-2 shrink-0">
                    {applyWalletCredits
                      ? `Total Budget: ${(currentPackage?.credits ?? 0) + userBalance} CR`
                      : `Using Package Only: ${currentPackage?.credits ?? 0} CR`}
                  </Badge>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-3.5 sm:p-4 rounded-xl border border-border/70 bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Coins className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Global Studio Credit System</h4>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    All packages include permanent studio credits with 12-month rollover. Select a tier below to fund your project.
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <span className="text-xs font-mono font-bold text-muted-foreground">0 CR Balance</span>
              </div>
            </Card>
          )}

          {userBalance > 0 && (
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/80" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 font-bold tracking-wider text-muted-foreground">
                  {isWalletFunding
                    ? 'Or select a package to expand your credit budget'
                    : 'Choose your package tier below'}
                </span>
              </div>
            </div>
          )}

          {/* Centered 3 Compact Package Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 items-stretch">
            {PACKAGES.map((pkg) => {
              const pkgCredits = pkg.credits;
              const effectiveRate = (pkg.price / pkgCredits).toFixed(2);
              const isSelected = selectedPackageId === pkg.id;
              const isPopular = pkg.id === 'studio-momentum';
              const combinedBudget = effectiveApplyWallet && isSelected ? pkgCredits + userBalance : pkgCredits;

              return (
                <Card
                  key={pkg.id}
                  onClick={() => handleSelectPackage(pkg.id)}
                  className={cn(
                    'relative flex flex-col justify-between rounded-xl transition-all duration-200 cursor-pointer select-none overflow-hidden shadow-2xs py-0 gap-0',
                    isSelected
                      ? 'border-2 border-amber-500 bg-amber-500/[0.04] dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                      : 'border border-border/80 bg-card hover:border-border hover:shadow-xs'
                  )}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0">
                      <div
                        className={cn(
                          'font-bold text-2xs uppercase tracking-wider py-0.5 px-2.5 rounded-bl-lg transition-colors',
                          isSelected
                            ? 'bg-amber-500 text-white'
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
                        ${pkg.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">USD</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <CreditValue value={combinedBudget} size="sm" variant="pill" />
                      {effectiveApplyWallet && isSelected ? (
                        <span className="text-2xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          +{userBalance} CR Wallet
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium font-mono tabular-nums">
                          ${effectiveRate}/CR
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-xs leading-relaxed text-muted-foreground line-clamp-2 min-h-[2.5rem] mt-1">
                      {pkg.bestFor}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2.5 space-y-2 text-xs text-muted-foreground border-t border-border/50 flex-1">
                    {pkg.id === 'creator-forge' && (
                      <>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>660 Credits · Essential creator starter kit</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Basic + up to 2 Standard units</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Standard studio turnaround & 2 review rounds</span>
                        </div>
                      </>
                    )}
                    {pkg.id === 'studio-momentum' && (
                      <>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>1,160 Credits (includes +160 bonus credits)</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Basic, Standard + up to 2 Elite units</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Priority production queue & accelerated review</span>
                        </div>
                      </>
                    )}
                    {pkg.id === 'signature-collective' && (
                      <>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>1,920 Credits (maximum +320 bonus credits)</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Full access across all 39 service tiers</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>VIP turnaround & dedicated Lead Producer</span>
                        </div>
                      </>
                    )}
                  </CardContent>

                  <div className="p-4 pt-0">
                    <Button
                      type="button"
                      variant={isSelected ? 'default' : 'secondary'}
                      size="sm"
                      className={cn(
                        'w-full text-xs font-semibold gap-1.5 h-9 rounded-lg cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
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

          {/* Centered Bottom Tip & Newcomer Guide */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground pt-1 pb-2">
            <span className="font-semibold text-foreground/90">💡 1 CR ≈ one basic asset task</span>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <span>Higher packages include volume bonus credit multipliers</span>
            <span className="hidden sm:inline text-muted-foreground/40">•</span>
            <span>Unused credits roll over for 12 months</span>
          </div>
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
                2 OF 5 · PICK YOUR SERVICES
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Choose everything you need in one go.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Select the services, set the size and quantity, and watch your credits update instantly.
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
                {isWalletFunding ? 'Switch Funding Mode' : 'Change Package'}
              </Button>
            </div>
          </div>

          {isWalletFunding && remainingCredits < 0 && (
            <Alert variant="warning" className="rounded-xl border-amber-500/30 bg-amber-500/10">
              <Sparkles className="w-4 h-4 text-amber-600" />
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* LEFT COLUMN: AVAILABLE SERVICES & ADDITIONS (~65% / 8 cols) */}
            <div className="lg:col-span-8 space-y-6">
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
                        'group rounded-xl transition-all duration-200 overflow-hidden flex flex-col justify-between py-0 gap-0 shadow-2xs',
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
                                  'rounded-lg transition-all duration-200',
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
                              <ServiceImageHoverCard service={svc}>
                                <span className="inline-flex items-center gap-1.5 cursor-pointer group/title">
                                  <h3 className="text-sm font-bold text-foreground leading-snug truncate group-hover/title:text-amber-500 transition-colors">
                                    {svc.name}
                                  </h3>
                                  <span className="size-4 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground group-hover/title:bg-amber-500/20 group-hover/title:text-amber-600 transition-colors" title="Hover for deliverable preview">
                                    <Eye className="size-2.5" />
                                  </span>
                                </span>
                              </ServiceImageHoverCard>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
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
                            className="w-full text-xs font-semibold h-8 rounded-lg border-dashed hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Scope
                          </Button>
                        )}
                      </div>

                      {/* Card Bottom Drawer (Ultra-Compact Responsive Action Bar) */}
                      {isSelected && choice && (
                        <div className="bg-secondary/40 border-t border-border/80 px-3 sm:px-3.5 py-2 sm:py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-2.5">
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
                                    aria-label="Remove from scope"
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
            <div id="studio-cart-sidebar" className="lg:col-span-4 lg:sticky lg:top-[8.75rem] lg:h-[calc(100vh-15.5rem)] lg:min-h-[500px]">
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
                className="h-full"
              />
            </div>
          </div>

          {/* Mobile Floating Cart Summary Pill (Only visible on < 1024px screens when services are selected) */}
          {selectedEntries.length > 0 && (
            <div className="lg:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
              <div className="flex items-center justify-between p-2.5 pl-3.5 rounded-xl bg-zinc-950/95 dark:bg-zinc-900/95 text-white border border-amber-500/40 shadow-xl backdrop-blur-md pointer-events-auto">
                <div className="flex items-center gap-2 min-w-0">
                  <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-xs truncate">
                    <span className="font-bold text-white">
                      {selectedEntries.length} {selectedEntries.length === 1 ? 'service' : 'services'}
                    </span>
                    <span className="text-zinc-400 mx-1.5">·</span>
                    <span className="text-amber-400 font-extrabold font-mono tabular-nums">
                      {remainingCredits >= 0 ? `${remainingCredits} CR left` : `${Math.abs(remainingCredits)} CR over`}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="gold"
                  onClick={() => {
                    document.getElementById('studio-cart-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="font-bold text-xs h-7 px-3 rounded-xl shrink-0 cursor-pointer shadow-xs gap-1"
                >
                  <span>View Scope</span>
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
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
                3 OF 5 · WHAT CREDITS COVER
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Check what your credits can be used for.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Credits work for approved Humantek Art services only, so please check this before you continue.
              </p>
            </div>

            <Badge variant="secondary" className="w-fit text-xs font-semibold px-3 py-1 rounded-xl">
              Studio Policy Compliance
            </Badge>
          </div>

          {/* ReUI Standardized Announcement & Status Banner */}
          <StudioNoticeBanner type="step3-coverage" />

          {/* Two Equal Neutral Cards: Supported Deliverables | Restricted Guidelines (5-to-5 Symmetry) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
            {/* Supported Deliverables Card */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
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
                  <Badge variant="secondary" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-0 px-2.5 py-0.5">
                    Covered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3.5 flex flex-col justify-between flex-1">
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

                <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="size-3.5" />
                    Full commercial rights included
                  </span>
                  <span className="font-semibold text-foreground/80">39 catalog services</span>
                </div>
              </CardContent>
            </Card>

            {/* Restricted Content Card (Symmetrical 5-Item Rhythm & Collapsible) */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs flex flex-col overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
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
                  <Badge variant="secondary" className="text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-500/10 border-0 px-2.5 py-0.5">
                    Prohibited
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-3.5 flex flex-col justify-between flex-1">
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
                  <span className="text-xs text-muted-foreground">
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
                      <div className="rounded-xl border border-border/70 overflow-hidden overflow-x-auto bg-background [scrollbar-width:thin]">
                        <Table className="w-full min-w-[340px] text-xs">
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
                              <TableCell className="font-medium text-foreground py-2.5 px-3.5">Minor text or color change</TableCell>
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
                        <p className="text-muted-foreground leading-relaxed text-xs">
                          1 CR = $2.50 listed service value. Credits are deducted only after the studio confirms and approves the final brief.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Scope Tiers</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-xs">
                          Basic, Standard, and Elite are distinct alternative scopes. Select one tier per service item.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Included Revisions</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-xs">
                          Multi-round revisions apply within the approved direction. Major concept changes adhere to scope rates.
                        </p>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>12-Month Rollover</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed text-xs">
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
                          <span className="text-xs leading-snug">Logos, emotes, badges, banners, and static screens.</span>
                        </div>
                        <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60">
                          <b className="text-foreground text-xs block mb-1">Motion & Video</b>
                          <span className="text-amber-600 font-bold block mb-1">5–7 Business Days</span>
                          <span className="text-xs leading-snug">Animated screens, alerts, video reels, and stingers.</span>
                        </div>
                        <div className="p-3.5 sm:p-4 rounded-xl bg-secondary/30 border border-border/60">
                          <b className="text-foreground text-xs block mb-1">VTuber & 3D Work</b>
                          <span className="text-amber-600 font-bold block mb-1">10–14 Business Days</span>
                          <span className="text-xs leading-snug">Full Live2D model art & rigging with milestone reviews.</span>
                        </div>
                      </div>
                      <p className="pt-1 text-xs">
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
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>Full commercial streaming & broadcasting license across all monetized creator channels.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>100% intellectual property ownership of delivered master art, 3D, and video assets upon delivery.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>Strict human-crafted production guarantee with zero unauthorized generative AI replication.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
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
            id="policy-ack-card"
            className={cn(
              'rounded-xl border transition-all cursor-pointer select-none scroll-mt-[140px]',
              policyAccepted
                ? 'border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/25 shadow-xs'
                : 'border-border/80 bg-card hover:border-amber-500/40 hover:shadow-2xs'
            )}
            onClick={() => setPolicyAccepted(!policyAccepted)}
          >
            <CardContent className="p-4 sm:p-4.5 flex items-start gap-3">
              <Checkbox
                id="policy-ack"
                checked={policyAccepted}
                onCheckedChange={(checked) => setPolicyAccepted(Boolean(checked))}
                className="mt-0.5 shrink-0 scroll-mt-[140px]"
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
        <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Step Top Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                4 OF 5 · YOUR PROJECT DETAILS
              </div>
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
              >
                Tell us what each item should include.
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                Add your brief, reference images, and any extras, then confirm the terms.
              </p>
            </div>

            <Badge variant="outline" className="w-fit text-xs font-semibold px-3 py-1 rounded-xl">
              Project ID: {projectId}
            </Badge>
          </div>

          {/* Centered Main Form Card (Compact Layout Skeleton to Minimize Scrolling) */}
          <Card className="rounded-xl border border-border/80 bg-card shadow-2xs p-4 sm:p-5 space-y-3.5 sm:space-y-4">
            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Your Name */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('clientName')} className="text-xs font-semibold text-foreground">
                  Your Name <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input
                  {...brief.fieldProps('clientName')}
                  autoComplete="name"
                  maxLength={BRIEF_LIMITS.clientName.max}
                  placeholder="Your full legal or creator name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('clientName')} message={brief.getError('clientName')} />
              </div>

              {/* Channel / Brand Name */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('channelName')} className="text-xs font-semibold text-foreground">
                  Channel / Brand Name
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

              {/* Email */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('email')} className="text-xs font-semibold text-foreground">
                  Email Address <span className="text-destructive font-semibold">*</span>
                </Label>
                <Input
                  {...brief.fieldProps('email')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  maxLength={BRIEF_LIMITS.email.max}
                  placeholder="creator@channel.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('email')} message={brief.getError('email')} />
              </div>

              {/* Primary Platform */}
              <div className="space-y-1 scroll-mt-[140px]">
                <Label htmlFor={briefFieldId('platform')} className="text-xs font-semibold text-foreground">
                  Primary Platform
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
                  Preferred Art Style
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
                  Color Palette / Themes
                </Label>
                <Input
                  {...brief.fieldProps('colors')}
                  maxLength={BRIEF_LIMITS.colors.max}
                  placeholder="e.g. #FF007F Neon Pink, Cyan, Deep Slate"
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  className="rounded-lg h-9 text-xs sm:text-sm bg-background/50 scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('colors')} message={brief.getError('colors')} />
              </div>

              {/* Instructions Full Width */}
              <div className="space-y-1 sm:col-span-2 scroll-mt-[140px]">
                <div className="flex items-center justify-between">
                  <Label htmlFor={briefFieldId('instructions')} className="text-xs font-semibold text-foreground">
                    Creative Brief & Asset Instructions <span className="text-destructive font-semibold">*</span>
                  </Label>
                  <span
                    className={cn(
                      'text-xs font-mono tabular-nums',
                      instructions.trim().length < BRIEF_LIMITS.instructions.min
                        ? 'text-muted-foreground'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {instructions.trim().length.toLocaleString()} / {BRIEF_LIMITS.instructions.max.toLocaleString()}
                  </span>
                </div>
                <Textarea
                  {...brief.fieldProps('instructions')}
                  maxLength={BRIEF_LIMITS.instructions.max}
                  placeholder="Detail exact text, expressions for emotes, character poses, references, and delivery formats..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={3}
                  className="rounded-lg text-xs sm:text-sm leading-relaxed bg-background/50 py-2 resize-y scroll-mt-[140px]"
                />
                <FieldError id={briefFieldId('instructions')} message={brief.getError('instructions')} />
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
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
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
                  className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-xs text-muted-foreground text-center sm:text-left cursor-pointer outline-none transition-colors hover:border-amber-400/70 hover:bg-amber-50/40 focus-visible:ring-2 focus-visible:ring-amber-500/40 data-[dragging]:border-amber-500 data-[dragging]:bg-amber-50/70 data-[dragging]:text-amber-700 dark:hover:bg-amber-500/5 dark:data-[dragging]:bg-amber-500/10"
                >
                  <ImageIcon className="size-3.5 shrink-0 text-amber-600" />
                  <span className="leading-snug">
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
                          <AttachmentTitle className="text-xs">{f.filename}</AttachmentTitle>
                          <AttachmentDescription className="text-2xs">
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
                          <AttachmentTitle className="text-xs">{name}</AttachmentTitle>
                          <AttachmentDescription className="text-2xs">
                            Uploading…
                          </AttachmentDescription>
                        </AttachmentContent>
                      </Attachment>
                    ))}
                  </AttachmentGroup>
                )}
              </div>

              {/* Promo Code Panel */}
              <div className="p-3 sm:p-3.5 rounded-xl bg-secondary/30 border border-border/70 flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <b className="text-xs font-bold text-foreground">
                      Promo Code
                    </b>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                    Have a sponsor or promo code? Apply it to your project.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <Input
                    id="brief-redeemCode"
                    aria-label="Promo code"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={BRIEF_LIMITS.redeemCode.max}
                    placeholder="e.g. HT-VIP-2026"
                    value={redeemCodeInput}
                    onChange={(e) => {
                      setRedeemCodeInput(e.target.value.toUpperCase());
                      setRedeemCodeAttached(false);
                    }}
                    className="h-9 text-xs font-mono rounded-lg bg-card flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant={redeemCodeAttached ? 'secondary' : 'default'}
                    size="sm"
                    onClick={async () => {
                      const parsed = redeemCodeSchema.safeParse(redeemCodeInput);
                      if (!parsed.success || !parsed.data) {
                        toast.error(parsed.success ? 'Please enter a promo code' : parsed.error.issues[0]?.message);
                        return;
                      }
                      const clean = parsed.data;
                      setRedeemCodeInput(clean);
                      try {
                        const data = await redeemPromoMutation.mutateAsync({
                          code: clean,
                          email: email || userEmail,
                        });
                        setRedeemCodeAttached(true);
                        useNotificationStore.getState().addNotification({
                          title: 'Promo Code Applied',
                          description: `Code ${clean} redeemed: +${data.creditsAdded} CR added to your wallet.`,
                          iconType: 'credits',
                          link: '/redeem-code',
                        });
                        toast.success(`Promo code redeemed! +${data.creditsAdded} CR added to your balance.`);
                      } catch (err: unknown) {
                        const apiErr = err as { status?: number; message?: string };
                        if (apiErr.status === 409) {
                          setRedeemCodeAttached(true);
                          toast.info(`Promo code attached: ${clean}`);
                        } else {
                          toast.error(apiErr.message || 'Failed to redeem promo code');
                        }
                      }
                    }}
                    className="text-xs shrink-0 font-semibold h-9 px-3.5 rounded-lg cursor-pointer"
                  >
                    {redeemCodeAttached ? 'Applied ✓' : 'Apply & Redeem'}
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

            {/* Collapsible Terms & Conditions */}
            <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
              <Collapsible open={isTermsExpanded} onOpenChange={setIsTermsExpanded}>
                <CollapsibleTrigger className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left font-bold text-foreground text-xs sm:text-sm hover:bg-secondary/40 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30">
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
                      <p key={idx} className="text-xs text-muted-foreground leading-relaxed pl-3 border-l-2 border-amber-500/30">
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
                termsAccepted
                  ? 'border-amber-500/80 bg-amber-500/[0.03] ring-1 ring-amber-500/25 shadow-xs'
                  : 'border-border/80 bg-card hover:border-amber-500/40 hover:shadow-2xs'
              )}
              onClick={() => setTermsAccepted(!termsAccepted)}
            >
              <CardContent className="p-4 sm:p-4.5 flex items-start gap-3">
                <Checkbox
                  id="terms-ack"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                  className="mt-0.5 shrink-0 scroll-mt-[140px]"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="terms-ack" className="text-xs font-bold text-foreground cursor-pointer block">
                    Terms Confirmation <span className="text-destructive font-semibold">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
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
        <div className="space-y-6 animate-in fade-in duration-200 pb-36 sm:pb-16">
          {submittedProject ? (
            /* Order Confirmed Screen */
            <Card className="max-w-lg w-full mx-auto rounded-2xl border border-border/80 bg-card p-6 sm:p-8 space-y-6 shadow-sm text-center animate-in fade-in zoom-in-95 duration-200">
              {/* Green Check Icon */}
              <div className="size-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
                <Check className="size-6 stroke-[2.5]" />
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground outline-none"
                >
                  Order confirmed
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  We&apos;ve received your order. Our team will review your details and message you if they need anything.
                </p>
              </div>

              {/* Order Spec Snapshot Card */}
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 sm:p-5 text-left text-xs divide-y divide-border/60 shadow-2xs space-y-3">
                {/* 1. Project Code with Copy */}
                <div className="flex items-center justify-between pt-0 first:pt-0">
                  <span className="text-muted-foreground font-medium">Project code</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground text-xs sm:text-sm tracking-wide">
                      {submittedProject.projectCode}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(submittedProject.projectCode);
                        toast.success('Project code copied to clipboard');
                      }}
                      className="size-6 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                      title="Copy project code"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </div>

                {/* 2. Package */}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-muted-foreground font-medium">Package</span>
                  <span className="font-semibold text-foreground text-xs sm:text-sm">
                    {submittedProject.packageName}
                  </span>
                </div>

                {/* 3. Credits */}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-muted-foreground font-medium">Credits</span>
                  <span className="font-semibold text-foreground text-xs sm:text-sm">
                    {submittedProject.fundingSource === 'wallet'
                      ? `${submittedProject.usedCredits} credits used`
                      : `${submittedProject.usedCredits} of ${submittedProject.packageCredits} used`}
                  </span>
                </div>

                {/* 4. Status */}
                <div className="flex items-center justify-between pt-3">
                  <span className="text-muted-foreground font-medium">Status</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-xs sm:text-sm text-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Brief review
                  </span>
                </div>
              </div>

              {/* Payment & Receipt Note */}
              <p className="text-xs text-muted-foreground leading-normal">
                {submittedProject.fundingSource === 'wallet'
                  ? `Funded with ${submittedProject.usedCredits} credits`
                  : `Paid $${submittedProject.packagePrice.toLocaleString()} USD`}
                {submittedProject.email ? ` · Receipt sent to ${submittedProject.email}` : ''}
              </p>

              {/* Actions: Flat Primary Button & Text Link */}
              <div className="space-y-2 pt-1 w-full">
                <Link href="/projects" className="block w-full">
                  <Button
                    type="button"
                    variant="default"
                    size="lg"
                    className="w-full h-10 font-semibold text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs cursor-pointer transition-colors"
                  >
                    <span>View my project</span>
                    <ArrowRight className="size-4 ml-1" />
                  </Button>
                </Link>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setChatOpen(true, submittedProject.id)}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-8 cursor-pointer"
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Message our team</span>
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => resetWizard()}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5 h-8 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Start another project</span>
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            /* Order Review and Payment View */
            <>
              {/* Step Top Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5 sm:pb-4">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    5 OF 5 · REVIEW &amp; PAY
                  </div>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="scroll-mt-[140px] text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground lg:text-3xl outline-none"
                  >
                    Ready to submit?
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                    Check your package, services, brief, and balance, then pay securely with PayPal.
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
                  <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
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

                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-2.5 sm:p-3 rounded-lg bg-secondary/40 border border-border/60 text-center">
                      <div className="min-w-0">
                        <span className="text-2xs sm:text-xs text-muted-foreground uppercase font-bold block truncate">Selected Plan</span>
                        <b className="text-2xs sm:text-sm text-foreground mt-0.5 block truncate">{currentPackage.name}</b>
                      </div>
                      <div className="min-w-0">
                        <span className="text-2xs sm:text-xs text-muted-foreground uppercase font-bold block truncate">Package Value</span>
                        <b className="text-2xs sm:text-sm text-amber-600 dark:text-amber-400 font-black mt-0.5 block font-mono tabular-nums truncate">
                          ${currentPackage.price.toLocaleString()} USD
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
                    <CardHeader className="p-4 sm:p-5 pb-2.5 border-b border-border/60 flex flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                        <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider truncate">
                          Deliverables ({selectedEntries.length})
                        </CardTitle>
                      </div>
                      <CreditValue value={usedCredits} size="sm" variant="pill" suffix="CR Used" className="shrink-0" />
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-3">
                      {selectedEntries.length === 0 ? (
                        <div className="py-6 px-4 text-center rounded-xl bg-secondary/20 border border-dashed border-border/80 space-y-2">
                          <Sparkles className="w-5 h-5 text-amber-600/80 mx-auto" />
                          <b className="text-xs sm:text-sm font-semibold text-foreground block">
                            No specific services pre-allocated
                          </b>
                          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                            Your full balance of <b className="font-mono tabular-nums">{totalPackageCredits} Credits</b> will remain active in your studio wallet for 12 months, ready to deploy on any creative request on-demand.
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
                                  <TableCell className="py-2 text-xs font-bold text-foreground max-w-[130px] sm:max-w-none truncate sm:whitespace-normal">
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
                  <Card className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
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
                          className="h-auto px-0 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0"
                        >
                          Edit Brief
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-xs font-medium text-muted-foreground block">Creator / Client</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {clientName || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-xs font-medium text-muted-foreground block">Email Address</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-all">
                          {email || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-xs font-medium text-muted-foreground block">Channel / Brand</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {channelName || 'Not specified'}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-secondary/25 border border-border/50">
                        <span className="text-xs font-medium text-muted-foreground block">Art Style & Palette</span>
                        <p className="text-xs font-semibold text-foreground mt-0.5 break-words">
                          {style || 'Studio Selected'}{colors ? ` · ${colors}` : ''}
                        </p>
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
                      <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground border-t border-border/40">
                        <Upload className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>{uploadedFiles.length} reference file(s) attached to brief</span>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Right Column: Checkout & Actions */}
                <div id="studio-checkout-section" className="lg:col-span-6 space-y-4">
                  <Card className="rounded-xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm space-y-5">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {isWalletFunding ? 'Wallet Credit Settlement' : 'Secure Studio Checkout'}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {isWalletFunding
                          ? 'Settle project scope instantly using your active Studio Credit balance ($0.00 USD).'
                          : 'Pay with PayPal, credit/debit card, or submit for agency invoice.'}
                      </p>
                    </div>

                    {/* Order Line-Item Breakdown */}
                    <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-2 text-xs">
                      {isWalletFunding ? (
                        <>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Funding Source</span>
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <Wallet className="w-3.5 h-3.5 text-amber-500" /> Global Studio Wallet
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Current Available Balance</span>
                            <span className="font-semibold text-foreground">{userBalance} CR</span>
                          </div>
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
                            <span>Service Scope Total</span>
                            <span>{usedCredits} CR</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Wallet Deduction</span>
                            <span className="font-semibold text-foreground font-mono tabular-nums">-{usedCredits} CR</span>
                          </div>
                          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span>Remaining Balance After Launch</span>
                            <span className="font-mono tabular-nums">{Math.max(0, userBalance - usedCredits)} CR</span>
                          </div>
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                            <span>Total Due Today</span>
                            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                              $0.00 USD
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>{currentPackage.name} Package</span>
                            <span className="font-semibold text-foreground font-mono tabular-nums">${currentPackage.price.toLocaleString()} USD</span>
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
                          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
                            <span>Service Scope Used</span>
                            <span className="font-semibold font-mono tabular-nums">-{usedCredits} CR</span>
                          </div>
                          {totalUsableCredits > usedCredits && (
                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Rollover to Global Wallet</span>
                              <span className="font-mono tabular-nums">+{totalUsableCredits - usedCredits} CR</span>
                            </div>
                          )}
                          {redeemCodeAttached && (
                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Promo Code: {redeemCodeInput}</span>
                              <span>Applied</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-sm font-bold text-foreground">
                            <span>Total Due</span>
                            <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                              ${currentPackage.price.toLocaleString()} USD
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Payment / Wallet Settlement Action */}
                    <div className="space-y-3">
                      {isWalletFunding ? (
                        <div className="space-y-2">
                          <Button
                            type="button"
                            size="lg"
                            loading={isSubmitting}
                            loadingText="Launching Project..."
                            disabled={userBalance < usedCredits}
                            onClick={handleLaunchWithWallet}
                            className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Sparkles className="w-4 h-4" /> Confirm & Launch with {usedCredits} Credits ($0.00 USD)
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
                              if (proj && proj.id) {
                                setSubmittedProject(proj);
                                registerProject({
                                  id: proj.id,
                                  projectCode: proj.projectCode,
                                  packageName: proj.packageName,
                                  clientName: proj.clientName,
                                  status: proj.status,
                                  price: proj.packagePrice,
                                  credits: proj.packageCredits,
                                });
                                useNotificationStore.getState().addNotification({
                                  title: 'Payment Confirmed',
                                  description: `Project HT-${proj.projectCode} payment received. Production initiated.`,
                                  iconType: 'check',
                                  link: '/projects',
                                });
                                toast.success(
                                  appliedWalletCredits > 0
                                    ? `Success! Project launched with ${proj.packageName} + ${appliedWalletCredits} CR applied from your Studio Wallet!`
                                    : `Success! Project HT-${proj.projectCode} payment confirmed!`
                                );
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
                        <span className="font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {isSubmitting ? 'Submitting review...' : 'Request review (no payment yet) →'}
                        </span>
                      </button>
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
                        <span>Have questions about this brief? Chat with our team →</span>
                      </Button>
                    </div>

                    {/* Security & SLA Badges */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-center gap-2 text-2xs text-muted-foreground/70">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600/80" /> 256-Bit SSL
                      </span>
                      <span>·</span>
                      <span>PayPal Protection</span>
                      <span>·</span>
                      <span>Studio SLA</span>
                    </div>
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
