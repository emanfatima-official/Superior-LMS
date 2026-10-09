const {
  supabaseAdmin,
} = require("../config/supabase");

const teacherModel =
  require("../models/teacher.model");

const {
  sendCredentialsEmail,
} = require("../services/email.service");

const {
  normalizeCnic,
  isValidCnic,
  authEmailFromCnic,
} = require("../utils/authIdentity");

// ======================================================
// CREATE TEACHER
// ======================================================

const createTeacher =
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

        phone,
        cnic,
        avatar_url,
        bio,
        department,

        is_active,
        must_change_password,
      } = req.body;

      // ==================================================
      // VALIDATION
      // ==================================================

      if (
        !full_name?.trim() ||
        !cnic?.trim() ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Full name, CNIC and password are required",
          });
      }

      if (
        password.length <
        6
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Password must be at least 6 characters",
          });
      }

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
          .status(400)
          .json({
            success: false,

            message:
              "CNIC must contain exactly 13 digits",
          });
      }

      const normalizedEmail =
        email?.trim()
          ? email
              .trim()
              .toLowerCase()
          : null;

      const authEmail =
        authEmailFromCnic(
          normalizedCnic
        );

      // ==================================================
      // OPTIONAL CONTACT EMAIL
      // ==================================================

      if (
        normalizedEmail
      ) {
        const existingTeacher =
          await teacherModel.findTeacherByEmail(
            normalizedEmail
          );

        if (
          existingTeacher
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "A teacher with this email already exists",
            });
        }
      }

      // ==================================================
      // DUPLICATE CNIC / USERNAME
      // ==================================================

      const {
        data:
          existingCnic,

        error:
          cnicError,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .select(
            "id, role"
          )
          .eq(
            "cnic",
            normalizedCnic
          )
          .maybeSingle();

      if (
        cnicError
      ) {
        throw cnicError;
      }

      if (
        existingCnic
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "This CNIC is already being used as a login username",
          });
      }

      // ==================================================
      // CREATE AUTH USER
      // ==================================================

      const {
        data:
          authData,

        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .createUser({
            email:
              authEmail,

            password,

            email_confirm:
              true,

            user_metadata: {
              role:
                "teacher",

              full_name:
                full_name.trim(),

              login_cnic:
                normalizedCnic,
            },
          });

      if (
        authError
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              authError.message,
          });
      }

      createdAuthUserId =
        authData.user.id;

      // ==================================================
      // CREATE PROFILE
      // ==================================================

      const teacher =
        await teacherModel.createTeacher({
          id:
            createdAuthUserId,

          full_name:
            full_name.trim(),

          email:
            normalizedEmail,

          role:
            "teacher",

          department:
            department?.trim() ||
            null,

          phone:
            phone?.trim() ||
            null,

          cnic:
            normalizedCnic,

          avatar_url:
            avatar_url ||
            null,

          bio:
            bio?.trim() ||
            null,

          is_active:
            is_active ===
            undefined
              ? true
              : Boolean(
                  is_active
                ),

          must_change_password:
            must_change_password ===
            undefined
              ? true
              : Boolean(
                  must_change_password
                ),
        });

      // ==================================================
      // OPTIONAL CREDENTIAL EMAIL
      // ==================================================

      let credentialEmail = {
        sent: false,

        reason:
          normalizedEmail
            ? "Credential email was not attempted."
            : "Teacher email was not provided.",
      };

      if (
        normalizedEmail
      ) {
        try {
          credentialEmail =
            await sendCredentialsEmail({
              to:
                normalizedEmail,

              fullName:
                full_name.trim(),

              role:
                "teacher",

              password,

              username:
                normalizedCnic,

              mustChangePassword:
                must_change_password ===
                undefined
                  ? true
                  : Boolean(
                      must_change_password
                    ),
            });
        } catch (
          mailError
        ) {
          console.error(
            "TEACHER CREDENTIAL EMAIL ERROR:",
            mailError?.message ||
              mailError
          );

          credentialEmail = {
            sent: false,

            reason:
              "Teacher was created, but the credentials email could not be sent.",
          };
        }
      }

      return res
        .status(201)
        .json({
          success: true,

          message:
            credentialEmail.sent
              ? "Teacher created successfully. Login credentials were emailed to the teacher."
              : "Teacher created successfully.",

          data:
            teacher,

          login_username:
            normalizedCnic,

          credential_email_sent:
            Boolean(
              credentialEmail.sent
            ),

          credential_email_warning:
            credentialEmail.sent
              ? null
              : credentialEmail.reason,
        });
    } catch (
      error
    ) {
      console.error(
        "CREATE TEACHER ERROR:",
        error
      );

      // ==================================================
      // ROLLBACK
      // ==================================================

      if (
        createdAuthUserId
      ) {
        try {
          await teacherModel
            .deleteTeacher(
              createdAuthUserId
            )
            .catch(
              () => {}
            );

          const {
            error:
              rollbackError,
          } =
            await supabaseAdmin
              .auth
              .admin
              .deleteUser(
                createdAuthUserId
              );

          if (
            rollbackError
          ) {
            console.error(
              "TEACHER AUTH ROLLBACK ERROR:",
              rollbackError
            );
          }
        } catch (
          rollbackError
        ) {
          console.error(
            "TEACHER AUTH ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      if (
        error?.code ===
        "23505"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "CNIC or another unique teacher value already exists",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// UPLOAD TEACHER AVATAR
// ======================================================

const uploadTeacherAvatar =
  async (
    req,
    res
  ) => {
    try {
      if (
        !req.file
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Avatar image is required",
          });
      }

      const file =
        req.file;

      const fileExtension =
        file.originalname
          .split(".")
          .pop()
          .toLowerCase();

      const fileName =
        `teacher-${Date.now()}-${Math.random()
          .toString(36)
          .substring(
            2,
            10
          )}.${fileExtension}`;

      const filePath =
        `avatars/${fileName}`;

      const {
        error:
          uploadError,
      } =
        await supabaseAdmin
          .storage
          .from(
            "campusz-files"
          )
          .upload(
            filePath,
            file.buffer,
            {
              contentType:
                file.mimetype,

              cacheControl:
                "3600",

              upsert:
                false,
            }
          );

      if (
        uploadError
      ) {
        console.error(
          "TEACHER AVATAR UPLOAD ERROR:",
          uploadError
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              uploadError.message ||
              "Avatar upload failed",
          });
      }

      const {
        data:
          publicUrlData,
      } =
        supabaseAdmin
          .storage
          .from(
            "campusz-files"
          )
          .getPublicUrl(
            filePath
          );

      const avatar_url =
        publicUrlData
          ?.publicUrl;

      if (
        !avatar_url
      ) {
        return res
          .status(500)
          .json({
            success: false,

            message:
              "Avatar uploaded but public URL could not be generated",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Avatar uploaded successfully",

          data: {
            avatar_url,

            path:
              filePath,
          },
        });
    } catch (
      error
    ) {
      console.error(
        "UPLOAD TEACHER AVATAR ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// GET ALL TEACHERS
// ======================================================

const getAllTeachers =
  async (
    req,
    res
  ) => {
    try {
      const teachers =
        await teacherModel.getAllTeachers(
          req.query
            .department ||
            "",

          req.query
            .department_id ||
            ""
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Teachers fetched successfully",

          data:
            teachers,
        });
    } catch (
      error
    ) {
      console.error(
        "GET TEACHERS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// GET TEACHER
// ======================================================

const getTeacherById =
  async (
    req,
    res
  ) => {
    try {
      const teacher =
        await teacherModel.getTeacherById(
          req.params.id
        );

      if (
        !teacher
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Teacher not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Teacher fetched successfully",

          data:
            teacher,
        });
    } catch (
      error
    ) {
      console.error(
        "GET TEACHER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// UPDATE TEACHER
// ======================================================

const updateTeacher =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      const existing =
        await teacherModel.getTeacherById(
          id
        );

      if (
        !existing
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Teacher not found",
          });
      }

      // ==================================================
      // NAME
      // ==================================================

      const newFullName =
        req.body
          .full_name !==
        undefined
          ? String(
              req.body
                .full_name ||
                ""
            ).trim()
          : existing.full_name;

      if (
        !newFullName
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Full name is required",
          });
      }

      // ==================================================
      // OPTIONAL CONTACT EMAIL
      // ==================================================

      const newEmail =
        req.body.email !==
        undefined
          ? (
              req.body.email
                ?.trim()
                ? req.body.email
                    .trim()
                    .toLowerCase()
                : null
            )
          : existing.email;

      if (
        newEmail &&
        newEmail !==
          String(
            existing.email ||
              ""
          ).toLowerCase()
      ) {
        const duplicateEmail =
          await teacherModel.findTeacherByEmail(
            newEmail
          );

        if (
          duplicateEmail &&
          duplicateEmail.id !==
            id
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Another teacher already uses this email",
            });
        }
      }

      // ==================================================
      // CNIC / LOGIN USERNAME
      // ==================================================

      const newCnic =
        req.body.cnic !==
        undefined
          ? normalizeCnic(
              req.body.cnic
            )
          : normalizeCnic(
              existing.cnic
            );

      if (
        !newCnic ||
        !isValidCnic(
          newCnic
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "CNIC must contain exactly 13 digits",
          });
      }

      const oldCnic =
        normalizeCnic(
          existing.cnic
        );

      if (
        newCnic !==
        oldCnic
      ) {
        const {
          data:
            duplicateCnic,

          error:
            duplicateCnicError,
        } =
          await supabaseAdmin
            .from(
              "profiles"
            )
            .select(
              "id, role"
            )
            .eq(
              "cnic",
              newCnic
            )
            .neq(
              "id",
              id
            )
            .maybeSingle();

        if (
          duplicateCnicError
        ) {
          throw duplicateCnicError;
        }

        if (
          duplicateCnic
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This CNIC is already being used as a login username",
            });
        }

        const {
          error:
            authIdentityError,
        } =
          await supabaseAdmin
            .auth
            .admin
            .updateUserById(
              id,
              {
                email:
                  authEmailFromCnic(
                    newCnic
                  ),

                email_confirm:
                  true,

                user_metadata:
                  {
                    role:
                      "teacher",

                    full_name:
                      newFullName,

                    login_cnic:
                      newCnic,
                  },
              }
            );

        if (
          authIdentityError
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                `Login username could not be updated. ${authIdentityError.message}`,
            });
        }
      } else if (
        newFullName !==
        existing.full_name
      ) {
        const {
          error:
            authMetadataError,
        } =
          await supabaseAdmin
            .auth
            .admin
            .updateUserById(
              id,
              {
                user_metadata:
                  {
                    role:
                      "teacher",

                    full_name:
                      newFullName,

                    login_cnic:
                      newCnic,
                  },
              }
            );

        if (
          authMetadataError
        ) {
          console.error(
            "TEACHER AUTH METADATA SYNC ERROR:",
            authMetadataError
          );
        }
      }

      // ==================================================
      // PROFILE PAYLOAD
      // ==================================================

      const payload = {
        full_name:
          newFullName,

        email:
          newEmail,

        phone:
          req.body.phone !==
          undefined
            ? (
                req.body
                  .phone
                  ?.trim() ||
                null
              )
            : existing.phone,

        cnic:
          newCnic,

        avatar_url:
          req.body
            .avatar_url !==
          undefined
            ? (
                req.body
                  .avatar_url ||
                null
              )
            : existing.avatar_url,

        bio:
          req.body.bio !==
          undefined
            ? (
                req.body.bio
                  ?.trim() ||
                null
              )
            : existing.bio,

        department:
          req.body
            .department !==
          undefined
            ? (
                req.body
                  .department
                  ?.trim() ||
                null
              )
            : existing.department,

        is_active:
          req.body
            .is_active ===
          undefined
            ? existing.is_active
            : Boolean(
                req.body
                  .is_active
              ),

        must_change_password:
          req.body
            .must_change_password ===
          undefined
            ? existing
                .must_change_password
            : Boolean(
                req.body
                  .must_change_password
              ),
      };

      // ==================================================
      // LOGIN STATUS SYNC
      // ==================================================

      if (
        req.body
          .is_active !==
        undefined
      ) {
        const {
          error:
            authStatusError,
        } =
          await supabaseAdmin
            .auth
            .admin
            .updateUserById(
              id,
              {
                ban_duration:
                  payload.is_active
                    ? "none"
                    : "876000h",
              }
            );

        if (
          authStatusError
        ) {
          return res
            .status(500)
            .json({
              success: false,

              message:
                `Teacher status could not be synchronized with login account. ${authStatusError.message}`,
            });
        }
      }

      const teacher =
        await teacherModel.updateTeacher({
          id,

          ...payload,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Teacher updated successfully",

          data:
            teacher,
        });
    } catch (
      error
    ) {
      console.error(
        "UPDATE TEACHER ERROR:",
        error
      );

      if (
        error?.code ===
        "23505"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "CNIC or another unique teacher value already exists",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// DELETE TEACHER
// ======================================================

const deleteTeacher =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      const teacher =
        await teacherModel.getTeacherById(
          id
        );

      if (
        !teacher
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Teacher not found",
          });
      }

      try {
        await teacherModel.deleteTeacher(
          id
        );
      } catch (
        profileError
      ) {
        console.error(
          "DELETE TEACHER PROFILE ERROR:",
          profileError
        );

        if (
          profileError.code ===
          "23503"
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Teacher has linked data and the hard-delete database migration is not applied.",
            });
        }

        throw profileError;
      }

      const {
        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .deleteUser(
            id
          );

      if (
        authError
      ) {
        console.error(
          "DELETE TEACHER AUTH ERROR:",
          authError
        );

        return res
          .status(500)
          .json({
            success: false,

            message:
              authError.message ||
              "Teacher authentication account could not be deleted",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Teacher deleted permanently. Teacher-owned academic content is preserved where configured, while teacher-specific linked records are removed according to the database delete policy.",
        });
    } catch (
      error
    ) {
      console.error(
        "DELETE TEACHER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

// ======================================================
// RESET PASSWORD
// ======================================================

const resetTeacherPassword =
  async (
    req,
    res
  ) => {
    try {
      const {
        password,
      } = req.body;

      if (
        !password ||
        password.length <
          6
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Password must be at least 6 characters",
          });
      }

      const teacher =
        await teacherModel.getTeacherById(
          req.params.id
        );

      if (
        !teacher
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Teacher not found",
          });
      }

      const {
        error,
      } =
        await supabaseAdmin
          .auth
          .admin
          .updateUserById(
            req.params.id,
            {
              password,
            }
          );

      if (
        error
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              error.message,
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Teacher password updated successfully",
        });
    } catch (
      error
    ) {
      console.error(
        "RESET TEACHER PASSWORD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal server error",
        });
    }
  };

module.exports = {
  createTeacher,
  uploadTeacherAvatar,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
  resetTeacherPassword,
};