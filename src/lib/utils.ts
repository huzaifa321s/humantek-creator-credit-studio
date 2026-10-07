import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatStudioDate(dateInput?: string | number | Date | null): string {
  if (!dateInput) return ''
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  payment_confirmed: 'Payment Confirmed',
  in_production: 'In Production',
  review_round: 'Review Round',
  delivered: 'Delivered',
  declined: 'Declined',
}

export function getProjectStatusLabel(status?: string): string {
  if (!status) return 'Unknown'
  return PROJECT_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Pending',
}

export function getPaymentStatusLabel(status?: string): string {
  if (!status) return 'Unknown'
  return PAYMENT_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  package_purchase: 'Package Purchase',
  service_deduction: 'Service Scope',
  promo_credit: 'Promo Code',
  refund: 'Refund',
}

export function getTransactionTypeLabel(type?: string): string {
  if (!type) return 'Unknown'
  return TRANSACTION_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

