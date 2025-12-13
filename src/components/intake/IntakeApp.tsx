import type { FunctionalComponent } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import BasicsStep from "./steps/BasicsStep";
import MeasurementsStep from "./steps/MeasurementsStep";
import PastSportsStep from "./steps/PastSportsStep";
import TraitsStep from "./steps/TraitsStep";
import PremiumBlock, { type PremiumSectionKey } from "./PremiumBlock";
import { measurementFields } from "../../data/measurementFields";
import {
  createPremiumController,
  type PremiumController,
} from "./premiumController";
import { buildFreePayload, buildPremiumPayload } from "../../data/intakeSchema";
import type {
  FreeIntakeData,
  PremiumIntakeData,
  Sex,
  TraitAnswers,
  PastSportInput,
} from "../../data/intakeSchema";

type SportySnapshot = {
  user: { id: string } | null;
  hasConsent: boolean;
};

export type PastSportsEntry = PastSportInput & {
  id: string;
  sport_label?: string | null;
};

const STORAGE_KEY = "sporty:intake:draft:v1";

const TRAIT_FIELDS = [
  "muscle_fiber",
  "metabolic_tendency",
  "joint_laxity",
  "foot_arch",
  "temperature_tolerance",
  "handedness",
  "footedness",
] as const;

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

const measurementKeys = measurementFields.map((field) => field.id) as Array<
  Exclude<keyof FreeIntakeData, "birthday" | "sex" | "pastSports">
>;

const LOCAL_PREFILL_BASICS: Pick<FreeIntakeData, "birthday" | "sex"> = {
  birthday: "1995-05-15",
  sex: "female",
};

const LOCAL_PREFILL_MEASUREMENTS: Record<string, number> = {
  height_cm: 168,
  weight_kg: 59,
  arm_span_cm: 170,
  leg_inseam_cm: 80,
  shoulder_width_cm: 44,
  pelvic_bone_width_cm: 69,
  hand_length_cm: 19,
  foot_length_cm: 24,
  torso_length_cm: 60,
  ankle_circumference_cm: 20,
  wrist_circumference_cm: 17,
};

const LOCAL_PREFILL_PAST_SPORTS: Array<Omit<PastSportsEntry, "id">> = [
  {
    sport_subcategory_id: "soccer-forward-striker",
    sport_label: "Soccer - Forward - Striker",
    years_played: 3,
    age_started_years: 14,
    intensity: "moderate",
    liked: true,
    had_flair: true,
    achieved_skill: true,
  },
  {
    sport_subcategory_id: "soccer-forward-winger",
    sport_label: "Soccer - Forward - Winger",
    years_played: 1.5,
    age_started_years: 12,
    intensity: "light",
    liked: true,
    had_flair: false,
    achieved_skill: false,
  },
];

