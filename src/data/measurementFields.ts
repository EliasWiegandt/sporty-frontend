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
  group: 'core' | 'torso' | 'extremities';
};

export const measurementFields: MeasurementFieldConfig[] = [
  {
    id: 'height_cm',
    label: 'Height',
    unit: 'cm',
    hint: 'Stand tall against a wall without shoes. Use a flat object on your head and mark the wall. Measure from the floor to the mark.',
    help: [
      'Stand tall against a wall without shoes.',
      'Use a flat object on your head and mark the wall.',
      'Measure from the floor to the mark.',
    ],
    min: 120,
    max: 230,
    step: 1,
    group: 'core',
  },
  {
    id: 'weight_kg',
    label: 'Weight',
    unit: 'kg',
    hint: 'Use a calibrated scale on a hard surface. Weigh yourself in light clothing, no shoes.',
    help: [
      'Use a calibrated scale on a hard surface.',
      'Weigh yourself in light clothing, no shoes.',
    ],
    min: 35,
    max: 200,
    step: 0.5,
    group: 'core',
  },
  {
    id: 'arm_span_cm',
    label: 'Arm span',
    unit: 'cm',
    hint: 'Extend both arms horizontally at shoulder height. Measure fingertip to fingertip across your back.',
    help: [
      'Extend both arms horizontally at shoulder height.',
      'Measure fingertip to fingertip across your back.',
    ],
    min: 100,
    max: 250,
    step: 1,
    group: 'core',
  },
  {
    id: 'leg_inseam_cm',
    label: 'Leg inseam',
    unit: 'cm',
    hint: 'Stand straight with shoes off. Measure from the top of the inner thigh to the ankle bone.',
    help: [
      'Stand straight with shoes off.',
      'Measure from the top of the inner thigh to the ankle bone.',
    ],
    min: 50,
    max: 130,
    step: 1,
    group: 'core',
  },
  {
    id: 'shoulder_width_cm',
    label: 'Shoulder width',
    unit: 'cm',
    hint: 'Find the outer points of each shoulder. Measure the straight line distance between them.',
    help: [
      'Find the outer points of each shoulder.',
      'Measure the straight line distance between them.',
    ],
    min: 30,
    max: 70,
    step: 0.5,
    group: 'torso',
  },
  {
    id: 'pelvic_bone_width_cm',
    label: 'Pelvic bone width',
    unit: 'cm',
    hint: 'Measure the distance between the outer edges of your pelvic bones (iliac crests).',
    help: [
      'Measure the distance between the outer edges of your pelvic bones (iliac crests).',
    ],
    min: 30,
    max: 70,
    step: 0.5,
    group: 'torso',
  },
  {
    id: 'torso_length_cm',
    label: 'Torso length',
    unit: 'cm',
    hint: 'Sit upright against a wall on a flat surface. Measure from the sitting surface up to the top of your shoulder.',
    help: [
      'Sit upright against a wall on a flat surface.',
      'Measure from the sitting surface up to the top of your shoulder.',
    ],
    min: 30,
    max: 90,
    step: 0.5,
    group: 'torso',
  },
  {
    id: 'hand_length_cm',
    label: 'Hand length',
    unit: 'cm',
    hint: 'Measure from the wrist crease to the tip of the middle finger.',
    help: ['Measure from the wrist crease to the tip of the middle finger.'],
    min: 12,
    max: 30,
    step: 0.5,
    group: 'extremities',
  },
  {
    id: 'foot_length_cm',
    label: 'Foot length',
    unit: 'cm',
    hint: 'Trace your foot on paper while standing. Measure heel to longest toe along the outline.',
    help: [
      'Trace your foot on paper while standing.',
      'Measure heel to longest toe along the outline.',
    ],
    min: 18,
    max: 35,
    step: 0.5,
    group: 'extremities',
  },
  {
    id: 'ankle_circumference_cm',
    label: 'Ankle circumference',
    unit: 'cm',
    hint: 'Stand with weight evenly on both feet. Wrap the tape around the narrowest point above the ankle bone.',
    help: [
      'Stand with weight evenly on both feet.',
      'Wrap the tape around the narrowest point above the ankle bone.',
    ],
    min: 15,
    max: 40,
    step: 0.5,
    group: 'extremities',
  },
  {
    id: 'wrist_circumference_cm',
    label: 'Wrist circumference',
    unit: 'cm',
    hint: 'Relax your arm at your side. Wrap the tape around the narrowest part of the wrist just above the bone.',
    help: [
      'Relax your arm at your side.',
      'Wrap the tape around the narrowest part of the wrist just above the bone.',
    ],
    min: 12,
    max: 30,
    step: 0.5,
    group: 'extremities',
  },
];

export default measurementFields;
