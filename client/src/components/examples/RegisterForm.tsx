import { RegisterForm } from "../RegisterForm";
import { AuthProvider } from "@/lib/auth-context";

export default function RegisterFormExample() {
  return (
    <AuthProvider>
      <RegisterForm
        onSwitchToLogin={() => console.log("Switch to login")}
        onSuccess={() => console.log("Register success")}
      />
    </AuthProvider>
  );
}
