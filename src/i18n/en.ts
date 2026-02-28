export const en = {
  nav: {
    brand: "Game of Trivia",
  },
  home: {
    welcomeTo: "Welcome to",
    subtitle: "Challenge Your Knowledge.",
    questionsAvailable: "questions available",
    categories: "categories",
    chooseCategory: "Choose a Quiz Category",
    pickCategory: "Pick a category and let the quiz begin!",
    noCategories: "No categories available yet.",
    startQuiz: "Start the Quiz",
    quickQuizTitle: "Quick Quiz",
    quickQuizSubtitle: "Random questions from all categories",
  },
  quickquiz: {
    title: "Quick Quiz",
    subtitle: "Random questions from all categories. How many can you get right?",
    noQuestions: "No questions available yet.",
    allCategories: "All Categories",
  },
  category: {
    backToCategories: "Back to Categories",
    noQuestions: "No questions in this category yet.",
  },
  quiz: {
    questionOf: "Question {current} of {total}",
    all: "All",
    noQuestionsInSubcategory: "No questions in this subcategory yet.",
    typeYourAnswer: "Type your answer...",
    correct: "Correct!",
    incorrect: "Incorrect. Try again or show the answer.",
    theAnswerIs: "The answer is:",
    didYouKnow: "Did you know?",
    checkAnswer: "Check Answer",
    showAnswer: "Show Answer",
    previous: "Previous",
    next: "Next",
  },
  categoryCard: {
    question: "question",
    questions: "questions",
  },
  sidebar: {
    home: "Home",
    quickQuiz: "QuickQuiz",
  },
} as const;

export type Dictionary = typeof en;
