import type { FunctionalComponent } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { measurementFields } from '../../data/measurementFields';
import MeasurementField from '../intake/MeasurementField';
import PastSportsStep from '../intake/steps/PastSportsStep';
import TraitsStep from '../intake/steps/TraitsStep';
import PremiumBlock, { type PremiumSectionKey } from '../intake/PremiumBlock';
import { createPremiumController, type PremiumController } from '../intake/premiumController';
import type { PastSportsEntry } from '../intake/IntakeApp';

type Sex = 'female' | 'male' | 'other' | 'prefer_not_to_say' | 'prefer_not';

type SportySnapshot = {
  user: { id: string; email?: string | null } | null;
  hasConsent?: boolean;
};

type ChildRow = {
  id: string;
  name: string | null;
  birthdate: string | null;
  sex: string | null;
};

type MeasurementValues = Record<string, number | null>;

type Props = {
  adultAgeGroups: string[];
};

const STEP_KEYS = [
  'child',
  'measurements',
  'parents',
  'traits',
  'preferences',
  'goals',
  'injuries',
  'pastSports',
] as const;
type StepKey = (typeof STEP_KEYS)[number];
type StepDefinition = { key: StepKey; title: string };

const STEP_DEFINITIONS: StepDefinition[] = [
  { key: 'child', title: 'Child basics' },
  { key: 'measurements', title: 'Measurements' },
  { key: 'parents', title: 'Parents' },
  { key: 'traits', title: 'Traits' },
  { key: 'preferences', title: 'Preferences' },
  { key: 'goals', title: 'Goals' },
  { key: 'injuries', title: 'Injuries' },
  { key: 'pastSports', title: 'Past sports' },
];

const PREMIUM_SECTION_KEYS: PremiumSectionKey[] = ['preferences', 'goals', 'injuries'];

const TRAIT_FIELDS = [
  'muscle_fiber',
  'metabolic_tendency',
  'joint_laxity',
  'foot_arch',
  'temperature_tolerance',
  'handedness',
  'footedness',
] as const;

const CHILD_FIELD_OVERRIDES: Partial<Record<string, Partial<{ min: number; max: number }>>> = {
  height_cm: { min: 60 },
  weight_kg: { min: 10 },
  arm_span_cm: { min: 60 },
  leg_inseam_cm: { min: 20 },
  shoulder_width_cm: { min: 15 },
  pelvic_bone_width_cm: { min: 15 },
  torso_length_cm: { min: 20 },
  hand_length_cm: { min: 8 },
  foot_length_cm: { min: 10 },
  ankle_circumference_cm: { min: 10 },
  wrist_circumference_cm: { min: 8 },
};

const buildEmptyMeasurements = (fields = measurementFields): MeasurementValues => {
  const output: MeasurementValues = {};
  fields.forEach((field) => {
    output[field.id] = null;
  });
  return output;
};

const normalizeSex = (value: string): Sex => {
  const v = (value || '').toLowerCase();
  if (v === 'female' || v === 'male' || v === 'other') return v as Sex;
  if (v === 'prefer_not') return 'prefer_not';
  return 'prefer_not';
};

const formatChildTitle = (child: ChildRow | null) => {
  if (!child) return 'Choose child';
  const name = child.name || 'Child';
  return name;
};

