import { getQuestions } from "./db";

export interface PracticeExamRequest {
  course: string;
  topics?: string[];
  numQuestions?: number;
}

export function createPracticeExam(req: PracticeExamRequest) {
  const { course, topics = [], numQuestions = 20 } = req;

  let allQuestions: any[] = [];

  if (topics.length === 0) {
    allQuestions = getQuestions({ course });
  } else {
    for (const topic of topics) {
      const qs = getQuestions({ course, topics: topic });
      allQuestions.push(...qs);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error("No questions found for the selected course/topics");
  }

  // Remove duplicates
  const uniqueQuestions = Array.from(
    new Map(allQuestions.map((q) => [q.question_text, q])).values()
  );

  // Shuffle
  for (let i = uniqueQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniqueQuestions[i], uniqueQuestions[j]] = [
      uniqueQuestions[j],
      uniqueQuestions[i],
    ];
  }

  return uniqueQuestions.slice(0, Math.min(numQuestions, uniqueQuestions.length));
}
