import axios from "axios";

// ======================================================
// API BASE URL
// ======================================================

const API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL ||
  "http://https://superior-lms-ten.vercel.app/api";

// ======================================================
// STORAGE KEYS
// ======================================================

export const AUTH_STORAGE = {
  accessToken:
    "campusz_token",

  refreshToken:
    "campusz_refresh_token",

  admin:
    "campusz_admin",
};

// ======================================================
// AUTH EVENTS
// ======================================================

export const AUTH_EVENTS = {
  sessionUpdated:
    "campusz:session-updated",

  reauthRequired:
    "campusz:reauth-required",

  reauthSucceeded:
    "campusz:reauth-succeeded",

  reauthCancelled:
    "campusz:reauth-cancelled",
};

// ======================================================
// MAIN API CLIENT
// ======================================================

const axiosClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    headers: {
      "Content-Type":
        "application/json",
    },
  });

// ======================================================
// REFRESH CLIENT
// ======================================================
//
// This client intentionally has no auth interceptors.
// Otherwise /auth/refresh returning 401 could recursively
// trigger another refresh attempt forever.
// ======================================================

const refreshClient =
  axios.create({
    baseURL:
      API_BASE_URL,

    headers: {
      "Content-Type":
        "application/json",
    },
  });

let refreshPromise =
  null;

let reauthPromise =
  null;

// ======================================================
// HELPERS
// ======================================================

const isAuthEndpoint =
  (
    url = ""
  ) => {
    const value =
      String(
        url ||
          ""
      );

    return (
      value.includes(
        "/auth/login"
      ) ||
      value.includes(
        "/auth/signup"
      ) ||
      value.includes(
        "/auth/refresh"
      )
    );
  };

const saveSession =
  (
    session
  ) => {
    const accessToken =
      session
        ?.access_token;

    const refreshToken =
      session
        ?.refresh_token;

    if (
      !accessToken
    ) {
      throw new Error(
        "Session does not contain an access token"
      );
    }

    localStorage
      .setItem(
        AUTH_STORAGE
          .accessToken,
        accessToken
      );

    // Supabase can rotate refresh tokens, so always save
    // the newest value returned by refreshSession().
    if (
      refreshToken
    ) {
      localStorage
        .setItem(
          AUTH_STORAGE
            .refreshToken,
          refreshToken
        );
    }

    window
      .dispatchEvent(
        new CustomEvent(
          AUTH_EVENTS
            .sessionUpdated,
          {
            detail: {
              access_token:
                accessToken,

              refresh_token:
                refreshToken ||
                localStorage
                  .getItem(
                    AUTH_STORAGE
                      .refreshToken
                  ),
            },
          }
        )
      );

    return accessToken;
  };

const normalizeAxiosError =
  (
    error,
    fallbackMessage =
      "Something went wrong. Please try again."
  ) => ({
    message:
      error
        ?.response
        ?.data
        ?.message ||
      error
        ?.message ||
      fallbackMessage,

    status:
      error
        ?.response
        ?.status ||
      error
        ?.status ||
      null,

    original:
      error,
  });

// ======================================================
// REFRESH ACCESS TOKEN
// ======================================================

const performRefresh =
  async () => {
    const refreshToken =
      localStorage
        .getItem(
          AUTH_STORAGE
            .refreshToken
        );

    if (
      !refreshToken
    ) {
      const error =
        new Error(
          "No refresh token is available"
        );

      error.status =
        401;

      throw error;
    }

    const response =
      await refreshClient
        .post(
          "/auth/refresh",
          {
            refresh_token:
              refreshToken,
          }
        );

    const session =
      response
        ?.data
        ?.data
        ?.session;

    if (
      !session
        ?.access_token
    ) {
      const error =
        new Error(
          "Invalid refresh response"
        );

      error.status =
        401;

      throw error;
    }

    return saveSession(
      session
    );
  };

const getFreshAccessToken =
  async () => {
    // If several requests fail at the same time, only one
    // refresh request is sent. All callers await it.
    if (
      !refreshPromise
    ) {
      refreshPromise =
        performRefresh()
          .finally(
            () => {
              refreshPromise =
                null;
            }
          );
    }

    return refreshPromise;
  };

// ======================================================
// RE-AUTHENTICATION WITHOUT LEAVING THE PAGE
// ======================================================
//
// If the refresh token is no longer usable, the current
// React tree stays mounted. AuthContext shows a password
// modal above the existing screen. This preserves open
// modals and unsaved form state.
// ======================================================

