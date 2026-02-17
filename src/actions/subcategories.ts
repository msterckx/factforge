"use server";

import { db } from "@/db";
import { subcategories, questions } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";
import { z } from "zod/v4";

const subcategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  categoryId: z.coerce.number().int().positive("Category is required"),
});

export async function createSubcategory(formData: FormData) {
  const parsed = subcategorySchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, categoryId } = parsed.data;
  const slug = slugify(name);

  try {
    db.insert(subcategories).values({ name, slug, categoryId }).run();
  } catch {
    return { error: "A subcategory with this name already exists in this category." };
  }

  revalidatePath("/admin/categories");
  return { success: true };
}

export async function updateSubcategory(id: number, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  if (!name || name.length < 2) {
    return { error: "Name must be at least 2 characters." };
  }

  const slug = slugify(name);

  try {
    db.update(subcategories).set({ name, slug }).where(eq(subcategories.id, id)).run();
  } catch {
    return { error: "A subcategory with this name already exists." };
  }

  revalidatePath("/admin/categories");
  return { success: true };
}

export async function deleteSubcategory(id: number) {
  db.delete(subcategories).where(eq(subcategories.id, id)).run();

  revalidatePath("/admin/categories");
  revalidatePath("/admin/questions");
  return { success: true };
}

export async function getSubcategoriesByCategory(categoryId: number) {
  return db
    .select({
      id: subcategories.id,
      name: subcategories.name,
      slug: subcategories.slug,
      categoryId: subcategories.categoryId,
    })
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId))
    .orderBy(subcategories.name)
    .all();
}

export async function getAllSubcategories() {
  return db
    .select({
      id: subcategories.id,
      name: subcategories.name,
      slug: subcategories.slug,
      categoryId: subcategories.categoryId,
    })
    .from(subcategories)
    .orderBy(subcategories.name)
    .all();
}

export async function getSubcategoriesWithCounts() {
  return db
    .select({
      id: subcategories.id,
      name: subcategories.name,
      slug: subcategories.slug,
      categoryId: subcategories.categoryId,
      questionCount: count(questions.id),
    })
    .from(subcategories)
    .leftJoin(questions, eq(subcategories.id, questions.subcategoryId))
    .groupBy(subcategories.id)
    .orderBy(subcategories.name)
    .all();
}
