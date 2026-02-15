# Phase 5: Public Pages — Quiz Interface

> The core feature: one question at a time with answer checking.

## Depends On
- Phase 2 (database with seed data)
- Phase 3 (layout)
- Phase 4 (home page links here)

## Tasks

### 5.1 Answer Checking Utility
- [ ] Create `src/lib/utils.ts` with `checkAnswer(userAnswer, correctAnswer)` function
  - Trim whitespace
  - Lowercase both strings
  - Strip punctuation and special characters
  - Normalize multiple spaces to single space
  - Return boolean
  - Example: "Mount Everest" matches "mount everest", "Mount  Everest!", "mount-everest"

### 5.2 Quiz Page (Server Component)
- [ ] Build `src/app/category/[slug]/page.tsx`
  - Server Component: fetches category + all its questions from DB
  - Passes questions array (including answers) to the AnswerChecker client component
  - Shows category name as heading
  - Handles invalid slug → call `notFound()`
  - Shows "No questions in this category yet" if category is empty
  - "Back to Categories" link

### 5.3 Answer Checker Component (Client Component)
- [ ] Create `src/components/AnswerChecker.tsx`
  - **Props**: receives full question list `{ id, questionText, answer, imagePath }[]`
  - **State**: current question index, user input, feedback status (idle / correct / incorrect / revealed)
  - **Display for current question**:
    - Question image (responsive, with fallback if no image)
    - Question text
    - Text input field for user's answer
    - **"Check Answer"** button:
      - Runs `checkAnswer()` locally
      - Shows green feedback with message on correct
      - Shows red feedback on incorrect (does NOT reveal the answer)
    - **"Show Answer"** button:
      - Reveals the correct answer with a highlighted display
  - **Navigation**:
    - **"Previous"** / **"Next"** buttons to move between questions
    - Progress indicator: "Question 3 of 12"
    - Previous disabled on first question
    - Next disabled on last question
  - **Behavior**:
    - Resets input and feedback state when navigating to a new question
    - Enter key triggers "Check Answer"
    - Auto-focus on answer input

### 5.4 Not Found Page
- [ ] Create `src/app/category/[slug]/not-found.tsx` — "Category not found" with link to home

### 5.5 Verification
- [ ] Test full quiz flow: home → pick category → see first question with image → type answer → check (correct) → check (incorrect) → show answer → next → previous → back to categories
- [ ] Test edge cases:
  - Empty category → shows message
  - Single question category → prev/next disabled
  - Long answer text → input handles it
  - Missing image → fallback/placeholder shown

## Files Created/Modified
| File | Action |
|------|--------|
| `src/lib/utils.ts` | Created |
| `src/app/category/[slug]/page.tsx` | Created |
| `src/app/category/[slug]/not-found.tsx` | Created |
| `src/components/AnswerChecker.tsx` | Created |

## Done When
- User can navigate from home → category → quiz
- Questions display one at a time with image, text, and answer input
- "Check Answer" gives correct/incorrect feedback without revealing answer
- "Show Answer" reveals the correct answer
- Next/Previous navigation works with progress indicator
- Invalid category slugs show 404