const waitForReauthentication =
  () => {
    if (
      reauthPromise
    ) {
      return reauthPromise;
    }

    reauthPromise =
      new Promise(
        (
          resolve,
          reject
        ) => {
          const cleanup =
            () => {
              window
                .removeEventListener(
                  AUTH_EVENTS
                    .reauthSucceeded,
                  handleSuccess
                );

              window
                .removeEventListener(
                  AUTH_EVENTS
                    .reauthCancelled,
                  handleCancel
                );
            };

          const handleSuccess =
            (
              event
            ) => {
              cleanup();

              const accessToken =
                event
                  ?.detail
                  ?.access_token ||
                localStorage
                  .getItem(
                    AUTH_STORAGE
                      .accessToken
                  );

              if (
                !accessToken
              ) {
                reject(
                  new Error(
                    "Re-authentication did not return an access token"
                  )
                );

                return;
              }

              resolve(
                accessToken
              );
            };

          const handleCancel =
            () => {
              cleanup();

              const error =
                new Error(
                  "Session ended"
                );

              error.status =
                401;

              reject(
                error
              );
            };

          window
            .addEventListener(
              AUTH_EVENTS
                .reauthSucceeded,
              handleSuccess
            );

          window
            .addEventListener(
              AUTH_EVENTS
                .reauthCancelled,
              handleCancel
            );

          window
            .dispatchEvent(
              new CustomEvent(
                AUTH_EVENTS
                  .reauthRequired
              )
            );
        }
      )
        .finally(
          () => {
            reauthPromise =
              null;
          }
        );

    return reauthPromise;
  };

// ======================================================
// REQUEST INTERCEPTOR
// ======================================================

axiosClient
  .interceptors
  .request
  .use(
    (
      config
    ) => {
      const token =
        localStorage
          .getItem(
            AUTH_STORAGE
              .accessToken
          );

      config.headers =
        config.headers ||
        {};

      if (
        token
      ) {
        config.headers
          .Authorization =
          `Bearer ${token}`;
      }

      const clientTimezone =
        Intl
          .DateTimeFormat()
          .resolvedOptions()
          .timeZone;

      if (
        clientTimezone
      ) {
        config.headers[
          "x-client-timezone"
        ] =
          clientTimezone;
      }

      return config;
    }
  );

// ======================================================
// RESPONSE INTERCEPTOR
// ======================================================

axiosClient
  .interceptors
  .response
  .use(
    (
      response
    ) =>
      response.data,

    async (
      error
    ) => {
      const status =
        error
          .response
          ?.status;

      const originalRequest =
        error
          .config;

      // --------------------------------------------------
      // Protected API returned 401.
      // --------------------------------------------------

      if (
        status === 401 &&
        originalRequest &&
        !originalRequest
          ._campuszAuthRetried &&
        !isAuthEndpoint(
          originalRequest
            .url
        )
      ) {
        originalRequest
          ._campuszAuthRetried =
          true;

        try {
          // ==============================================
          // LEVEL 1: AUTO REFRESH
          // ==============================================

          const newAccessToken =
            await getFreshAccessToken();

          originalRequest
            .headers =
            originalRequest
              .headers ||
            {};

          originalRequest
            .headers
            .Authorization =
            `Bearer ${newAccessToken}`;

          return axiosClient(
            originalRequest
          );
        } catch (
          refreshError
        ) {
          const refreshStatus =
            refreshError
              ?.response
              ?.status ||
            refreshError
              ?.status ||
            null;

          // ============================================
          // LEVEL 2: REFRESH TOKEN EXPIRED / INVALID
          // ============================================
          //
          // Do NOT clear auth and do NOT redirect here.
          // Keeping the route mounted preserves all current
          // React form/modal state while admin signs in again.
          // ============================================

          if (
            refreshStatus ===
              401 ||
            refreshStatus ===
              403
          ) {
            try {
              const reauthenticatedToken =
                await waitForReauthentication();

              originalRequest
                .headers =
                originalRequest
                  .headers ||
                {};

              originalRequest
                .headers
                .Authorization =
                `Bearer ${reauthenticatedToken}`;

              return axiosClient(
                originalRequest
              );
            } catch (
              reauthError
            ) {
              return Promise
                .reject(
                  normalizeAxiosError(
                    reauthError,
                    "Your session has ended."
                  )
                );
            }
          }

          // Network/server failure while refreshing should
          // not log the admin out or destroy form state.
          return Promise
            .reject(
              normalizeAxiosError(
                refreshError,
                "Unable to refresh the session. Please try again."
              )
            );
        }
      }

      return Promise
        .reject(
          normalizeAxiosError(
            error
          )
        );
    }
  );

export default axiosClient;
