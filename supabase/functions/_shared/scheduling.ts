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
  cw1_planned_at: string;
  cw2_planned_at: string;
  cw3_planned_at: string;
  review_planned_at: string;
  portfolio_request_planned_at: string;
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
}: {
  startDate: string;
  sessionCount?: number;
  healingDays?: number;
  sessionHours?: number;
}): GeneratedSchedule {
  if (!startDate) {
    throw new Error("Missing startDate");
  }

  const start = new Date(startDate);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid startDate");
  }

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

  const completionCheck = new Date(lastSessionEnd);

  const cw1 = new Date(lastSessionEnd);
  cw1.setHours(cw1.getHours() + 24);

  const cw2 = new Date(lastSessionEnd);
  cw2.setHours(cw2.getHours() + 72);

  const cw3 = new Date(lastSessionEnd);
  cw3.setDate(cw3.getDate() + 10);

  const review = new Date(lastSessionEnd);
  review.setDate(review.getDate() + 14);

  const portfolio = new Date(lastSessionEnd);
  portfolio.setDate(portfolio.getDate() + 30);

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
    cw1_planned_at: cw1.toISOString(),
    cw2_planned_at: cw2.toISOString(),
    cw3_planned_at: cw3.toISOString(),
    review_planned_at: review.toISOString(),
    portfolio_request_planned_at: portfolio.toISOString(),
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