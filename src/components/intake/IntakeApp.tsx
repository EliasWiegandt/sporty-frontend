import type { FunctionalComponent } from "preact";
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import BasicsStep from "./steps/BasicsStep";
import MeasurementsStep from "./steps/MeasurementsStep";
import PastSportsStep from "./steps/PastSportsStep";
import TraitsStep from "./steps/TraitsStep";
import PremiumBlock, { type PremiumSectionKey } from "./PremiumBlock";
import {
  freeMeasurementFields,
  premiumMeasurementFields,
} from "../../data/measurementFields";
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
  session?: { access_token?: string } | null;
  purgeStatus?: string | null;
  purgeRequestedAt?: string | null;
  purgeCompletedAt?: string | null;
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
  const activeMeasurementFields = useMemo(
    () =>
      mode === "premium"
        ? premiumMeasurementFields
        : [...freeMeasurementFields].sort(
            (a, b) =>
              (a.quick_order ?? Number.MAX_SAFE_INTEGER) -
              (b.quick_order ?? Number.MAX_SAFE_INTEGER)
          ),
    [mode]
  );
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
    hasConsent: false,
  });
  const [pastSports, setPastSports] = useState<PastSportsEntry[]>(() => []);
  const [basics, setBasics] = useState<{ birthday: string; sex: Sex | "" }>(
    () => ({ birthday: "", sex: "" })
  );
  const [measurements, setMeasurements] = useState<
    Record<string, number | null>
  >(() => buildEmptyMeasurements(measurementKeys));
  const [traits, setTraits] = useState<TraitAnswers>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const consentIntentRef = useRef(false);
  const [consentSaving, setConsentSaving] = useState(false);
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
        await sportyApp.grantConsent();
      } else {
        throw new Error("Consent grant API unavailable");
      }

      await sportyApp?.refreshConsent?.();
      const hasConsent =
        typeof sportyApp?.hasConsent === "function"
          ? Boolean(sportyApp.hasConsent())
          : true;
      if (!hasConsent) {
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
      traits: { ...traits },
    };

    const hasBasics = Boolean(draft.basics.birthday || draft.basics.sex);
    const hasMeasurements = Object.keys(draft.measurements).length > 0;
    const hasPast = draft.pastSports.length > 0;
    const hasTraits = Object.keys(draft.traits || {}).length > 0;

    try {
      if (hasBasics || hasMeasurements || hasPast || hasTraits) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [basics, measurements, pastSports, traits]);

  // Autosave on change
  useEffect(() => {
    if (!isRestoringRef.current) {
      saveDraft();
    }
  }, [basics, measurements, pastSports, traits, saveDraft]);

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
      const traitsDraft = parsed?.traits;
      if (traitsDraft && typeof traitsDraft === "object") {
        const restoredTraits: TraitAnswers = {};
        TRAIT_FIELDS.forEach((fieldName) => {
          const value = traitsDraft[fieldName];
          if (typeof value === "string" && value.trim()) {
            restoredTraits[fieldName as keyof TraitAnswers] = value;
          }
        });
        setTraits((prev) => ({ ...prev, ...restoredTraits }));
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

  const serverPrefillAppliedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!sportySnapshot.user?.id) return;
    if (serverPrefillAppliedRef.current) return;

    const sportyApp = (window as any).SportyApp;
    const client = sportyApp?.getClient?.();
    if (!client) return;

    serverPrefillAppliedRef.current = true;

    (async () => {
      try {
        const userId = sportySnapshot.user!.id;

        const [{ data: profile }, { data: measurement }, { data: pastSportsRows }] = await Promise.all([
          client
            .from("profiles")
            .select("birthdate,sex,preferred_measurement_system")
            .eq("id", userId)
            .maybeSingle(),
          client
            .from("measurements")
            .select("*")
            .eq("subject_type", "adult")
            .eq("subject_user_id", userId)
            .order("measured_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          client
            .from("past_sports")
            .select("id,sport_subcategory_id,years_played,age_started_years,intensity,liked,had_flair,achieved_skill")
            .eq("subject_type", "adult")
            .eq("subject_user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        if (profile) {
          setBasics((prev) => ({
            birthday: prev.birthday || profile.birthdate || "",
            sex: (prev.sex || (profile.sex as Sex) || "") as Sex | "",
          }));
          const preferredSystem = resolveMeasurementSystemOnClient(
            profile.preferred_measurement_system
          );
          setMeasurementSystem(preferredSystem);
          persistMeasurementSystemLocal(preferredSystem);
        }

        if (measurement) {
          setMeasurements((prev) => {
            const next = { ...prev };
            measurementKeys.forEach((id) => {
              if (next[id] !== null && next[id] !== undefined) return;
              const value = (measurement as any)[id];
              if (value === null || value === undefined) return;
              const numVal = Number(value);
              next[id] = Number.isFinite(numVal) ? numVal : null;
            });
            return next;
          });
        }

        if (Array.isArray(pastSportsRows) && pastSportsRows.length) {
          const subcategoryIds = Array.from(
            new Set(
              pastSportsRows
                .map((row: any) => row?.sport_subcategory_id)
                .filter((value: any) => Boolean(value))
            )
          );
          const labelById = new Map<string, string>();
          if (subcategoryIds.length) {
            const { data: categories } = await client
              .from("sports_subcategories")
              .select("id,name,slug,category")
              .in("id", subcategoryIds);
            (categories || []).forEach((row: any) => {
              const label = typeof row?.name === "string" ? row.name.trim() : "";
              if (!label) {
                console.warn("[Intake] sports_subcategories row missing canonical name", {
                  subcategoryId: row?.id ?? null,
                });
              }
              labelById.set(String(row.id), label);
            });
          }

          const entries = pastSportsRows.map((row: any) => ({
            id: String(row.id),
            sport_subcategory_id: row.sport_subcategory_id || null,
            sport_label: row.sport_subcategory_id
              ? labelById.get(String(row.sport_subcategory_id)) || ""
              : "",
            years_played:
              row.years_played === null || row.years_played === undefined
                ? null
                : Number(row.years_played),
            age_started_years:
              row.age_started_years === null || row.age_started_years === undefined
                ? null
                : Number(row.age_started_years),
            intensity: row.intensity || null,
            liked:
              row.liked === null || row.liked === undefined ? null : Boolean(row.liked),
            had_flair:
              row.had_flair === null || row.had_flair === undefined
                ? null
                : Boolean(row.had_flair),
            achieved_skill:
              row.achieved_skill === null || row.achieved_skill === undefined
                ? null
                : Boolean(row.achieved_skill),
          }));

          setPastSports((prev) => (prev.length ? prev : entries));
        }
      } catch (error) {
        console.warn("[Intake] Unable to prefill from saved profile/measurements/past sports", error);
      }
    })();
  }, [sportySnapshot.user?.id]);

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
      if (!sportySnapshot.hasConsent && consentGiven) {
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

      let consentAccepted = snapshot.hasConsent || consentGiven || consentIntentRef.current;
      const sportyApp =
        typeof window !== "undefined" ? (window as any).SportyApp : null;

      // For logged-in users, require consent before persisting account history.
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
                    mode={mode}
                    fields={activeMeasurementFields}
                    values={measurements}
                    measurementSystem={measurementSystem}
                    onMeasurementSystemChange={handleMeasurementSystemChange}
                    onChange={(patch) =>
                      setMeasurements((prev) => ({ ...prev, ...patch }))
                    }
                  />
                );
              case "traits":
                return (
                  <TraitsStep
                    value={traits}
                    onChange={(patch) =>
                      setTraits((prev) => ({ ...prev, ...patch }))
                    }
                  />
                );
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
