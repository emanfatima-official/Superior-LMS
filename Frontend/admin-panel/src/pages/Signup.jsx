import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Moon,
  Sun,
  UserPlus,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import branding from "../config/branding";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Alert } from "../components/FormField";

function Signup() {
  const { darkMode, toggleTheme } = useTheme();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await signup({ full_name: fullName, email, password });
      setSuccess(true);

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.message || "Could not create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 transition-colors dark:bg-slate-950">
      {/* Theme button */}
      <button
        onClick={toggleTheme}
        className="absolute right-6 top-6 z-20 rounded-xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left branding */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 lg:flex">
          <div className="animate-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="animate-blob animation-delay-2000 absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/10" />
          <div className="animate-blob animation-delay-4000 absolute left-1/3 top-1/2 h-56 w-56 rounded-full bg-white/5" />

          <div className="relative z-10 flex w-full flex-col items-center justify-center px-12 text-center text-white">
            <div className="animate-fade-in-up mb-8 rounded-3xl bg-white/10 p-5 backdrop-blur">
              <img src={branding.logo} alt={branding.universityName} className="h-28 w-28 object-contain" />
            </div>

            <h1 className="animate-fade-in-up text-4xl font-bold tracking-tight" style={{ animationDelay: "0.1s" }}>
              {branding.shortName}
            </h1>

            <p className="animate-fade-in-up mt-3 text-lg text-blue-100" style={{ animationDelay: "0.15s" }}>
              {branding.lmsName}
            </p>

            <p className="animate-fade-in-up mt-10 max-w-md text-sm leading-7 text-blue-100" style={{ animationDelay: "0.2s" }}>
              Create your administrator account and manage
              teachers, students, courses and enrollments
              from one centralized administration panel.
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="animate-fade-in-up mb-8 flex flex-col items-center lg:hidden">
              <img src={branding.logo} alt={branding.universityName} className="h-20 w-20 object-contain" />

              <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                {branding.shortName}
              </h1>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {branding.panelName}
              </p>
            </div>

            {success ? (
              <div className="animate-fade-in-up flex flex-col items-center rounded-2xl border border-green-200 bg-green-50 px-6 py-10 text-center dark:border-green-500/20 dark:bg-green-500/10">
                <CheckCircle2 size={44} className="text-green-500" />
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                  Account created!
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Redirecting you to sign in...
                </p>
              </div>
            ) : (
              <>
                {/* Heading */}
                <div className="animate-fade-in-up mb-8">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                    Create Account ✨
                  </h2>

                  <p className="mt-2 text-slate-500 dark:text-slate-400">
                    Create your administrator account to get started.
                  </p>
                </div>

                <Alert message={error} />

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Full Name */}
                  <div className="animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Full name
                    </label>

                    <div className="relative">
                      <User size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Muhammad Usman"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email address
                    </label>

                    <div className="relative">
                      <Mail size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={branding.adminEmailPlaceholder}
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </label>

                    <div className="relative">
                      <Lock size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Confirm password
                    </label>

                    <div className="relative">
                      <Lock size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        required
                        className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-600"
                      />

                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>
                  </div>

                  {/* Signup button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="animate-fade-in-up flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ animationDelay: "0.25s" }}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Create Account
                      </>
                    )}
                  </button>
                </form>

                {/* Login link */}
                <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    Sign in
                  </Link>
                </p>

                <p className="mt-8 text-center text-xs text-slate-400">
                  © 2026 {branding.copyrightName}. All rights reserved.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
