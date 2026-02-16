"use server";

import { db } from "@/db";
import { questions, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { saveUploadedImage, deleteImage } from "@/lib/uploads";
import { z } from "zod/v4";

const questionSchema = z.object({
  questionText: z.string().min(3, "Question must be at least 3 characters"),
  answer: z.string().min(1, "Answer is required"),
  categoryId: z.coerce.number().int().positive("Category is required"),
  difficulty: z.enum(["easy", "intermediate", "difficult"]),
});

export async function createQuestion(formData: FormData) {
  const parsed = questionSchema.safeParse({
    questionText: formData.get("questionText"),
    answer: formData.get("answer"),
    categoryId: formData.get("categoryId"),
    difficulty: formData.get("difficulty"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let imagePath: string | null = null;
  const imageFile = formData.get("image") as File | null;
  const searchedImagePath = formData.get("searchedImagePath") as string | null;

  if (imageFile && imageFile.size > 0) {
    try {
      imagePath = await saveUploadedImage(imageFile);
    } catch (err) {
      return { error: (err as Error).message };
    }
  } else if (searchedImagePath) {
    imagePath = searchedImagePath;
  }

  db.insert(questions)
    .values({
      questionText: parsed.data.questionText,
      answer: parsed.data.answer,
      categoryId: parsed.data.categoryId,
      difficulty: parsed.data.difficulty,
      didYouKnow: (formData.get("didYouKnow") as string)?.trim() || null,
      imagePath,
    })
    .run();

  revalidatePath("/admin/questions");
  revalidatePath("/");

  // Revalidate the category page
  const category = db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .get();
  if (category) {
    revalidatePath(`/category/${category.slug}`);
  }

  return { success: true };
}

export async function updateQuestion(id: number, formData: FormData) {
  const parsed = questionSchema.safeParse({
    questionText: formData.get("questionText"),
    answer: formData.get("answer"),
    categoryId: formData.get("categoryId"),
    difficulty: formData.get("difficulty"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = db.select().from(questions).where(eq(questions.id, id)).get();
  if (!existing) {
    return { error: "Question not found." };
  }

  let imagePath = existing.imagePath;

  const removeImage = formData.get("removeImage") === "true";
  const imageFile = formData.get("image") as File | null;
  const searchedImagePath = formData.get("searchedImagePath") as string | null;

  if (removeImage && (!imageFile || imageFile.size === 0) && !searchedImagePath) {
    // Remove existing image
    if (existing.imagePath) {
      await deleteImage(existing.imagePath);
    }
    imagePath = null;
  } else if (imageFile && imageFile.size > 0) {
    // Replace with uploaded file
    if (existing.imagePath) {
      await deleteImage(existing.imagePath);
    }
    try {
      imagePath = await saveUploadedImage(imageFile);
    } catch (err) {
      return { error: (err as Error).message };
    }
  } else if (searchedImagePath) {
    // Replace with image from search (already saved on disk)
    if (existing.imagePath) {
      await deleteImage(existing.imagePath);
    }
    imagePath = searchedImagePath;
  }

  db.update(questions)
    .set({
      questionText: parsed.data.questionText,
      answer: parsed.data.answer,
      categoryId: parsed.data.categoryId,
      difficulty: parsed.data.difficulty,
      didYouKnow: (formData.get("didYouKnow") as string)?.trim() || null,
      imagePath,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(questions.id, id))
    .run();

  revalidatePath("/admin/questions");
  revalidatePath("/");

  // Revalidate both old and new category pages
  const oldCat = db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, existing.categoryId)).get();
  const newCat = db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, parsed.data.categoryId)).get();
  if (oldCat) revalidatePath(`/category/${oldCat.slug}`);
  if (newCat) revalidatePath(`/category/${newCat.slug}`);

  return { success: true };
}

export async function createQuestionFromAI(data: {
  questionText: string;
  answer: string;
  categoryId: number;
  difficulty: "easy" | "intermediate" | "difficult";
  didYouKnow: string | null;
}) {
  const parsed = questionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  db.insert(questions)
    .values({
      questionText: parsed.data.questionText,
      answer: parsed.data.answer,
      categoryId: parsed.data.categoryId,
      difficulty: parsed.data.difficulty,
      didYouKnow: data.didYouKnow?.trim() || null,
      imagePath: null,
    })
    .run();

  revalidatePath("/admin/questions");
  revalidatePath("/");

  const category = db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, parsed.data.categoryId))
    .get();
  if (category) {
    revalidatePath(`/category/${category.slug}`);
  }

  return { success: true };
}

export async function deleteQuestion(id: number) {
  const existing = db.select().from(questions).where(eq(questions.id, id)).get();
  if (!existing) {
    return { error: "Question not found." };
  }

  if (existing.imagePath) {
    await deleteImage(existing.imagePath);
  }

  db.delete(questions).where(eq(questions.id, id)).run();

  revalidatePath("/admin/questions");
  revalidatePath("/");

  const category = db.select({ slug: categories.slug }).from(categories).where(eq(categories.id, existing.categoryId)).get();
  if (category) {
    revalidatePath(`/category/${category.slug}`);
  }

  return { success: true };
}
