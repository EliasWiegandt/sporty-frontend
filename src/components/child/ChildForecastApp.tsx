import type { FunctionalComponent } from "preact";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "preact/hooks";
import MeasurementField from "../intake/MeasurementField";
import InlineInfoTip from "../intake/InlineInfoTip";
import PastSportsStep from "../intake/steps/PastSportsStep";
import TraitsStep from "../intake/steps/TraitsStep";
import PremiumBlock, { type PremiumSectionKey } from "../intake/PremiumBlock";
import {
  createPremiumController,
  type PremiumController,
} from "../intake/premiumController";
import type { PastSportsEntry } from "../intake/IntakeApp";
import RadioCards from "../intake/controls/RadioCards";
import type { Sex } from "../../data/intakeSchema";
import { SEX_OPTIONS } from "../../data/sexOptions";
import { formatBoundaryValue, type MeasurementSystem } from "../../lib/units";
import {
  persistMeasurementSystemForUser,
  persistMeasurementSystemLocal,
  resolveMeasurementSystemOnClient,
} from "../../lib/measurementSystem";
import {
  fetchIntakeCatalog,
  type ChildForecastRaceOption,
  type MeasurementFieldConfig,
  type PastSportBooleanFieldConfig,
  type PastSportIntensityOption,
  type TraitCatalogQuestion,
} from "../../lib/intakeCatalog";

