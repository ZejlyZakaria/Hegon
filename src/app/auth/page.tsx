/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Trophy,
  Tv,
  BookOpen,
  Target,
  Brain,
} from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client"
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

// ─── types ────────────────────────────────────────────────────────────────────

type Mode = "login" | "signup";

// ─── google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
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

// ─── password input (shadcn Input + show/hide) ────────────────────────────────

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
        placeholder="Mot de passe"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={`bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600 pr-10 ${hasError ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}`}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon,
  label,
  desc,
  accent,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  accent: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className="flex items-start gap-3 p-4 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors duration-200"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
      </div>
    </motion.div>
  );
}

// ─── right panel ──────────────────────────────────────────────────────────────

function RightPanel() {
  const features = [
    {
      icon: <Trophy size={15} />,
      label: "Sport Hub",
      desc: "Football, Tennis, F1 en temps réel",
      accent: "#10b981",
      delay: 0.2,
    },
    {
      icon: <Tv size={15} />,
      label: "Watching",
      desc: "Films, séries et animes organisés",
      accent: "#8b5cf6",
      delay: 0.3,
    },
    {
      icon: <BookOpen size={15} />,
      label: "Books",
      desc: "Ta bibliothèque personnelle",
      accent: "#f97316",
      delay: 0.4,
    },
    {
      icon: <Target size={15} />,
      label: "Goals & Pro",
      desc: "Objectifs, carrière et projets tech",
      accent: "#6366f1",
      delay: 0.5,
    },
  ];

  return (
    <div className="hidden lg:flex flex-col justify-center h-full px-14 py-12 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-20 w-72 h-72 rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-3 mb-12"
      >
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <Brain size={20} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">
          Second Brain
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-10"
      >
        <h2 className="text-3xl font-bold text-white leading-tight mb-3">
          Tout ce qui compte,
          <br />
          <span className="bg-linear-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            au même endroit.
          </span>
        </h2>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
          Ton espace personnel pour suivre le sport, les films, les livres et
          tes objectifs pro — sans friction.
        </p>
      </motion.div>

      <div className="space-y-2.5 max-w-sm">
        {features.map((f) => (
          <FeatureCard key={f.label} {...f} />
        ))}
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
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

  const next = searchParams.get("next") ?? "/dashboard";
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError === "auth_failed")
      setError("Authentification échouée. Réessaie.");
    if (urlError === "missing_code") setError("Lien invalide ou expiré.");
  }, [urlError]);

  const clear = () => {
    setError("");
    setSuccess("");
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    clear();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clear();
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        setSuccess("Vérifie tes emails pour confirmer ton compte.");
      }
    } catch (err: any) {
      const map: Record<string, string> = {
        "Invalid login credentials": "Email ou mot de passe incorrect.",
        "Email not confirmed": "Confirme ton email avant de te connecter.",
        "User already registered": "Un compte existe déjà avec cet email.",
      };
      setError(map[err.message] ?? err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] lg:grid lg:grid-cols-2">
      {/* ── left — form ── */}
      <div className="flex flex-col justify-center px-8 sm:px-14 py-12 min-h-screen lg:min-h-0">
        {/* mobile logo */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-white">Second Brain</span>
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          {/* heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1.5">
              {mode === "login" ? "Bon retour 👋" : "Créer un compte"}
            </h1>
            <p className="text-sm text-zinc-500">
              {mode === "login"
                ? "Connecte-toi pour accéder à ton espace"
                : "Rejoins et commence à tout organiser"}
            </p>
          </div>

          {/* google */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full mb-6 bg-zinc-900 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 hover:border-zinc-600  transition-all duration-150"
          >
            {googleLoading ? (
              <Loader2 size={15} className="animate-spin mr-2" />
            ) : (
              <span className="mr-2">
                <GoogleIcon />
              </span>
            )}
            Continuer avec Google
          </Button>

          {/* divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800/80" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#09090b] px-3 text-[11px] text-zinc-600 uppercase tracking-widest">
                ou avec email
              </span>
            </div>
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <AnimatePresence>
              {mode === "signup" && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-zinc-400 text-xs">
                      Prénom
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Ton prénom"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="given-name"
                      className="bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-400 text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`bg-zinc-900/80 border-zinc-800 text-white placeholder:text-zinc-600 focus-visible:ring-zinc-600 ${error ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-400 text-xs">
                Mot de passe
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
                  className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10  border border-red-500/20 rounded-xl text-red-400 text-xs"
                >
                  <AlertCircle size={13} className="shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10  border border-emerald-500/20 rounded-xl text-emerald-400 text-xs"
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={loading || googleLoading || !email || !password}
              className="w-full mt-1 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-lg shadow-violet-500/20 font-semibold transition-all duration-150"
            >
              {loading && <Loader2 size={15} className="animate-spin mr-2" />}
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          {/* toggle mode */}
          <p className="text-center text-xs text-zinc-600 mt-6">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                clear();
              }}
              className="text-zinc-400 hover:text-white transition-colors font-medium"
            >
              {mode === "login" ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* ── right — presentation ── */}
      <div className="border-l border-zinc-800/40 bg-zinc-950/30">
        <RightPanel />
      </div>
    </div>
  );
}
