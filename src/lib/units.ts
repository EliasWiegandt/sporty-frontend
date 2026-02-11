export type MeasurementSystem = 'metric' | 'imperial';
export type MassUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

export type HeightDisplay = {
  feet: number | null;
  inches: number | null;
};

const CM_PER_INCH = 2.54;
const KG_PER_POUND = 0.45359237;

const WEIGHT_FIELDS = new Set(['weight_kg']);
const HEIGHT_FIELD = 'height_cm';

export const isWeightField = (fieldId: string): boolean => WEIGHT_FIELDS.has(fieldId);
export const isHeightField = (fieldId: string): boolean => fieldId === HEIGHT_FIELD;
export const isLengthField = (fieldId: string): boolean => fieldId.endsWith('_cm');

export const cmToIn = (cm: number): number => cm / CM_PER_INCH;
export const inToCm = (inches: number): number => inches * CM_PER_INCH;
export const kgToLb = (kg: number): number => kg / KG_PER_POUND;
export const lbToKg = (lb: number): number => lb * KG_PER_POUND;

const roundToStep = (value: number, step: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / step) * step;
};

const roundToDecimal = (value: number, places: number): number => {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

export const cmToFeetInches = (cm: number): HeightDisplay => {
  if (!Number.isFinite(cm)) {
    return { feet: null, inches: null };
  }
  const totalInches = cmToIn(cm);
  const roundedHalfInch = roundToStep(totalInches, 0.5);
  const feet = Math.floor(roundedHalfInch / 12);
  const inches = roundToStep(roundedHalfInch - feet * 12, 0.5);

  if (inches >= 12) {
    return {
      feet: feet + 1,
      inches: 0,
    };
  }

  return {
    feet,
    inches,
  };
};

export const feetInchesToCm = (feet: number, inches: number): number => {
  const normalizedFeet = Number.isFinite(feet) ? feet : 0;
  const normalizedInches = Number.isFinite(inches) ? inches : 0;
  const totalInches = normalizedFeet * 12 + normalizedInches;
  return inToCm(totalInches);
};

export const getDisplayStep = (fieldId: string, system: MeasurementSystem): number => {
  if (system === 'metric') {
    return isWeightField(fieldId) ? 0.5 : 1;
  }
  if (isWeightField(fieldId)) return 0.5;
  if (isHeightField(fieldId)) return 0.5;
  return 0.1;
};

export const displayUnitForField = (fieldId: string, system: MeasurementSystem): string => {
  if (system === 'metric') {
    return isWeightField(fieldId) ? 'kg' : 'cm';
  }
  if (isWeightField(fieldId)) return 'lb';
  if (isHeightField(fieldId)) return 'ft/in';
  return 'in';
};

export const toDisplayValue = (
  fieldId: string,
  metricValue: number,
  system: MeasurementSystem,
): number => {
  if (!Number.isFinite(metricValue)) return metricValue;
  if (system === 'metric') return metricValue;

  if (isWeightField(fieldId)) {
    return roundToStep(kgToLb(metricValue), 0.5);
  }

  if (isLengthField(fieldId)) {
    return roundToDecimal(cmToIn(metricValue), 1);
  }

  return metricValue;
};

export const toCanonicalMetric = (
  fieldId: string,
  displayValue: number,
  system: MeasurementSystem,
): number => {
  if (!Number.isFinite(displayValue)) return displayValue;
  if (system === 'metric') return displayValue;
  if (isWeightField(fieldId)) return lbToKg(displayValue);
  if (isLengthField(fieldId)) return inToCm(displayValue);
  return displayValue;
};

export const formatDisplayNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(value);
};

export const formatBoundaryValue = (
  fieldId: string,
  metricValue: number,
  system: MeasurementSystem,
): string => {
  if (system === 'metric') {
    return `${formatDisplayNumber(metricValue)} ${displayUnitForField(fieldId, system)}`;
  }

  if (isHeightField(fieldId)) {
    const height = cmToFeetInches(metricValue);
    if (height.feet === null || height.inches === null) return '';
    return `${height.feet} ft ${formatDisplayNumber(height.inches)} in`;
  }

  const converted = toDisplayValue(fieldId, metricValue, system);
  return `${formatDisplayNumber(converted)} ${displayUnitForField(fieldId, system)}`;
};

export const clampInRange = (value: number, min?: number, max?: number): number => {
  let next = value;
  if (typeof min === 'number' && next < min) next = min;
  if (typeof max === 'number' && next > max) next = max;
  return next;
};