type SportySnapshot = {
  user: { id: string; email?: string | null } | null;
  consents?: Record<string, { granted?: boolean }>;
  session?: { access_token?: string } | null;
  purgeStatus?: string | null;
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

const CHILD_NOTICE_VERSION = "child-privacy-notice-v1";

const STEP_KEYS = [
  "child",
  "measurements",
  "parents",
  "traits",
  "preferences",
  "goals",
  "injuries",
  "pastSports",
] as const;
type StepKey = (typeof STEP_KEYS)[number];
type StepDefinition = { key: StepKey; title: string };

const STEP_DEFINITIONS: StepDefinition[] = [
  { key: "child", title: "Child basics" },
  { key: "measurements", title: "Measurements" },
  { key: "parents", title: "Parents" },
  { key: "traits", title: "Traits" },
  { key: "preferences", title: "Preferences" },
  { key: "goals", title: "Goals" },
  { key: "injuries", title: "Injuries" },
  { key: "pastSports", title: "Past sports" },
];

const PREMIUM_SECTION_KEYS: PremiumSectionKey[] = [
  "preferences",
  "goals",
  "injuries",
];

const buildEmptyMeasurements = (
  fields: MeasurementFieldConfig[],
): MeasurementValues => {
  const output: MeasurementValues = {};
  fields.forEach((field) => {
    output[field.id] = null;
  });
  return output;
};

const normalizeSex = (value: string): Sex => {
  const v = (value || "").toLowerCase();
  if (v === "female" || v === "male" || v === "other") return v as Sex;
  return "prefer_not_to_say";
};

const formatChildTitle = (child: ChildRow | null) => {
  if (!child) return "Choose child";
  const name = child.name || "Child";
  return name;
};

const ChildForecastApp: FunctionalComponent<Props> = ({ adultAgeGroups }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [statusHtml, setStatusHtml] = useState<{
    html: string;
    tone: "info" | "error";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [snapshot, setSnapshot] = useState<SportySnapshot>({ user: null });

  const [availableChildren, setAvailableChildren] = useState<ChildRow[]>([]);
  const [childId, setChildId] = useState<string>("");
  const [childRecord, setChildRecord] = useState<ChildRow | null>(null);

  const [birthdate, setBirthdate] = useState<string>("");
  const [sex, setSex] = useState<Sex>("female");
  const [race, setRace] = useState<string>("");
  const [adultAgeGroup, setAdultAgeGroup] = useState<string>(
    adultAgeGroups[2] || adultAgeGroups[0] || "25-35 years",
  );
  const [childNoticeAccepted, setChildNoticeAccepted] = useState(false);
  const [measurementFields, setMeasurementFields] = useState<MeasurementFieldConfig[]>([]);

  const [childMeasurements, setChildMeasurements] = useState<MeasurementValues>(
    () => buildEmptyMeasurements([]),
  );

  const [includeMother, setIncludeMother] = useState(false);
  const [includeFather, setIncludeFather] = useState(false);
  const [motherMeasurements, setMotherMeasurements] =
    useState<MeasurementValues>(() => buildEmptyMeasurements([]));
  const [fatherMeasurements, setFatherMeasurements] =
    useState<MeasurementValues>(() => buildEmptyMeasurements([]));
  const [measurementSystem, setMeasurementSystem] =
    useState<MeasurementSystem>("metric");

  const [pastSports, setPastSports] = useState<PastSportsEntry[]>([]);
  const [traits, setTraits] = useState<Record<string, string>>({});
  const [traitQuestions, setTraitQuestions] = useState<TraitCatalogQuestion[]>([]);
  const [pastSportIntensityOptions, setPastSportIntensityOptions] = useState<PastSportIntensityOption[]>([]);
  const [pastSportBooleanFields, setPastSportBooleanFields] = useState<
    Record<string, PastSportBooleanFieldConfig>
  >({});
  const [raceOptions, setRaceOptions] = useState<ChildForecastRaceOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(
    null,
  );

  const currentStep: StepKey =
    STEP_KEYS[Math.max(0, Math.min(STEP_KEYS.length - 1, stepIndex))];
  const isFirstStep = stepIndex === 0;
  const isFinalStep = stepIndex === STEP_KEYS.length - 1;
  const activePremiumSection = PREMIUM_SECTION_KEYS.includes(
    currentStep as PremiumSectionKey,
  )
    ? (currentStep as PremiumSectionKey)
    : null;
  const showPremiumBlock = activePremiumSection !== null;

  const sportyAppRef = useRef<any>(null);
  const premiumControllerRef = useRef<PremiumController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCatalogLoading(true);
        setCatalogError(null);
        const catalog = await fetchIntakeCatalog();
        if (cancelled) return;
        setMeasurementFields(catalog.measurements.child || []);
        setTraitQuestions(catalog.traits.intake.questions || []);
        setPastSportIntensityOptions(catalog.past_sports.intensity_options || []);
        setPastSportBooleanFields(catalog.past_sports.boolean_options.fields || {});
        setRaceOptions(catalog.child_forecast.race_options || []);
      } catch (error) {
        if (cancelled) return;
        console.error("[ChildIntake] Failed to load intake catalog", error);
        setCatalogError("We could not load intake options right now. Refresh and try again.");
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setChildMeasurements((prev) => ({ ...buildEmptyMeasurements(measurementFields), ...prev }));
    setMotherMeasurements((prev) => ({ ...buildEmptyMeasurements(measurementFields), ...prev }));
    setFatherMeasurements((prev) => ({ ...buildEmptyMeasurements(measurementFields), ...prev }));
  }, [measurementFields]);

  useEffect(() => {
    if (race || !raceOptions.length) return;
    const defaultRace = raceOptions.find((option) => option.is_overall)?.id || raceOptions[0]?.id || "";
    if (defaultRace) setRace(defaultRace);
  }, [race, raceOptions]);

  const setStatus = useCallback(
    (html: string, tone: "info" | "error" = "info") => {
      setStatusHtml(html ? { html, tone } : null);
    },
    [],
  );

  const focusField = useCallback((fieldId: string | null) => {
    if (!fieldId) return;
    const el = document.getElementById(fieldId) as HTMLInputElement | null;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleMeasurementSystemChange = useCallback(
    async (nextSystem: MeasurementSystem) => {
      setMeasurementSystem(nextSystem);
      persistMeasurementSystemLocal(nextSystem);

      const sportyApp = sportyAppRef.current;
      const client = sportyApp?.getClient?.();
      const user = sportyApp?.getUser?.();
      if (!client || !user?.id) return;

      try {
        await persistMeasurementSystemForUser(client, user.id, nextSystem);
      } catch (error) {
        console.warn(
          "[ChildIntake] Unable to persist measurement system",
          error,
        );
      }
    },
    [],
  );

  const fetchChildOptions = useCallback(async (client: any, userId: string) => {
    const { data: guards, error: gErr } = await client
      .from("guardianships")
      .select("child_id")
      .eq("guardian_user_id", userId)
      .eq("status", "active");
    if (gErr) throw gErr;
    const ids = Array.from(
      new Set((guards || []).map((row: any) => row.child_id).filter(Boolean)),
    );
    if (!ids.length) return [];
    const { data: kids, error: cErr } = await client
      .from("children")
      .select("id,name,birthdate,sex")
      .in("id", ids)
      .order("created_at", { ascending: false });
    if (cErr) throw cErr;
    return (kids || []) as ChildRow[];
  }, []);

  const loadChild = useCallback(async (client: any, id: string) => {
    const { data, error } = await client
      .from("children")
      .select("id,name,birthdate,sex")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data || null) as ChildRow | null;
  }, []);

  const loadLatestChildMeasurement = useCallback(
    async (client: any, id: string) => {
      const { data, error } = await client
        .from("measurements")
        .select("*")
        .eq("subject_type", "child")
        .eq("subject_child_id", id)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    [],
  );

  const loadLatestAdultMeasurement = useCallback(
    async (client: any, userId: string) => {
      const { data, error } = await client
        .from("measurements")
        .select("*")
        .eq("subject_type", "adult")
        .eq("subject_user_id", userId)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    [],
  );

  const loadMyBiologicalRole = useCallback(
    async (client: any, userId: string, id: string) => {
      const { data, error } = await client
        .from("guardianships")
        .select("biological_role")
        .eq("guardian_user_id", userId)
        .eq("child_id", id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return (data && data.biological_role) || null;
    },
    [],
  );

  const loadSharedParentMeasurements = useCallback(
    async (client: any, id: string) => {
      try {
        const { data, error } = await client.rpc(
          "get_child_parent_measurements",
          { p_child_id: id },
        );
        if (error) throw error;
        return data || null;
      } catch (err) {
        console.warn(
          "[ChildIntake] Shared parent measurements unavailable",
          err,
        );
        return null;
      }
    },
    [],
  );

  const applyMeasurementRow = useCallback(
    (
      row: any,
      setter: (updater: (prev: MeasurementValues) => MeasurementValues) => void,
    ) => {
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
    },
    [],
  );

  // Wire SportyApp snapshot.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const init = () => {
      const sportyApp = (window as any).SportyApp;
      if (!sportyApp || !sportyApp.ready) return false;
      sportyAppRef.current = sportyApp;
      sportyApp.ready.then(() => {
        if (typeof sportyApp.onAuthChange === "function") {
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
    if (typeof document === "undefined") return undefined;
    const premiumController = createPremiumController({
      block: document.querySelector("[data-premium-block]"),
      locked: document.querySelector("[data-premium-locked]"),
      lockedMessage: document.querySelector("[data-premium-locked-message]"),
      summary: document.querySelector("[data-premium-summary]"),
      getClient: () => (window as any).SportyApp?.getClient?.() ?? null,
      creditType: "child",
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
        consents: snapshot?.consents || {},
      })
      .catch((err) =>
        console.error("[ChildIntake] Failed to update premium controller", err),
      );
  }, [snapshot.user?.id, snapshot?.consents?.child_data_processing?.granted]);

  useEffect(() => {
    const resolved = resolveMeasurementSystemOnClient();
    setMeasurementSystem(resolved);
    if (import.meta.env.DEV) {
      console.debug("[ChildIntake] Measurement system resolved on mount", {
        resolved,
      });
    }
  }, []);

  // On login: load children list and preselect by query param (or auto-select single).
  useEffect(() => {
    const user = snapshot.user;
    const sportyApp = sportyAppRef.current;
    const client = sportyApp?.getClient?.();
    if (!user || !client) return;

    (async () => {
      try {
        const { data: profile } = await client
          .from("profiles")
          .select("preferred_measurement_system")
          .eq("id", user.id)
          .maybeSingle();
        const preferredSystem = resolveMeasurementSystemOnClient(
          profile?.preferred_measurement_system,
        );
        setMeasurementSystem(preferredSystem);
        persistMeasurementSystemLocal(preferredSystem);

        const kids = await fetchChildOptions(client, user.id);
        setAvailableChildren(kids);
        const urlId = new URL(window.location.href).searchParams.get(
          "child_id",
        );
        if (urlId && kids.some((k) => k.id === urlId)) {
          setChildId(urlId);
          return;
        }
        if (!childId && kids.length === 1) {
          setChildId(kids[0].id);
        }
      } catch (err) {
        console.error("[ChildIntake] Failed to load children", err);
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
      setStatus("");
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
        if (role === "mother") {
          setIncludeMother(true);
          const mine = await loadLatestAdultMeasurement(client, user.id);
          applyMeasurementRow(mine, setMotherMeasurements);
        } else if (role === "father") {
          setIncludeFather(true);
          const mine = await loadLatestAdultMeasurement(client, user.id);
          applyMeasurementRow(mine, setFatherMeasurements);
        }
      } catch (err) {
        console.error("[ChildIntake] Failed to prefill child intake", err);
      }
    })();
  }, [
    applyMeasurementRow,
    childId,
    loadChild,
    loadLatestAdultMeasurement,
    loadLatestChildMeasurement,
    loadMyBiologicalRole,
    loadSharedParentMeasurements,
    setStatus,
    snapshot.user,
  ]);

  const validateAllMeasurements = useCallback(
    (values: MeasurementValues, fields = measurementFields) => {
      if (!fields.length) {
        return {
          ok: false as const,
          message: "Measurement catalog not loaded yet. Try again in a moment.",
          fieldId: null,
        };
      }
      for (const field of fields) {
        const raw = values[field.id];
        if (raw === null || raw === undefined) {
          return {
            ok: false as const,
            message: `Enter ${field.label.toLowerCase()} before continuing.`,
            fieldId: field.id,
          };
        }
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          return {
            ok: false as const,
            message: `${field.label} must be a number.`,
            fieldId: field.id,
          };
        }
        if (typeof field.min === "number" && num < field.min) {
          return {
            ok: false as const,
            message: `${field.label} must be at least ${formatBoundaryValue(
              field.id,
              field.min,
              measurementSystem,
            )}.`,
            fieldId: field.id,
          };
        }
        if (typeof field.max === "number" && num > field.max) {
          return {
            ok: false as const,
            message: `${field.label} must be at most ${formatBoundaryValue(
              field.id,
              field.max,
              measurementSystem,
            )}.`,
            fieldId: field.id,
          };
        }
      }
      return { ok: true as const };
    },
    [measurementSystem, measurementFields],
  );

  const submit = useCallback(async () => {
    const sportyApp = sportyAppRef.current;
    const user = sportyApp?.getUser?.() || null;

    if (!user || !user.id) {
      setStatus("Sign in as a guardian to run a child analysis.", "error");
      return;
    }

    if (!childId) {
      setStatus("Choose a child before continuing.", "error");
      return;
    }
    if (!childNoticeAccepted) {
      setStatus(
        "Please review and accept the child data notice before continuing.",
        "error",
      );
      return;
    }
    if (!birthdate || !sex) {
      setStatus("Birthdate and sex are required.", "error");
      return;
    }

    const childValidation = validateAllMeasurements(
      childMeasurements,
      measurementFields,
    );
    if (!childValidation.ok) {
      setStatus(childValidation.message, "error");
      focusField(`child-${(childValidation as any).fieldId || ""}`);
      return;
    }

    if (includeMother) {
      const momValidation = validateAllMeasurements(
        motherMeasurements,
        measurementFields,
      );
      if (!momValidation.ok) {
        setStatus(`Mother: ${momValidation.message}`, "error");
        focusField(`mother-${(momValidation as any).fieldId || ""}`);
        return;
      }
    }
    if (includeFather) {
      const dadValidation = validateAllMeasurements(
        fatherMeasurements,
        measurementFields,
      );
      if (!dadValidation.ok) {
        setStatus(`Father: ${dadValidation.message}`, "error");
        focusField(`father-${(dadValidation as any).fieldId || ""}`);
        return;
      }
    }

    const premiumSelection = premiumControllerRef.current?.collect() ?? {
      applyCredit: false,
      data: null,
      errors: [] as string[],
    };
    if (premiumSelection.errors.length) {
      setStatus(premiumSelection.errors.join(" "), "error");
      return;
    }
    if (!premiumSelection.applyCredit) {
      setStatus("Add a child analysis credit to continue.", "error");
      return;
    }
    if (
      sportyAppRef.current &&
      typeof sportyAppRef.current.ensureConsent === "function" &&
      !Boolean(snapshot?.consents?.child_data_processing?.granted)
    ) {
      const accepted = await sportyAppRef.current.ensureConsent(
        "child_data_processing",
      );
      if (!accepted) {
        setStatus(
          "Child analysis needs explicit child-data consent before processing.",
          "error",
        );
        return;
      }
    }

    const payload: any = {
      child_id: childId,
      guardian_user_id: user.id,
      birthdate,
      sex,
      race,
      adult_age_group: adultAgeGroup,
      measurements: { ...childMeasurements },
      traits: { ...traits },
      child_notice_acknowledged: childNoticeAccepted,
      child_notice_version: CHILD_NOTICE_VERSION,
    };
    if (includeMother) {
      payload.mother = {
        display_name: "Mother",
        measurements: { ...motherMeasurements },
      };
    }
    if (includeFather) {
      payload.father = {
        display_name: "Father",
        measurements: { ...fatherMeasurements },
      };
    }
    const cleanedPastSports = pastSports.map(
      ({ id, sport_label, ...rest }) => rest,
    );
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
    setStatus("Applying your credit and computing the forecast…", "info");
    try {
      const response = await fetch("/api/forecast-child", {
        method: "POST",
        headers: (() => {
          const token =
            sportyAppRef.current?.getSession?.()?.access_token ||
            snapshot.session?.access_token;
          const h: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (token) h.Authorization = `Bearer ${token}`;
          return h;
        })(),
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      if (!response.ok) {
        let detail = "Unable to generate forecast right now.";
        try {
          const json = JSON.parse(text);
          detail = json.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      try {
        const parsed = JSON.parse(text);
        const credit = parsed?.premium_analysis?.credit?.totals;
        const runId = parsed?.run_id;
        if (credit) {
          sessionStorage.setItem(
            "sporty:lastCreditSnapshot",
            JSON.stringify(credit),
          );
        }
        if (!runId) {
          throw new Error("Missing child run id in forecast response.");
        }
        sessionStorage.setItem("sporty:childResultsTab", "matches");
        window.location.assign(`/child-results?id=${encodeURIComponent(String(runId))}&tab=matches`);
        return;
      } catch (_) {}
      throw new Error("Child forecast completed, but no run id was returned.");
    } catch (err: any) {
      console.error("[ChildIntake] Forecast failed", err);
      setStatus(err?.message || "Unexpected error, please try again.", "error");
      setSubmitting(false);
    }
  }, [
    adultAgeGroup,
    birthdate,
    childNoticeAccepted,
    measurementFields,
    childId,
    childMeasurements,
    race,
    fatherMeasurements,
    includeFather,
    includeMother,
    motherMeasurements,
    pastSports,
    traits,
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
      idPrefix: string,
    ) => {
      const groups = [
        {
          key: "core",
          title: "Core linear metrics",
          description:
            "Height, weight, span, and inseam anchor the body’s overall scale.",
        },
        {
          key: "torso",
          title: "Width & torso length",
          description:
            "Shoulders, pelvis, and torso length describe the body’s width profile.",
        },
        {
          key: "extremities",
          title: "Extremities & girth",
          description:
            "Hands, feet, wrists, and ankles capture the fine extremity proportions.",
        },
      ] as const;

      return (
        <div className="space-y-6">
          {groups.map((group) => {
            const groupFields = fields.filter(
              (f: any) => f.group === group.key,
            );
            if (!groupFields.length) return null;
            return (
              <section key={group.key} className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="type-lead text-slate-700">{group.title}</h3>
                    <InlineInfoTip
                      id={`${idPrefix}-${group.key}-tip`}
                      label={group.title}
                      steps={[group.description]}
                    />
                  </div>
                </div>
                <fieldset className="grid gap-6 md:grid-cols-2">
                  {groupFields.map((field: any) => (
                    <MeasurementField
                      key={`${idPrefix}-${field.id}`}
                      {...field}
                      id={`${idPrefix}-${field.id}`}
                      canonicalId={field.id}
                      measurementSystem={measurementSystem}
                      showInstructionTooltip
                      value={values[field.id] ?? ""}
                      onChange={(val) =>
                        onChange({ ...values, [field.id]: val })
                      }
                    />
                  ))}
                </fieldset>
              </section>
            );
          })}
        </div>
      );
    },
    [measurementSystem],
  );

  const headerTitle = STEP_DEFINITIONS[stepIndex]?.title || "";

  const validateCurrentStepAndAdvance = useCallback(() => {
    if (currentStep === "child") {
      if (!childId) {
        setStatus("Choose a child before continuing.", "error");
        return;
      }
      if (!childNoticeAccepted) {
        setStatus(
          "Please review and accept the child data notice before continuing.",
          "error",
        );
        return;
      }
      if (!birthdate) {
        setStatus("Birthdate is required.", "error");
        return;
      }
      if (!sex) {
        setStatus("Sex is required.", "error");
        return;
      }
    } else if (currentStep === "measurements") {
      const res = validateAllMeasurements(childMeasurements, measurementFields);
      if (!res.ok) {
        setStatus(res.message, "error");
        focusField(`child-${(res as any).fieldId || ""}`);
        return;
      }
    } else if (currentStep === "parents") {
      if (includeMother) {
        const res = validateAllMeasurements(
          motherMeasurements,
          measurementFields,
        );
        if (!res.ok) {
          setStatus(`Mother: ${res.message}`, "error");
          focusField(`mother-${(res as any).fieldId || ""}`);
          return;
        }
      }
      if (includeFather) {
        const res = validateAllMeasurements(
          fatherMeasurements,
          measurementFields,
        );
        if (!res.ok) {
          setStatus(`Father: ${res.message}`, "error");
          focusField(`father-${(res as any).fieldId || ""}`);
          return;
        }
      }
    }

    setStatus("");
    const nextIndex = Math.min(STEP_KEYS.length - 1, stepIndex + 1);
    setStepIndex(nextIndex);
  }, [
    birthdate,
    measurementFields,
    childId,
    childMeasurements,
    childNoticeAccepted,
    currentStep,
    focusField,
    sex,
    setStatus,
    stepIndex,
    validateAllMeasurements,
  ]);

  return (
    <div className="space-y-8" data-child-intake>
      <div className="space-y-2">
        <p className="type-lead text-teal-600">Child analysis</p>
        <h1 className="type-display text-slate-900">
          Forecast a child’s future build, then run the full analysis.
        </h1>
        <p className="text-slate-600">
          Use the child’s measurements (and optionally parent measurements) to
          project an adult body profile. Then continue to premium signals and
          sport matching.
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
                Math.max(
                  0,
                  Math.round(((stepIndex + 1) / STEP_KEYS.length) * 100),
                ),
              )}%`,
            }}
          ></div>
        </div>
      </div>

      <div className="space-y-6" data-stepper-content>
        <div hidden={currentStep !== "child"}>
          <div className="card-shell space-y-6">
            <header className="space-y-2">
              <h2 className="type-title text-slate-900">
                Who are we forecasting?
              </h2>
              <p className="text-slate-600">
                Pick a registered child (or open this page from the dashboard).
                We’ll prefill from the latest saved measurements when available.
              </p>
              <div>
                <a
                  href="/dashboard"
                  className="btn-pill btn-pill-secondary btn-sm"
                >
                  Go to dashboard and register a new child
                </a>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">
                  Child
                </div>
                <select
                  className="input-field input-select-pill"
                  value={childId}
                  onChange={(e) =>
                    setChildId((e.target as HTMLSelectElement).value)
                  }
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
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Selected
                </div>
                <div className="text-sm font-medium text-slate-900 mt-1">
                  {formatChildTitle(childRecord)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {childRecord?.birthdate
                    ? `Born ${childRecord.birthdate}`
                    : "—"}
                </div>
              </div>
            </div>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Direct guardian notice (required)
              </h3>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                <li>
                  This flow is only for minors under 18, managed by a guardian
                  account.
                </li>
                <li>
                  Child analysis requires a paid child credit from a guardian
                  card transaction.
                </li>
                <li>
                  Child data and results are retained for 7 days, then deleted;
                  export PDF from the results page if you need a copy.
                </li>
                <li>
                  Child data is not used for model training and not monetized.
                </li>
                <li>
                  Guardians can revoke consent and/or delete their child's data
                  at any time from the dashboard.
                </li>
              </ul>
              <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-white px-3 py-3">
                <input
                  type="checkbox"
                  checked={childNoticeAccepted}
                  onChange={(e) =>
                    setChildNoticeAccepted(
                      Boolean((e.target as HTMLInputElement).checked),
                    )
                  }
                />
                <span className="text-sm text-slate-800">
                  I confirm I am the guardian and acknowledge this child data
                  notice.
                </span>
              </label>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">
                  Birthdate
                </div>
                <input
                  className="input-field"
                  type="date"
                  value={birthdate}
                  onChange={(e) =>
                    setBirthdate((e.target as HTMLInputElement).value)
                  }
                  required
                />
              </label>
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">Sex</div>
                <RadioCards
                  name="child-sex"
                  value={sex}
                  options={SEX_OPTIONS}
                  onChange={(val) => setSex(val as Sex)}
                  columns="grid-cols-1"
                  variant="row"
                />
              </div>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">
                  Race (optional)
                </div>
                <select
                  className="input-field input-select-pill"
                  value={race}
                  onChange={(e) =>
                    setRace((e.target as HTMLSelectElement).value)
                  }
                >
                  {raceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-800">
                  Target adult cohort
                </div>
                <select
                  className="input-field input-select-pill"
                  value={adultAgeGroup}
                  onChange={(e) =>
                    setAdultAgeGroup((e.target as HTMLSelectElement).value)
                  }
                >
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

        <div hidden={currentStep !== "measurements"}>
          <div className="card-shell space-y-6">
            <header className="space-y-2">
              <h2 className="type-title text-slate-900">
                Child's measurements
              </h2>
              <p className="text-slate-600">
                Every field is required. These measurements anchor the forecast
                and downstream sport analysis.
              </p>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-full transition ${
                    measurementSystem === "metric"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                  onClick={() => handleMeasurementSystemChange("metric")}
                  aria-pressed={measurementSystem === "metric"}
                >
                  Metric (cm/kg)
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 text-sm rounded-full transition ${
                    measurementSystem === "imperial"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                  onClick={() => handleMeasurementSystemChange("imperial")}
                  aria-pressed={measurementSystem === "imperial"}
                >
                  Imperial (ft/in, lb)
                </button>
              </div>
            </header>
            {renderMeasurementGroups(
              measurementFields as any[],
              childMeasurements,
              setChildMeasurements,
              "child",
            )}
          </div>
        </div>

        <div hidden={currentStep !== "parents"}>
          <div className="space-y-6">
            <div className="card-shell space-y-4">
              <header className="space-y-2">
                <h2 className="type-title text-slate-900">
                  Parent measurements
                </h2>
                <p className="text-slate-600">
                  Parents can share their latest measurements with all
                  guardians. If you enable a parent section here, all fields
                  become required.
                </p>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-full transition ${
                      measurementSystem === "metric"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                    onClick={() => handleMeasurementSystemChange("metric")}
                    aria-pressed={measurementSystem === "metric"}
                  >
                    Metric (cm/kg)
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-sm rounded-full transition ${
                      measurementSystem === "imperial"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500"
                    }`}
                    onClick={() => handleMeasurementSystemChange("imperial")}
                    aria-pressed={measurementSystem === "imperial"}
                  >
                    Imperial (ft/in, lb)
                  </button>
                </div>
              </header>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={includeMother}
                    onChange={(e) =>
                      setIncludeMother(
                        Boolean((e.target as HTMLInputElement).checked),
                      )
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      Include mother's measurements
                      <InlineInfoTip
                        id="child-mother-toggle-tip"
                        label="Include mother's measurements"
                        steps={[
                          "All mother fields become required when this toggle is enabled.",
                        ]}
                      />
                    </div>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={includeFather}
                    onChange={(e) =>
                      setIncludeFather(
                        Boolean((e.target as HTMLInputElement).checked),
                      )
                    }
                  />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      Include father's measurements
                      <InlineInfoTip
                        id="child-father-toggle-tip"
                        label="Include father's measurements"
                        steps={[
                          "All father fields become required when this toggle is enabled.",
                        ]}
                      />
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {includeMother && (
              <div className="card-shell space-y-6">
                <header className="space-y-2">
                  <h3 className="type-title text-slate-900">
                    Mother's measurements
                  </h3>
                  <p className="text-slate-600">
                    All fields required when this section is enabled.
                  </p>
                </header>
                {renderMeasurementGroups(
                  measurementFields as any[],
                  motherMeasurements,
                  setMotherMeasurements,
                  "mother",
                )}
              </div>
            )}

            {includeFather && (
              <div className="card-shell space-y-6">
                <header className="space-y-2">
                  <h3 className="type-title text-slate-900">
                    Father's measurements
                  </h3>
                  <p className="text-slate-600">
                    All fields required when this section is enabled.
                  </p>
                </header>
                {renderMeasurementGroups(
                  measurementFields as any[],
                  fatherMeasurements,
                  setFatherMeasurements,
                  "father",
                )}
              </div>
            )}
          </div>
        </div>

        <div hidden={currentStep !== "traits"}>
          <TraitsStep
            value={traits}
            questions={traitQuestions}
            loading={catalogLoading}
            error={catalogError}
            onChange={(patch) => setTraits((prev) => ({ ...prev, ...patch }))}
          />
        </div>

        <div hidden={!showPremiumBlock}>
          <PremiumBlock
            activeSection={activePremiumSection}
            visible={showPremiumBlock}
          />
        </div>

        <div hidden={currentStep !== "pastSports"}>
          <PastSportsStep
            entries={pastSports}
            intensityOptions={pastSportIntensityOptions}
            booleanFields={pastSportBooleanFields}
            onUpdate={setPastSports}
          />
        </div>
      </div>

      <div
        className="flex w-full items-center justify-between gap-3 py-4"
        data-stepper-actions
      >
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
              {submitting ? "Running analysis…" : "Run child analysis"}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div data-status aria-live="polite">
          {statusHtml ? (
            <div className={`status status--${statusHtml.tone}`}>
              {/* eslint-disable-next-line react/no-danger */}
              <div dangerouslySetInnerHTML={{ __html: statusHtml.html }} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ChildForecastApp;