const ChildForecastApp: FunctionalComponent<Props> = ({ adultAgeGroups }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [statusHtml, setStatusHtml] = useState<{ html: string; tone: 'info' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [snapshot, setSnapshot] = useState<SportySnapshot>({ user: null });

  const [availableChildren, setAvailableChildren] = useState<ChildRow[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [childRecord, setChildRecord] = useState<ChildRow | null>(null);

  const [birthdate, setBirthdate] = useState<string>('');
  const [sex, setSex] = useState<Sex>('female');
  const [ethnicity, setEthnicity] = useState<string>('');
  const [adultAgeGroup, setAdultAgeGroup] = useState<string>(adultAgeGroups[2] || adultAgeGroups[0] || '25-35 years');

  const [childMeasurements, setChildMeasurements] = useState<MeasurementValues>(() => buildEmptyMeasurements());

  const [includeMother, setIncludeMother] = useState(false);
  const [includeFather, setIncludeFather] = useState(false);
  const [motherMeasurements, setMotherMeasurements] = useState<MeasurementValues>(() => buildEmptyMeasurements());
  const [fatherMeasurements, setFatherMeasurements] = useState<MeasurementValues>(() => buildEmptyMeasurements());

  const [pastSports, setPastSports] = useState<PastSportsEntry[]>([]);

  const currentStep: StepKey = STEP_KEYS[Math.max(0, Math.min(STEP_KEYS.length - 1, stepIndex))];
  const isFirstStep = stepIndex === 0;
  const isFinalStep = stepIndex === STEP_KEYS.length - 1;
  const activePremiumSection = PREMIUM_SECTION_KEYS.includes(currentStep as PremiumSectionKey)
    ? (currentStep as PremiumSectionKey)
    : null;
  const showPremiumBlock = activePremiumSection !== null;

  const sportyAppRef = useRef<any>(null);
  const premiumControllerRef = useRef<PremiumController | null>(null);

  const childFields = useMemo(() => {
    return measurementFields.map((field) => {
      const override = CHILD_FIELD_OVERRIDES[field.id] || {};
      return { ...field, ...override };
    });
  }, []);

  const setStatus = useCallback((html: string, tone: 'info' | 'error' = 'info') => {
    setStatusHtml(html ? { html, tone } : null);
  }, []);

  const focusField = useCallback((fieldId: string | null) => {
    if (!fieldId) return;
    const el = document.getElementById(fieldId) as HTMLInputElement | null;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const collectTraitAnswers = useCallback((): Record<string, string> => {
    const form = document.getElementById('child-intake-form') as HTMLFormElement | null;
    const answers: Record<string, string> = {};
    if (!form) return answers;
    TRAIT_FIELDS.forEach((fieldName) => {
      const input = form.querySelector<HTMLInputElement>(`input[name="${fieldName}"]:checked`);
      if (input && input.value) {
        answers[fieldName] = input.value;
      }
    });
    return answers;
  }, []);

  const fetchChildOptions = useCallback(async (client: any, userId: string) => {
    const { data: guards, error: gErr } = await client
      .from('guardianships')
      .select('child_id')
      .eq('guardian_user_id', userId)
      .eq('status', 'active');
    if (gErr) throw gErr;
    const ids = Array.from(new Set((guards || []).map((row: any) => row.child_id).filter(Boolean)));
    if (!ids.length) return [];
    const { data: kids, error: cErr } = await client
      .from('children')
      .select('id,name,birthdate,sex')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (cErr) throw cErr;
    return (kids || []) as ChildRow[];
  }, []);

  const loadChild = useCallback(async (client: any, id: string) => {
    const { data, error } = await client
      .from('children')
      .select('id,name,birthdate,sex')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as ChildRow | null;
  }, []);

  const loadLatestChildMeasurement = useCallback(async (client: any, id: string) => {
    const { data, error } = await client
      .from('measurements')
      .select('*')
      .eq('subject_type', 'child')
      .eq('subject_child_id', id)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }, []);

  const loadLatestAdultMeasurement = useCallback(async (client: any, userId: string) => {
    const { data, error } = await client
      .from('measurements')
      .select('*')
      .eq('subject_type', 'adult')
      .eq('subject_user_id', userId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }, []);

  const loadMyBiologicalRole = useCallback(async (client: any, userId: string, id: string) => {
    const { data, error } = await client
      .from('guardianships')
      .select('biological_role')
      .eq('guardian_user_id', userId)
      .eq('child_id', id)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw error;
    return (data && data.biological_role) || null;
  }, []);

  const loadSharedParentMeasurements = useCallback(async (client: any, id: string) => {
    try {
      const { data, error } = await client.rpc('get_child_parent_measurements', { p_child_id: id });
      if (error) throw error;
      return data || null;
    } catch (err) {
      console.warn('[ChildIntake] Shared parent measurements unavailable', err);
      return null;
    }
  }, []);

  const applyMeasurementRow = useCallback((row: any, setter: (updater: (prev: MeasurementValues) => MeasurementValues) => void) => {
    if (!row) return;
    setter((prev) => {
      const next = { ...prev };
      measurementFields.forEach((field) => {
        const raw = row[field.id];
        if (raw === null || raw === undefined) return;
        const num = Number(raw);
        next[field.id] = Number.isFinite(num) ? num : next[field.id];
      });
      return next;
    });
  }, []);

  // Wire SportyApp snapshot.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const init = () => {
      const sportyApp = (window as any).SportyApp;
      if (!sportyApp || !sportyApp.ready) return false;
      sportyAppRef.current = sportyApp;
      sportyApp.ready.then(() => {
        if (typeof sportyApp.onAuthChange === 'function') {
          unsubscribe = sportyApp.onAuthChange((s: SportySnapshot | null) => {
            setSnapshot(s || { user: null });
          });
        }
        const user = sportyApp.getUser?.() || null;
        if (user && user.id) {
          setSnapshot({ user: { id: user.id, email: user.email || null } });
        }
      });
      return true;
    };
    init();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Premium controller (preferences/goals/injuries) but using child credits.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const premiumController = createPremiumController({
      block: document.querySelector('[data-premium-block]'),
      locked: document.querySelector('[data-premium-locked]'),
      lockedMessage: document.querySelector('[data-premium-locked-message]'),
      summary: document.querySelector('[data-premium-summary]'),
      getClient: () => (window as any).SportyApp?.getClient?.() ?? null,
      creditType: 'child',
      prefillForTesting: false,
    });
    premiumControllerRef.current = premiumController;
    return () => {
      premiumController.reset();
    };
  }, []);

  useEffect(() => {
    premiumControllerRef.current
      ?.update({
        user: snapshot.user ? { id: snapshot.user.id } : null,
        hasConsent: Boolean(snapshot.hasConsent),
      })
      .catch((err) => console.error('[ChildIntake] Failed to update premium controller', err));
  }, [snapshot.user?.id, snapshot.hasConsent]);

  // On login: load children list and preselect by query param (or auto-select single).
  useEffect(() => {
    const user = snapshot.user;
    const sportyApp = sportyAppRef.current;
    const client = sportyApp?.getClient?.();
    if (!user || !client) return;

    (async () => {
      try {
        const kids = await fetchChildOptions(client, user.id);
        setAvailableChildren(kids);
        const urlId = new URL(window.location.href).searchParams.get('child_id');
        if (urlId && kids.some((k) => k.id === urlId)) {
          setChildId(urlId);
          return;
        }
        if (!childId && kids.length === 1) {
          setChildId(kids[0].id);
        }
      } catch (err) {
        console.error('[ChildIntake] Failed to load children', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.user?.id]);

  // When a child is selected: prefill basics + measurements + parent shares.
  useEffect(() => {
    const user = snapshot.user;
    const sportyApp = sportyAppRef.current;
    const client = sportyApp?.getClient?.();
    if (!user || !client || !childId) return;

    (async () => {
      setStatus('');
      try {
        const child = await loadChild(client, childId);
        setChildRecord(child);
        if (child?.birthdate) setBirthdate(child.birthdate);
        if (child?.sex) setSex(normalizeSex(child.sex));

        const m = await loadLatestChildMeasurement(client, childId);
        applyMeasurementRow(m, setChildMeasurements);

        const shared = await loadSharedParentMeasurements(client, childId);
        if (shared?.mother) {
          setIncludeMother(true);
          applyMeasurementRow(shared.mother, setMotherMeasurements);
        }
        if (shared?.father) {
          setIncludeFather(true);
          applyMeasurementRow(shared.father, setFatherMeasurements);
        }

        const role = await loadMyBiologicalRole(client, user.id, childId);
        if (role === 'mother') {
          setIncludeMother(true);
          const mine = await loadLatestAdultMeasurement(client, user.id);
          applyMeasurementRow(mine, setMotherMeasurements);
        } else if (role === 'father') {
          setIncludeFather(true);
          const mine = await loadLatestAdultMeasurement(client, user.id);
          applyMeasurementRow(mine, setFatherMeasurements);
        }
      } catch (err) {
        console.error('[ChildIntake] Failed to prefill child intake', err);
      }
    })();
  }, [applyMeasurementRow, childId, loadChild, loadLatestAdultMeasurement, loadLatestChildMeasurement, loadMyBiologicalRole, loadSharedParentMeasurements, setStatus, snapshot.user]);

  const validateAllMeasurements = useCallback((values: MeasurementValues, fields = measurementFields) => {
    for (const field of fields) {
      const raw = values[field.id];
      if (raw === null || raw === undefined) {
        return { ok: false as const, message: `Enter ${field.label.toLowerCase()} before continuing.`, fieldId: field.id };
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        return { ok: false as const, message: `${field.label} must be a number.`, fieldId: field.id };
      }
      if (typeof field.min === 'number' && num < field.min) {
        return { ok: false as const, message: `${field.label} must be at least ${field.min}.`, fieldId: field.id };
      }
      if (typeof field.max === 'number' && num > field.max) {
        return { ok: false as const, message: `${field.label} must be at most ${field.max}.`, fieldId: field.id };
      }
    }
    return { ok: true as const };
  }, []);

  const submit = useCallback(async () => {
    const sportyApp = sportyAppRef.current;
    const user = sportyApp?.getUser?.() || null;

    if (!user || !user.id) {
      setStatus('Sign in as a guardian to run a child analysis.', 'error');
      return;
    }

    if (!childId) {
      setStatus('Choose a child before continuing.', 'error');
      return;
    }
    if (!birthdate || !sex) {
      setStatus('Birthdate and sex are required.', 'error');
      return;
    }

    const childValidation = validateAllMeasurements(childMeasurements, childFields);
    if (!childValidation.ok) {
      setStatus(childValidation.message, 'error');
      focusField(`child-${(childValidation as any).fieldId || ''}`);
      return;
    }

    if (includeMother) {
      const momValidation = validateAllMeasurements(motherMeasurements, measurementFields);
      if (!momValidation.ok) {
        setStatus(`Mother: ${momValidation.message}`, 'error');
        focusField(`mother-${(momValidation as any).fieldId || ''}`);
        return;
      }
    }
    if (includeFather) {
      const dadValidation = validateAllMeasurements(fatherMeasurements, measurementFields);
      if (!dadValidation.ok) {
        setStatus(`Father: ${dadValidation.message}`, 'error');
        focusField(`father-${(dadValidation as any).fieldId || ''}`);
        return;
      }
    }

    const premiumSelection =
      premiumControllerRef.current?.collect() ?? { applyCredit: false, data: null, errors: [] as string[] };
    if (premiumSelection.errors.length) {
      setStatus(premiumSelection.errors.join(' '), 'error');
      return;
    }
    if (!premiumSelection.applyCredit) {
      setStatus('Add a child analysis credit to continue.', 'error');
      return;
    }

    const payload: any = {
      child_id: childId,
      guardian_user_id: user.id,
      birthdate,
      sex,
      ethnicity: ethnicity || null,
      adult_age_group: adultAgeGroup,
      measurements: { ...childMeasurements },
      traits: collectTraitAnswers(),
    };
    if (includeMother) {
      payload.mother = { display_name: 'Mother', measurements: { ...motherMeasurements } };
    }
    if (includeFather) {
      payload.father = { display_name: 'Father', measurements: { ...fatherMeasurements } };
    }
    const cleanedPastSports = pastSports.map(({ id, sport_label, ...rest }) => rest);
    if (cleanedPastSports.length) {
      payload.past_sports = cleanedPastSports;
    }
    payload.premium = {
      apply_credit: true,
      preferences: premiumSelection.data?.preferences || [],
      goals: premiumSelection.data?.goals || [],
      injuries: premiumSelection.data?.injuries || [],
    };

    setSubmitting(true);
    setStatus('Applying your credit and computing the forecast…', 'info');
    try {
      const response = await fetch('/api/forecast-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) {
        let detail = 'Unable to generate forecast right now.';
        try {
          const json = JSON.parse(text);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      sessionStorage.setItem('sporty:lastChildForecast', text);
      sessionStorage.setItem('sporty:lastChildForecastRequest', JSON.stringify(payload));
      try {
        const parsed = JSON.parse(text);
        const credit = parsed?.premium_analysis?.credit?.totals;
        if (credit) {
          sessionStorage.setItem('sporty:lastCreditSnapshot', JSON.stringify(credit));
        }
      } catch (_) {}
      sessionStorage.setItem('sporty:childResultsTab', 'matches');
      window.location.assign('/child-results?tab=matches');
    } catch (err: any) {
      console.error('[ChildIntake] Forecast failed', err);
      setStatus(err?.message || 'Unexpected error, please try again.', 'error');
      setSubmitting(false);
    }
  }, [
    adultAgeGroup,
    birthdate,
    childFields,
    childId,
    childMeasurements,
    collectTraitAnswers,
    ethnicity,
    fatherMeasurements,
    includeFather,
    includeMother,
    motherMeasurements,
    pastSports,
    sex,
    setStatus,
    focusField,
    validateAllMeasurements,
  ]);

  const renderMeasurementGroups = useCallback(
    (
      fields: any[],
      values: MeasurementValues,
      onChange: (patch: MeasurementValues) => void,
      idPrefix: string
    ) => {
      const groups = [
        { key: 'core', title: 'Core linear metrics', description: 'Height, weight, span, and inseam anchor the body’s overall scale.' },
        { key: 'torso', title: 'Width & torso length', description: 'Shoulders, pelvis, and torso length describe the body’s width profile.' },
        { key: 'extremities', title: 'Extremities & girth', description: 'Hands, feet, wrists, and ankles capture the fine extremity proportions.' },
      ] as const;

      return (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupFields = fields.filter((f: any) => f.group === group.key);
            if (!groupFields.length) return null;
            return (
              <section key={group.key} className="space-y-3">
                <div className="space-y-1">
                  <h3 className="type-lead text-slate-700">{group.title}</h3>
                  <p className="text-sm text-slate-500">{group.description}</p>
                </div>
                <fieldset className="grid gap-6 md:grid-cols-2">
                  {groupFields.map((field: any) => (
                    <MeasurementField
                      key={`${idPrefix}-${field.id}`}
                      {...field}
                      id={`${idPrefix}-${field.id}`}
                      value={values[field.id] ?? ''}
                      onChange={(val) => onChange({ ...values, [field.id]: val })}
                    />
                  ))}
                </fieldset>
              </section>
            );
          })}
        </div>
      );
    },
    []
  );

  const headerTitle = STEP_DEFINITIONS[stepIndex]?.title || '';

  const validateCurrentStepAndAdvance = useCallback(() => {
    if (currentStep === 'child') {
      if (!childId) {
        setStatus('Choose a child before continuing.', 'error');
        return;
      }
      if (!birthdate) {
        setStatus('Birthdate is required.', 'error');
        return;
      }
      if (!sex) {
        setStatus('Sex is required.', 'error');
        return;
      }
    } else if (currentStep === 'measurements') {
      const res = validateAllMeasurements(childMeasurements, childFields);
      if (!res.ok) {
        setStatus(res.message, 'error');
        focusField(`child-${(res as any).fieldId || ''}`);
        return;
      }
    } else if (currentStep === 'parents') {
      if (includeMother) {
        const res = validateAllMeasurements(motherMeasurements, measurementFields);
        if (!res.ok) {
          setStatus(`Mother: ${res.message}`, 'error');
          focusField(`mother-${(res as any).fieldId || ''}`);
          return;
        }
      }
      if (includeFather) {
        const res = validateAllMeasurements(fatherMeasurements, measurementFields);
        if (!res.ok) {
          setStatus(`Father: ${res.message}`, 'error');
          focusField(`father-${(res as any).fieldId || ''}`);
          return;
        }
      }
    }

    setStatus('');
    const nextIndex = Math.min(STEP_KEYS.length - 1, stepIndex + 1);
    setStepIndex(nextIndex);
  }, [birthdate, childFields, childId, childMeasurements, currentStep, focusField, sex, setStatus, stepIndex, validateAllMeasurements]);

  return (
    <div className="space-y-8" data-child-intake>
      <div className="space-y-2">
        <p className="type-lead text-teal-600">Child analysis</p>
        <h1 className="type-display text-slate-900">Forecast a child’s future build, then run the full analysis.</h1>
        <p className="text-slate-600">
          Use the child’s measurements (and optionally parent measurements) to project an adult body profile. Then continue to premium
          signals and sport matching.
        </p>
      </div>

      <div className="w-full" data-stepper-progress>
        <div className="flex justify-between items-baseline mb-2">
          <span className="badge-subtle">{headerTitle}</span>
          <span className="text-sm text-slate-500">
            Step {stepIndex + 1} of {STEP_KEYS.length}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className="bg-teal-600 h-2.5 rounded-full transition-all duration-200"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, Math.round(((stepIndex + 1) / STEP_KEYS.length) * 100))
              )}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="space-y-6" data-stepper-content>
      <div hidden={currentStep !== 'child'}>
        <div className="card-shell space-y-6">
          <header className="space-y-2">
            <h2 className="type-title text-slate-900">Who are we forecasting?</h2>
            <p className="text-slate-600">
              Pick a registered child (or open this page from the dashboard). We’ll prefill from the latest saved measurements when available.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Child</div>
              <select
                className="input-base"
                value={childId}
                onChange={(e) => setChildId((e.target as HTMLSelectElement).value)}
                required
              >
                <option value="">Select a child…</option>
                {availableChildren.map((child) => (
                  <option key={child.id} value={child.id}>
                    {formatChildTitle(child)}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Selected</div>
              <div className="text-sm font-medium text-slate-900 mt-1">{formatChildTitle(childRecord)}</div>
              <div className="text-xs text-slate-500 mt-1">
                {childRecord?.birthdate ? `Born ${childRecord.birthdate}` : '—'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Birthdate</div>
              <input className="input-base" type="date" value={birthdate} onChange={(e) => setBirthdate((e.target as HTMLInputElement).value)} required />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Sex</div>
              <select className="input-base" value={sex} onChange={(e) => setSex((e.target as HTMLSelectElement).value as Sex)} required>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not">Prefer not to say</option>
              </select>
            </label>
            <label className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Ethnicity (optional)</div>
              <select className="input-base" value={ethnicity} onChange={(e) => setEthnicity((e.target as HTMLSelectElement).value)}>
                <option value="">General population</option>
                <option value="caucasian">Caucasian</option>
                <option value="asian">Asian</option>
              </select>
            </label>
            <label className="space-y-2">
              <div className="text-sm font-semibold text-slate-800">Target adult cohort</div>
              <select className="input-base" value={adultAgeGroup} onChange={(e) => setAdultAgeGroup((e.target as HTMLSelectElement).value)}>
                {adultAgeGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div hidden={currentStep !== 'measurements'}>
        <div className="card-shell space-y-6">
          <header className="space-y-2">
            <h2 className="type-title text-slate-900">Child body measurements</h2>
            <p className="text-slate-600">
              Every field is required. These measurements anchor the forecast and downstream sport analysis.
            </p>
          </header>
          {renderMeasurementGroups(childFields as any[], childMeasurements, setChildMeasurements, 'child')}
        </div>
      </div>

      <div hidden={currentStep !== 'parents'}>
        <div className="space-y-6">
          <div className="card-shell space-y-4">
            <header className="space-y-2">
              <h2 className="type-title text-slate-900">Parent measurements</h2>
              <p className="text-slate-600">
                Parents can share their latest measurements with all guardians. If you enable a parent section here, all fields become required.
              </p>
            </header>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" checked={includeMother} onChange={(e) => setIncludeMother(Boolean((e.target as HTMLInputElement).checked))} />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Include mother measurements</div>
                  <div className="text-xs text-slate-500">All fields required when enabled.</div>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" checked={includeFather} onChange={(e) => setIncludeFather(Boolean((e.target as HTMLInputElement).checked))} />
                <div>
                  <div className="text-sm font-semibold text-slate-800">Include father measurements</div>
                  <div className="text-xs text-slate-500">All fields required when enabled.</div>
                </div>
              </label>
            </div>
          </div>

          {includeMother && (
            <div className="card-shell space-y-6">
              <header className="space-y-2">
                <h3 className="type-title text-slate-900">Mother measurements</h3>
                <p className="text-slate-600">All fields required when this section is enabled.</p>
              </header>
              {renderMeasurementGroups(measurementFields as any[], motherMeasurements, setMotherMeasurements, 'mother')}
            </div>
          )}

          {includeFather && (
            <div className="card-shell space-y-6">
              <header className="space-y-2">
                <h3 className="type-title text-slate-900">Father measurements</h3>
                <p className="text-slate-600">All fields required when this section is enabled.</p>
              </header>
              {renderMeasurementGroups(measurementFields as any[], fatherMeasurements, setFatherMeasurements, 'father')}
            </div>
          )}
        </div>
      </div>

      <div hidden={currentStep !== 'traits'}>
        <TraitsStep />
      </div>

      <div hidden={!showPremiumBlock}>
        <PremiumBlock activeSection={activePremiumSection} visible={showPremiumBlock} />
      </div>

      <div hidden={currentStep !== 'pastSports'}>
        <PastSportsStep entries={pastSports} onUpdate={setPastSports} />
      </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 py-4" data-stepper-actions>
        <div>
          {!isFirstStep && (
            <button
              type="button"
              className="btn-pill btn-pill-secondary btn-pill-sm"
              disabled={submitting}
              onClick={() => {
                const target = stepIndex - 1;
                if (target >= 0) setStepIndex(target);
              }}
            >
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isFinalStep && (
            <button
              type="button"
              className="btn-pill btn-pill-primary btn-pill-sm"
              disabled={submitting}
              onClick={() => validateCurrentStepAndAdvance()}
            >
              Continue
            </button>
          )}
          {isFinalStep && (
            <button
              type="button"
              className="btn-pill btn-pill-primary"
              disabled={submitting}
              onClick={() => submit()}
              data-submit
            >
              {submitting ? 'Running analysis…' : 'Run child analysis'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div data-status aria-live="polite">
          {statusHtml ? <div className={`status status--${statusHtml.tone}`}>{/* eslint-disable-next-line react/no-danger */}<div dangerouslySetInnerHTML={{ __html: statusHtml.html }} /></div> : null}
        </div>
      </div>
    </div>
  );
};

export default ChildForecastApp;
