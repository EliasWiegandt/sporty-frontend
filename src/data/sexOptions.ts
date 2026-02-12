import type { Sex } from './intakeSchema';

export type SexOption = {
  value: Sex;
  label: string;
};

export const SEX_OPTIONS: SexOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

