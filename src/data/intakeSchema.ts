export type Sex =
  | 'male'
  | 'female'
  | 'other'
  | 'prefer_not_to_say';

export type PastSportIntensity = 'light' | 'moderate' | 'intense' | 'elite';

export type PastSportDraft = {
  sport_subcategory_id: string | null;
  years_played: number | null;
  age_started_years: number | null;
  intensity: PastSportIntensity | null;
  liked: boolean | null;
  had_flair: boolean | null;
  achieved_skill: boolean | null;
};

export type PastSportInput = {
  sport_subcategory_id?: string | null;
  years_played?: number | null;
  age_started_years?: number | null;
  intensity?: PastSportIntensity | null;
  liked?: boolean | null;
  had_flair?: boolean | null;
  achieved_skill?: boolean | null;
};

export type FreeIntakeData = {
  birthday: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  arm_span_cm: number;
  leg_inseam_cm: number;
  shoulder_width_cm: number;
  pelvic_bone_width_cm: number;
  hand_length_cm: number;
  foot_length_cm: number;
  torso_length_cm: number;
  ankle_circumference_cm: number;
  wrist_circumference_cm: number;
  pastSports: PastSportInput[];
};

export type TraitAnswers = {
  muscle_fiber?: string;
  metabolic_tendency?: string;
  joint_laxity?: string;
  foot_arch?: string;
  temperature_tolerance?: string;
  handedness?: string;
  sport_side?: string;
};

export type PreferenceInput = {
  preference_id: string;
  priority: 'must_have' | 'nice_to_have';
};

export type GoalInput = {
  goal_id: string;
  priority: 'must_have' | 'nice_to_have';
};

export type InjuryInput = {
  injury_id: string;
  injury_subcategory_id?: string | null;
  severity: 'severe' | 'somewhat_bad' | 'mostly_healed';
  notes?: string | null;
};

export type PremiumOnlyInputs = {
  traits: TraitAnswers;
  preferences: PreferenceInput[];
  goals: GoalInput[];
  injuries: InjuryInput[];
};

export type PremiumIntakeData = FreeIntakeData & PremiumOnlyInputs;

type FreePayload = {
  birthday: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  arm_span_cm: number;
  leg_inseam_cm: number;
  shoulder_width_cm: number;
  pelvic_bone_width_cm: number;
  hand_length_cm: number;
  foot_length_cm: number;
  torso_length_cm: number;
  ankle_circumference_cm: number;
  wrist_circumference_cm: number;
  past_sports?: PastSportInput[];
  traits?: Record<string, string>;
  consent_preview?: boolean;
};

type PremiumPayload = {
  user_id: string;
  birthday: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  arm_span_cm: number;
  leg_inseam_cm: number;
  shoulder_width_cm: number;
  pelvic_bone_width_cm: number;
  hand_length_cm: number;
  foot_length_cm: number;
  torso_length_cm: number;
  ankle_circumference_cm: number;
  wrist_circumference_cm: number;
  past_sports?: PastSportInput[];
  premium: {
    apply_credit: true;
    preferences: PreferenceInput[];
    goals: GoalInput[];
    injuries: InjuryInput[];
  };
  traits?: Record<string, string>;
};

export function buildFreePayload(data: FreeIntakeData): FreePayload {
  const {
    birthday,
    sex,
    height_cm,
    weight_kg,
    arm_span_cm,
    leg_inseam_cm,
    shoulder_width_cm,
    pelvic_bone_width_cm,
    hand_length_cm,
    foot_length_cm,
    torso_length_cm,
    ankle_circumference_cm,
    wrist_circumference_cm,
    pastSports,
  } = data;

  const payload: FreePayload = {
    birthday,
    sex: sex || 'prefer_not_to_say',
    height_cm,
    weight_kg,
    arm_span_cm,
    leg_inseam_cm,
    shoulder_width_cm,
    pelvic_bone_width_cm,
    hand_length_cm,
    foot_length_cm,
    torso_length_cm,
    ankle_circumference_cm,
    wrist_circumference_cm,
    consent_preview: true,
  };

  const cleanedPastSports = (pastSports || []).filter((entry) => !!entry);
  if (cleanedPastSports.length) {
    payload.past_sports = cleanedPastSports;
  }

  return payload;
}

export function buildPremiumPayload(
  data: PremiumIntakeData,
  userId: string,
): PremiumPayload {
  const base = buildFreePayload(data);

  const traits: Record<string, string> = {};
  Object.entries(data.traits || {}).forEach(([key, value]) => {
    if (value) {
      traits[key] = value;
    }
  });

  const preferences = (data.preferences || []).filter(
    (entry) => !!entry && !!entry.preference_id,
  );
  const goals = (data.goals || []).filter(
    (entry) => !!entry && !!entry.goal_id,
  );
  const injuries = (data.injuries || []).filter(
    (entry) => !!entry && !!entry.injury_id,
  );

  const payload: PremiumPayload = {
    user_id: userId,
    birthday: base.birthday,
    sex: base.sex,
    height_cm: base.height_cm,
    weight_kg: base.weight_kg,
    arm_span_cm: base.arm_span_cm,
    leg_inseam_cm: base.leg_inseam_cm,
    shoulder_width_cm: base.shoulder_width_cm,
    pelvic_bone_width_cm: base.pelvic_bone_width_cm,
    hand_length_cm: base.hand_length_cm,
    foot_length_cm: base.foot_length_cm,
    torso_length_cm: base.torso_length_cm,
    ankle_circumference_cm: base.ankle_circumference_cm,
    wrist_circumference_cm: base.wrist_circumference_cm,
    past_sports: base.past_sports,
    premium: {
      apply_credit: true,
      preferences,
      goals,
      injuries,
    },
  };

  if (Object.keys(traits).length) {
    payload.traits = traits;
  }

  return payload;
}

