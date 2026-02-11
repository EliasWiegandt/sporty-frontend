import type { MeasurementSystem } from './units';

export const MEASUREMENT_SYSTEM_STORAGE_KEY = 'sporty:measurement-system:v1';

const isMeasurementSystem = (value: unknown): value is MeasurementSystem =>
  value === 'metric' || value === 'imperial';

const readStoredSystem = (): MeasurementSystem | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored =
      window.sessionStorage.getItem(MEASUREMENT_SYSTEM_STORAGE_KEY) ??
      window.localStorage.getItem(MEASUREMENT_SYSTEM_STORAGE_KEY);
    if (isMeasurementSystem(stored)) return stored;
  } catch {
    // ignore storage errors
  }
  return null;
};

const localeDefaultSystem = (): MeasurementSystem => {
  if (typeof navigator === 'undefined') return 'metric';

  const locale = navigator.language || '';
  const parts = locale.split('-');
  const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';

  return region === 'US' ? 'imperial' : 'metric';
};

export const resolveMeasurementSystem = (preferredFromProfile?: unknown): MeasurementSystem => {
  if (isMeasurementSystem(preferredFromProfile)) {
    return preferredFromProfile;
  }

  const stored = readStoredSystem();
  if (stored) return stored;

  return localeDefaultSystem();
};

export const resolveMeasurementSystemOnClient = (
  preferredFromProfile?: unknown,
): MeasurementSystem => {
  if (typeof window === 'undefined') {
    return 'metric';
  }
  return resolveMeasurementSystem(preferredFromProfile);
};

export const persistMeasurementSystemLocal = (system: MeasurementSystem): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(MEASUREMENT_SYSTEM_STORAGE_KEY, system);
    window.localStorage.setItem(MEASUREMENT_SYSTEM_STORAGE_KEY, system);
  } catch {
    // ignore storage errors
  }
};

export const persistMeasurementSystemForUser = async (
  client: any,
  userId: string,
  system: MeasurementSystem,
): Promise<void> => {
  if (!client || !userId) return;

  const { error } = await client
    .from('profiles')
    .update({ preferred_measurement_system: system })
    .eq('id', userId);

  if (error) {
    throw error;
  }
};
