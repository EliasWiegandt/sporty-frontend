export type TraitCatalogOption = {
  value: string;
  label: string;
  detail?: string;
};

export type TraitCatalogQuestion = {
  field: string;
  trait_key: string;
  label: string;
  description: string;
  options: TraitCatalogOption[];
};

export type MeasurementFieldConfig = {
  id: string;
  label: string;
  unit: 'cm' | 'kg' | 'ratio';
  hint: string;
  help: string[];
  quick_section?: 'fast_start' | 'tape_measurements';
  quick_order?: number;
  min: number;
  max: number;
  step?: number;
  required?: boolean;
  group: 'core' | 'torso' | 'extremities';
  is_ratio?: boolean;
};

export type InjuryCatalogOption = {
  id: string;
  name: string;
  description?: string;
};

export type InjuryCatalogSubcategory = {
  id: string;
  injury_id: string;
  name: string;
  definition?: string;
};

export type InjurySeverityOption = {
  id: string;
  label: string;
  guidance?: string;
  is_default: boolean;
};

export type PastSportIntensityOption = {
  id: string;
  label: string;
  is_default: boolean;
};

export type PastSportBooleanFieldConfig = {
  label: string;
  true_label: string;
  false_label: string;
  unknown_label: string;
};

export type IntakeCatalog = {
  version: number;
  traits: {
    version: number;
    intake: {
      questions: TraitCatalogQuestion[];
    };
  };
  measurements: {
    adult_free: MeasurementFieldConfig[];
    adult_premium: MeasurementFieldConfig[];
    child: MeasurementFieldConfig[];
    required: {
      adult_free: string[];
      adult_premium: string[];
      child: string[];
    };
  };
  preferences: {
    version: number;
    options: Array<{ id: string; name: string; description?: string }>;
    priority_options: Array<{ id: string; label: string; weight: number; is_default: boolean }>;
    default_priority: string;
  };
  goals: {
    version: number;
    options: Array<{ id: string; name: string; description?: string }>;
    priority_options: Array<{ id: string; label: string; weight: number; is_default: boolean }>;
    default_priority: string;
  };
  injuries: {
    version: number;
    options: InjuryCatalogOption[];
    subcategories: InjuryCatalogSubcategory[];
    severity_options: InjurySeverityOption[];
    default_severity: string;
  };
  past_sports: {
    version: number;
    intensity_options: PastSportIntensityOption[];
    default_intensity: string | null;
    boolean_options: {
      default: {
        true_label: string;
        false_label: string;
        unknown_label: string;
      };
      fields: Record<string, PastSportBooleanFieldConfig>;
    };
  };
};

