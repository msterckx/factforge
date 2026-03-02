"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
  const cookieStore = await cookies();
  // Auth.js v5 uses these cookie names (HTTP dev / HTTPS prod)
  cookieStore.delete("authjs.session-token");
  cookieStore.delete("__Secure-authjs.session-token");
  redirect("/admin/login");
}
