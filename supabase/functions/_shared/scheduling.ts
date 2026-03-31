export type GeneratedSession = {
  index: number;
  start_at: string;
  end_at: string;
};

export type GeneratedSchedule = {
  sessions: GeneratedSession[];
  prep_planned_at: string;
  completion_check_planned_at: string;
  aftercare_planned_at: null;
  contact_card_planned_at: null;
  cw1_planned_at: string | null;
  cw2_planned_at: string | null;
  cw3_planned_at: string | null;
  review_planned_at: string | null;
  portfolio_request_planned_at: string | null;
  execution_gates: {
    aftercare_requires_done: true;
    contact_card_requires_done: true;
    carewatch_requires_done: true;
    review_requires_positive_outcome: true;
    portfolio_requires_completed_project: true;
  };
  escalation_plan: {
    artist_done_nudge_planned_at: string;
    escalation_to_manager_planned_at: string;
  };
};

export function generateSchedule({
  startDate,
  sessionCount = 1,
  healingDays = 21,
  sessionHours = 4,
  projectType = "tattoo",
}: {
  startDate: string;
  sessionCount?: number;
  healingDays?: number;
  sessionHours?: number;
  projectType?: string;
}): GeneratedSchedule {
  if (!startDate) {
    throw new Error("Missing startDate");
  }

  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid startDate");
  }

  const isConsult = String(projectType).toLowerCase().includes("consult");

  const safeSessionCount = Math.max(1, sessionCount);
  const safeHealingDays = Math.max(1, healingDays);
  const safeSessionHours = Math.max(1, sessionHours);

  const sessions: GeneratedSession[] = [];

  for (let i = 0; i < safeSessionCount; i++) {
    const sessionStart = new Date(start);
    sessionStart.setDate(sessionStart.getDate() + i * safeHealingDays);

    const sessionEnd = new Date(sessionStart);
    sessionEnd.setHours(sessionEnd.getHours() + safeSessionHours);

    sessions.push({
      index: i + 1,
      start_at: sessionStart.toISOString(),
      end_at: sessionEnd.toISOString(),
    });
  }

  const firstSessionStart = new Date(sessions[0].start_at);
  const lastSessionEnd = new Date(sessions[sessions.length - 1].end_at);

  const prep = new Date(firstSessionStart);
  prep.setDate(prep.getDate() - 1);

  // For consults, this becomes a simple reminder instead of prep

  const completionCheck = new Date(lastSessionEnd);

  let cw1: Date | null = null;
  let cw2: Date | null = null;
  let cw3: Date | null = null;
  let review: Date | null = null;
  let portfolio: Date | null = null;

  if (!isConsult) {
    cw1 = new Date(lastSessionEnd);
    cw1.setHours(cw1.getHours() + 24);

    cw2 = new Date(lastSessionEnd);
    cw2.setHours(cw2.getHours() + 72);

    cw3 = new Date(lastSessionEnd);
    cw3.setDate(cw3.getDate() + 10);

    review = new Date(lastSessionEnd);
    review.setDate(review.getDate() + 14);

    portfolio = new Date(lastSessionEnd);
    portfolio.setDate(portfolio.getDate() + 30);
  }

  const artistDoneNudge = new Date(lastSessionEnd);
  artistDoneNudge.setHours(artistDoneNudge.getHours() + 1);

  const escalationToManager = new Date(lastSessionEnd);
  escalationToManager.setHours(escalationToManager.getHours() + 3);

  return {
    sessions,
    prep_planned_at: prep.toISOString(),
    completion_check_planned_at: completionCheck.toISOString(),
    aftercare_planned_at: null,
    contact_card_planned_at: null,
    cw1_planned_at: cw1 ? cw1.toISOString() : null,
    cw2_planned_at: cw2 ? cw2.toISOString() : null,
    cw3_planned_at: cw3 ? cw3.toISOString() : null,
    review_planned_at: review ? review.toISOString() : null,
    portfolio_request_planned_at: portfolio ? portfolio.toISOString() : null,
    execution_gates: {
      aftercare_requires_done: true,
      contact_card_requires_done: true,
      carewatch_requires_done: true,
      review_requires_positive_outcome: true,
      portfolio_requires_completed_project: true,
    },
    escalation_plan: {
      artist_done_nudge_planned_at: artistDoneNudge.toISOString(),
      escalation_to_manager_planned_at: escalationToManager.toISOString(),
    },
  };
}