export type LearningPreferences = {
  educationLevel?: string;
  language?: string;
  answerStyle?: string;
};

export const EDUCATION_LEVELS = [
  "Primary school",
  "Middle school",
  "High school",
  "Undergraduate",
  "Postgraduate",
  "Professional",
] as const;

export const ANSWER_STYLES = [
  { value: "balanced", label: "Balanced" },
  { value: "concise", label: "Short and to the point" },
  { value: "detailed", label: "Detailed and thorough" },
  { value: "socratic", label: "Ask me questions (Socratic)" },
  { value: "simple", label: "Explain like I'm new to this" },
] as const;

export const LANGUAGES = [
  "English",
  "Hindi",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Mandarin",
  "Japanese",
  "Tamil",
] as const;

export function parsePreferences(raw: unknown): LearningPreferences {
  if (!raw || typeof raw !== "object") return {};
  const { educationLevel, language, answerStyle } = raw as Record<string, unknown>;
  return {
    educationLevel: typeof educationLevel === "string" ? educationLevel : undefined,
    language: typeof language === "string" ? language : undefined,
    answerStyle: typeof answerStyle === "string" ? answerStyle : undefined,
  };
}

const STYLE_INSTRUCTIONS: Record<string, string> = {
  concise: "Keep answers brief — lead with the answer, then at most a few supporting points.",
  detailed: "Give thorough explanations with examples and step-by-step reasoning.",
  socratic: "Guide the learner with probing questions before revealing the full answer.",
  simple: "Assume no prior knowledge. Use plain words and everyday analogies.",
};

/** Turns saved preferences into extra system-prompt guidance for the tutor. */
export function preferenceInstructions(prefs: LearningPreferences): string {
  const parts: string[] = [];
  if (prefs.educationLevel) parts.push(`The learner is at ${prefs.educationLevel} level — pitch your explanations accordingly.`);
  if (prefs.language && prefs.language !== "English") parts.push(`Reply in ${prefs.language}.`);
  const style = prefs.answerStyle ? STYLE_INSTRUCTIONS[prefs.answerStyle] : undefined;
  if (style) parts.push(style);
  return parts.join(" ");
}
