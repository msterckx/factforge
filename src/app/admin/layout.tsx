import AdminSidebar from "@/components/AdminSidebar";
import { auth } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Login page renders without sidebar
  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className="flex gap-8">
      <AdminSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