let intakeCatalogPromise: Promise<IntakeCatalog> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toMeasurementField(raw: Record<string, unknown>): MeasurementFieldConfig | null {
  const id = String(raw.id || '').trim();
  const label = String(raw.label || '').trim();
  const group = String(raw.group_key || '').trim() as MeasurementFieldConfig['group'];
  const unit = String(raw.unit || '').trim() as MeasurementFieldConfig['unit'];
  const min = Number(raw.min);
  const max = Number(raw.max);
  if (!id || !label || !group || !unit || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  const helpSteps = Array.isArray(raw.help_steps)
    ? raw.help_steps.map((step) => String(step || '').trim()).filter(Boolean)
    : [];
  return {
    id,
    label,
    unit,
    group,
    hint: String(raw.hint || '').trim(),
    help: helpSteps,
    quick_section: (raw.quick_section ? String(raw.quick_section) : undefined) as MeasurementFieldConfig['quick_section'],
    quick_order: raw.quick_order == null ? undefined : Number(raw.quick_order),
    min,
    max,
    step: raw.step == null ? undefined : Number(raw.step),
    required: false,
    is_ratio: Boolean(raw.is_ratio),
  };
}

function toPastSportBooleanFieldConfig(raw: Record<string, unknown>, defaults: Record<string, unknown>): PastSportBooleanFieldConfig | null {
  const label = String(raw.label || '').trim();
  const true_label = String(raw.true_label || defaults.true_label || '').trim();
  const false_label = String(raw.false_label || defaults.false_label || '').trim();
  const unknown_label = String(raw.unknown_label || defaults.unknown_label || '').trim();
  if (!label || !true_label || !false_label || !unknown_label) return null;
  return { label, true_label, false_label, unknown_label };
}

function normalizeCatalog(payload: unknown): IntakeCatalog {
  if (!isRecord(payload)) throw new Error('Intake catalog response must be an object.');
  const traitsBlock = isRecord(payload.traits) ? payload.traits : {};
  const intakeBlock = isRecord(traitsBlock.intake) ? traitsBlock.intake : {};
  const questionsRaw = Array.isArray(intakeBlock.questions) ? intakeBlock.questions : [];
  const traitQuestions: TraitCatalogQuestion[] = questionsRaw
    .filter(isRecord)
    .map((row) => {
      const optionsRaw = Array.isArray(row.options) ? row.options : [];
      const options = optionsRaw
        .filter(isRecord)
        .map((option) => ({
          value: String(option.value || '').trim(),
          label: String(option.label || '').trim(),
          detail: option.detail == null ? undefined : String(option.detail),
        }))
        .filter((option) => option.value && option.label);
      return {
        field: String(row.field || '').trim(),
        trait_key: String(row.trait_key || '').trim(),
        label: String(row.label || '').trim(),
        description: String(row.description || '').trim(),
        options,
      };
    })
    .filter((question) => question.field && question.trait_key && question.label && question.options.length > 0);

  const measurementsBlock = isRecord(payload.measurements) ? payload.measurements : {};
  const requiredBlock = isRecord(measurementsBlock.required) ? measurementsBlock.required : {};
  const preferencesBlock = isRecord(payload.preferences) ? payload.preferences : {};
  const goalsBlock = isRecord(payload.goals) ? payload.goals : {};
  const injuriesBlock = isRecord(payload.injuries) ? payload.injuries : {};
  const pastSportsBlock = isRecord(payload.past_sports) ? payload.past_sports : {};
  const required = {
    adult_free: Array.isArray(requiredBlock.adult_free) ? requiredBlock.adult_free.map((x) => String(x)).filter(Boolean) : [],
    adult_premium: Array.isArray(requiredBlock.adult_premium) ? requiredBlock.adult_premium.map((x) => String(x)).filter(Boolean) : [],
    child: Array.isArray(requiredBlock.child) ? requiredBlock.child.map((x) => String(x)).filter(Boolean) : [],
  };

  const normalizeMeasurementList = (raw: unknown, requiredIds: string[]) => {
    const requiredSet = new Set(requiredIds);
    const list = Array.isArray(raw) ? raw : [];
    return list
      .filter(isRecord)
      .map(toMeasurementField)
      .filter((x): x is MeasurementFieldConfig => Boolean(x))
      .map((field) => ({ ...field, required: requiredSet.has(field.id) }));
  };

  const goalOptions = Array.isArray(goalsBlock.options)
    ? goalsBlock.options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          description: row.description == null ? undefined : String(row.description || '').trim(),
        }))
        .filter((row) => row.id && row.name)
    : [];

  const goalPriorityOptions = Array.isArray(goalsBlock.priority_options)
    ? goalsBlock.priority_options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          label: String(row.label || '').trim(),
          weight: Number(row.weight),
          is_default: Boolean(row.is_default),
        }))
        .filter((row) => row.id && row.label && Number.isFinite(row.weight))
    : [];

  const preferenceOptions = Array.isArray(preferencesBlock.options)
    ? preferencesBlock.options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          description: row.description == null ? undefined : String(row.description || '').trim(),
        }))
        .filter((row) => row.id && row.name)
    : [];

  const preferencePriorityOptions = Array.isArray(preferencesBlock.priority_options)
    ? preferencesBlock.priority_options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          label: String(row.label || '').trim(),
          weight: Number(row.weight),
          is_default: Boolean(row.is_default),
        }))
        .filter((row) => row.id && row.label && Number.isFinite(row.weight))
    : [];

  const injuryOptions = Array.isArray(injuriesBlock.options)
    ? injuriesBlock.options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          description: row.description == null ? undefined : String(row.description || '').trim(),
        }))
        .filter((row) => row.id && row.name)
    : [];

  const injurySubcategories = Array.isArray(injuriesBlock.subcategories)
    ? injuriesBlock.subcategories
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          injury_id: String(row.injury_id || '').trim(),
          name: String(row.name || '').trim(),
          definition: row.definition == null ? undefined : String(row.definition || '').trim(),
        }))
        .filter((row) => row.id && row.injury_id && row.name)
    : [];

  const injurySeverityOptions = Array.isArray(injuriesBlock.severity_options)
    ? injuriesBlock.severity_options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          label: String(row.label || '').trim(),
          guidance: row.guidance == null ? undefined : String(row.guidance || '').trim(),
          is_default: Boolean(row.is_default),
        }))
        .filter((row) => row.id && row.label)
    : [];

  const pastSportIntensityOptions = Array.isArray(pastSportsBlock.intensity_options)
    ? pastSportsBlock.intensity_options
        .filter(isRecord)
        .map((row) => ({
          id: String(row.id || '').trim(),
          label: String(row.label || '').trim(),
          is_default: Boolean(row.is_default),
        }))
        .filter((row) => row.id && row.label)
    : [];

  const booleanOptionsBlock = isRecord(pastSportsBlock.boolean_options) ? pastSportsBlock.boolean_options : {};
  const booleanDefaultBlock = isRecord(booleanOptionsBlock.default) ? booleanOptionsBlock.default : {};
  const booleanFieldsBlock = isRecord(booleanOptionsBlock.fields) ? booleanOptionsBlock.fields : {};
  const pastSportBooleanEntries = Object.entries(booleanFieldsBlock)
    .filter(([, raw]) => isRecord(raw))
    .map(([field, raw]) => [field, toPastSportBooleanFieldConfig(raw as Record<string, unknown>, booleanDefaultBlock)] as const)
    .filter((entry): entry is readonly [string, PastSportBooleanFieldConfig] => Boolean(entry[1]));
  const pastSportBooleanFields = Object.fromEntries(pastSportBooleanEntries) as Record<
    string,
    PastSportBooleanFieldConfig
  >;

  return {
    version: Number(payload.version || 1),
    traits: {
      version: Number(traitsBlock.version || 1),
      intake: {
        questions: traitQuestions,
      },
    },
    measurements: {
      adult_free: normalizeMeasurementList(measurementsBlock.adult_free, required.adult_free),
      adult_premium: normalizeMeasurementList(measurementsBlock.adult_premium, required.adult_premium),
      child: normalizeMeasurementList(measurementsBlock.child, required.child),
      required,
    },
    preferences: {
      version: Number(preferencesBlock.version || 1),
      options: preferenceOptions,
      priority_options: preferencePriorityOptions,
      default_priority: String(preferencesBlock.default_priority || '').trim()
        || preferencePriorityOptions.find((option) => option.is_default)?.id
        || 'nice_to_have',
    },
    goals: {
      version: Number(goalsBlock.version || 1),
      options: goalOptions,
      priority_options: goalPriorityOptions,
      default_priority: String(goalsBlock.default_priority || '').trim()
        || goalPriorityOptions.find((option) => option.is_default)?.id
        || 'nice_to_have',
    },
    injuries: {
      version: Number(injuriesBlock.version || 1),
      options: injuryOptions,
      subcategories: injurySubcategories,
      severity_options: injurySeverityOptions,
      default_severity: String(injuriesBlock.default_severity || '').trim()
        || injurySeverityOptions.find((option) => option.is_default)?.id
        || '',
    },
    past_sports: {
      version: Number(pastSportsBlock.version || 1),
      intensity_options: pastSportIntensityOptions,
      default_intensity:
        pastSportsBlock.default_intensity == null
          ? null
          : String(pastSportsBlock.default_intensity || '').trim() || null,
      boolean_options: {
        default: {
          true_label: String(booleanDefaultBlock.true_label || '').trim(),
          false_label: String(booleanDefaultBlock.false_label || '').trim(),
          unknown_label: String(booleanDefaultBlock.unknown_label || '').trim(),
        },
        fields: pastSportBooleanFields,
      },
    },
  };
}

export async function fetchIntakeCatalog(): Promise<IntakeCatalog> {
  if (!intakeCatalogPromise) {
    intakeCatalogPromise = (async () => {
      const response = await fetch('/api/intake-catalog', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body?.detail) detail = String(body.detail);
        } catch {
          // ignore
        }
        throw new Error(`Failed to load intake catalog: ${detail}`);
      }
      const payload = await response.json();
      return normalizeCatalog(payload);
    })();
  }
  return intakeCatalogPromise;
}
