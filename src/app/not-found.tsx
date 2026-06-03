import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

// Global 404 — also rendered (server-side) for demo visitors hitting a module
// that isn't exposed, so there's no flash of restricted content.
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#09090b] px-6 text-center">
      {/* ambient glow — same palette as the auth screen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 28%, rgba(139,92,246,0.16), transparent 45%),
            radial-gradient(circle at 75% 70%, rgba(20,184,166,0.08), transparent 50%)
          `,
        }}
      />

      <div className="relative flex flex-col items-center">
        <div className="relative mb-8">
          <div
            className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.55), transparent 70%)" }}
          />
          <Image
            src="/logo/Hegon_white_logo.png"
            width={44}
            height={44}
            alt="HEGON"
            className="relative drop-shadow-[0_0_24px_rgba(139,92,246,0.45)]"
          />
        </div>

        {/* oversized faint marker */}
        <p className="select-none text-[140px] font-bold leading-[0.8] tracking-tighter text-white/[0.05]">
          404
        </p>

        <h1 className="mt-2 text-xl font-semibold text-text-primary">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 max-w-sm text-sm text-text-tertiary">
          The page you&apos;re looking for has moved, or was never here.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            boxShadow: "0 4px 24px rgba(124,58,237,0.25)",
          }}
        >
          <ArrowLeft size={15} />
          Back to HEGON
        </Link>
      </div>
    </div>
  );
}
