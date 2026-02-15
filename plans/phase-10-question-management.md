# Phase 10: Admin Panel — Question Management

> Full CRUD for questions with image uploads. The most complex admin feature.

## Depends On
- Phase 2 (database schema)
- Phase 6 (authentication)
- Phase 7 (admin layout)
- Phase 8 (categories must exist to assign questions to)
- Phase 9 (image upload system)

## Tasks

### 10.1 Server Actions
- [ ] Create `src/actions/questions.ts`
  - **`createQuestion(formData)`**
    - Validate with Zod: question_text (required), answer (required), category_id (required, must exist)
    - If image file provided: save via `saveUploadedImage()`
    - Insert question into DB with image_path
    - Revalidate admin question list + public category page
    - Return success/error
  - **`updateQuestion(id, formData)`**
    - Validate same fields
    - If new image uploaded: delete old image, save new one
    - If image removed (flag in form): delete old image, set path to null
    - If no image change: keep existing path
    - Update DB record
    - Revalidate affected paths
  - **`deleteQuestion(id)`**
    - Fetch question to get image_path
    - Delete image file if exists
    - Delete question from DB
    - Revalidate affected paths
  - All actions protected: verify admin session

### 10.2 Question Form Component
- [ ] Create `src/components/QuestionForm.tsx` (Client Component)
  - Fields:
    - **Category** — dropdown, populated from categories list (passed as prop)
    - **Question text** — textarea
    - **Answer** — text input
    - **Image** — ImageUpload component
  - Works in both **create** and **edit** mode:
    - Create: all fields empty
    - Edit: pre-populated with existing question data
  - Form validation with inline error messages
  - Submit button calls appropriate server action via form action
  - On success: redirect to question list
  - On error: show error message, preserve form state

### 10.3 Question List Page
- [ ] Create `src/app/admin/questions/page.tsx`
  - Table with columns:
    - Image thumbnail (small)
    - Question text (truncated)
    - Answer
    - Category name
    - Actions (Edit, Delete)
  - **Category filter** dropdown at top (filter questions by category)
  - **"Add New Question"** button linking to `/admin/questions/new`
  - **Edit** button links to `/admin/questions/[id]`
  - **Delete** button with confirmation dialog
  - Empty state: "No questions yet. Add your first question!"

### 10.4 Create Question Page
- [ ] Create `src/app/admin/questions/new/page.tsx`
  - Server Component: fetch categories for dropdown
  - Renders QuestionForm in create mode
  - Page heading: "Add New Question"

### 10.5 Edit Question Page
- [ ] Create `src/app/admin/questions/[id]/page.tsx`
  - Server Component: fetch existing question data + categories
  - Renders QuestionForm in edit mode, pre-populated
  - Page heading: "Edit Question"
  - Handles invalid ID → not-found

### 10.6 Verification
- [ ] Test: create question with image → appears in admin list and on public quiz
- [ ] Test: edit question text → changes reflected on public site
- [ ] Test: replace question image → old image file deleted, new one displayed
- [ ] Test: delete question → removed from list, image file deleted from disk
- [ ] Test: create question without image → works (image is optional)
- [ ] Test: form validation → missing required fields show errors
- [ ] Test: assigning question to different category → appears in new category's quiz

## Files Created/Modified
| File | Action |
|------|--------|
| `src/actions/questions.ts` | Created |
| `src/components/QuestionForm.tsx` | Created |
| `src/app/admin/questions/page.tsx` | Created |
| `src/app/admin/questions/new/page.tsx` | Created |
| `src/app/admin/questions/[id]/page.tsx` | Created |

## Done When
- Admin can create questions with all fields + image upload
- Admin can edit existing questions (including image replacement)
- Admin can delete questions (image file also cleaned up)
- Questions appear on the correct public category quiz page
- Form validates required fields
- Category filter works on question list
