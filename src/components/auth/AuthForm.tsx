"use client"

import React, { useState } from "react"
import { Mail, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthMode = "signup" | "signin"

const countryCodes = [
  { code: "US", flag: "🇺🇸", dial: "+1" },
  { code: "FR", flag: "🇫🇷", dial: "+33" },
  { code: "GB", flag: "🇬🇧", dial: "+44" },
  { code: "DE", flag: "🇩🇪", dial: "+49" },
  { code: "ES", flag: "🇪🇸", dial: "+34" },
  { code: "MA", flag: "🇲🇦", dial: "+212" },
]

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("signup")
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0])
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const [error, setError] = useState<string>('')

  // Form states
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        return;
      }

      // Si signup OK, insert profile
      if (data.user) {
        const fullPhone = `${selectedCountry.dial}${phone}`;
        await supabase.from('profiles').insert({
          id: data.user.id,
          first_name: firstName,
          last_name: lastName,
          phone: fullPhone,
        });
        alert('Check ton email pour confirmer !');
        setMode('signin'); // Switch auto à signin après signup
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push('/dashboard');
    }
  }

  const handleGoogleSignIn = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) setError(error.message);
  }

  const handleAppleSignIn = async () => {
    setError('');
    // TODO: Configure Apple OAuth dans Supabase dashboard (needs Apple dev account)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) setError(error.message);
  }

  return (
    <div className="relative w-full max-w-lg">
      {/* Glassmorphism card */}
      <div className="relative rounded-3xl bg-white/8 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-white/6 p-1">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                mode === "signup"
                  ? "bg-white text-black shadow-lg"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                mode === "signin"
                  ? "bg-white text-black shadow-lg"
                  : "text-gray-400 hover:text-white"
              )}
            >
              Sign in
            </button>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white mb-6">
          {mode === "signup" ? "Create an account" : "Welcome back"}
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              {/* Name inputs */}
              <div className="flex gap-3 ">
                <input
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-fit bg-white/6 border border-white/8 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-fit bg-white/6 border border-white/8 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>

              {/* Email input */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/6 border border-white/8 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>

              {/* Phone input */}
              <div className="relative flex">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="flex items-center gap-2 bg-white/6 border border-white/8 border-r-0 rounded-l-xl px-4 py-3.5 text-white hover:bg-white/8 transition-colors"
                  >
                    <span className="text-lg">{selectedCountry.flag}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  
                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl py-2 z-10 min-w-35">
                      {countryCodes.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country)
                            setShowCountryDropdown(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-white hover:bg-white/10 transition-colors"
                        >
                          <span className="text-lg">{country.flag}</span>
                          <span className="text-sm text-gray-400">{country.dial}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="tel"
                  placeholder="(775) 351-6501"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 bg-white/6 border border-white/8 rounded-r-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {/* Pwd input */}
              <div className="relative">   
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/6 border border-white/8 rounded-xl pl-4 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>
            </>
          )}

          {mode === "signin" && (
            <>
              {/* Email input for signin */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/6 border border-white/8 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                  required
                />
              </div>

              {/* Password input */}
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/6 border border-white/8 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-white/20 transition-colors"
                required
              />
            </>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="w-full bg-white text-black font-medium py-3.5 rounded-xl hover:bg-gray-100 transition-colors mt-2"
          >
            {mode === "signup" ? "Create an account" : "Sign in"}
          </button>
        </form>

        {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-500 uppercase tracking-wider">Or sign in with</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/8 rounded-xl py-3.5 text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            </svg>
          </button>
          <button
            type="button"
            onClick={handleAppleSignIn}
            className="flex-1 flex items-center justify-center gap-2 bg-white/6 border border-white/8 rounded-xl py-3.5 text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </svg>
          </button>
        </div>

        {/* Terms */}
        <p className="text-center text-sm text-gray-500 mt-6">
          By creating an account, you agree to our{" "}
          <a href="#" className="text-gray-300 hover:text-white transition-colors">
            Terms & Service
          </a>
        </p>
      </div>
    </div>
  )
}