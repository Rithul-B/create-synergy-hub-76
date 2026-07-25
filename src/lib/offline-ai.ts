import type { StudyPlanDay } from "@/lib/exam-planner-data";

/** Extract topic-like lines from raw syllabus text (no AI needed). */
export function parseTopicsFromText(text: string): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    let t = line
      .replace(/^[\s•\-–—*]+/, "")
      .replace(/^\d+[\.\):]\s*/, "")
      .replace(/^(unit|chapter|topic|module|week)\s+\d+[:\.\-\s]*/i, "")
      .trim();
    if (t.length < 3 || t.length > 120) continue;
    if (/^(syllabus|course|exam|schedule|page|\d+$)/i.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(t);
  }
  return topics.slice(0, 50);
}

export function buildLocalStudyPlan(
  examTitle: string,
  examDateIso: string,
  topics: string[],
): { plan: StudyPlanDay[]; tips: string[] } {
  const examDate = new Date(examDateIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  examDate.setHours(0, 0, 0, 0);
  let daysLeft = Math.ceil((examDate.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 1) daysLeft = 1;

  const plan: StudyPlanDay[] = [];
  const list = topics.length ? [...topics] : ["Review all course material", "Practice past papers", "Final revision"];
  const studyDays = Math.max(1, daysLeft - 1);
  let idx = 0;

  for (let d = 0; d < daysLeft; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const iso = date.toISOString().slice(0, 10);

    if (d === daysLeft - 1) {
      plan.push({
        date: iso,
        label: `Exam day — ${examTitle}`,
        topics: ["Light review only", "Rest & stay calm"],
        notes: "Avoid cramming. Skim key formulas and get good sleep.",
      });
      continue;
    }

    if (d === daysLeft - 2 && daysLeft > 2) {
      plan.push({
        date: iso,
        label: "Day before — Full review",
        topics: list.slice(0, Math.min(6, list.length)),
        notes: "2–3 hours: revisit weak areas, run through flashcards.",
      });
      continue;
    }

    const chunk = Math.max(1, Math.ceil(list.length / studyDays));
    const dayTopics = list.slice(idx, idx + chunk);
    idx = Math.min(idx + chunk, list.length);
    if (dayTopics.length === 0) dayTopics.push(list[d % list.length]);

    plan.push({
      date: iso,
      label: `Day ${d + 1} — ${dayTopics[0]?.slice(0, 30) ?? "Study"}`,
      topics: dayTopics,
      notes: `Aim for 1–2 focused hours on: ${dayTopics.join(", ")}`,
    });
  }

  return {
    plan,
    tips: [
      "Spread topics evenly — don't leave everything for the last night.",
      "Mark topics as Covered / In progress in the Exams editor to track progress.",
      "Add GEMINI_API_KEY to .env for smarter AI plans (free at aistudio.google.com/apikey).",
    ],
  };
}

export function searchSyllabusLocal(query: string, syllabusText: string) {
  const q = query.toLowerCase();
  const lines = syllabusText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const matches = lines.filter((l) => l.toLowerCase().includes(q)).slice(0, 8);
  const topics = parseTopicsFromText(matches.join("\n"));
  const answer =
    matches.length > 0
      ? `Found ${matches.length} matching line(s) in your syllabus for "${query}".`
      : `No exact match for "${query}". Try scanning/pasting more syllabus text, or browse topics below.`;
  return { matches: topics.length ? topics : matches.slice(0, 5), answer };
}

export function offlineChatReply(userMessage: string, subjectName?: string): string {
  const msg = userMessage.trim();
  const sub = subjectName ? ` for **${subjectName}**` : "";
  const lower = msg.toLowerCase();

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return `Hello! I'm your study assistant${sub}. Ask me to explain a topic, make a revision plan, or quiz you on key concepts.\n\n*Tip: Add a free \`GEMINI_API_KEY\` in your .env file for full AI answers.*`;
  }
  if (/quiz|test me|question/.test(lower)) {
    return `**Quick quiz${sub}:**\n\n1. Explain the main concept behind "${msg.replace(/quiz|test me|question/gi, "").trim() || "today's topic"}" in your own words.\n2. List three key terms and define each.\n3. What is one common mistake students make here?\n\n*Running in built-in study mode. Add GEMINI_API_KEY for custom AI-generated quizzes.*`;
  }
  if (/plan|schedule|revise|study/.test(lower)) {
    return `**Study plan suggestion${sub}:**\n\n1. **Today** — Read notes & highlight weak areas\n2. **Tomorrow** — Practice problems on the hardest topic\n3. **Day before exam** — Review summary sheets only\n\nUse **Exams → AI plan everything** for a day-by-day schedule tied to your exam date.\n\n*Built-in mode — add GEMINI_API_KEY for personalized AI planning.*`;
  }
  if (/explain|what is|how does|why/.test(lower)) {
    return `**Study guide${sub}:**\n\nFor "${msg.slice(0, 120)}":\n\n- **Define it** — Write the definition in one sentence\n- **Example** — Give a real-world or exam-style example\n- **Connect** — How does it link to other topics in your syllabus?\n- **Practice** — Try one past-paper question on this\n\n*Built-in tutor mode. For detailed AI explanations, add a free key: \`GEMINI_API_KEY=...\` in .env (get one at aistudio.google.com/apikey).*`;
  }

  return `Thanks for your question${sub}!\n\n**Your question:** ${msg}\n\n**How to study this:**\n1. Break the topic into 3–5 sub-topics\n2. Spend 25 minutes on each (Pomodoro)\n3. Test yourself without notes\n4. Mark progress in **Exams → Topics**\n\n*You're in built-in study mode (no API key needed). For full AI answers, add \`GEMINI_API_KEY\` to your .env — free at [Google AI Studio](https://aistudio.google.com/apikey).*`;
}

export function offlineChatJson(userPrompt: string): string {
  const lower = userPrompt.toLowerCase();

  if (lower.includes("syllabus") && lower.includes("topic")) {
    const topics = parseTopicsFromText(userPrompt);
    return JSON.stringify({
      syllabus_summary: "Parsed from text (built-in mode)",
      topics: topics.length ? topics : ["Introduction", "Core concepts", "Applications", "Review"],
    });
  }

  if (lower.includes("study plan") || lower.includes('"plan"')) {
    const topicMatch = userPrompt.match(/Topics to cover: ([^\n]+)/i);
    const dateMatch = userPrompt.match(/Exam date: ([^\n]+)/i);
    const titleMatch = userPrompt.match(/Exam: ([^\n]+)/i);
    const topics = topicMatch
      ? topicMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
      : ["Topic 1", "Topic 2", "Topic 3"];
    const { plan, tips } = buildLocalStudyPlan(
      titleMatch?.[1] ?? "Exam",
      dateMatch?.[1] ?? new Date(Date.now() + 7 * 86_400_000).toISOString(),
      topics,
    );
    return JSON.stringify({ plan, tips });
  }

  if (lower.includes("matches") || lower.includes("syllabus text")) {
    const qMatch = userPrompt.match(/User question: ([^\n]+)/i);
    const textMatch = userPrompt.match(/"""([\s\S]*?)"""/);
    const result = searchSyllabusLocal(qMatch?.[1] ?? "", textMatch?.[1] ?? userPrompt);
    return JSON.stringify(result);
  }

  return JSON.stringify({ answer: offlineChatReply(userPrompt), matches: [] });
}
