export type MeasurementFieldConfig = {
  id: string;
  label: string;
  unit: string;
  hint: string;
  help: string[];
  min: number;
  max: number;
  step?: number;
  required?: boolean;
};

export const measurementFields: MeasurementFieldConfig[] = [
  {
    id: 'height_cm',
    label: 'Height',
    unit: 'cm',
    hint: 'Most adults fall between 150–200 cm.',
    help: [
      'Stand tall against a wall without shoes.',
      'Use a flat object on your head and mark the wall.',
      'Measure from the floor to the mark.',
    ],
    min: 120,
    max: 230,
    step: 1,
  },
  {
    id: 'weight_kg',
    label: 'Weight',
    unit: 'kg',
    hint: 'Most adults fall between 45–120 kg.',
    help: [
      'Use a calibrated scale on a hard surface.',
      'Weigh yourself in light clothing, no shoes.',
    ],
    min: 35,
    max: 200,
    step: 0.5,
  },
  {
    id: 'arm_span_cm',
    label: 'Arm span',
    unit: 'cm',
    hint: 'Usually similar to your height (height ±10 cm).',
    help: [
      'Extend both arms horizontally at shoulder height.',
      'Measure fingertip to fingertip across your back.',
    ],
    min: 100,
    max: 250,
    step: 1,
  },
  {
    id: 'leg_inseam_cm',
    label: 'Leg inseam',
    unit: 'cm',
    hint: 'Most adults fall between 60–95 cm.',
    help: [
      'Stand straight with shoes off.',
      'Measure from the top of the inner thigh to the ankle bone.',
    ],
    min: 50,
    max: 130,
    step: 1,
  },
  {
    id: 'shoulder_width_cm',
    label: 'Shoulder width',
    unit: 'cm',
    hint: 'Typical range is 35–55 cm.',
    help: [
      'Find the outer points of each shoulder.',
      'Measure the straight line distance between them.',
    ],
    min: 30,
    max: 70,
    step: 0.5,
  },
  {
    id: 'hip_width_cm',
    label: 'Hip width',
    unit: 'cm',
    hint: 'Typical range is 32–48 cm.',
    help: [
      'Stand with feet together.',
      'Measure across the widest part of your hips.',
    ],
    min: 30,
    max: 70,
    step: 0.5,
  },
  {
    id: 'hand_length_cm',
    label: 'Hand length',
    unit: 'cm',
    hint: 'Typical range is 16–22 cm.',
    help: ['Measure from the wrist crease to the tip of the middle finger.'],
    min: 12,
    max: 30,
    step: 0.5,
  },
  {
    id: 'foot_length_cm',
    label: 'Foot length',
    unit: 'cm',
    hint: 'Typical range is 22–30 cm.',
    help: [
      'Trace your foot on paper while standing.',
      'Measure heel to longest toe along the outline.',
    ],
    min: 18,
    max: 35,
    step: 0.5,
  },
];

export default measurementFields;
