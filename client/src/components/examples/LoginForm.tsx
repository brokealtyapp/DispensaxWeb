import { LoginForm } from "../LoginForm";
import { AuthProvider } from "@/lib/auth-context";

export default function LoginFormExample() {
  return (
    <AuthProvider>
      <LoginForm
        onSwitchToRegister={() => console.log("Switch to register")}
        onSuccess={() => console.log("Login success")}
      />
    </AuthProvider>
  );
}
