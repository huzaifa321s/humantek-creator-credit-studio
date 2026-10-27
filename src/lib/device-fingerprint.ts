'use client';

const DEVICE_STORAGE_KEY = 'ht_studio_machine_id';

/**
 * Generates a persistent per-computer/per-browser hardware & screen signature
 * so the developer audit vault can distinguish between multiple computers
 * sharing the same office Wi-Fi / Public WAN IP address.
 */
export function getClientDeviceFingerprint(): string {
  if (typeof window === 'undefined') return '';

  try {
    let machineId = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!machineId || !/^PC-[A-Z0-9]{6}$/.test(machineId)) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      machineId = `PC-${rand}`;
      localStorage.setItem(DEVICE_STORAGE_KEY, machineId);
    }

    const screenRes =
      window.screen?.width && window.screen?.height
        ? `${window.screen.width}x${window.screen.height}`
        : '';
    const cores =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? `${navigator.hardwareConcurrency}C`
        : '';

    const parts = [machineId, screenRes, cores].filter(Boolean);
    return `[${parts.join(' · ')}]`;
  } catch {
    return '';
  }
}
