export interface Dictionary {
  nav: {
    brand: string;
  };
  home: {
    welcomeTo: string;
    subtitle: string;
    questionsAvailable: string;
    categories: string;
    chooseCategory: string;
    pickCategory: string;
    noCategories: string;
    startQuiz: string;
    quickQuizTitle: string;
    quickQuizSubtitle: string;
  };
  quickquiz: {
    title: string;
    subtitle: string;
    noQuestions: string;
    allCategories: string;
  };
  category: {
    backToCategories: string;
    noQuestions: string;
  };
  quiz: {
    questionOf: string;
    all: string;
    noQuestionsInSubcategory: string;
    typeYourAnswer: string;
    correct: string;
    incorrect: string;
    theAnswerIs: string;
    didYouKnow: string;
    checkAnswer: string;
    showAnswer: string;
    previous: string;
    next: string;
    quizMode: string;
    listMode: string;
    answerLabel: string;
    allDifficulties: string;
    easy: string;
    intermediate: string;
    difficult: string;
  };
  categoryCard: {
    question: string;
    questions: string;
  };
  sidebar: {
    home: string;
    quickQuiz: string;
    challenges: string;
    contact: string;
  };
  challenges: {
    title: string;
    subtitle: string;
    pickGame: string;
    gamesTitle: string;
    guessThePerson: string;
    guessThePersonSubtitle: string;
    comingSoon: string;
    backToChallenges: string;
    typeTheName: string;
    submit: string;
    correct: string;
    wrong: string;
    timeUp: string;
    thePersonWas: string;
    nextPerson: string;
    score: string;
    timeLeft: string;
    hint: string;
    round: string;
    playAgain: string;
    twelveCaesars: string;
    twelveCaesarsSubtitle: string;
    conquistadors: string;
    conquistadorsSubtitle: string;
    quantumScientists: string;
    quantumScientistsSubtitle: string;
    filterBy: string;
    filterByCategory: string;
    filterByGameType: string;
    filterAll: string;
    categoryHistory: string;
    categoryScience: string;
    gameTypeChronology: string;
    dragOrTap: string;
    checkOrder: string;
    correctPositions: string;
    perfectOrder: string;
    tryAgain: string;
    revealAnswer: string;
    yourAnswer: string;
  };
  contact: {
    title: string;
    subtitle: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    send: string;
    sending: string;
    successTitle: string;
    successMessage: string;
    errorMessage: string;
  };
}

export const en: Dictionary = {
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
    quizMode: "Quiz",
    listMode: "List",
    answerLabel: "Answer",
    allDifficulties: "All levels",
    easy: "Easy",
    intermediate: "Intermediate",
    difficult: "Difficult",
  },
  categoryCard: {
    question: "question",
    questions: "questions",
  },
  sidebar: {
    home: "Home",
    quickQuiz: "QuickQuiz",
    challenges: "Challenges",
    contact: "Contact",
  },
  challenges: {
    title: "Challenges",
    subtitle: "Test your knowledge in a whole new way.",
    pickGame: "Pick a game from the right and start playing!",
    gamesTitle: "Games",
    guessThePerson: "Guess the Person",
    guessThePersonSubtitle: "Recognize a famous face before time runs out",
    comingSoon: "Coming soon",
    backToChallenges: "Back to Challenges",
    typeTheName: "Type the name...",
    submit: "Submit",
    correct: "Correct!",
    wrong: "Wrong — keep trying!",
    timeUp: "Time's up!",
    thePersonWas: "The person was:",
    nextPerson: "Next Person",
    score: "Score",
    timeLeft: "Time left",
    hint: "Hint",
    round: "Round",
    playAgain: "Play Again",
    twelveCaesars: "The Twelve Caesars",
    twelveCaesarsSubtitle: "Order the Roman emperors chronologically",
    conquistadors: "The Conquistadors",
    conquistadorsSubtitle: "Order the Spanish conquistadors chronologically",
    quantumScientists: "Quantum Scientists",
    quantumScientistsSubtitle: "Order the pioneers of quantum mechanics chronologically",
    filterBy: "Filter by",
    filterByCategory: "Category",
    filterByGameType: "Game Type",
    filterAll: "All",
    categoryHistory: "History",
    categoryScience: "Science",
    gameTypeChronology: "Chronology",
    dragOrTap: "Drag to reorder, or tap two items to swap them",
    checkOrder: "Check My Order",
    correctPositions: "{correct} of {total} in the right position",
    perfectOrder: "Perfect chronological order! 🎉",
    tryAgain: "Try Again",
    revealAnswer: "Reveal Correct Order",
    yourAnswer: "Your order",
  },
  contact: {
    title: "Contact Us",
    subtitle: "Have a question or suggestion? We'd love to hear from you.",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "your@email.com",
    message: "Message",
    messagePlaceholder: "Your message...",
    send: "Send Message",
    sending: "Sending...",
    successTitle: "Message sent!",
    successMessage: "Thanks for reaching out. We'll get back to you soon.",
    errorMessage: "Something went wrong. Please try again.",
  },
};
