export const valuePillars = [
  {
    imageKey: "landing.pillars.ai_research",
    imageAlt:
      "Abstract watercolor collage showing athlete silhouettes connected by data nodes.",
    title: "AI-driven research",
    copy: "We use AI-agents to extensively research public information on anthropometrics, biomechanics, and sport science.",
  },
  {
    imageKey: "landing.pillars.proprietary_data",
    imageAlt:
      "Collage of everyday athletes logging workouts alongside stylized data charts.",
    title: "Proprietary data",
    copy: "We have unique first-party data on amateurs' bodies and experiences with sports.",
  },
  {
    imageKey: "landing.pillars.privacy",
    imageAlt:
      "Abstract rendering of bubbles of information with options to delete flowing into a database with a padlock right before the database.",
    title: "Privacy by design",
    copy: "Nothing happens without your consent. Run anonymous analyses, control consent and delete your data as you see fit.",
  },
] as const;

export const howSteps = [
  {
    title: "Measure & Enter",
    subtitle: "Enter your body measurements and past-sport history in minutes.",
    imageKey: "landing.how_it_works.measure",
    imageAlt: "Guardian measuring an athlete with tape and digital overlays.",
  },
  {
    title: "Get Your Matches",
    subtitle:
      "Instantly see sport matches tuned to your unique build and data.",
    imageKey: "landing.how_it_works.results",
    imageAlt: "Sport recommendation cards fanning out with fit scores.",
  },
  {
    title: "Discover & Upgrade",
    subtitle:
      "Review your free result, then upgrade for deeper insights or a forecast + analysis for a child.",
    imageKey: "landing.how_it_works.upgrade",
    imageAlt:
      "Guardian and athlete reviewing premium analysis insights together.",
  },
] as const;

export const testimonials = [
  {
    quote:
      "“I was an over-weight and pot-smoking guy. Sporty told me I had a great body for running. Turned out to be true!”",
    name: "Christian, 36",
  },
  {
    quote:
      "“I got Runner's Knee from my long distance running. Sporty suggest cycling, which both fit my body and ensured I didn't worsen the knee. And it worked!”",
    name: "Laura, 32",
  },
  {
    quote:
      "“Our daughter didn't enjoy PE at all. Sporty recommended trying harder with swimming, since her long body, but short legs fit that. She doing regionals now!”",
    name: "Jonas, 40",
  },
] as const;

export const offerings = [
  {
    ribbon: "Included",
    title: "Free Analysis of Adult",
    price: "$0",
    summary:
      "Unlimited biomechanics-backed matches any time you want another perspective.",
    features: [
      "Run analysis based on body composition and past sports.",
      "Review component summaries and explanations of matches.",
      "Sign up for free account to save runs to your dashboard.",
    ],
    cta: {
      href: "/intake",
      label: "Try free analysis",
      theme: "primary",
    },
  },
  {
    ribbon: "Purchase",
    title: "Premium Analysis of Adult",
    price: "$5",
    summary: "Gain deeper insights and tailored recommendations.",
    features: [
      "Add goals to see sports that fit your ambitions.",
      "Add preferences to filter irrelevent results.",
      "Add injuries you want to avoid aggravating or prevent developing.",
    ],
    cta: {
      href: "/intake?premium=true",
      label: "Buy now",
      theme: "secondary",
    },
  },
  {
    ribbon: "Purchase",
    title: "Premium Analysis of Child",
    price: "$5",
    summary: "Forecast a child's growth and match it's future body to sports.",
    features: [
      "Forecast your child's body metrics using child + parent measurements.",
      "Take child's preferences, goals, injuries, and past sports into account.",
      "Get full premium analysis of your child's sport matches.",
    ],
    cta: {
      href: "/child-intake",
      label: "Buy now",
      theme: "secondary",
    },
  },
] as const;

export const sampleHighlights = [
  {
    key: "landing.sample_results.tile_matches",
    alt: "Square illustration of three sport recommendation cards fanned across a desk.",
    title: "Sport matches with narrative context",
    copy: "Each card surfaces body fit, comparable athletes, and the qualitative cues we considered so you can explain the recommendation to a coach or parent.",
  },
  {
    key: "landing.sample_results.tile_metrics",
    alt: "Square illustration of a component impact chart comparing measurements to optimal ranges.",
    title: "Component impact bar + percentiles",
    copy: "See the measurements driving your fit, with percentile bands and suggested training levers to move closer to the optimal window.",
  },
  {
    key: "landing.sample_results.tile_next_steps",
    alt: "Square illustration of a clipboard checklist with training next steps.",
    title: "Actionable next steps",
    copy: "Premium runs include drills, local leagues, and follow-up prompts so you always know what to try next.",
  },
] as const;

export const faqItems = [
  {
    title: "Are free adult matches really unlimited?",
    content:
      "<p>Yes. You can run the biomechanics-based quick match as often as you like. Runs stay anonymous until you opt in to save them to your dashboard.</p>",
  },
  {
    title: "How do premium credits work?",
    content:
      "<p>Premium adult analyses and child packages each cost a single $5 credit. Purchase credits through Stripe Checkout from Pricing or the dashboard, then apply them during intake.</p>",
  },
  {
    title: "What makes the premium analysis different?",
    content:
      "<p>Credits unlock inputs for goals, preferences, injuries, past sports, and performance factors. The results add component impact bars, alignment summaries, and tailored recommendations.</p>",
  },
  {
    title: "How does the child analysis package work?",
    content:
      "<p>Guardians measure the child, optionally add parent measurements, then apply a child credit to blend preferences, goals, injuries, and past sports into sport matches.</p><p>Child analyses are only stored when guardians consent, and you can revoke or export data anytime.</p>",
  },
  {
    title: "Can I control what data you store?",
    content:
      "<p>Absolutely. Consent is required before we store measurements, preferences, injuries, or child data. You can revoke consent, delete runs, or export data under Account → Data & Privacy.</p>",
  },
] as const;

export const scienceSection = {
  title: "The science behind Sporty",
  copy: "Sporty’s recommendations draw on established research in sport science, physiology, and psychology. Explore how body–sport fit, adult enjoyment, and early mastery keep people motivated for life.",
  cta: {
    href: "/science",
    label: "Read the research summary",
    theme: "secondary",
  },
} as const;

export const scienceHighlights = [
  {
    icon: "mdi:arm-flex",
    title: "Body fit and sport demands",
    copy: "Measurable traits like limb lengths, segment ratios, and body composition influence leverage, energy cost, and how natural a sport feels.",
    cta: {
      href: "/science#body-fit-and-anthropometry-in-sport",
      label: "Review the evidence",
      theme: "secondary",
    },
  },
  {
    icon: "mdi:hand-heart",
    title: "Enjoyment keeps adults active",
    copy: "Enjoyment and competence are the strongest predictors of sticking with sport, boosting mental health, social wellbeing, and life satisfaction.",
    cta: {
      href: "/science#why-enjoying-a-sport-and-feeling-good-at-it-matters-for-adults",
      label: "Explore adult benefits",
      theme: "secondary",
    },
  },
  {
    icon: "mdi:infinity",
    title: "Early mastery fuels confidence",
    copy: "Early wins build self-efficacy and motivation, keeping young athletes engaged and confident over the long term.",
    cta: {
      href: "/science#early-mastery-confidence-and-motivation",
      label: "Understand youth momentum",
      theme: "secondary",
    },
  },
] as const;
