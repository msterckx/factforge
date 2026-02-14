"use server";

import { db } from "@/db";
import { categories, questions } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { z } from "zod/v4";

const categorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
});

export async function createCategory(formData: FormData) {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;
  const slug = slugify(name);

  try {
    db.insert(categories).values({ name, slug }).run();
  } catch {
    return { error: "A category with this name already exists." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { success: true };
}

export async function updateCategory(id: number, formData: FormData) {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;
  const slug = slugify(name);

  try {
    db.update(categories).set({ name, slug }).where(eq(categories.id, id)).run();
  } catch {
    return { error: "A category with this name already exists." };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/");
  return { success: true };
}

export async function deleteCategory(id: number) {
  // Get associated questions to clean up images
  const qs = db
    .select({ imagePath: questions.imagePath })
    .from(questions)
    .where(eq(questions.categoryId, id))
    .all();

  // Delete image files
  const { unlink } = await import("fs/promises");
  const path = await import("path");
  for (const q of qs) {
    if (q.imagePath) {
      const fullPath = path.join(process.cwd(), "public", q.imagePath);
      try {
        await unlink(fullPath);
      } catch {
        // File might not exist
      }
    }
  }

  db.delete(categories).where(eq(categories.id, id)).run();

  revalidatePath("/admin/categories");
  revalidatePath("/admin/questions");
  revalidatePath("/");
  return { success: true };
}

export async function getCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      createdAt: categories.createdAt,
      questionCount: count(questions.id),
    })
    .from(categories)
    .leftJoin(questions, eq(categories.id, questions.categoryId))
    .groupBy(categories.id)
    .orderBy(categories.name)
    .all();
}
