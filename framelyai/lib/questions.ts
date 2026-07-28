// lib/questions.ts
//
// Shared interview-question pool + a per-session randomizer. Used by both
// the landing page (static Question Bank section) and the live interview
// page (a stable, randomized subset of SAMPLE_SIZE per session).
//
// Each entry is { q, tag } — q is the prompt the candidate reads, tag is a
// short competency label shown in the sidebar and per-question report card.

export type Question = {
  q: string;
  tag: string;
};

// Full pool — kept human-curated. Order here is irrelevant at runtime
// because the interview page shuffles before showing.
export const QUESTIONS: Question[] = [
  // Conflict & collaboration
  { q: "Tell me about a time you disagreed with a teammate.", tag: "Conflict & collaboration" },
  { q: "Describe a situation where you had to work with someone whose style was very different from yours.", tag: "Conflict & collaboration" },
  { q: "Tell me about a time you gave a peer difficult feedback.", tag: "Conflict & collaboration" },
  { q: "Walk me through a time you helped a teammate through a rough patch at work.", tag: "Conflict & collaboration" },

  // Failure & growth
  { q: "Describe a project that failed. What did you learn?", tag: "Failure & growth" },
  { q: "Tell me about a time you shipped something you weren't proud of.", tag: "Failure & growth" },
  { q: "What's the biggest mistake you've made at work, and how have you changed because of it?", tag: "Failure & growth" },
  { q: "Tell me about a goal you set that you didn't hit. What got in the way?", tag: "Failure & growth" },

  // Leadership
  { q: "Tell me about a time you led without formal authority.", tag: "Leadership" },
  { q: "Describe a moment where you had to motivate a team that was losing momentum.", tag: "Leadership" },
  { q: "Tell me about a time you delegated something important and it didn't go as planned.", tag: "Leadership" },
  { q: "Give an example of when you set the direction for a group, not just executed on someone else's plan.", tag: "Leadership" },

  // Judgment
  { q: "Walk me through a decision you'd make differently today.", tag: "Judgment" },
  { q: "Tell me about a time you had to weigh two bad options.", tag: "Judgment" },
  { q: "Describe a decision you made with incomplete information. What did you do about the gaps?", tag: "Judgment" },
  { q: "Tell me about a time you changed your mind based on new evidence.", tag: "Judgment" },

  // Influence
  { q: "Tell me about a time you had to persuade someone.", tag: "Influence" },
  { q: "Describe a time you convinced a skeptical audience to adopt your idea.", tag: "Influence" },
  { q: "Give an example of when you got pushback from your manager and changed their mind.", tag: "Influence" },
  { q: "Tell me about a time you influenced a decision without being in the room.", tag: "Influence" },

  // Prioritization
  { q: "Tell me about a time you had to choose between two good options with no time to do both.", tag: "Prioritization" },
  { q: "Describe how you've handled a sudden shift in priorities mid-project.", tag: "Prioritization" },
  { q: "Walk me through how you decide what to drop when your plate is full.", tag: "Prioritization" },

  // Handling ambiguity
  { q: "Describe a time you had to act before the goal was clear.", tag: "Handling ambiguity" },
  { q: "Tell me about a project where the requirements kept shifting. How did you adapt?", tag: "Handling ambiguity" },

  // Communication
  { q: "Tell me about a time you had to explain something complex to a non-technical audience.", tag: "Communication" },
  { q: "Describe a moment when a message you sent was misunderstood. What did you do?", tag: "Communication" },
];

// How many questions each interview session draws from the pool.
export const SAMPLE_SIZE = 5;

// In-place Fisher–Yates shuffle — uniform random permutation over the input.
function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick a random subset of `n` questions from the pool. Stable for one
// caller — call once per session (the interview page does this in a
// useState lazy initializer so the order stays fixed for the whole
// interview).
export function pickRandomQuestions(n: number = SAMPLE_SIZE): Question[] {
  const pool = QUESTIONS.length;
  const count = Math.min(Math.max(1, n), pool);
  return shuffle(QUESTIONS).slice(0, count);
}