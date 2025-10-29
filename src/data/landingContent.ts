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
      "“Premium adult analysis gave me the component breakdown I needed. Seeing shoulder width vs. optimal ranges explained why certain drills click.”",
    name: "Morgan, 32 · Premium member",
  },
  {
    quote:
      "“The guardian flow let us forecast our daughter, apply a credit, and compare sport matches aligned to her projected build—game changer.”",
    name: "Elena, 39 · Guardian",
  },
] as const;

export const offerings = [
  {
    ribbon: "Included",
    title: "Free Adult Match",
    price: "$0",
    summary:
      "Unlimited biomechanics-backed matches any time you want another perspective.",
    features: [
      "Run the full measurement set with instant sport suggestions.",
      "Review component summaries and athlete analogues for each sport.",
      "Stay anonymous until you opt in to save results.",
    ],
    cta: {
      href: "/intake",
      label: "Start free match",
      theme: "primary",
    },
  },
  {
    ribbon: "$5 credit",
    title: "Premium Adult Analysis",
    price: "$5",
    summary: "Apply a credit to unlock qualitative inputs and deeper insights.",
    features: [
      "Blend goals, preferences, injuries, past sports, and performance factors.",
      "See component impact bars, alignment scores, and recommended focus areas.",
      "Store runs in your dashboard with share-ready summaries.",
    ],
    cta: {
      href: "/intake?premium=true",
      label: "Use an adult credit",
      theme: "secondary",
    },
    secondaryCta: {
      href: "/pricing",
      label: "View pricing",
      theme: "outline",
    },
  },
  {
    ribbon: "$5 credit",
    title: "Child Analysis Package",
    price: "$5",
    summary: "Forecast and refine a child’s sport path with guardian consent.",
    features: [
      "Project future body metrics using child + parent measurements.",
      "Apply preferences, goals, injuries, and past sports to unlock matches.",
      "Store guardian-backed runs and track credits per child.",
    ],
    cta: {
      href: "/child-intake",
      label: "Start child analysis",
      theme: "secondary",
    },
    secondaryCta: {
      href: "/pricing#child",
      label: "How credits work",
      theme: "outline",
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
