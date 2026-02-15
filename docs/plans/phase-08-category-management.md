# Phase 8: Admin Panel — Category Management

> CRUD operations for categories.

## Depends On
- Phase 2 (database schema)
- Phase 6 (authentication)
- Phase 7 (admin layout with sidebar)

## Tasks

### 8.1 Server Actions
- [ ] Create `src/actions/categories.ts`
  - **`createCategory(formData)`**
    - Validate name with Zod (required, min 2 chars, unique)
    - Auto-generate slug from name (lowercase, hyphens, strip special chars)
    - Insert into DB
    - Revalidate `/` (home page) and `/admin/categories`
    - Return success/error response
  - **`updateCategory(id, formData)`**
    - Validate name
    - Update name and regenerate slug
    - Revalidate affected paths
  - **`deleteCategory(id)`**
    - Delete category (CASCADE deletes associated questions)
    - Delete image files for all associated questions
    - Revalidate affected paths
  - All actions protected: verify admin session before executing

### 8.2 Category List Page
- [ ] Create `src/app/admin/categories/page.tsx`
  - Table listing all categories with columns:
    - Name
    - Slug
    - Question count
    - Created date
    - Actions (Edit, Delete)
  - **"Add Category"** form at top of page:
    - Inline text input + submit button
    - Uses `createCategory` server action
  - **Edit** button per row:
    - Inline edit (toggle row to editable input) or modal
    - Uses `updateCategory` server action
  - **Delete** button per row:
    - Confirmation dialog ("This will also delete X questions. Are you sure?")
    - Uses `deleteCategory` server action
  - Success/error feedback messages after actions

### 8.3 Verification
- [ ] Test: create new category → appears in admin list AND on public home page
- [ ] Test: edit category name → slug updates, public links still work
- [ ] Test: delete category → removed from list, associated questions also removed
- [ ] Test: duplicate category name → shows validation error
- [ ] Test: empty name → shows validation error

## Files Created/Modified
| File | Action |
|------|--------|
| `src/actions/categories.ts` | Created |
| `src/app/admin/categories/page.tsx` | Created |

## Done When
- Admin can create, edit, and delete categories
- Changes are immediately reflected on the public home page
- Deleting a category cascades to its questions
- Validation prevents duplicate or empty category names
