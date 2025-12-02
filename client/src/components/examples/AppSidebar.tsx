import { AppSidebar } from "../AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/lib/auth-context";

export default function AppSidebarExample() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </AuthProvider>
  );
}
