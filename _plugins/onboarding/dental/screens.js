// IMPORTANT (Canon):
// screens.js must not set RR_DEFAULT_FLOW.
// The page (shop.html/provider.html) owns RR_DEFAULT_FLOW.
// screens.js must not set RR_ONBOARDING_VERTICAL_KEY either — the page owns it.

window.RR_ONBOARDING_VERTICAL = {
  roster_roles: [
    { label: "Dentist", value: "dentist" },
    { label: "Hygienist", value: "hygienist" },
    { label: "Office Manager", value: "manager" },
    { label: "Reception", value: "reception" }
  ]
};

const FLOWS = {
  shop: [
    {
      id: "DENTAL_SHOP_NAME",
      type: "form",
      title: "Practice Details",
      question: "What is the name of your dental practice?",
      fields: [
        { id: "shop.name", label: "Practice name", required: true }
      ],
      next: "DENTAL_PHONE"
    },
    {
      id: "DENTAL_PHONE",
      type: "phone",
      key: "shop.phone",
      title: "Main Line",
      question: "What is your primary office phone?",
      next: "DENTAL_HOURS"
    },
    {
      id: "DENTAL_HOURS",
      type: "hours",
      title: "Office Hours",
      question: "When is your practice open?",
      next: "DENTAL_ROSTER"
    },
    {
      id: "DENTAL_ROSTER",
      type: "roster_build",
      title: "Team Setup",
      question: "Add your dental team.",
      next: "DENTAL_DONE"
    },
    {
      id: "DENTAL_DONE",
      type: "end",
      title: "Complete",
      question: "Your dental onboarding is complete."
    }
  ],

  artist: [
  {
    id: "DENTAL_PROVIDER_START",
    type: "end",
    title: "Provider Onboarding",
    quote: "Dental provider onboarding is parked for now.",
    question: "Nothing else to configure here yet.\nYou can close this tab.",
  }
]
};

window.RR_ONBOARDING_FLOWS = FLOWS;
