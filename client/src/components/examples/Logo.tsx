import { Logo } from "../Logo";

export default function LogoExample() {
  return (
    <div className="flex flex-col gap-4">
      <Logo size="sm" />
      <Logo size="md" />
      <Logo size="lg" />
      <Logo collapsed />
    </div>
  );
}
