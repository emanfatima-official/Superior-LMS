const {
  normalizeEmail,
  normalizeCnic,
  formatCnic,
  integer,
  booleanValue,
  createImportEngine,
  createProfileImageImporter,
} = require("../utils/importEngine");

const {
  authEmailFromCnic,
} = require("../utils/authIdentity");

// ======================================================
// NORMALIZE TEACHER ROW
// ======================================================

const normalizeRow = (
  row,
  index,
  helpers
) => {
  const active =
    booleanValue(
      row.is_active ??
        row.status,
      true
    );

  const mustChangePassword =
    booleanValue(
      row.must_change_password ??
        row.force_password_change,
      true
    );

  const cnicKey =
    normalizeCnic(
      row.cnic ??
        row.cnic_no ??
        row.cnic_number ??
        row.national_id ??
        row.username
    );

  return {
    row_number:
      integer(
        row.row_number
      ) ||
      index + 2,

    full_name:
      helpers.text(
        row.full_name ??
          row.teacher_name ??
          row.name
      ),

    email:
      normalizeEmail(
        row.email ??
          row.email_address ??
          row.teacher_email ??
          row.personal_email ??
          row.contact_email
      ) || null,

    cnic:
      formatCnic(
        cnicKey
      ),

    cnic_key:
      cnicKey,

    auth_email:
      cnicKey.length ===
      13
        ? authEmailFromCnic(
            cnicKey
          )
        : null,

    phone:
      helpers.text(
        row.phone ??
          row.mobile ??
          row.mobile_no ??
          row.mobile_number ??
          row.contact ??
          row.contact_number
      ) || null,

    department:
      helpers.text(
        row.department ??
          row.faculty_department ??
          row.department_name ??
          row.faculty ??
          row.dept
      ) || null,

    password:
      helpers.text(
        row.password ??
          row.temporary_password ??
          row.temp_password
      ) || null,

    bio:
      helpers.text(
        row.bio ??
          row.notes ??
          row.remarks
      ) || null,

    is_active:
      active.value,

    is_active_valid:
      active.valid,

    must_change_password:
      mustChangePassword.value,

    must_change_password_valid:
      mustChangePassword.valid,
  };
};

// ======================================================
// LOAD CONTEXT
// ======================================================

const loadContext =
  async ({
    checkExternal,
    helpers,
  }) => {
    const [
      profiles,
      authEmails,
    ] =
      await Promise.all([
        helpers.fetchAllRows(
          "profiles",
          `
            id,
            role,
            email,
            cnic
          `
        ),

        checkExternal
          ? helpers.loadAuthEmailSet(
              "TEACHER IMPORT"
            )
          : Promise.resolve(
              new Set()
            ),
      ]);

    return {
      profiles,
      authEmails,
    };
  };

// ======================================================
// VALIDATE ROW
// ======================================================

const validateRow = (
  row,
  {
    context,
    errors,
    warnings,
  }
) => {
  if (
    !row.full_name
  ) {
    errors.push(
      "Full name is required."
    );
  }

  if (
    row.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      row.email
    )
  ) {
    errors.push(
      "Email format is invalid."
    );
  }

  if (
    !row.cnic_key
  ) {
    errors.push(
      "CNIC is required. It is also the login username."
    );
  } else if (
    row.cnic_key.length !==
    13
  ) {
    errors.push(
      "CNIC must contain exactly 13 digits."
    );
  }

  if (
    row.password &&
    row.password.length <
      6
  ) {
    errors.push(
      "Password must contain at least 6 characters."
    );
  }

  if (
    !row.is_active_valid
  ) {
    errors.push(
      "is_active must be Yes/No, True/False, 1/0 or Active/Inactive."
    );
  }

  if (
    !row
      .must_change_password_valid
  ) {
    errors.push(
      "must_change_password must be Yes/No, True/False, 1/0 or Active/Inactive."
    );
  }

  if (
    row.auth_email &&
    context.authEmails.has(
      row.auth_email
    )
  ) {
    errors.push(
      "This CNIC already has an authentication account."
    );
  }

  if (
    !row.email
  ) {
    warnings.push(
      "Contact email is blank. Teacher can still log in using CNIC."
    );
  }

  if (
    !row.password
  ) {
    warnings.push(
      "A secure temporary password will be generated and password change will be required."
    );
  }

  if (
    !row.department
  ) {
    warnings.push(
      "Faculty department is not supplied."
    );
  }

  return {
    department:
      row.department,

    is_active:
      row.is_active,
  };
};

// ======================================================
// PUBLIC ROW
// ======================================================

const toPublicRow = (
  row
) => ({
  row_number:
    row.row_number,

  status:
    row.errors.length
      ? "invalid"
      : "valid",

  record: {
    full_name:
      row.full_name,

    email:
      row.email,

    cnic:
      row.cnic,

    phone:
      row.phone,

    department:
      row.department,

    is_active:
      row.is_active,

    must_change_password:
      row.password
        ? row
            .must_change_password
        : true,

    password_supplied:
      Boolean(
        row.password
      ),
  },

  mapping:
    row.resolved,

  errors:
    row.errors,

  warnings:
    row.warnings,
});

