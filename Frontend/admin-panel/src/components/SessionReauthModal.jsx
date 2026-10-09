import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";

import {
  Alert,
} from "./FormField";

function SessionReauthModal({
  open,
  admin,
  loading,
  error,
  onSubmit,
  onSignOut,
}) {
  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(false);

  const inputRef =
    useRef(null);

  useEffect(
    () => {
      if (
        !open
      ) {
        setPassword("");
        setShowPassword(false);
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            inputRef
              .current
              ?.focus();
          },
          50
        );

      return () =>
        window.clearTimeout(
          timer
        );
    },
    [open]
  );

  if (
    !open
  ) {
    return null;
  }

  const handleSubmit =
    async (
      event
    ) => {
      event
        .preventDefault();

      if (
        !password ||
        loading
      ) {
        return;
      }

      const success =
        await onSubmit(
          password
        );

      if (
        success
      ) {
        setPassword("");
      }
    };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-reauth-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <ShieldAlert
              size={24}
            />
          </div>

          <div className="min-w-0">
            <h2
              id="session-reauth-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Session expired
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Sign in again to continue. Your current page and unsaved form data will stay open.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Admin account
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {admin?.email ||
              "Current admin"}
          </p>
        </div>

        <div className="mt-5">
          <Alert
            message={error}
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>

            <div className="relative">
              <LockKeyhole
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                ref={inputRef}
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(
                  event
                ) =>
                  setPassword(
                    event
                      .target
                      .value
                  )
                }
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (
                      current
                    ) =>
                      !current
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword
                  ? (
                    <EyeOff
                      size={18}
                    />
                  )
                  : (
                    <Eye
                      size={18}
                    />
                  )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !password
            }
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <Loader2
                size={17}
                className="animate-spin"
              />
            )}

            {loading
              ? "Signing in..."
              : "Continue working"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onSignOut}
            className="h-10 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}

export default SessionReauthModal;
