const path =
  require(
    "path"
  );

require(
  "dotenv"
).config({
  path:
    path.join(
      __dirname,
      "../.env"
    ),
});

const {
  supabaseAdmin,
} = require(
  "../config/supabase"
);

const {
  normalizeCnic,
  isValidCnic,
  authEmailFromCnic,
} = require(
  "../utils/authIdentity"
);

const loadAllAuthUsers =
  async () => {
    const users = [];

    let page = 1;

    const perPage =
      1000;

    while (true) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .auth
          .admin
          .listUsers({
            page,
            perPage,
          });

      if (error) {
        throw error;
      }

      const current =
        data?.users ||
        [];

      users.push(
        ...current
      );

      if (
        current.length <
        perPage
      ) {
        break;
      }

      page += 1;
    }

    return users;
  };

const run =
  async () => {
    const {
      data:
        profiles,

      error:
        profileError,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "id,full_name,role,cnic"
        )
        .in(
          "role",
          [
            "student",
            "teacher",
          ]
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          }
        );

    if (
      profileError
    ) {
      throw profileError;
    }

    const authUsers =
      await loadAllAuthUsers();

    const authMap =
      new Map(
        authUsers.map(
          (
            user
          ) => [
            String(
              user.id
            ),
            user,
          ]
        )
      );

    let migrated =
      0;

    let skipped =
      0;

    let failed =
      0;

    for (
      const profile of
        profiles || []
    ) {
      const cnic =
        normalizeCnic(
          profile.cnic
        );

      if (
        !isValidCnic(
          cnic
        )
      ) {
        skipped += 1;

        console.log(
          `[SKIP] ${profile.role} ${
            profile.full_name ||
            profile.id
          }: valid 13-digit CNIC is missing.`
        );

        continue;
      }

      const authUser =
        authMap.get(
          String(
            profile.id
          )
        );

      if (!authUser) {
        failed += 1;

        console.log(
          `[FAIL] ${profile.role} ${
            profile.full_name ||
            profile.id
          }: Auth user not found.`
        );

        continue;
      }

      const targetEmail =
        authEmailFromCnic(
          cnic
        );

      if (
        String(
          authUser.email ||
            ""
        ).toLowerCase() ===
        targetEmail
      ) {
        skipped += 1;

        console.log(
          `[OK] ${profile.role} ${
            profile.full_name ||
            profile.id
          }: already migrated.`
        );

        continue;
      }

      const {
        error,
      } =
        await supabaseAdmin
          .auth
          .admin
          .updateUserById(
            profile.id,
            {
              email:
                targetEmail,

              email_confirm:
                true,

              user_metadata:
                {
                  ...(
                    authUser.user_metadata ||
                    {}
                  ),

                  role:
                    profile.role,

                  full_name:
                    profile.full_name ||
                    authUser
                      .user_metadata
                      ?.full_name ||
                    null,

                  login_cnic:
                    cnic,
                },
            }
          );

      if (error) {
        failed += 1;

        console.log(
          `[FAIL] ${profile.role} ${
            profile.full_name ||
            profile.id
          }: ${
            error.message
          }`
        );

        continue;
      }

      migrated += 1;

      console.log(
        `[MIGRATED] ${profile.role} ${
          profile.full_name ||
          profile.id
        } -> ${cnic}`
      );
    }

    console.log(
      "\nMigration summary"
    );

    console.log(
      `Migrated: ${migrated}`
    );

    console.log(
      `Skipped:  ${skipped}`
    );

    console.log(
      `Failed:   ${failed}`
    );

    if (
      failed > 0
    ) {
      process.exitCode =
        1;
    }
  };

run().catch(
  (
    error
  ) => {
    console.error(
      "AUTH IDENTITY MIGRATION ERROR:",
      error
    );

    process.exitCode =
      1;
  }
);