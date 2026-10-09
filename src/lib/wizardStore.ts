'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SERVICES, PACKAGES } from '@/lib/catalog';
import type {
  ServiceSelection,
  ServiceTierLevel,
  UploadedFile,
  ProjectRecord,
} from '@/types';

export interface WizardBriefState {
  channelName: string;
  platform: string;
  style: string;
  colors: string;
  instructions: string;
}

const INITIAL_BRIEF: WizardBriefState = {
  channelName: '',
  platform: '',
  style: '',
  colors: '',
  instructions: '',
};

const createProjectId = () =>
  `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export interface WizardStoreState {
  projectId: string;
  currentStep: number;
  selectedPackageId: string;
  fundingSource: 'wallet' | 'package' | 'hybrid';
  applyWalletCredits: boolean;
  activeCategory: string;
  priceFilter: string;

  selections: Record<string, ServiceSelection>;
  additions: string[];
  policyAccepted: boolean;
  openPolicyAccordion: string[];
  showAllRestricted: boolean;
  termsAccepted: boolean;
  isTermsExpanded: boolean;

  brief: WizardBriefState;
  uploadedFiles: UploadedFile[];
  redeemCodeInput: string;
  redeemCodeAttached: boolean;

  isSubmitting: boolean;
  errorMessage: string;
  submittedProject: ProjectRecord | null;
  savedAt?: number;
  isHydrated: boolean;

  // Actions
  generateNewProjectId: () => string;
  setHydrated: (hydrated: boolean) => void;
  setStep: (step: number) => void;
  setSelectedPackageId: (id: string) => void;
  setFundingSource: (source: 'wallet' | 'package' | 'hybrid') => void;
  setApplyWalletCredits: (apply: boolean) => void;
  setActiveCategory: (cat: string) => void;
  setPriceFilter: (filter: string) => void;

  setSelections: (
    selections:
      | Record<string, ServiceSelection>
      | ((prev: Record<string, ServiceSelection>) => Record<string, ServiceSelection>)
  ) => void;
  toggleService: (serviceId: string) => void;
  updateServiceTier: (serviceId: string, level: ServiceTierLevel) => void;
  updateServiceQuantity: (serviceId: string, quantity: number) => void;
  removeService: (serviceId: string) => void;
  clearAllServices: () => void;

  setAdditions: (additions: string[] | ((prev: string[]) => string[])) => void;
  toggleAddition: (extra: string) => void;

  setPolicyAccepted: (accepted: boolean) => void;
  setOpenPolicyAccordion: (sections: string[]) => void;
  setShowAllRestricted: (show: boolean) => void;

  setTermsAccepted: (accepted: boolean) => void;
  setIsTermsExpanded: (expanded: boolean) => void;

  updateBriefField: (field: keyof WizardBriefState, value: string) => void;
  setBrief: (patch: Partial<WizardBriefState>) => void;

  setUploadedFiles: (
    files: UploadedFile[] | ((prev: UploadedFile[]) => UploadedFile[])
  ) => void;
  addUploadedFile: (file: UploadedFile) => void;
  removeUploadedFile: (id: string) => void;

  setRedeemCodeInput: (code: string) => void;
  setRedeemCodeAttached: (attached: boolean) => void;

  setIsSubmitting: (submitting: boolean) => void;
  setErrorMessage: (msg: string) => void;
  setSubmittedProject: (project: ProjectRecord | null) => void;

  resetWizard: () => void;
}

export const useWizardStore = create<WizardStoreState>()(
  persist(
    (set) => ({
      projectId: '',
      currentStep: 1,
      selectedPackageId: '',
      fundingSource: 'package',
      applyWalletCredits: true,
      activeCategory: 'All',
      priceFilter: 'all',

      selections: {},
      additions: [],
      policyAccepted: false,
      openPolicyAccordion: [],
      showAllRestricted: false,
      termsAccepted: false,
      isTermsExpanded: false,

      brief: INITIAL_BRIEF,
      uploadedFiles: [],
      redeemCodeInput: '',
      redeemCodeAttached: false,

      isSubmitting: false,
      errorMessage: '',
      submittedProject: null,
      savedAt: 0,
      isHydrated: false,

      generateNewProjectId: () => {
        const id = createProjectId();
        set({ projectId: id });
        return id;
      },
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
      setStep: (step) => set({ currentStep: Math.max(1, Math.min(5, step)) }),
      setSelectedPackageId: (id) => set({ selectedPackageId: id }),
      setFundingSource: (source) => set({ fundingSource: source }),
      setApplyWalletCredits: (apply) => set({ applyWalletCredits: apply }),
      setActiveCategory: (cat) => set({ activeCategory: cat }),
      setPriceFilter: (filter) => set({ priceFilter: filter }),

      setSelections: (updater) =>
        set((state) => ({
          selections: typeof updater === 'function' ? updater(state.selections) : updater,
        })),

      toggleService: (serviceId) =>
        set((state) => {
          const next = { ...state.selections };
          if (next[serviceId]) {
            delete next[serviceId];
          } else {
            next[serviceId] = { level: 0, quantity: 1 };
          }
          return { selections: next };
        }),

      updateServiceTier: (serviceId, level) =>
        set((state) => ({
          selections: {
            ...state.selections,
            [serviceId]: {
              level,
              quantity: state.selections[serviceId]?.quantity || 1,
            },
          },
        })),

      updateServiceQuantity: (serviceId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const next = { ...state.selections };
            delete next[serviceId];
            return { selections: next };
          }
          return {
            selections: {
              ...state.selections,
              [serviceId]: {
                level: state.selections[serviceId]?.level ?? 0,
                quantity,
              },
            },
          };
        }),

      removeService: (serviceId) =>
        set((state) => {
          const next = { ...state.selections };
          delete next[serviceId];
          return { selections: next };
        }),

      clearAllServices: () => set({ selections: {} }),

      setAdditions: (updater) =>
        set((state) => ({
          additions: typeof updater === 'function' ? updater(state.additions) : updater,
        })),

      toggleAddition: (extra) =>
        set((state) => ({
          additions: state.additions.includes(extra)
            ? state.additions.filter((a) => a !== extra)
            : [...state.additions, extra],
        })),

      setPolicyAccepted: (accepted) => set({ policyAccepted: accepted }),
      setOpenPolicyAccordion: (sections) => set({ openPolicyAccordion: sections }),
      setShowAllRestricted: (show) => set({ showAllRestricted: show }),

      setTermsAccepted: (accepted) => set({ termsAccepted: accepted }),
      setIsTermsExpanded: (expanded) => set({ isTermsExpanded: expanded }),

      updateBriefField: (field, value) =>
        set((state) => ({
          brief: { ...state.brief, [field]: value },
        })),

      setBrief: (patch) =>
        set((state) => ({
          brief: { ...state.brief, ...patch },
        })),

      setUploadedFiles: (updater) =>
        set((state) => ({
          uploadedFiles:
            typeof updater === 'function' ? updater(state.uploadedFiles) : updater,
        })),

      addUploadedFile: (file) =>
        set((state) => ({
          uploadedFiles: [...state.uploadedFiles, file],
        })),

      removeUploadedFile: (id) =>
        set((state) => ({
          uploadedFiles: state.uploadedFiles.filter((f) => f.id !== id),
        })),

      setRedeemCodeInput: (code) => set({ redeemCodeInput: code }),
      setRedeemCodeAttached: (attached) => set({ redeemCodeAttached: attached }),

      setIsSubmitting: (submitting) => set({ isSubmitting: submitting }),
      setErrorMessage: (msg) => set({ errorMessage: msg }),
      setSubmittedProject: (project) => set({ submittedProject: project }),

      resetWizard: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('humantek_wizard_cart');
          } catch {
            // Ignore storage removal errors
          }
        }
        set({
          projectId: createProjectId(),
          currentStep: 1,
          selectedPackageId: '',
          fundingSource: 'package',
          applyWalletCredits: true,
          activeCategory: 'All',
          priceFilter: 'all',
          selections: {},
          additions: [],
          policyAccepted: false,
          openPolicyAccordion: [],
          showAllRestricted: false,
          termsAccepted: false,
          isTermsExpanded: false,
          brief: INITIAL_BRIEF,
          uploadedFiles: [],
          redeemCodeInput: '',
          redeemCodeAttached: false,
          isSubmitting: false,
          errorMessage: '',
          submittedProject: null,
          savedAt: typeof window !== 'undefined' ? Date.now() : 0,
        });
      },
    }),
    {
      name: 'humantek_wizard_cart',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      skipHydration: true,
      partialize: (state) => ({
        projectId: state.projectId,
        selectedPackageId: state.selectedPackageId,
        fundingSource: state.fundingSource,
        currentStep: state.currentStep,
        selections: Object.fromEntries(
          Object.entries(state.selections).map(([id, s]) => [
            id,
            { level: s.level, quantity: s.quantity },
          ])
        ),
        additions: state.additions,
        policyAccepted: state.policyAccepted,
        termsAccepted: state.termsAccepted,
        brief: {
          channelName: state.brief.channelName,
          platform: state.brief.platform,
          style: state.brief.style,
          colors: state.brief.colors,
          instructions: state.brief.instructions,
        },
        savedAt: Date.now(),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.projectId) {
          state.projectId = createProjectId();
        }
        state.isHydrated = true;
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        if (state.savedAt && Date.now() - state.savedAt > SEVEN_DAYS_MS) {
          state.resetWizard();
          return;
        }

        // Validate service IDs against catalog
        const validServiceIds = new Set(SERVICES.map((s) => s.id));
        const cleaned: Record<string, ServiceSelection> = {};
        for (const [id, choice] of Object.entries(state.selections || {})) {
          if (validServiceIds.has(id)) {
            cleaned[id] = choice;
          }
        }
        state.selections = cleaned;

        // Validate package ID
        const validPackageIds = new Set([...PACKAGES.map((p) => p.id), 'studio-wallet']);
        if (state.selectedPackageId && !validPackageIds.has(state.selectedPackageId)) {
          state.selectedPackageId = '';
        }
      },
    }
  )
);
