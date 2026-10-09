import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  loginAdmin,
  signupAdmin,
} from "../services/authService";

import {
  AUTH_EVENTS,
  AUTH_STORAGE,
} from "../api/axiosClient";

import SessionReauthModal from "../components/SessionReauthModal";

const AuthContext =
  createContext();

// ======================================================
// SAFE ADMIN READ
// ======================================================

const readStoredAdmin =
  () => {
    try {
      const saved =
        localStorage
          .getItem(
            AUTH_STORAGE
              .admin
          );

      return saved
        ? JSON.parse(
            saved
          )
        : null;
    } catch {
      localStorage
        .removeItem(
          AUTH_STORAGE
            .admin
        );

      return null;
    }
  };

// ======================================================
// AUTH PROVIDER
// ======================================================

export function AuthProvider({
  children,
}) {
  const [
    admin,
    setAdmin,
  ] =
    useState(
      readStoredAdmin
    );

  const [
    token,
    setToken,
  ] =
    useState(
      () =>
        localStorage
          .getItem(
            AUTH_STORAGE
              .accessToken
          )
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    reauthOpen,
    setReauthOpen,
  ] =
    useState(false);

  const [
    reauthLoading,
    setReauthLoading,
  ] =
    useState(false);

  const [
    reauthError,
    setReauthError,
  ] =
    useState("");

  // ====================================================
  // STORAGE SYNC
  // ====================================================

  useEffect(
    () => {
      if (
        token
      ) {
        localStorage
          .setItem(
            AUTH_STORAGE
              .accessToken,
            token
          );
      } else {
        localStorage
          .removeItem(
            AUTH_STORAGE
              .accessToken
          );
      }
    },
    [token]
  );

  useEffect(
    () => {
      if (
        admin
      ) {
        localStorage
          .setItem(
            AUTH_STORAGE
              .admin,
            JSON.stringify(
              admin
            )
          );
      } else {
        localStorage
          .removeItem(
            AUTH_STORAGE
              .admin
          );
      }
    },
    [admin]
  );

  // ====================================================
  // CENTRAL AUTH EVENTS
  // ====================================================

  useEffect(
    () => {
      const handleSessionUpdated =
        (
          event
        ) => {
          const freshToken =
            event
              ?.detail
              ?.access_token ||
            localStorage
              .getItem(
                AUTH_STORAGE
                  .accessToken
              );

          if (
            freshToken
          ) {
            setToken(
              freshToken
            );
          }
        };

      const handleReauthRequired =
        () => {
          setReauthError("");
          setReauthOpen(true);
        };

      window
        .addEventListener(
          AUTH_EVENTS
            .sessionUpdated,
          handleSessionUpdated
        );

      window
        .addEventListener(
          AUTH_EVENTS
            .reauthRequired,
          handleReauthRequired
        );

      return () => {
        window
          .removeEventListener(
            AUTH_EVENTS
              .sessionUpdated,
            handleSessionUpdated
          );

        window
          .removeEventListener(
            AUTH_EVENTS
              .reauthRequired,
            handleReauthRequired
          );
      };
    },
    []
  );

  // ====================================================
  // APPLY LOGIN SESSION
  // ====================================================

  const applyLoginSession =
    (
      session,
      adminProfile
    ) => {
      const accessToken =
        session
          ?.access_token;

      const refreshToken =
        session
          ?.refresh_token;

      if (
        !accessToken ||
        !refreshToken
      ) {
        throw new Error(
          "Login succeeded but the server did not return a complete session."
        );
      }

      localStorage
        .setItem(
          AUTH_STORAGE
            .accessToken,
          accessToken
        );

      localStorage
        .setItem(
          AUTH_STORAGE
            .refreshToken,
          refreshToken
        );

      if (
        adminProfile
      ) {
        localStorage
          .setItem(
            AUTH_STORAGE
              .admin,
            JSON.stringify(
              adminProfile
            )
          );
      }

      setToken(
        accessToken
      );

      setAdmin(
        adminProfile ||
          null
      );

      return accessToken;
    };

  // ====================================================
  // NORMAL LOGIN
  // ====================================================

  const login =
    async ({
      email,
      password,
    }) => {
      setLoading(
        true
      );

      try {
        const res =
          await loginAdmin({
            email,
            password,
          });

        const {
          session,
          admin:
            adminProfile,
        } =
          res.data ||
          {};

        applyLoginSession(
          session,
          adminProfile
        );

        return res;
      } finally {
        setLoading(
          false
        );
      }
    };

  // ====================================================
  // SIGNUP
  // ====================================================

  const signup =
    async ({
      full_name,
      email,
      password,
    }) => {
      setLoading(
        true
      );

      try {
        const response =
          await signupAdmin({
            full_name,
            email,
            password,
          });

        return response
          .data;
      } finally {
        setLoading(
          false
        );
      }
    };

  // ====================================================
  // RE-AUTHENTICATE IN PLACE
  // ====================================================
  //
  // This is intentionally not a navigation to /login.
  // Keeping the current route mounted preserves open
  // modals and unsaved React form state.
  // ====================================================

  const reauthenticate =
    async (
      password
    ) => {
      const email =
        admin
          ?.email;

      if (
        !email
      ) {
        setReauthError(
          "Admin email is unavailable. Sign out and log in again."
        );

        return false;
      }

      setReauthLoading(
        true
      );

      setReauthError("");

      try {
        const res =
          await loginAdmin({
            email,
            password,
          });

        const {
          session,
          admin:
            adminProfile,
        } =
          res.data ||
          {};

        const accessToken =
          applyLoginSession(
            session,
            adminProfile
          );

        setReauthOpen(
          false
        );

        window
          .dispatchEvent(
            new CustomEvent(
              AUTH_EVENTS
                .reauthSucceeded,
              {
                detail: {
                  access_token:
                    accessToken,
                },
              }
            )
          );

        return true;
      } catch (
        error
      ) {
        setReauthError(
          error
            ?.message ||
            "Invalid password. Please try again."
        );

        return false;
      } finally {
        setReauthLoading(
          false
        );
      }
    };

  // ====================================================
  // LOGOUT
  // ====================================================

  const logout =
    () => {
      localStorage
        .removeItem(
          AUTH_STORAGE
            .accessToken
        );

      localStorage
        .removeItem(
          AUTH_STORAGE
            .refreshToken
        );

      localStorage
        .removeItem(
          AUTH_STORAGE
            .admin
        );

      setToken(
        null
      );

      setAdmin(
        null
      );

      setReauthOpen(
        false
      );

      setReauthError("");

      window
        .dispatchEvent(
          new CustomEvent(
            AUTH_EVENTS
              .reauthCancelled
          )
        );
    };

  // ====================================================
  // CONTEXT VALUE
  // ====================================================

  const value =
    useMemo(
      () => ({
        admin,
        token,

        isAuthenticated:
          Boolean(
            token
          ),

        loading,
        login,
        signup,
        logout,
      }),
      [
        admin,
        token,
        loading,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}

      <SessionReauthModal
        open={reauthOpen}
        admin={admin}
        loading={reauthLoading}
        error={reauthError}
        onSubmit={reauthenticate}
        onSignOut={logout}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(
    AuthContext
  );
}
