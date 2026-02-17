import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GeneratedQuestion {
  questionText: string;
  answer: string;
  difficulty: "easy" | "intermediate" | "difficult";
  didYouKnow: string;
  subcategory?: string;
}

export async function generateQuestions(
  categoryName: string,
  count: number = 5,
  existingQuestions: { questionText: string; answer: string }[] = [],
  subcategoryNames: string[] = []
): Promise<GeneratedQuestion[]> {
  const existingList = existingQuestions.length > 0
    ? `\n\nIMPORTANT: The following questions already exist in the database. Do NOT generate any questions that are the same or very similar to these (same topic/answer):\n${existingQuestions.map((q) => `- Q: "${q.questionText}" A: "${q.answer}"`).join("\n")}`
    : "";

  const subcategoryInstruction = subcategoryNames.length > 0
    ? `\n- "subcategory": one of the following subcategories that best fits the question: ${subcategoryNames.map((n) => `"${n}"`).join(", ")}. Pick the most relevant one for each question.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a trivia question generator. Generate unique, interesting trivia questions with clear, unambiguous answers. Return JSON with a "questions" array.

Each question object must have:
- "questionText": the question (clear, concise)
- "answer": the correct answer (short, factual — a name, number, place, etc.)
- "difficulty": one of "easy", "intermediate", or "difficult"
- "didYouKnow": a fun fact related to the answer (2-3 sentences, engaging and educational)${subcategoryInstruction}

Mix difficulties across the batch. Avoid overly obscure questions for "easy". Ensure answers are definitively correct.${existingList}`,
      },
      {
        role: "user",
        content: `Generate ${count} trivia questions in the category "${categoryName}".`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  const parsed = JSON.parse(content);
  return parsed.questions as GeneratedQuestion[];
}
