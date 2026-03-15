import type { FunctionalComponent } from "preact";
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import BasicsStep from "./steps/BasicsStep";
import MeasurementsStep from "./steps/MeasurementsStep";
import PastSportsStep from "./steps/PastSportsStep";
import TraitsStep from "./steps/TraitsStep";
import PremiumBlock, { type PremiumSectionKey } from "./PremiumBlock";
import { formatBoundaryValue, type MeasurementSystem } from "../../lib/units";
import {
  persistMeasurementSystemForUser,
  persistMeasurementSystemLocal,
  resolveMeasurementSystemOnClient,
} from "../../lib/measurementSystem";
import {
  createPremiumController,
  type PremiumController,
} from "./premiumController";
import { buildFreePayload, buildPremiumPayload } from "../../data/intakeSchema";
import {
  fetchIntakeCatalog,
  type MeasurementFieldConfig,
  type PastSportBooleanFieldConfig,
  type PastSportIntensityOption,
  type TraitCatalogQuestion,
} from "../../lib/intakeCatalog";
import type {
  FreeIntakeData,
  PremiumIntakeData,
  Sex,
  TraitAnswers,
  PastSportInput,
} from "../../data/intakeSchema";

type SportySnapshot = {
  user: { id: string } | null;
  consents?: Record<string, { granted?: boolean; purge_status?: string | null }>;
  session?: { access_token?: string } | null;
  purgeStatus?: string | null;
  purgeRequestedAt?: string | null;
  purgeCompletedAt?: string | null;
};

export type PastSportsEntry = PastSportInput & {
  id: string;
  sport_label?: string | null;
};

type StepKey =
  | "basics"
  | "measurements"
  | "traits"
  | "preferences"
  | "goals"
  | "injuries"
  | "pastSports";

type StepDefinition = {
  key: StepKey;
  index: number;
  title: string;
  subtitle: string;
};

const FREE_STEP_KEYS: StepKey[] = ["basics", "measurements", "pastSports"];
const PREMIUM_STEP_KEYS: StepKey[] = [
  "basics",
  "measurements",
  "traits",
  "preferences",
  "goals",
  "injuries",
  "pastSports",
];

const STEP_META: Record<StepKey, { title: string; subtitle: string }> = {
  basics: { title: "Basics", subtitle: "" },
  measurements: { title: "Measurements", subtitle: "" },
  traits: { title: "Traits", subtitle: "" },
  preferences: { title: "Preferences", subtitle: "" },
  goals: { title: "Goals", subtitle: "" },
  injuries: { title: "Injuries", subtitle: "" },
  pastSports: { title: "Past sports", subtitle: "" },
};

const PREMIUM_SECTION_KEYS: PremiumSectionKey[] = [
  "preferences",
  "goals",
  "injuries",
];

type IntakeMode = "free" | "premium";

const buildStepDefinitions = (mode: IntakeMode): StepDefinition[] => {
  const keys = mode === "premium" ? PREMIUM_STEP_KEYS : FREE_STEP_KEYS;
  return keys.map((key, index) => ({
    key,
    index: index + 1,
    title: STEP_META[key].title,
    subtitle: STEP_META[key].subtitle,
  }));
};

type MeasurementFormValues = Record<string, number | null>;

const buildEmptyMeasurements = (keys: string[]): MeasurementFormValues => {
  const output: Record<string, number | null> = {};
  keys.forEach((id) => {
    output[id] = null;
  });
  return output;
};

const SEX_OPTIONS: Set<Sex> = new Set([
  "female",
  "male",
  "other",
  "prefer_not_to_say",
]);

type StepValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; elementId?: string };

const isSexOption = (value: string): value is Sex =>
  SEX_OPTIONS.has(value as Sex);

type IntakePrefillPastSport = {
  sport_subcategory_id?: string | null;
  sport_label?: string | null;
  years_played?: number | null;
  age_started_years?: number | null;
  intensity?: string | null;
  liked?: boolean | null;
  had_flair?: boolean | null;
  achieved_skill?: boolean | null;
};

type IntakePrefillResponse = {
  prefill?: {
    basics?: Partial<{ birthday: string; sex: string }>;
    measurements?: Partial<Record<string, number>>;
    traits?: Partial<Record<string, string>>;
    past_sports?: IntakePrefillPastSport[];
    preferences?: PremiumIntakeData["preferences"];
    goals?: PremiumIntakeData["goals"];
    injuries?: PremiumIntakeData["injuries"];
  };
  sources?: Record<string, unknown>;
};

type IntakeAppProps = {
  mode: IntakeMode;
};

