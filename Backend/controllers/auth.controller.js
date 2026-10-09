const {
  supabaseAuth,
  supabaseAdmin,
} = require(
  "../config/supabase"
);

const adminModel =
  require(
    "../models/admin.model"
  );

const {
  createActivityLog,
} = require(
  "../models/activityLog.model"
);

const {
  normalizeCnic,
  isValidCnic,
  authEmailFromCnic,
} = require(
  "../utils/authIdentity"
);

// ======================================================
// ADMIN SIGNUP
// ======================================================

const signup =
  async (
    req,
    res
  ) => {
    let createdAuthUserId =
      null;

    try {
      const {
        full_name,
        email,
        password,
      } =
        req.body;

      if (
        !full_name?.trim() ||
        !email?.trim() ||
        !password
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "Full name, email and password are required",
          });
      }

      if (
        password.length <
        6
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "Password must be at least 6 characters",
          });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const existingAdmin =
        await adminModel
          .findAdminByEmail(
            normalizedEmail
          );

      if (
        existingAdmin
      ) {
        return res
          .status(
            409
          )
          .json({
            success:
              false,

            message:
              "Admin already exists",
          });
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .auth
          .admin
          .createUser({
            email:
              normalizedEmail,

            password,

            email_confirm:
              true,
          });

      if (
        error
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      createdAuthUserId =
        data
          .user
          .id;

      const admin =
        await adminModel
          .createAdmin(
            {
              id:
                data
                  .user
                  .id,

              full_name:
                full_name
                  .trim(),

              email:
                normalizedEmail,
            }
          );

      await createActivityLog(
        {
          actor_id:
            data
              .user
              .id,

          actor_role:
            "admin",

          action:
            "signup",

          module:
            "auth",

          target_type:
            "admin",

          target_id:
            data
              .user
              .id,

          target_label:
            full_name
              .trim(),

          new_values: {
            email:
              normalizedEmail,

            full_name:
              full_name
                .trim(),
          },
        }
      );

      return res
        .status(
          201
        )
        .json({
          success:
            true,

          message:
            "Admin signup successful",

          data:
            admin,
        });
    } catch (
      error
    ) {
      console.error(
        "SIGNUP ERROR:",
        error
      );

      if (
        createdAuthUserId
      ) {
        await supabaseAdmin
          .auth
          .admin
          .deleteUser(
            createdAuthUserId
          )
          .catch(
            () => {}
          );
      }

      return res
        .status(
          500
        )
        .json({
          success:
            false,

          message:
            "Internal server error",
        });
    }
  };

// ======================================================
// ADMIN LOGIN
// ======================================================

const login =
  async (
    req,
    res
  ) => {
    try {
      const {
        email,
        password,
      } =
        req.body;

      if (
        !email ||
        !password
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "Email and password are required",
          });
      }

      const normalizedEmail =
        String(
          email
        )
          .trim()
          .toLowerCase();

      const {
        data,
        error,
      } =
        await supabaseAuth
          .auth
          .signInWithPassword(
            {
              email:
                normalizedEmail,

              password,
            }
          );

      if (
        error
      ) {
        return res
          .status(
            401
          )
          .json({
            success:
              false,

            message:
              "Invalid email or password",
          });
      }

      const admin =
        await adminModel
          .findAdminByEmail(
            normalizedEmail
          );

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
              "Admin profile not found",
          });
      }

      await createActivityLog(
        {
          actor_id:
            data
              .user
              .id,

          actor_role:
            "admin",

          action:
            "login",

          module:
            "auth",

          target_type:
            "admin",

          target_id:
            data
              .user
              .id,

          target_label:
            admin
              .full_name ||
            admin
              .email,

          new_values: {
            email:
              admin
                .email,
          },
        }
      );

      return res
        .status(
          200
        )
        .json({
          success:
            true,

          message:
            "Admin login successful",

          data: {
            user:
              data
                .user,

            session:
              data
                .session,

            admin,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "LOGIN ERROR:",
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
            "Internal server error",
        });
    }
  };

// ======================================================
// STUDENT / TEACHER LOGIN
// ======================================================

