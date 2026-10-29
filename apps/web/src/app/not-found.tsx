import Link from "next/link";
import { primaryButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="@container mx-auto max-w-xs px-4 py-28 text-center">
      <p className="font-display text-hero tracking-[-0.045em]">404</p>
      <p className="mt-6 text-small text-muted">Esta página no existe.</p>
      <Link href="/" className={`${primaryButton} mt-8`}>
        Volver al inicio
      </Link>
    </div>
  );
}