const IntakeApp: FunctionalComponent<IntakeAppProps> = ({ mode }) => {
  const [activeMeasurementFields, setActiveMeasurementFields] = useState<MeasurementFieldConfig[]>([]);
  const measurementKeys = useMemo(
    () => activeMeasurementFields.map((field) => field.id),
    [activeMeasurementFields]
  );
  const measurementFieldById = useMemo(
    () => new Map(activeMeasurementFields.map((field) => [field.id, field])),
    [activeMeasurementFields]
  );
  const stepDefinitions = buildStepDefinitions(mode);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
  const [sportySnapshot, setSportySnapshot] = useState<SportySnapshot>({
    user: null,
  });
  const [pastSports, setPastSports] = useState<PastSportsEntry[]>(() => []);
  const [basics, setBasics] = useState<{ birthday: string; sex: Sex | "" }>(
    () => ({ birthday: "", sex: "" })
  );
  const [measurements, setMeasurements] = useState<
    Record<string, number | null>
  >(() => buildEmptyMeasurements(measurementKeys));
  const [traits, setTraits] = useState<TraitAnswers>({});
  const [traitQuestions, setTraitQuestions] = useState<TraitCatalogQuestion[]>([]);
  const [pastSportIntensityOptions, setPastSportIntensityOptions] = useState<PastSportIntensityOption[]>([]);
  const [pastSportBooleanFields, setPastSportBooleanFields] = useState<
    Record<string, PastSportBooleanFieldConfig>
  >({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const consentIntentRef = useRef(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [sensitiveConsentGiven, setSensitiveConsentGiven] = useState(false);
  const sensitiveConsentIntentRef = useRef(false);
  const [sensitiveConsentSaving, setSensitiveConsentSaving] = useState(false);
  const [measurementSystem, setMeasurementSystem] =
    useState<MeasurementSystem>("metric");

  // Premium controller (kept as is for now since it handles external UI blocks)
const premiumControllerRef = useRef<PremiumController | null>(null);

  useEffect(() => {
    setMeasurements((prev) => {
      const next = buildEmptyMeasurements(measurementKeys);
      measurementKeys.forEach((id) => {
        const existingValue = prev[id];
        if (existingValue !== undefined) {
          next[id] = existingValue;
        }
      });
      return next;
    });
  }, [measurementKeys]);

  useEffect(() => {
    const resolved = resolveMeasurementSystemOnClient();
    setMeasurementSystem(resolved);
    if (import.meta.env.DEV) {
      console.debug("[Intake] Measurement system resolved on mount", {
        resolved,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const catalog = await fetchIntakeCatalog();
        if (cancelled) return;
        const measurementFields =
          mode === "premium"
            ? catalog.measurements.adult_premium
            : catalog.measurements.adult_free;
        setActiveMeasurementFields(
          [...measurementFields].sort(
            (a, b) =>
              (a.quick_order ?? Number.MAX_SAFE_INTEGER) -
              (b.quick_order ?? Number.MAX_SAFE_INTEGER)
          )
        );
        setTraitQuestions(catalog.traits.intake.questions || []);
        setPastSportIntensityOptions(catalog.past_sports.intensity_options || []);
        setPastSportBooleanFields(catalog.past_sports.boolean_options.fields || {});
      } catch (error) {
        if (cancelled) return;
        console.error("[Intake] Failed to load intake catalog", error);
        setCatalogError("We could not load intake options right now. Refresh and try again.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const traitFieldNames = useMemo(
    () => traitQuestions.map((q) => q.field).filter(Boolean),
    [traitQuestions]
  );

  const premiumSectionIndexMap = new Map<PremiumSectionKey, number>();
  if (mode === "premium") {
    PREMIUM_SECTION_KEYS.forEach((section) => {
      const idx = stepDefinitions.findIndex((step) => step.key === section);
      if (idx >= 0) {
        premiumSectionIndexMap.set(section, idx);
      }
    });
  }
  const activePremiumSection =
    mode === "premium"
      ? PREMIUM_SECTION_KEYS.find(
        (section) => premiumSectionIndexMap.get(section) === currentStepIndex
      ) ?? null
      : null;
  const showPremiumBlock = activePremiumSection !== null;

  const submitLabel = "See my matches";
  const setStatus = useCallback(
    (html: string, type: "info" | "error" = "info") => {
      if (typeof document === "undefined") return;
      const statusEl = document.querySelector<HTMLElement>("[data-status]");
      if (!statusEl) return;
      statusEl.innerHTML = html
        ? `<div class="status status--${type}">${html}</div>`
        : "";
    },
    []
  );

  const focusField = useCallback((elementId: string | undefined) => {
    if (!elementId) return;
    const element = document.getElementById(elementId);
    if (!element) return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleGrantConsent = useCallback(async (): Promise<boolean> => {
    if (consentSaving || !sportySnapshot.user) return false;

    setConsentSaving(true);
    try {
      const sportyApp = typeof window !== "undefined" ? (window as any).SportyApp : null;
      const user = sportyApp?.getUser?.();

      if (!user) {
        throw new Error("Not authenticated");
      }

      if (typeof sportyApp.grantConsent === "function") {
        await sportyApp.grantConsent("basic_processing", "consent-policy-v1", "EU");
      } else {
        throw new Error("Consent grant API unavailable");
      }

      await sportyApp?.refreshConsent?.();
      const hasBasicConsentConfirmed =
        typeof sportyApp?.hasConsentType === "function"
          ? Boolean(sportyApp.hasConsentType("basic_processing"))
          : true;
      if (!hasBasicConsentConfirmed) {
        throw new Error("Consent was not recorded");
      }
      setConsentGiven(true);
      return true;
    } catch (error) {
      console.error('[Intake] Failed to grant consent', error);
      setConsentGiven(false);
      throw error;
    } finally {
      setConsentSaving(false);
    }
  }, [consentSaving, sportySnapshot.user]);

  const handleGrantSensitiveConsent = useCallback(async (): Promise<boolean> => {
    if (sensitiveConsentSaving || !sportySnapshot.user) return false;

    setSensitiveConsentSaving(true);
    try {
      const sportyApp = typeof window !== "undefined" ? (window as any).SportyApp : null;
      const user = sportyApp?.getUser?.();

      if (!user) {
        throw new Error("Not authenticated");
      }

      if (typeof sportyApp.grantConsent === "function") {
        await sportyApp.grantConsent("sensitive_health_processing", "consent-policy-v1", "EU");
      } else {
        throw new Error("Sensitive consent grant API unavailable");
      }

      await sportyApp?.refreshConsent?.();
      const hasSensitiveConsent =
        typeof sportyApp?.hasConsentType === "function"
          ? Boolean(sportyApp.hasConsentType("sensitive_health_processing"))
          : false;
      if (!hasSensitiveConsent) {
        throw new Error("Sensitive consent was not recorded");
      }
      setSensitiveConsentGiven(true);
      return true;
    } catch (error) {
      console.error('[Intake] Failed to grant sensitive consent', error);
      setSensitiveConsentGiven(false);
      throw error;
    } finally {
      setSensitiveConsentSaving(false);
    }
  }, [sensitiveConsentSaving, sportySnapshot.user]);

  const currentStepIndexRef = useRef(currentStepIndex);
  const prefillAppliedUserIdRef = useRef<string | null>(null);
  const basicsTouchedRef = useRef<Set<string>>(new Set());
  const measurementsTouchedRef = useRef<Set<string>>(new Set());
  const traitsTouchedRef = useRef<Set<string>>(new Set());
  const pastSportsTouchedRef = useRef(false);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    if (!sportySnapshot.user?.id) {
      prefillAppliedUserIdRef.current = null;
      basicsTouchedRef.current.clear();
      measurementsTouchedRef.current.clear();
      traitsTouchedRef.current.clear();
      pastSportsTouchedRef.current = false;
    }
  }, [sportySnapshot.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sportySnapshot.user?.id) return;
    const userId = sportySnapshot.user.id;
    if (prefillAppliedUserIdRef.current === userId) return;

    prefillAppliedUserIdRef.current = userId;
    const sportyApp = (window as any).SportyApp;

    (async () => {
      try {
        const payload = await sportyApp?.fetchIntakePrefill?.();
        const prefill = payload?.prefill || {};
        const basicPrefill = prefill?.basics || {};
        const measurementPrefill = prefill?.measurements || {};
        const traitsPrefill = prefill?.traits || {};
        const pastSportsPrefill = Array.isArray(prefill?.past_sports) ? prefill.past_sports : [];
        const premiumPrefill = {
          preferences: Array.isArray(prefill?.preferences) ? prefill.preferences : [],
          goals: Array.isArray(prefill?.goals) ? prefill.goals : [],
          injuries: Array.isArray(prefill?.injuries) ? prefill.injuries : [],
        };

        setBasics((prev) => {
          const next = { ...prev };
          if (!basicsTouchedRef.current.has("birthday")) {
            const birthday = typeof basicPrefill?.birthday === "string" ? basicPrefill.birthday : "";
            if (birthday) next.birthday = birthday;
          }
          if (!basicsTouchedRef.current.has("sex")) {
            const sex = typeof basicPrefill?.sex === "string" ? basicPrefill.sex : "";
            if (sex && isSexOption(sex)) next.sex = sex as Sex;
          }
          return next;
        });

        setMeasurements((prev) => {
          const next = { ...prev };
          measurementKeys.forEach((id) => {
            if (measurementsTouchedRef.current.has(id)) return;
            const raw = (measurementPrefill as any)?.[id];
            if (raw === null || raw === undefined || raw === "") return;
            const num = Number(raw);
            if (Number.isFinite(num)) next[id] = num;
          });
          return next;
        });

        setTraits((prev) => {
          const next = { ...prev };
          traitFieldNames.forEach((fieldName) => {
            if (traitsTouchedRef.current.has(fieldName)) return;
            const value = (traitsPrefill as any)?.[fieldName];
            if (typeof value === "string" && value.trim()) {
              next[fieldName as keyof TraitAnswers] = value.trim();
            }
          });
          return next;
        });

        if (!pastSportsTouchedRef.current && pastSportsPrefill.length) {
          const entries = pastSportsPrefill.map((row: any, idx: number) => ({
            id: `prefill-${idx}-${Date.now()}`,
            sport_subcategory_id: row?.sport_subcategory_id || null,
            sport_label: row?.sport_label || "",
            years_played:
              row?.years_played === null || row?.years_played === undefined
                ? null
                : Number(row.years_played),
            age_started_years:
              row?.age_started_years === null || row?.age_started_years === undefined
                ? null
                : Number(row.age_started_years),
            intensity: row?.intensity || null,
            liked: typeof row?.liked === "boolean" ? row.liked : null,
            had_flair: typeof row?.had_flair === "boolean" ? row.had_flair : null,
            achieved_skill:
              typeof row?.achieved_skill === "boolean" ? row.achieved_skill : null,
          }));
          setPastSports((prev) => (prev.length ? prev : entries));
        }

        premiumControllerRef.current?.prefill?.(premiumPrefill);
      } catch (error) {
        console.warn("[Intake] Unable to prefill from canonical saved-analysis prefill endpoint", error);
      }
    })();
  }, [measurementKeys, sportySnapshot.user?.id, traitFieldNames]);

  const validateBasics = useCallback((): StepValidationResult<
    Pick<FreeIntakeData, "birthday" | "sex">
  > => {
    if (!basics.birthday) {
      return {
        ok: false,
        message: "Add your birthday before continuing.",
        elementId: "birthday",
      };
    }
    if (!basics.sex || !isSexOption(basics.sex)) {
      return {
        ok: false,
        message: "Select the sex assigned at birth before continuing.",
        elementId: "sex",
      };
    }
    return {
      ok: true,
      data: { birthday: basics.birthday, sex: basics.sex as Sex },
    };
  }, [basics]);

  const validateMeasurements = useCallback((): StepValidationResult<Record<string, number>> => {
    const data: Record<string, number> = {};
    if (!measurementKeys.length) {
      return {
        ok: false,
        message: "Measurement catalog not loaded yet. Try again in a moment.",
      };
    }

    for (const id of measurementKeys) {
      const field = measurementFieldById.get(id);
      const label = field?.label || id;
      const value = measurements[id];

      if (value === null || value === undefined || value === ("" as any)) {
        return {
          ok: false,
          message: `Enter ${label.toLowerCase()} before continuing.`,
          elementId: id,
        };
      }

      const numVal = Number(value);
      if (!Number.isFinite(numVal)) {
        return {
          ok: false,
          message: `${label} must be a number.`,
          elementId: id,
        };
      }

      if (typeof field?.min === "number" && numVal < field.min) {
        return {
          ok: false,
          message: `${label} must be at least ${formatBoundaryValue(
            id,
            field.min,
            measurementSystem
          )}.`,
          elementId: id,
        };
      }

      if (typeof field?.max === "number" && numVal > field.max) {
        return {
          ok: false,
          message: `${label} must be at most ${formatBoundaryValue(
            id,
            field.max,
            measurementSystem
          )}.`,
          elementId: id,
        };
      }
      data[id] = numVal;
    }

    return { ok: true, data };
  }, [measurementFieldById, measurementKeys, measurements, measurementSystem]);

  const handleMeasurementSystemChange = useCallback(
    async (nextSystem: MeasurementSystem) => {
      setMeasurementSystem(nextSystem);
      persistMeasurementSystemLocal(nextSystem);

      const sportyApp =
        typeof window !== "undefined" ? (window as any).SportyApp : null;
      const client = sportyApp?.getClient?.();
      const user = sportyApp?.getUser?.();
      if (!client || !user?.id) return;

      try {
        await persistMeasurementSystemForUser(client, user.id, nextSystem);
      } catch (error) {
        console.warn("[Intake] Unable to persist measurement system", error);
      }
    },
    []
  );

  const setSubmitBusy = useCallback(
    (isBusy: boolean) => {
      const form = document.getElementById("intake-form");
      const button = form?.querySelector<HTMLButtonElement>("[data-submit]");
      if (!button) return;
      button.disabled = isBusy;
      button.textContent = isBusy ? "Generating…" : submitLabel;
    },
    [submitLabel]
  );

  const handleSubmit = useCallback(
    async (event?: Event) => {
      if (event) event.preventDefault();

      const basicsResult = validateBasics();
      if (!basicsResult.ok) {
        setStatus(basicsResult.message, "error");
        focusField(basicsResult.elementId);
        return;
      }

      const measurementResult = validateMeasurements();
      if (!measurementResult.ok) {
        setStatus(measurementResult.message, "error");
        focusField(measurementResult.elementId);
        return;
      }

      const premiumController = premiumControllerRef.current;
      const premiumSelection = premiumController?.collect() ?? {
        applyCredit: false,
        data: null,
        errors: [],
      };
      if (premiumSelection.errors && premiumSelection.errors.length) {
        setStatus(premiumSelection.errors.join(" "), "error");
        setSubmitBusy(false);
        return;
      }

      const requiresPremium = mode === "premium";
      // If user opted in to consent in this session, record it before submit
      if (!sportySnapshot?.consents?.basic_processing?.granted && consentGiven) {
        try {
          const ok = await handleGrantConsent();
          consentIntentRef.current = Boolean(ok);
        } catch (err) {
          consentIntentRef.current = false;
          setStatus("Unable to record consent right now. Please try again.", "error");
          setSubmitBusy(false);
          return;
        }
      }
      if (requiresPremium && !premiumSelection.applyCredit) {
        setStatus(
          "No credits for a premium analysis available.",
          "error"
        );
        return;
      }
      // Only allow premium flow when we're on the premium intake or the user explicitly applied a credit in that mode.
      const wantsPremium = requiresPremium ? true : false;
      const premiumData = premiumSelection.data || null;
      const snapshot = sportySnapshot;
      const userId = snapshot.user && snapshot.user.id ? snapshot.user.id : null;
      if (wantsPremium && !userId) {
        setStatus("Sign in to apply an adult analysis credit.", "error");
        return;
      }

      const cleanedPastSports = pastSports.map(
        ({ id, sport_label, ...rest }) => rest
      );
      const readMeasurement = (id: string): number | undefined =>
        measurementResult.data[id];

      const freeIntakeData: FreeIntakeData = {
        ...basicsResult.data,
        height_cm: readMeasurement("height_cm")!,
        weight_kg: readMeasurement("weight_kg")!,
        arm_span_cm: readMeasurement("arm_span_cm")!,
        leg_inseam_cm: readMeasurement("leg_inseam_cm")!,
        shoulder_width_cm: readMeasurement("shoulder_width_cm")!,
        pelvic_bone_width_cm: readMeasurement("pelvic_bone_width_cm")!,
        torso_length_cm: readMeasurement("torso_length_cm")!,
        wrist_circumference_cm: readMeasurement("wrist_circumference_cm")!,
        hand_length_cm: mode === "premium" ? readMeasurement("hand_length_cm")! : null,
        foot_length_cm: mode === "premium" ? readMeasurement("foot_length_cm")! : null,
        ankle_circumference_cm:
          mode === "premium" ? readMeasurement("ankle_circumference_cm")! : null,
        pastSports: cleanedPastSports,
      };

      const traitAnswers: TraitAnswers = wantsPremium ? { ...traits } : {};

      const premiumIntakeData: PremiumIntakeData = {
        ...freeIntakeData,
        hand_length_cm: readMeasurement("hand_length_cm")!,
        foot_length_cm: readMeasurement("foot_length_cm")!,
        ankle_circumference_cm: readMeasurement("ankle_circumference_cm")!,
        traits: traitAnswers,
        preferences: premiumData?.preferences || [],
        goals: premiumData?.goals || [],
        injuries: premiumData?.injuries || [],
      };
      const payload = wantsPremium
        ? buildPremiumPayload(premiumIntakeData, userId!)
        : buildFreePayload(freeIntakeData);

      setSubmitBusy(true);
      setStatus(
        wantsPremium
          ? "Applying your credit and crunching the numbers…"
          : "Crunching the numbers…",
        "info"
      );

      const hasBasicConsent = Boolean(
        snapshot?.consents?.basic_processing?.granted
      );
      let consentAccepted = hasBasicConsent || consentGiven || consentIntentRef.current;
      let hasSensitiveConsent = Boolean(
        snapshot?.consents?.sensitive_health_processing?.granted
      );
      let sensitiveConsentAccepted =
        hasSensitiveConsent || sensitiveConsentGiven || sensitiveConsentIntentRef.current;
      const sportyApp =
        typeof window !== "undefined" ? (window as any).SportyApp : null;

      // For logged-in users, require basic consent before persisting account history.
      if (
        sportyApp &&
        snapshot.user &&
        !consentAccepted &&
        typeof sportyApp.ensureConsent === "function"
      ) {
        try {
          consentAccepted = await sportyApp.ensureConsent("basic_processing");
          premiumController?.setConsent?.(consentAccepted);
        } catch (error) {
          console.error("Consent prompt failed", error);
          consentAccepted = false;
        }
        if (!consentAccepted) {
          setStatus(
            wantsPremium
              ? "To keep your data private, log out before running another match or enable storage in your profile."
              : "Analysis ran, but we did not save it. Enable storage consent in your profile to keep history.",
            "error"
          );
          if (wantsPremium) {
            setSubmitBusy(false);
            return;
          }
        }
      }

      if (wantsPremium && snapshot.user && !hasSensitiveConsent && sensitiveConsentAccepted) {
        try {
          const ok = await handleGrantSensitiveConsent();
          sensitiveConsentIntentRef.current = Boolean(ok);
          hasSensitiveConsent = Boolean(ok);
          sensitiveConsentAccepted = Boolean(ok);
        } catch (_error) {
          sensitiveConsentIntentRef.current = false;
          sensitiveConsentAccepted = false;
          hasSensitiveConsent = false;
          setStatus("Unable to record sensitive-data consent right now. Please try again.", "error");
          setSubmitBusy(false);
          return;
        }
      }

      if (wantsPremium && snapshot.user && !hasSensitiveConsent) {
        setStatus(
          "Premium analysis needs explicit sensitive-data consent (injury/health factors). Turn on the sensitive consent toggle first.",
          "error"
        );
        setSubmitBusy(false);
        return;
      }

      try {
        const endpoint = wantsPremium
          ? "/api/recommend-adult-premium"
          : "/api/recommend-adult-free";

        // Get or create session ID
        let sessionId = sessionStorage.getItem("sporty:sessionId");
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          sessionStorage.setItem("sporty:sessionId", sessionId);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Session-ID": sessionId
        };
        const accessToken =
          sportyApp?.getSession?.()?.access_token || sportySnapshot.session?.access_token;
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        const requestBody = JSON.stringify(payload);

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: requestBody,
        });

        const bodyText = await response.text();
        if (!response.ok) {
          let detail = "We could not generate a suggestion right now.";
          try {
            const json = JSON.parse(bodyText);
            if (Array.isArray(json.detail)) {
              // FastAPI validation errors: array of {msg, loc, type}
              detail = json.detail.map((err: any) => err.msg || JSON.stringify(err)).join("; ");
            } else if (typeof json.detail === "string") {
              detail = json.detail;
            } else if (json.detail) {
              detail = JSON.stringify(json.detail);
            }
          } catch (_) { }
          throw new Error(detail);
        }

        const resultJson = (() => {
          try {
            return JSON.parse(bodyText);
          } catch (_) {
            return null;
          }
        })();

        const storageKey = wantsPremium
          ? "sporty:lastPremiumResult"
          : "sporty:lastResult";
        sessionStorage.setItem(storageKey, bodyText);
        if (!wantsPremium) {
          sessionStorage.setItem("sporty:lastResult", bodyText);
        } else if (
          resultJson &&
          resultJson.credit &&
          resultJson.credit.totals
        ) {
          sessionStorage.setItem(
            "sporty:lastCreditSnapshot",
            JSON.stringify(resultJson.credit.totals)
          );
        }

        if (
          consentAccepted &&
          sportyApp &&
          typeof sportyApp.saveRecommendation === "function"
        ) {
          try {
            const extraPayload: Record<string, unknown> = {};
            if (premiumData) {
              extraPayload.analysisInput = premiumData;
            }
            if (cleanedPastSports.length) {
              extraPayload.pastSports = cleanedPastSports;
            }
            extraPayload.analysisType = wantsPremium ? "premium" : "free";
            const extras = Object.keys(extraPayload).length
              ? extraPayload
              : undefined;
            if (!resultJson) throw new Error("Invalid analysis payload");
            const saveOutcome = await sportyApp.saveRecommendation(
              payload,
              resultJson,
              extras
            );
            if (saveOutcome && saveOutcome.saved) {
              setStatus("Saved to your account. Redirecting…", "info");
            }
          } catch (error) {
            console.error("Failed to persist recommendation", error);
          }
        }

        window.location.assign(wantsPremium ? "/results/premium" : "/results");
      } catch (error) {
        setStatus(
          (error as Error).message || "Unexpected error, please try again.",
          "error"
        );
        setSubmitBusy(false);
      }
    },
    [
      focusField,
      mode,
      setSubmitBusy,
      setStatus,
      validateBasics,
      validateMeasurements,
      sportySnapshot,
      pastSports,
      basics,
      measurements,
      traits,
      consentGiven,
      sensitiveConsentGiven,
      handleGrantConsent,
      handleGrantSensitiveConsent,
    ]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const premiumController = createPremiumController({
      block: document.querySelector("[data-premium-block]"),
      locked: document.querySelector("[data-premium-locked]"),
      lockedMessage: document.querySelector("[data-premium-locked-message]"),
      summary: document.querySelector("[data-premium-summary]"),
      prefillForTesting: Boolean(import.meta.env.DEV),
      getClient: () =>
        typeof window !== "undefined"
          ? (window as any).SportyApp?.getClient?.() ?? null
          : null,
    });
    premiumControllerRef.current = premiumController;

    return () => {
      premiumController.reset();
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let pollTimer: number | undefined;
    let attempts = 0;
    const MAX_ATTEMPTS = 50; // 5 seconds max

    const applySnapshot = (snapshot: SportySnapshot | null) => {
      const normalized = snapshot || { user: null, consents: {} };
      setSportySnapshot(normalized);
      premiumControllerRef.current?.update(normalized).catch((error) => {
        console.error("Failed to update premium controller", error);
      });
    };

    const initSportyApp = () => {
      const sportyApp = typeof window !== "undefined" ? (window as any).SportyApp : null;

      if (sportyApp && sportyApp.ready) {
        if (pollTimer) {
          window.clearInterval(pollTimer);
          pollTimer = undefined;
        }

        sportyApp.ready.then(() => {
          if (typeof sportyApp.onAuthChange === "function") {
            unsubscribe = sportyApp.onAuthChange((snapshot: SportySnapshot | null) =>
              applySnapshot(snapshot)
            );
          } else {
            applySnapshot({ user: null, consents: {} });
          }
        });
        return true;
      }
      return false;
    };

    // Try immediately
    if (!initSportyApp()) {
      // Poll if not ready yet
      pollTimer = window.setInterval(() => {
        attempts++;
        if (initSportyApp() || attempts >= MAX_ATTEMPTS) {
          if (pollTimer) {
            window.clearInterval(pollTimer);
            pollTimer = undefined;
          }
        }
      }, 100);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, []);

  const canNavigateTo = (targetIndex: number): boolean => {
    if (targetIndex < 0 || targetIndex >= stepDefinitions.length) return false;
    return targetIndex <= maxVisitedIndex;
  };

  const handleNavClick = (targetIndex: number) => {
    if (!canNavigateTo(targetIndex)) return;
    setCurrentStepIndex(targetIndex);
  };

  const isFirstStep = currentStepIndex === 0;
  const isFinalStep = currentStepIndex === stepDefinitions.length - 1;

  const renderStepperActions = () => (
    <div
      className="flex w-full items-center justify-between gap-3 py-4"
      data-stepper-actions
    >
      <div>
        {!isFirstStep && (
          <button
            type="button"
            className="btn-pill btn-pill-secondary btn-pill-sm"
            onClick={() => {
              const target = currentStepIndex - 1;
              if (target >= 0) {
                setCurrentStepIndex(target);
              }
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
            onClick={() => {
              if (currentStepIndex === 0) {
                const result = validateBasics();
                if (!result.ok) {
                  setStatus(result.message, "error");
                  focusField(result.elementId);
                  return;
                }
              } else if (currentStepIndex === 1) {
                const result = validateMeasurements();
                if (!result.ok) {
                  setStatus(result.message, "error");
                  focusField(result.elementId);
                  return;
                }
              }

              setStatus("");
              const nextIndex = Math.min(
                stepDefinitions.length - 1,
                currentStepIndex + 1
              );
              setCurrentStepIndex(nextIndex);
              setMaxVisitedIndex((prev) => Math.max(prev, nextIndex));
            }}
          >
            Continue
          </button>
        )}
        {isFinalStep && (() => {
          const needsBasicConsent =
            sportySnapshot.user &&
            !Boolean(sportySnapshot?.consents?.basic_processing?.granted) &&
            !consentGiven;
          const needsSensitiveConsent =
            mode === "premium" &&
            sportySnapshot.user &&
            !Boolean(sportySnapshot?.consents?.sensitive_health_processing?.granted) &&
            !sensitiveConsentGiven;
          const isDisabled = Boolean(needsBasicConsent || needsSensitiveConsent);
          return (
            <button
              type="button"
              onClick={() => handleSubmit()}
              className={`btn-pill btn-pill-primary ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-submit
              disabled={isDisabled || undefined}
            >
              {submitLabel}
            </button>
          );
        })()}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar replacing step pills */}
      <div className="w-full" data-stepper-progress>
        <div className="flex justify-between items-baseline mb-2">
          <span className="badge-subtle">
            {stepDefinitions[currentStepIndex]?.title || ""}
          </span>
          <span className="text-sm text-slate-500">
            Step {currentStepIndex + 1} of {stepDefinitions.length}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className="bg-teal-600 h-2.5 rounded-full transition-all duration-200"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  Math.round(((currentStepIndex + 1) / stepDefinitions.length) * 100)
                )
              )}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="space-y-6" data-stepper-content>
        {stepDefinitions.map((step, idx) => {
          if (PREMIUM_SECTION_KEYS.includes(step.key as PremiumSectionKey)) {
            return null;
          }
          const isActive = idx === currentStepIndex;
          const inner = (() => {
            switch (step.key) {
              case "basics":
                return (
                  <BasicsStep
                    value={basics}
                    onChange={(patch) => {
                      Object.keys(patch || {}).forEach((key) => basicsTouchedRef.current.add(key));
                      setBasics((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                );
              case "measurements":
                return (
                  <MeasurementsStep
                    mode={mode}
                    fields={activeMeasurementFields}
                    values={measurements}
                    measurementSystem={measurementSystem}
                    onMeasurementSystemChange={handleMeasurementSystemChange}
                    onChange={(patch) => {
                      Object.keys(patch || {}).forEach((key) => measurementsTouchedRef.current.add(key));
                      setMeasurements((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                );
              case "traits":
                return (
                  <TraitsStep
                    value={traits}
                    questions={traitQuestions}
                    loading={catalogLoading}
                    error={catalogError}
                    onChange={(patch) => {
                      Object.keys(patch || {}).forEach((key) => traitsTouchedRef.current.add(key));
                      setTraits((prev) => ({ ...prev, ...patch }));
                    }}
                  />
                );
              case "pastSports":
                return (
                  <PastSportsStep
                    entries={pastSports}
                    intensityOptions={pastSportIntensityOptions}
                    booleanFields={pastSportBooleanFields}
                    onUpdate={(entries) => {
                      pastSportsTouchedRef.current = true;
                      setPastSports(entries);
                    }}
                  />
                );
              default:
                return null;
            }
          })();
          if (!inner) return null;
          return (
            <div key={step.key} hidden={!isActive}>
              {inner}
            </div>
          );
        })}
        <div hidden={!showPremiumBlock}>
          <PremiumBlock
            activeSection={activePremiumSection}
            visible={showPremiumBlock}
          />
        </div>
      </div>

      {/* Consent prompt only when not already granted */}
      {isFinalStep &&
        sportySnapshot.user &&
        !Boolean(sportySnapshot?.consents?.basic_processing?.granted) && (
        <div className="dashboard-card border-2 border-amber-100 bg-amber-50/30">
          <div className="flex items-center justify-between py-4">
            <div className="max-w-xl">
              <h3 className="font-medium text-slate-900">Consent to Sporty handling your data</h3>
              <p className="text-sm text-slate-500 mt-1">
                Allow Sporty to process and store your intake data and results for your account.
              </p>
            </div>
            <label className="toggle flex-shrink-0 ml-4" aria-label="Data retention consent">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  consentIntentRef.current = target.checked;
                  setConsentGiven(target.checked);
                }}
                disabled={consentSaving}
              />
              <span className="toggle__track"></span>
            </label>
          </div>
        </div>
      )}

      {isFinalStep &&
        mode === "premium" &&
        sportySnapshot.user &&
        !Boolean(sportySnapshot?.consents?.sensitive_health_processing?.granted) && (
        <div className="dashboard-card border-2 border-amber-100 bg-amber-50/30">
          <div className="flex items-center justify-between py-4">
            <div className="max-w-xl">
              <h3 className="font-medium text-slate-900">Consent to sensitive health processing</h3>
              <p className="text-sm text-slate-500 mt-1">
                Allow Sporty to process injury and health-related premium inputs as part of your premium analysis.
              </p>
            </div>
            <label className="toggle flex-shrink-0 ml-4" aria-label="Sensitive health processing consent">
              <input
                type="checkbox"
                checked={sensitiveConsentGiven}
                onChange={(e) => {
                  const target = e.target as HTMLInputElement;
                  sensitiveConsentIntentRef.current = target.checked;
                  setSensitiveConsentGiven(target.checked);
                }}
                disabled={sensitiveConsentSaving}
              />
              <span className="toggle__track"></span>
            </label>
          </div>
        </div>
      )}

      {renderStepperActions()}
    </div>
  );
};

export default IntakeApp;
