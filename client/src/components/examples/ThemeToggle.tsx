import { ThemeToggle } from "../ThemeToggle";
import { ThemeProvider } from "@/lib/theme-context";

export default function ThemeToggleExample() {
  return (
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}