const LOCAL_PREFILL_TRAITS: Record<string, string> = {
  muscle_fiber: "fast_twitch_dominant",
  metabolic_tendency: "don't know",
  joint_laxity: "medium",
  foot_arch: "neutral",
  temperature_tolerance: "don't know",
  handedness: "right",
  footedness: "right",
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

const supportsLocalStorage = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const key = "__sporty_intake_test__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

type IntakeAppProps = {
  mode: IntakeMode;
};

const IntakeApp: FunctionalComponent<IntakeAppProps> = ({ mode }) => {
  const stepDefinitions = buildStepDefinitions(mode);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
  const [sportySnapshot, setSportySnapshot] = useState<SportySnapshot>({
    user: null,
    hasConsent: false,
  });
  const [pastSports, setPastSports] = useState<PastSportsEntry[]>(() =>
    LOCAL_PREFILL_PAST_SPORTS.map((entry, index) => ({
      ...entry,
      id: `prefill-${index}`,
    }))
  );
  const [basics, setBasics] = useState<{ birthday: string; sex: Sex | "" }>(
    () => ({
      ...LOCAL_PREFILL_BASICS,
    })
  );
  const [measurements, setMeasurements] = useState<
    Record<string, number | null>
  >(() => ({
    ...LOCAL_PREFILL_MEASUREMENTS,
  }));
  const [consentGiven, setConsentGiven] = useState(false);
  const consentIntentRef = useRef(false);
  const [consentSaving, setConsentSaving] = useState(false);

  // Premium controller (kept as is for now since it handles external UI blocks)
const premiumControllerRef = useRef<PremiumController | null>(null);

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

  const handleGrantConsent = useCallback(async () => {
    if (consentSaving || !sportySnapshot.user) return;

    setConsentSaving(true);
    try {
      const sportyApp = typeof window !== "undefined" ? (window as any).SportyApp : null;
      const client = sportyApp?.getClient?.();
      const user = sportyApp?.getUser?.();

      if (!client || !user) {
        throw new Error("Not authenticated");
      }

      // Check if consent already exists
      const { data: existing } = await client
        .from('consents')
        .select('id')
        .eq('user_id', user.id)
        .eq('consent_type', 'data_retention')
        .is('revoked_at', null)
        .maybeSingle();

      if (!existing) {
        // Record consent
        if (typeof sportyApp.recordConsent === 'function') {
          await sportyApp.recordConsent(user.id);
        } else {
          // Fallback
          const payload = {
            user_id: user.id,
            consent_type: 'data_retention',
            version: 'adult-data-retention-v1',
          };
          const { error } = await client.from('consents').insert(payload);
          if (error) throw error;
        }
      }

      // Refresh consent state
      await sportyApp?.refreshConsent?.();
      setConsentGiven(true);
    } catch (error) {
      console.error('[Intake] Failed to grant consent', error);
      setConsentGiven(false);
    } finally {
      setConsentSaving(false);
    }
  }, [consentSaving, sportySnapshot.user]);

  const currentStepIndexRef = useRef(currentStepIndex);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  const saveDraft = useCallback(() => {
    if (!supportsLocalStorage()) return;

    const draft = {
      step: currentStepIndexRef.current + 1,
      basics: { ...basics },
      measurements: { ...measurements },
      pastSports: pastSports.map(({ id, ...rest }) => rest),
      traits: {}, // Traits logic would need similar update if used
    };

    // Collect traits from DOM for now (legacy behavior kept for traits step)
    const form = document.getElementById(
      "intake-form"
    ) as HTMLFormElement | null;
    if (form) {
      TRAIT_FIELDS.forEach((fieldName) => {
        const input = form.querySelector<HTMLInputElement>(
          `input[name="${fieldName}"]:checked`
        );
        if (input && input.value) {
          // @ts-ignore
          draft.traits[fieldName] = input.value;
        }
      });
    }

    const hasBasics = Boolean(draft.basics.birthday || draft.basics.sex);
    const hasMeasurements = Object.keys(draft.measurements).length > 0;
    const hasPast = draft.pastSports.length > 0;

    try {
      if (hasBasics || hasMeasurements || hasPast) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [basics, measurements, pastSports]);

  // Autosave on change
  useEffect(() => {
    if (!isRestoringRef.current) {
      saveDraft();
    }
  }, [basics, measurements, pastSports, saveDraft]);

  const restoreDraft = useCallback(() => {
    if (!supportsLocalStorage()) return null;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    const setRestoringFlag = (value: boolean) => {
      isRestoringRef.current = value;
    };

    setRestoringFlag(true);

    try {
      if (parsed.basics) {
        setBasics((prev) => ({ ...prev, ...parsed.basics }));
      }
      if (parsed.measurements) {
        setMeasurements((prev) => ({ ...prev, ...parsed.measurements }));
      }
      if (Array.isArray(parsed.pastSports)) {
        const restoredPastSports = parsed.pastSports.map(
          (entry: any, idx: number) => ({
            ...entry,
            id: `restored-${idx}-${Date.now()}`,
          })
        );
        setPastSports(restoredPastSports);
      }
      // Legacy field support
      const legacyFields = parsed?.fields;
      if (legacyFields && typeof legacyFields === "object") {
        const newBasics = {
          birthday: legacyFields.birthday || "",
          sex: legacyFields.sex || "",
        };
        setBasics(newBasics);
        const newMeasurements: Record<string, number> = {};
        measurementKeys.forEach((id) => {
          if (Object.prototype.hasOwnProperty.call(legacyFields, id)) {
            newMeasurements[id] = legacyFields[id];
          }
        });
        setMeasurements(newMeasurements);
      }

      // Restore traits to DOM (legacy)
      const form = document.getElementById("intake-form");
      const traitsDraft = parsed?.traits;
      if (form && traitsDraft && typeof traitsDraft === "object") {
        Object.entries(traitsDraft).forEach(([fieldName, value]) => {
          if (!value) return;
          const input = form.querySelector<HTMLInputElement>(
            `input[name="${fieldName}"][value="${value}"]`
          );
          if (input) {
            input.checked = true;
          }
        });
      }

      const stepValue =
        typeof parsed?.step === "number" && parsed.step > 0
          ? parsed.step
          : null;
      if (stepValue) {
        const index = Math.max(
          0,
          Math.min(stepDefinitions.length - 1, stepValue - 1)
        );
        setCurrentStepIndex(index);
        setMaxVisitedIndex((prev) => (index > prev ? index : prev));
      }
    } finally {
      setTimeout(() => {
        setRestoringFlag(false);
      }, 0);
    }

    return { step: parsed.step };
  }, [stepDefinitions.length]);

  // Initial restore
  useEffect(() => {
    restoreDraft();
  }, [restoreDraft]);

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

  const validateMeasurements = useCallback((): StepValidationResult<
    Pick<FreeIntakeData, (typeof measurementKeys)[number]>
  > => {
    const data: Partial<
      Pick<FreeIntakeData, (typeof measurementKeys)[number]>
    > = {};

    for (const id of measurementKeys) {
      const field = measurementFields.find((entry) => entry.id === id);
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
          message: `${label} must be at least ${field.min}.`,
          elementId: id,
        };
      }

      if (typeof field?.max === "number" && numVal > field.max) {
        return {
          ok: false,
          message: `${label} must be at most ${field.max}.`,
          elementId: id,
        };
      }
      data[id] = numVal;
    }

    return { ok: true, data: data as any };
  }, [measurements]);

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

  const collectTraitAnswers = useCallback((): TraitAnswers => {
    const form = document.getElementById("intake-form");
    const answers: TraitAnswers = {};
    if (!form) return answers;
    TRAIT_FIELDS.forEach((fieldName) => {
      const input = form.querySelector<HTMLInputElement>(
        `input[name="${fieldName}"]:checked`
      );
      if (input && input.value) {
        answers[fieldName as keyof TraitAnswers] = input.value;
      }
    });
    return answers;
  }, []);

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
      if (!sportySnapshot.hasConsent && consentGiven) {
        try {
          await handleGrantConsent();
          consentIntentRef.current = true;
        } catch (err) {
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

      const freeIntakeData: FreeIntakeData = {
        ...basicsResult.data,
        ...measurementResult.data,
        pastSports: cleanedPastSports,
      };

      const traitAnswers: TraitAnswers = wantsPremium
        ? collectTraitAnswers()
        : {};

      const premiumIntakeData: PremiumIntakeData = {
        ...freeIntakeData,
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

      let consentAccepted = snapshot.hasConsent || consentGiven || consentIntentRef.current;
      const sportyApp =
        typeof window !== "undefined" ? (window as any).SportyApp : null;

      // For premium flow, still use the modal-based ensureConsent
      if (
        wantsPremium &&
        sportyApp &&
        snapshot.user &&
        !consentAccepted &&
        typeof sportyApp.ensureConsent === "function"
      ) {
        try {
          consentAccepted = await sportyApp.ensureConsent();
          premiumController?.setConsent?.(consentAccepted);
        } catch (error) {
          console.error("Consent prompt failed", error);
          consentAccepted = false;
        }
        if (!consentAccepted) {
          setStatus(
            "To keep your data private, log out before running another match or enable storage in your profile.",
            "error"
          );
          setSubmitBusy(false);
          return;
        }
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
        if (userId) {
          headers["X-User-ID"] = userId;
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
      collectTraitAnswers,
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
    ]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const premiumController = createPremiumController({
      block: document.querySelector("[data-premium-block]"),
      locked: document.querySelector("[data-premium-locked]"),
      lockedMessage: document.querySelector("[data-premium-locked-message]"),
      summary: document.querySelector("[data-premium-summary]"),
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
      const normalized = snapshot || { user: null, hasConsent: false };
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
            applySnapshot({ user: null, hasConsent: false });
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

  // Auto-init Preline (if used elsewhere)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    (window as any).HSStaticMethods?.autoInit?.();
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
          const needsConsent = mode === "free" && sportySnapshot.user && !sportySnapshot.hasConsent && !consentGiven;
          const isDisabled = needsConsent;
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
                    onChange={(patch) =>
                      setBasics((prev) => ({ ...prev, ...patch }))
                    }
                  />
                );
              case "measurements":
                return (
                  <MeasurementsStep
                    values={measurements}
                    onChange={(patch) =>
                      setMeasurements((prev) => ({ ...prev, ...patch }))
                    }
                  />
                );
              case "traits":
                return <TraitsStep />;
              case "pastSports":
                return (
                  <PastSportsStep
                    entries={pastSports}
                    onUpdate={setPastSports}
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
      {isFinalStep && sportySnapshot.user && !sportySnapshot.hasConsent && (
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
                checked={consentGiven || sportySnapshot.hasConsent}
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

      {renderStepperActions()}
    </div>
  );
};

export default IntakeApp;
