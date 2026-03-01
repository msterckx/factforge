import { redirect } from "next/navigation";

// Middleware handles the redirect to /en — this is a fallback shim
export default function RootPage() {
  redirect("/en");
}
