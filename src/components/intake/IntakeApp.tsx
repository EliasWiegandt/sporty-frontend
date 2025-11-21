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
  "sport_side",
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
  basics: { title: "Basics", subtitle: "Birthday & sex" },
  measurements: {
    title: "Measurements",
    subtitle: "Body, torso & limb inputs",
  },
  traits: { title: "Traits", subtitle: "Physiological cues" },
  preferences: { title: "Preferences", subtitle: "Priority selections" },
  goals: { title: "Goals", subtitle: "Training and performance targets" },
  injuries: { title: "Injuries", subtitle: "Risk-aware considerations" },
  pastSports: { title: "Past sports", subtitle: "Optional experience" },
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
  hip_width_cm: 69,
  hand_length_cm: 19,
  foot_length_cm: 24,
  torso_length_cm: 60,
  ankle_circumference_cm: 20,
  wrist_circumference_cm: 17,
};

const LOCAL_PREFILL_PAST_SPORTS: Array<Omit<PastSportsEntry, "id">> = [
  {
    sport_subcategory_id: "e98f2d2c-46a5-4182-991f-00f4925d62c1",
    sport_label: "Tennis",
    years_played: 3,
    age_started_years: 14,
    intensity: "moderate",
    liked: true,
    had_flair: true,
    achieved_skill: true,
  },
  {
    sport_subcategory_id: "e20221fd-0b55-498b-9623-c40223cc6f3c",
    sport_label: "Soccer - Goalkeeper",
    years_played: 1.5,
    age_started_years: 12,
    intensity: "light",
    liked: true,
    had_flair: false,
    achieved_skill: false,
  },
];

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
        return;
      }

      const requiresPremium = mode === "premium";
      if (requiresPremium && !premiumSelection.applyCredit) {
        setStatus(
          "Apply an adult analysis credit before submitting this premium intake.",
          "error"
        );
        return;
      }
      const wantsPremium = premiumSelection.applyCredit || requiresPremium;
      const premiumData = premiumSelection.data || null;
      const snapshot = sportySnapshot;
      const userId =
        snapshot.user && snapshot.user.id ? snapshot.user.id : null;
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

      let consentAccepted = snapshot.hasConsent;
      const sportyApp =
        typeof window !== "undefined" ? (window as any).SportyApp : null;
      if (
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
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const bodyText = await response.text();
        if (!response.ok) {
          let detail = "We could not generate a suggestion right now.";
          try {
            const json = JSON.parse(bodyText);
            detail = json.detail || detail;
          } catch (_) {}
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
    const sportyApp =
      typeof window !== "undefined" ? (window as any).SportyApp : null;
    const applySnapshot = (snapshot: SportySnapshot | null) => {
      const normalized = snapshot || { user: null, hasConsent: false };
      setSportySnapshot(normalized);
      premiumControllerRef.current?.update(normalized).catch((error) => {
        console.error("Failed to update premium controller", error);
      });
    };

    if (sportyApp && sportyApp.ready) {
      sportyApp.ready.then(() => {
        if (typeof sportyApp.onAuthChange === "function") {
          sportyApp.onAuthChange((snapshot: SportySnapshot | null) =>
            applySnapshot(snapshot)
          );
        } else {
          applySnapshot({ user: null, hasConsent: false });
        }
      });
    } else {
      applySnapshot({ user: null, hasConsent: false });
    }
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
        {isFinalStep && (
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="btn-pill btn-pill-primary"
            data-submit
          >
            {submitLabel}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-3" data-stepper-nav>
        {stepDefinitions.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isCompleted = idx < maxVisitedIndex;
          const stepNumber = idx + 1;

          const baseClasses =
            "btn-pill btn-pill-secondary btn-pill-sm flex items-center gap-2 text-left border border-slate-200 bg-white transition";
          const activeClasses = isActive
            ? "border-2 border-slate-900 shadow-none"
            : "";
          const completedClasses = isCompleted
            ? "bg-teal-50 border-teal-400 text-teal-800"
            : "";

          return (
            <button
              key={step.key}
              type="button"
              className={[baseClasses, activeClasses, completedClasses]
                .filter(Boolean)
                .join(" ")}
              data-step-index={step.index}
              onClick={() => handleNavClick(idx)}
            >
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                  isCompleted
                    ? "border-teal-500 bg-teal-500 text-white"
                    : isActive
                    ? "border-slate-900 text-slate-900"
                    : "border-slate-300 text-slate-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {stepNumber}
              </span>
              <span className="flex flex-col items-start">
                <span className="font-semibold text-slate-800">
                  {step.title}
                </span>
                <span className="type-small text-slate-500">
                  {step.subtitle}
                </span>
              </span>
            </button>
          );
        })}
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

      {renderStepperActions()}
    </div>
  );
};

export default IntakeApp;
