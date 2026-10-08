'use client';

import { useCallback, useMemo, useState } from 'react';
import { briefFieldsSchema, type BriefField } from '@/lib/validation';

/** Raw form values as typed by the user — the schema narrows and validates them. */
export type BriefFormValues = Record<BriefField, string>;

/** DOM id for each brief field — used for focus management and aria wiring. */
export const briefFieldId = (field: BriefField) => `brief-${field}`;

const FIELD_ORDER: BriefField[] = [
  'channelName',
  'platform',
  'style',
  'colors',
  'instructions',
];

/**
 * Client-side validation for the Step 4 creative brief, driven by the same
 * Zod schema the API enforces. Errors are revealed per field after blur, or
 * for every field once the user tries to continue.
 */
export function useBriefValidation(values: BriefFormValues) {
  const [touched, setTouched] = useState<Partial<Record<BriefField, boolean>>>({});
  const [showAll, setShowAll] = useState(false);

  const { channelName, platform, style, colors, instructions } = values;

  const errors = useMemo(() => {
    const result = briefFieldsSchema.safeParse({
      channelName,
      platform,
      style,
      colors,
      instructions,
    });
    const out: Partial<Record<BriefField, string>> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as BriefField | undefined;
        if (key && !out[key]) out[key] = issue.message;
      }
    }
    return out;
  }, [channelName, platform, style, colors, instructions]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = useCallback((field: BriefField) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  const getError = (field: BriefField): string | undefined =>
    showAll || touched[field] ? errors[field] : undefined;

  /** Accessible props to spread onto an input for a given field. */
  const fieldProps = (field: BriefField) => {
    const error = getError(field);
    return {
      id: briefFieldId(field),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${briefFieldId(field)}-error` : undefined,
      onBlur: () => markTouched(field),
    } as const;
  };

  /**
   * Reveals all errors and focuses the first invalid field.
   * Returns true when the brief is valid.
   */
  const validateAll = (): boolean => {
    setShowAll(true);
    const first = FIELD_ORDER.find((f) => errors[f]);
    if (first) {
      const el = document.getElementById(briefFieldId(first));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    }
    return !first;
  };

  return {
    errors,
    errorCount: Object.keys(errors).length,
    isValid,
    getError,
    markTouched,
    fieldProps,
    validateAll,
  };
}
