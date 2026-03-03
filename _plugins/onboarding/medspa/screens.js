// MedSpa Onboarding — Screens (v1)
// Loaded by /medspa/shop.html and /medspa/provider.html
// Engine expected globals:
// - window.RR_ONBOARDING_FLOWS
// - window.RR_ONBOARDING_SCREENS
// --- Vertical configuration (MedSpa) ---
window.RR_ONBOARDING_VERTICAL = {
  key: "medspa_v1",
  roster_roles: [
    { label: "Provider", value: "provider" },
    { label: "Injector", value: "injector" },
    { label: "Esthetician", value: "esthetician" },
    { label: "Nurse", value: "nurse" },
    { label: "NP / PA", value: "np_pa" },
    { label: "Medical Director", value: "medical_director" },
    { label: "Front Desk", value: "front_desk" },
    { label: "Manager", value: "manager" },
    { label: "Owner", value: "owner" },
    { label: "Admin", value: "admin" },
  ],
};
(() => {
  const get = (state, key) => (state ? state[key] : undefined);

  const FLOWS = {
    shop: [
      {
        id: "SHOP_S0_WELCOME",
        type: "single",
        title: "",
        quote: "You can change anything later just by texting Isla.",
        question: "This takes a few minutes.",
        key: "shop.welcome_ack",
        options: [{ label: "Continue", value: "ok", primary: true }],
        next: "SHOP_S1_IDENTITY",
      },    
      {
        id: "SHOP_S1_IDENTITY",
        type: "form",
        title: "MedSpa",
        quote: "Quiet basics. No back-and-forth later.",
        question: "What should Isla call your medspa?",
        fields: [
          { id: "shop.name", label: "MedSpa name", kind: "text", required: true, max_length: 60 },
          { id: "shop.timezone", label: "Timezone", kind: "timezone", required: true },
        ],
        next: "SHOP_S2_BRANDING",
      },
      {
        id: "SHOP_S2_BRANDING",
        type: "upload",
        title: "Branding",
        quote: "This is how clients recognize your business.",
        question: "Upload your logo.",
        upload: { field_id: "shop.logo.asset_id", required: true },
        next: "SHOP_S3_HOURS",
      },
      {
        id: "SHOP_S3_HOURS",
        type: "hours",
        title: "Hours",
        quote: "Set once. Isla follows it.",
        question: "Set your business hours.",
        next: "SHOP_S3B_ROSTER_BUILD",
      },
      {
        id: "SHOP_S3B_ROSTER_BUILD",
        type: "roster_build",
        title: "Team",
        quote: "So Isla always knows who’s who.",
        question: "Add your team.",
        next: "SHOP_S4_CONTACT_LINE",
      },
      
      {
        id: "SHOP_S4_CONTACT_LINE",
        type: "phone",
        title: "Front desk line",
        quote: "This is the number clients will reach.",
        question: "What number should clients call?",
        key: "shop.isla_line.phone",
        next: "SHOP_S5_OPS_HELP_PICK",
      },
      {
        id: "SHOP_S5_OPS_HELP_PICK",
        type: "roster",
        title: "Second set of eyes",
        quote: "Quiet backup. Nothing dramatic.",
        question:
          "If Isla needs a quick decision and can’t reach the right person,\nwho can she quietly loop in to help keep things moving?",
        key: "shop.ops_help.primary_person_id",
        source: "roster",
        next: "SHOP_S7_AFTER_HOURS",
      },
      {
        id: "SHOP_S7_AFTER_HOURS",
        type: "single",
        title: "After hours",
        quote: "Clients are acknowledged — without creating urgency.",
        question: "After hours, should Isla…",
        key: "shop.after_hours.policy",
        options: [
          { label: "Handle it, but hold until business hours", value: "hold_to_hours" },
          { label: "Reach out anytime", value: "anytime" },
          { label: "Emergency only", value: "emergency_only" },
        ],
        next: "SHOP_S6_OWNER_PROVIDER_CHECK_LAST",
      },
      {
        id: "SHOP_S6_OWNER_PROVIDER_CHECK_LAST",
        type: "single",
        title: "Provider",
        quote: "This decides what I configure next.",
        question: "Do you personally provide services (inject, laser, esthetics)?",
        key: "owner.is_provider",
        options: [
          { label: "Yes", value: true, primary: true },
          { label: "No", value: false },
        ],
        next: (state) => (get(state, "owner.is_provider") ? "PROVIDER_P0_WELCOME" : "SHOP_END"),
      },
      {
        id: "SHOP_END",
        type: "end",
        title: "",
        quote: "",
        question: "MedSpa preferences saved.\nThank you.",
      },
    ],

    artist: [
      {
        id: "PROVIDER_P0_WELCOME",
        type: "single",
        title: "",
        quote: "Built to protect your time and keep your schedule clean — without extra work.",
        question: "Provider preferences.\nA few quick choices.",
        key: "provider.welcome_ack",
        options: [{ label: "Continue", value: "ok", primary: true }],
        next: "PROVIDER_P1_IN_SESSION",
      },
      {
        id: "PROVIDER_P1_IN_SESSION",
        type: "single",
        title: "During treatments",
        quote: "I’ll work around your flow — not interrupt it.",
        question: "If someone reaches out while you’re with a client…",
        key: "in_session.policy",
        options: [
          { label: "Try me first (a quick approve is fine)", value: "try_first" },
          { label: "Hold everything until I’m free", value: "hold" },
          { label: "Text me once only if it’s urgent", value: "text_once_urgent" },
        ],
        next: "PROVIDER_P2_AFTER_HOURS",
      },
      {
        id: "PROVIDER_P2_AFTER_HOURS",
        type: "single",
        title: "After hours",
        quote: "You decide when I can reach you — I’ll handle the rest.",
        question: "After hours, should Isla…",
        key: "after_hours.policy",
        options: [
          { label: "Handle it, but hold until business hours", value: "hold_to_hours" },
          { label: "Reach out to me anytime", value: "anytime" },
          { label: "Emergency only", value: "emergency_only" },
        ],
        next: "PROVIDER_P3_SERVICES",
      },
      {
        id: "PROVIDER_P3_SERVICES",
        type: "multi",
        title: "Services",
        quote: "So Isla routes requests correctly the first time.",
        question: "Which services do you personally offer?",
        key: "services.offered",
        options: [
          { label: "Botox / Dysport", value: "tox" },
          { label: "Filler", value: "filler" },
          { label: "Laser hair removal", value: "laser_hair" },
          { label: "IPL / photofacial", value: "ipl" },
          { label: "Microneedling", value: "microneedling" },
          { label: "Chemical peels", value: "peels" },
          { label: "Hydrafacial", value: "hydrafacial" },
          { label: "Facials (general)", value: "facials" },
          { label: "Body contouring", value: "body" },
        ],
        next: "PROVIDER_P4_DO_NOT",
      },
      {
        id: "PROVIDER_P4_DO_NOT",
        type: "multi",
        title: "Boundaries",
        quote: "This prevents awkward situations before they start.",
        question: "Any services or requests you do NOT take?",
        key: "services.do_not",
        options: [
          { label: "Same-day filler appointments", value: "no_same_day_filler" },
          { label: "Under 18 (any service)", value: "no_minors" },
          { label: "High-risk medical cases (route for approval)", value: "high_risk_route" },
          { label: "Anything not listed (always ask me)", value: "not_listed_ask" },
        ],
        next: "PROVIDER_P5_ESCALATION",
      },
      {
        id: "PROVIDER_P5_ESCALATION",
        type: "roster",
        title: "Second set of eyes",
        quote:
          "If Isla can’t reach you after a couple attempts,\nwho should she quietly loop in to help keep things moving?",
        question: "Who can help keep things moving?",
        key: "escalation.target_person_id",
        source: "roster",
        next: "PROVIDER_P6_FOLLOWUPS",
      },
      {
        id: "PROVIDER_P6_FOLLOWUPS",
        type: "multi",
        title: "Follow-ups",
        quote: "A calm check-in reduces anxiety and surfaces issues early — without getting weird.",
        question: "When should Isla check in after treatments?",
        key: "followup.checkpoints",
        options: [
          { label: "Same day (evening)", value: "same_day_pm" },
          { label: "24 hours (recommended)", value: "24h" },
          { label: "3 days", value: "3d" },
          { label: "7 days", value: "7d" },
          { label: "Never", value: "never" },
        ],
        next: "PROVIDER_P7_REVIEWS",
      },
      {
        id: "PROVIDER_P7_REVIEWS",
        type: "single",
        title: "Reviews",
        quote: "Only after Isla knows it was a good experience.",
        question: "Should Isla request reviews for you?",
        key: "reviews.enabled",
        options: [
          { label: "Yes — only after good experiences", value: true, primary: true },
          { label: "No", value: false },
        ],
        next: "PROVIDER_P8_REBOOK",
      },
      {
        id: "PROVIDER_P8_REBOOK",
        type: "multi",
        title: "Rebooking",
        quote: "Isla can help keep your calendar full without being pushy.",
        question: "When should Isla invite clients back?",
        key: "rebooking.timing",
        exclusive: ["client_initiates", "never"],
        options: [
          { label: "2 weeks", value: 0.5 },
          { label: "1 month", value: 1 },
          { label: "3 months (recommended)", value: 3 },
          { label: "6 months", value: 6 },
          { label: "Only if the client initiates", value: "client_initiates" },
          { label: "Never", value: "never" },
        ],
        next: "PROVIDER_END",
      },
      {
        id: "PROVIDER_END",
        type: "end",
        title: "",
        quote: "",
        question: "Onboarding complete.\nYour preferences have been sent.",
      },
    ],
  };

  const SCREENS = [
    ...(FLOWS.shop || []),
    ...(FLOWS.artist || []),
  ];

  window.RR_ONBOARDING_FLOWS = FLOWS;
  window.RR_ONBOARDING_SCREENS = SCREENS;
})();