const userLogin =
  async (
    req,
    res
  ) => {
    try {
      const {
        cnic,
        password,
      } =
        req.body;

      // --------------------------------------------------
      // REQUIRED FIELDS
      // --------------------------------------------------

      if (
        !cnic ||
        !password
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "CNIC and password are required",
          });
      }

      // --------------------------------------------------
      // NORMALIZE CNIC
      // --------------------------------------------------

      const normalizedCnic =
        normalizeCnic(
          cnic
        );

      if (
        !isValidCnic(
          normalizedCnic
        )
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "CNIC must contain exactly 13 digits",
          });
      }

      // --------------------------------------------------
      // FIND PROFILE
      // --------------------------------------------------

      const {
        data:
          profile,

        error:
          profileError,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .select(
            "*"
          )
          .eq(
            "cnic",
            normalizedCnic
          )
          .in(
            "role",
            [
              "student",
              "teacher",
            ]
          )
          .maybeSingle();

      if (
        profileError
      ) {
        throw profileError;
      }

      if (
        !profile
      ) {
        return res
          .status(
            401
          )
          .json({
            success:
              false,

            message:
              "Invalid CNIC or password",
          });
      }

      // --------------------------------------------------
      // ACTIVE STATUS
      // --------------------------------------------------

      if (
        profile
          .is_active ===
        false
      ) {
        return res
          .status(
            403
          )
          .json({
            success:
              false,

            message:
              "Your account is inactive",
          });
      }

      // --------------------------------------------------
      // INTERNAL AUTH EMAIL
      // --------------------------------------------------

      const authEmail =
        authEmailFromCnic(
          normalizedCnic
        );

      if (
        !authEmail
      ) {
        return res
          .status(
            400
          )
          .json({
            success:
              false,

            message:
              "Invalid CNIC",
          });
      }

      // --------------------------------------------------
      // SIGN IN
      // --------------------------------------------------

      const {
        data,
        error,
      } =
        await supabaseAuth
          .auth
          .signInWithPassword(
            {
              email:
                authEmail,

              password,
            }
          );

      if (
        error
      ) {
        return res
          .status(
            401
          )
          .json({
            success:
              false,

            message:
              "Invalid CNIC or password",
          });
      }

      // ==================================================
      // SECURITY CHECK
      // ==================================================
      //
      // The authenticated Supabase user must be the same
      // UUID as the profile being logged in.
      //
      // This prevents any wrong profile/user association.
      // ==================================================

      if (
        !data?.user?.id ||
        data.user.id !==
          profile.id
      ) {
        console.error(
          "AUTH PROFILE UUID MISMATCH:",
          {
            profile_id:
              profile.id,

            auth_user_id:
              data
                ?.user
                ?.id ||
              null,

            role:
              profile.role,
          }
        );

        try {
          await supabaseAuth
            .auth
            .signOut();
        } catch (
          signOutError
        ) {
          // Ignore signout cleanup errors.
        }

        return res
          .status(
            401
          )
          .json({
            success:
              false,

            message:
              "Authentication account does not match this profile",
          });
      }

      // ==================================================
      // LAST LOGIN
      // ==================================================
      //
      // Exact current LMS login request time.
      //
      // We intentionally do NOT copy an older
      // data.user.last_sign_in_at into profiles.
      // ==================================================

      const loginAt =
        new Date()
          .toISOString();

      const {
        data:
          updatedProfile,

        error:
          loginUpdateError,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .update({
            last_login_at:
              loginAt,
          })
          .eq(
            "id",
            profile.id
          )
          .select(
            "*"
          )
          .maybeSingle();

      if (
        loginUpdateError
      ) {
        console.warn(
          "LAST LOGIN PROFILE UPDATE ERROR:",
          loginUpdateError
            .message
        );
      }

      // --------------------------------------------------
      // RESPONSE
      // --------------------------------------------------

      return res
        .status(
          200
        )
        .json({
          success:
            true,

          message:
            "Login successful",

          data: {
            user:
              data
                .user,

            session:
              data
                .session,

            profile:
              updatedProfile ||
              {
                ...profile,

                last_login_at:
                  loginAt,
              },
          },
        });
    } catch (
      error
    ) {
      console.error(
        "USER LOGIN ERROR:",
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
            "Internal server error",
        });
    }
  };

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  signup,
  login,
  userLogin,
};