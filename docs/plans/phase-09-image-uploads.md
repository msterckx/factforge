# Phase 9: Admin Panel — Image Upload System

> Reusable image upload infrastructure used by question management.

## Depends On
- Phase 1 (uploads directory created)

## Tasks

### 9.1 Upload Helpers
- [ ] Create `src/lib/uploads.ts`
  - **`saveUploadedImage(file: File): Promise<string>`**
    - Validate file type: only jpg, jpeg, png, gif, webp
    - Validate file size: max 5MB
    - Generate unique filename: `uuid + original extension`
    - Write file to `public/uploads/questions/`
    - Return relative path: `/uploads/questions/<uuid>.<ext>`
    - Throw descriptive error on validation failure
  - **`deleteImage(imagePath: string): Promise<void>`**
    - Resolve full filesystem path from relative path
    - Security: verify resolved path is within `public/uploads/` (prevent path traversal)
    - Delete file from filesystem
    - Silently succeed if file doesn't exist (idempotent)

### 9.2 Image Upload Component
- [ ] Create `src/components/ImageUpload.tsx` (Client Component)
  - File input styled as "Choose Image" button
  - Image preview after file selection (before form submit)
  - When editing: show existing image from URL
  - "Remove Image" button to clear the selected/existing image
  - Accept attribute limits to image file types
  - Shows file size/type error immediately on invalid selection

### 9.3 Verification
- [ ] Test: selecting a valid image shows preview
- [ ] Test: selecting an oversized file shows error
- [ ] Test: selecting a non-image file is rejected
- [ ] Test: removing image clears preview
- [ ] Test: existing image displays when editing

## Files Created/Modified
| File | Action |
|------|--------|
| `src/lib/uploads.ts` | Created |
| `src/components/ImageUpload.tsx` | Created |

## Done When
- Upload helper correctly saves images with unique names
- Upload helper validates file type and size
- Delete helper safely removes images
- ImageUpload component shows preview and handles errors
- Component works in both "new" and "edit" contexts
