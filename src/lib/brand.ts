/** Change this single value to rename the app everywhere. */
export const APP_NAME = "Study Forge";

export const APP_TAGLINE = "Plan, track, and ace every exam";

export const APP_DESCRIPTION =
  "Organize subjects, schedule exams, track study progress, and use AI tools to prepare with confidence.";

export function pageTitle(section: string) {
  return `${section} — ${APP_NAME}`;
}
