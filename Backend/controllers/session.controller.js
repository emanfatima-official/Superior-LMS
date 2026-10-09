const {
  createClient,
} = require(
  "@supabase/supabase-js"
);

const {
  supabaseAdmin,
} = require(
  "../config/supabase"
);

// ======================================================
// ISOLATED PUBLIC AUTH CLIENT
// ======================================================
//
// Refresh requests use a fresh client instance so session
// state is never shared between concurrent backend users.
// ======================================================

const createPublicAuthClient =
  () =>
    createClient(
      process.env
        .SUPABASE_URL,

      process.env
        .SUPABASE_PUBLISHABLE_KEY,

      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },
      }
    );

// ======================================================
// REFRESH ADMIN SESSION
// ======================================================

const refreshAdminSession =
  async (
    req,
    res
  ) => {
    try {
      const refreshToken =
        String(
          req.body
            ?.refresh_token ||
            ""
        ).trim();

      if (
        !refreshToken
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "Refresh token is required",
          });
      }

      const authClient =
        createPublicAuthClient();

      const {
        data,
        error,
      } =
        await authClient
          .auth
          .refreshSession({
            refresh_token:
              refreshToken,
          });

      if (
        error ||
        !data
          ?.session ||
        !data
          ?.user
      ) {
        return res
          .status(
            401
          )
          .json({
            success:
              false,

            message:
              "Session has expired. Please sign in again.",
          });
      }

      // --------------------------------------------------
      // The refreshed Supabase account must still be an
      // LMS admin before the new session is returned.
      // --------------------------------------------------

      const {
        data:
          admin,

        error:
          adminError,
      } =
        await supabaseAdmin
          .from(
            "admins"
          )
          .select(
            "*"
          )
          .eq(
            "id",
            data.user.id
          )
          .maybeSingle();

      if (
        adminError
      ) {
        throw adminError;
      }

      if (
        !admin
      ) {
        return res
          .status(
            403
          )
          .json({
            success:
              false,

            message:
              "Access denied. Admin account required",
          });
      }

      return res
        .status(
          200
        )
        .json({
          success:
            true,

          message:
            "Session refreshed successfully",

          data: {
            session:
              data.session,

            user:
              data.user,

            admin,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "REFRESH ADMIN SESSION ERROR:",
        error
      );

      return res
        .status(
          500
        )
        .json({
          success:
            false,

          message:
            "Unable to refresh session",
        });
    }
  };

module.exports = {
  refreshAdminSession,
};
