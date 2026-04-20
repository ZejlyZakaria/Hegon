"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Zap,
  Grid3x3,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type Mode = "login" | "signup";

// ─── Design system tokens (auth exception: h-11 inputs for landing UX) ────────
const S = {
  surface2: "#141416",
  surface3: "#1a1a1d",
  primary: "#e2e2e6",
  secondary: "#a0a0a8",
  tertiary: "#71717a",
  border: "rgba(255,255,255,0.07)",
  borderSubtle: "rgba(255,255,255,0.04)",
};

// ─── Feature cards data ───────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Grid3x3 size={15} />,
    label: "All Connected",
    desc: "Tasks, sports, media in one OS.",
    delay: 0.55,
  },
  {
    icon: <Zap size={15} />,
    label: "What Matters",
    desc: "See the important, when it is.",
    delay: 0.65,
  },
  {
    icon: <Sparkles size={15} />,
    label: "Built for You",
    desc: "A system that adapts to your life.",
    delay: 0.75,
  },
];

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  label,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-center text-center gap-2.5 p-4 rounded-lg"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)", color: S.secondary }}
      >
        {icon}
      </div>
      <div>
        <p
          className="text-[10px] font-semibold uppercase tracking-wider leading-none"
          style={{ color: S.secondary }}
        >
          {label}
        </p>
        <p
          className="text-[10px] mt-1.5 leading-relaxed"
          style={{ color: S.tertiary }}
        >
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Password input ───────────────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  autoComplete,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hasError?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        placeholder="••••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`h-11 rounded-md pr-10 text-sm
          placeholder:text-[#71717a] text-[#e2e2e6]
          focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20
          ${
            hasError
              ? "bg-[#141416] border-red-500/30"
              : "bg-[#141416] border-white/[0.07]"
          }`}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a0a0a8] transition-colors duration-100"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function LeftPanel() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between h-full px-12 py-14 relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 20% 30%, rgba(139,92,246,0.22), transparent 40%),
          radial-gradient(circle at 80% 20%, rgba(99,102,241,0.18), transparent 40%),
          radial-gradient(circle at 60% 80%, rgba(20,184,166,0.12), transparent 50%),
          #09090b
        `,
      }}
    >
      {/* ── Logo + tagline centré ── */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
          className="flex flex-col items-center gap-4 text-center"
        >
          <div className="relative">
            <div
              className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
              style={{
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.6), transparent 70%)",
              }}
            />
            <Image
              src="/logo/Hegon_white_logo.png"
              width={64}
              height={64}
              alt="HEGON"
              className="relative drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
            />
          </div>
          <div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ color: S.primary }}
            >
              HEGON
            </h1>
            <p
              className="text-[11px] mt-1.5 uppercase tracking-[0.22em]"
              style={{ color: S.tertiary }}
            >
              Your Second Brain. Built Different.
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Feature cards en bas ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {FEATURES.map((f) => (
          <FeatureCard key={f.label} {...f} />
        ))}
      </div>

      {/* ── Footer ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="flex items-center justify-center gap-3 text-[10px]"
        style={{ color: S.tertiary }}
      >
        <span>© 2026 HEGON</span>
        <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
        <button
          type="button"
          className="hover:text-[#a0a0a8] transition-colors duration-100"
        >
          Privacy Policy
        </button>
        <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
        <button
          type="button"
          className="hover:text-[#a0a0a8] transition-colors duration-100"
        >
          Terms of Use
        </button>
      </motion.div>
    </div>
  );
}

// ─── Auth form ────────────────────────────────────────────────────────────────

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // const rawNext  = searchParams.get("next") ?? "/dashboard";
  // const next     = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && rawNext !== "/"
      ? rawNext
      : "/dashboard";
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError === "auth_failed")
      setError("Authentication failed. Please try again.");
    if (urlError === "missing_code") setError("Invalid or expired link.");
  }, [urlError]);

  const clear = () => {
    setError("");
    setSuccess("");
    setEmail("");
    setPassword("");
    setName("");
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    clear();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (signUpData.user?.email_confirmed_at) {
          router.push(next);
          router.refresh();
        } else {
          setSuccess("Check your email to confirm your account.");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred.";
      const map: Record<string, string> = {
        "Invalid login credentials": "Incorrect email or password.",
        "Email not confirmed": "Please confirm your email before signing in.",
        "User already registered": "An account already exists with this email.",
      };
      setError(map[message] ?? message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] lg:grid lg:grid-cols-2">
      <LeftPanel />

      {/* ── Right — form ── */}
      <div className="flex flex-col justify-center px-8 sm:px-16 py-12 min-h-screen lg:min-h-0">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
          className="w-full max-w-md mx-auto"
        >
          {/* Heading */}
          <div className="mb-8">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-2"
              style={{ color: S.tertiary }}
            >
              {mode === "login" ? "Welcome Back" : "Get Started"}
            </p>
            <h1
              className="text-3xl font-bold mb-2"
              style={{ color: S.primary }}
            >
              {mode === "login" ? (
                <>
                  Sign in to <span style={{ color: "#8b5cf6" }}>HEGON</span>
                </>
              ) : (
                <>
                  Join <span style={{ color: "#8b5cf6" }}>HEGON</span>
                </>
              )}
            </h1>
            <p className="text-sm" style={{ color: S.tertiary }}>
              {mode === "login"
                ? "Your dashboard is waiting."
                : "Start organizing everything that matters."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {mode === "signup" && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="name"
                      className="text-xs font-medium"
                      style={{ color: S.secondary }}
                    >
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="given-name"
                      className="h-11 rounded-md text-sm bg-[#141416] border-white/[0.07] text-[#e2e2e6] placeholder:text-[#71717a] focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-medium"
                style={{ color: S.secondary }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`h-11 rounded-md text-sm text-[#e2e2e6] placeholder:text-[#71717a] focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/20
                  ${error ? "bg-[#141416] border-red-500/30" : "bg-[#141416] border-white/[0.07]"}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-medium"
                style={{ color: S.secondary }}
              >
                Password
              </Label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                hasError={!!error}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs text-red-400"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  <AlertCircle size={12} className="shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs text-emerald-400"
                  style={{
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.15)",
                  }}
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || googleLoading || !email || !password}
              className="w-full h-11 mt-1 rounded-md text-sm font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 4px 24px rgba(124,58,237,0.25)",
              }}
            >
              {loading && <Loader2 size={14} className="animate-spin mr-2" />}
              {mode === "login" ? "Sign in" : "Create account"}
              {!loading && <ArrowRight size={14} className="ml-2" />}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t"
                style={{ borderColor: S.border }}
              />
            </div>
            <div className="relative flex justify-center">
              <span
                className="bg-[#09090b] px-3 text-[10px] uppercase tracking-[0.15em]"
                style={{ color: S.tertiary }}
              >
                Or continue with
              </span>
            </div>
          </div>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full h-11 rounded-md text-sm font-medium transition-colors duration-100 disabled:opacity-40"
            style={{
              background: S.surface2,
              border: `1px solid ${S.border}`,
              color: S.secondary,
            }}
          >
            {googleLoading ? (
              <Loader2 size={14} className="animate-spin mr-2" />
            ) : (
              <span className="mr-2">
                <GoogleIcon />
              </span>
            )}
            Google
          </Button>

          {/* Toggle mode */}
          <p className="text-center text-xs mt-8" style={{ color: S.tertiary }}>
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                clear();
              }}
              className="font-medium inline-flex items-center gap-1 transition-colors duration-100 hover:text-[#e2e2e6]"
              style={{ color: S.secondary }}
            >
              {mode === "login" ? "Create your account" : "Sign in"}
              <ArrowRight size={11} />
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090b]" />}>
      <AuthPageInner />
    </Suspense>
  );
}