// ======================================================
// INVALID RESULT
// ======================================================

const toInvalidResult = (
  row,
  message
) => ({
  row_number:
    row.row_number,

  success:
    false,

  profile_id:
    null,

  full_name:
    row.full_name,

  email:
    row.email,

  cnic:
    row.cnic,

  username:
    row.cnic,

  department:
    row.department,

  temporary_password:
    null,

  message,
});

// ======================================================
// CREATE ONE TEACHER
// ======================================================

const createRow =
  async (
    row,
    {
      helpers,
    }
  ) => {
    let authUserId =
      null;

    let profileSaved =
      false;

    const password =
      row.password ||
      helpers.generateTemporaryPassword();

    try {
      // ----------------------------------------------
      // AUTH
      // ----------------------------------------------

      const {
        data:
          authData,

        error:
          authError,
      } =
        await helpers
          .supabaseAdmin
          .auth
          .admin
          .createUser({
            email:
              row.auth_email,

            password,

            email_confirm:
              true,

            user_metadata: {
              role:
                "teacher",

              full_name:
                row.full_name,

              login_cnic:
                row.cnic_key,
            },
          });

      if (
        authError
      ) {
        throw authError;
      }

      authUserId =
        authData?.user?.id;

      if (
        !authUserId
      ) {
        throw new Error(
          "Authentication account was not created."
        );
      }

      // ----------------------------------------------
      // PROFILE
      // ----------------------------------------------

      const {
        error:
          profileError,
      } =
        await helpers
          .supabaseAdmin
          .from(
            "profiles"
          )
          .insert({
            id:
              authUserId,

            full_name:
              row.full_name,

            email:
              row.email,

            role:
              "teacher",

            department:
              row.department,

            semester:
              null,

            avatar_url:
              null,

            phone:
              row.phone,

            student_id:
              null,

            cnic:
              row.cnic_key,

            bio:
              row.bio,

            department_id:
              null,

            program_id:
              null,

            batch_id:
              null,

            semester_id:
              null,

            manual_is_active:
              row.is_active,

            academic_blocked:
              false,

            is_active:
              row.is_active,

            must_change_password:
              row.password
                ? row
                    .must_change_password
                : true,

            updated_at:
              new Date()
                .toISOString(),
          });

      if (
        profileError
      ) {
        throw profileError;
      }

      profileSaved =
        true;

      return {
        row_number:
          row.row_number,

        success:
          true,

        profile_id:
          authUserId,

        full_name:
          row.full_name,

        email:
          row.email,

        cnic:
          row.cnic,

        username:
          row.cnic,

        department:
          row.department,

        temporary_password:
          password,

        message:
          "Teacher imported successfully.",
      };
    } catch (
      error
    ) {
      if (
        profileSaved &&
        authUserId
      ) {
        await helpers
          .supabaseAdmin
          .from(
            "profiles"
          )
          .delete()
          .eq(
            "id",
            authUserId
          );
      }

      if (
        authUserId
      ) {
        await helpers
          .supabaseAdmin
          .auth
          .admin
          .deleteUser(
            authUserId
          )
          .catch(
            () => {}
          );
      }

      return toInvalidResult(
        row,
        error?.message ||
          "Teacher could not be imported."
      );
    }
  };

// ======================================================
// IMPORT ENGINE
// ======================================================

const engine =
  createImportEngine({
    key:
      "teachers",

    singularLabel:
      "Teacher",

    pluralLabel:
      "Teachers",

    normalizeRow,

    loadContext,

    existingRows:
      (context) =>
        context.profiles,

    uniqueFields: [
      {
        name:
          "email",

        label:
          "Email",

        rowKey:
          (row) =>
            row.email,

        existingKey:
          (profile) =>
            normalizeEmail(
              profile.email
            ),

        existingMessage:
          (
            profile
          ) =>
            `Email already belongs to an existing ${
              profile.role ||
              "user"
            } account.`,
      },

      {
        name:
          "cnic",

        label:
          "CNIC",

        rowKey:
          (row) =>
            row.cnic_key,

        existingKey:
          (profile) =>
            normalizeCnic(
              profile.cnic
            ),
      },
    ],

    validateRow,

    toPublicRow,

    toInvalidResult,

    createRow,
  });

// ======================================================
// IMAGE IMPORT
// ======================================================

const importImages =
  createProfileImageImporter({
    role:
      "teacher",

    singularLabel:
      "Teacher",

    pluralLabel:
      "Teachers",

    identityLabel:
      "13-digit CNIC",

    matchColumn:
      "cnic",

    storageFolder:
      "avatars/teachers",
  });

module.exports = {
  ...engine,

  importImages,
};