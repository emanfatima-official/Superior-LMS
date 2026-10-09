const { supabaseAdmin } = require("../config/supabase");

const studentModel = require("../models/student.model");

const {
  resolveAcademic,
} = require("../utils/academicRelations");

const {
  sendCredentialsEmail,
} = require("../services/email.service");

const {
  normalizeCnic,
  isValidCnic,
  authEmailFromCnic,
} = require("../utils/authIdentity");

// ======================================================
// HELPERS
// ======================================================

const getErrorMessage = (
  error,
  fallback
) =>
  error?.message ||
  fallback;

// ======================================================
// CREATE STUDENT
// ======================================================

const createStudent = async (
  req,
  res
) => {
  let authUserId = null;

  try {
    const {
      full_name,
      father_name,
      email,
      password,

      department_id,
      program_id,
      batch_id,
      semester_id,

      phone,
      student_id,
      cnic,
      avatar_url,
      bio,

      is_active,
      must_change_password,
    } = req.body;

    // --------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------

    if (
      !full_name?.trim() ||
      !father_name?.trim() ||
      !password ||
      !student_id?.trim() ||
      !cnic?.trim()
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Full name, father name, CNIC/B-Form, password and student ID are required.",
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
            "Password must be at least 6 characters.",
        });
    }

    if (
      !department_id ||
      !program_id ||
      !batch_id ||
      !semester_id
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Department, Program, Batch and Semester are required.",
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
            "CNIC/B-Form must contain exactly 13 digits.",
        });
    }

    const normalizedEmail =
      email?.trim()
        ? email
            .trim()
            .toLowerCase()
        : null;

    const normalizedStudentId =
      student_id.trim();

    const authEmail =
      authEmailFromCnic(
        normalizedCnic
      );

    // --------------------------------------------------
    // VALIDATE ACADEMIC STRUCTURE
    // --------------------------------------------------

    const academic =
      await resolveAcademic({
        department_id,
        program_id,
        batch_id,
        semester_id,
      });

    if (
      !academic.department ||
      !academic.program ||
      !academic.batch ||
      !academic.semester
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Selected academic structure is incomplete or invalid.",
        });
    }

    // --------------------------------------------------
    // OPTIONAL EMAIL DUPLICATE
    // --------------------------------------------------

    if (
      normalizedEmail
    ) {
      const existing =
        await studentModel.findStudentByEmail(
          normalizedEmail
        );

      if (
        existing
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Student with this email already exists.",
          });
      }
    }

    // --------------------------------------------------
    // DUPLICATE CNIC
    // --------------------------------------------------

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
            "This CNIC/B-Form is already being used as a login username.",
        });
    }

    // --------------------------------------------------
    // DUPLICATE STUDENT ID
    // --------------------------------------------------

    const {
      data:
        existingStudentId,

      error:
        studentIdError,
    } =
      await supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "id"
        )
        .eq(
          "student_id",
          normalizedStudentId
        )
        .eq(
          "role",
          "student"
        )
        .maybeSingle();

    if (
      studentIdError
    ) {
      throw studentIdError;
    }

    if (
      existingStudentId
    ) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "Student ID already exists.",
        });
    }

    // --------------------------------------------------
    // CREATE SUPABASE AUTH USER
    //
    // Important:
    // Actual contact email is NOT used for login.
    // Internal email generated from CNIC is used.
    // --------------------------------------------------

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
              "student",

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

    authUserId =
      authData.user.id;

    // --------------------------------------------------
    // CREATE PROFILE
    // --------------------------------------------------

    const student =
      await studentModel.createStudentProfile({
        id:
          authUserId,

        full_name:
          full_name.trim(),

        father_name:
          father_name.trim(),

        email:
          normalizedEmail,

        role:
          "student",

        department:
          academic.department.name,

        semester:
          academic.semester.name,

        department_id:
          academic.department_id,

        program_id:
          academic.program_id,

        batch_id:
          academic.batch_id,

        semester_id:
          academic.semester_id,

        phone:
          phone?.trim() ||
          null,

        student_id:
          normalizedStudentId,

        cnic:
          normalizedCnic,

        avatar_url:
          avatar_url ||
          null,

        bio:
          bio?.trim() ||
          null,

        manual_is_active:
          is_active ===
          undefined
            ? true
            : Boolean(
                is_active
              ),

        academic_blocked:
          false,

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

    // --------------------------------------------------
    // CREATE CURRENT ACADEMIC HISTORY
    // --------------------------------------------------

    await studentModel.createAcademicHistory({
      student_id:
        authUserId,

      batch_id:
        academic.batch_id,

      department_id:
        academic.department_id,

      program_id:
        academic.program_id,

      semester_id:
        academic.semester_id,

      status:
        "current",

      started_at:
        new Date()
          .toISOString(),
    });

    // --------------------------------------------------
    // OPTIONAL CREDENTIAL EMAIL
    // --------------------------------------------------

    let credentialEmail = {
      sent: false,

      reason:
        normalizedEmail
          ? "Credential email was not attempted."
          : "Student email was not provided.",
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
              "student",

            password,

            studentId:
              normalizedStudentId,

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
          "STUDENT CREDENTIAL EMAIL ERROR:",
          mailError?.message ||
            mailError
        );

        credentialEmail = {
          sent: false,

          reason:
            "Student was created, but the credentials email could not be sent.",
        };
      }
    }

    return res
      .status(201)
      .json({
        success: true,

        message:
          credentialEmail.sent
            ? "Student created successfully. Login credentials were emailed to the student."
            : "Student created successfully.",

        data:
          student,

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
    // --------------------------------------------------
    // ROLLBACK
    // --------------------------------------------------

    if (
      authUserId
    ) {
      await studentModel
        .deleteStudentProfile(
          authUserId
        )
        .catch(
          () => {}
        );

      await supabaseAdmin
        .auth
        .admin
        .deleteUser(
          authUserId
        )
        .catch(
          () => {}
        );
    }

    console.error(
      "CREATE STUDENT ERROR:",
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
            "Student ID, CNIC/B-Form or another unique value already exists.",
        });
    }

    return res
      .status(500)
      .json({
        success: false,

        message:
          getErrorMessage(
            error,
            "Failed to create student."
          ),
      });
  }
};

// ======================================================
// GET ALL STUDENTS
// ======================================================

const getAllStudents =
  async (
    req,
    res
  ) => {
    try {
      const students =
        await studentModel.getAllStudents(
          req.query
            .course_id ||
            null
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Students fetched successfully.",

          data:
            students,
        });
    } catch (
      error
    ) {
      console.error(
        "GET STUDENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to load students."
            ),
        });
    }
  };

// ======================================================
// GET SINGLE STUDENT
// ======================================================

const getStudentById =
  async (
    req,
    res
  ) => {
    try {
      const student =
        await studentModel.getStudentById(
          req.params.id
        );

      if (
        !student
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Student not found.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Student fetched successfully.",

          data:
            student,
        });
    } catch (
      error
    ) {
      console.error(
        "GET STUDENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to load student."
            ),
        });
    }
  };

// ======================================================
// UPDATE STUDENT
// ======================================================

const updateStudent =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      const existing =
        await studentModel.getStudentById(
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
              "Student not found.",
          });
      }

      // --------------------------------------------------
      // ACADEMIC PLACEMENT
      // --------------------------------------------------

      const academicKeys = [
        "batch_id",
        "department_id",
        "program_id",
        "semester_id",
      ];

      const academicChanged =
        academicKeys.some(
          (
            key
          ) =>
            req.body[
              key
            ] !==
              undefined &&
            req.body[
              key
            ] !==
              existing[
                key
              ]
        );

      if (
        academicChanged
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Academic placement cannot be changed from Edit Student. Use Promotion for semester changes so academic history stays correct.",
          });
      }

      const academic =
        await resolveAcademic({
          department_id:
            existing.department_id,

          program_id:
            existing.program_id,

          batch_id:
            existing.batch_id,

          semester_id:
            existing.semester_id,
        });

      if (
        !academic.department ||
        !academic.program ||
        !academic.batch ||
        !academic.semester
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Department, Program, Batch and Semester are required.",
          });
      }

      // --------------------------------------------------
      // FULL NAME
      // --------------------------------------------------

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
              "Full name is required.",
          });
      }

      // --------------------------------------------------
      // FATHER NAME
      // --------------------------------------------------

      const newFatherName =
        req.body
          .father_name !==
        undefined
          ? String(
              req.body
                .father_name ||
                ""
            ).trim()
          : existing.father_name;

      if (
        req.body
          .father_name !==
          undefined &&
        !newFatherName
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Father name is required.",
          });
      }

      // --------------------------------------------------
      // OPTIONAL EMAIL
      // --------------------------------------------------

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
        const duplicate =
          await studentModel.findStudentByEmail(
            newEmail
          );

        if (
          duplicate &&
          duplicate.id !==
            id
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Another student already uses this email.",
            });
        }
      }

      // --------------------------------------------------
      // STUDENT ID
      // --------------------------------------------------

      const newStudentId =
        req.body
          .student_id !==
        undefined
          ? String(
              req.body
                .student_id ||
                ""
            ).trim()
          : existing.student_id;

      if (
        !newStudentId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Student ID is required.",
          });
      }

      if (
        newStudentId !==
        existing.student_id
      ) {
        const {
          data:
            duplicateId,

          error:
            studentIdError,
        } =
          await supabaseAdmin
            .from(
              "profiles"
            )
            .select(
              "id"
            )
            .eq(
              "student_id",
              newStudentId
            )
            .eq(
              "role",
              "student"
            )
            .neq(
              "id",
              id
            )
            .maybeSingle();

        if (
          studentIdError
        ) {
          throw studentIdError;
        }

        if (
          duplicateId
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Student ID already exists.",
            });
        }
      }

      // --------------------------------------------------
      // CNIC / LOGIN USERNAME
      // --------------------------------------------------

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
              "CNIC/B-Form must contain exactly 13 digits.",
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
                "This CNIC/B-Form is already being used as a login username.",
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
                      "student",

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
                      "student",

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
            "STUDENT AUTH METADATA SYNC ERROR:",
            authMetadataError
          );
        }
      }

      // --------------------------------------------------
      // UPDATE PROFILE
      // --------------------------------------------------

      const student =
        await studentModel.updateStudent({
          id,

          full_name:
            newFullName,

          father_name:
            newFatherName ||
            null,

          email:
            newEmail,

          department:
            academic.department.name,

          semester:
            academic.semester.name,

          department_id:
            academic.department_id,

          program_id:
            academic.program_id,

          batch_id:
            academic.batch_id,

          semester_id:
            academic.semester_id,

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

          student_id:
            newStudentId,

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

          manual_is_active:
            req.body
              .is_active ===
            undefined
              ? (
                  existing
                    .manual_is_active ??
                  existing
                    .is_active
                )
              : Boolean(
                  req.body
                    .is_active
                ),

          is_active:
            req.body
              .is_active ===
            undefined
              ? existing.is_active
              : Boolean(
                  req.body
                    .is_active
                ) &&
                !Boolean(
                  existing
                    .academic_blocked
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
        });

      // --------------------------------------------------
      // AUTH STATUS
      // --------------------------------------------------

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
                  Boolean(
                    req.body
                      .is_active
                  ) &&
                  !Boolean(
                    existing
                      .academic_blocked
                  )
                    ? "none"
                    : "876000h",
              }
            );

        if (
          authStatusError
        ) {
          console.error(
            "AUTH STATUS SYNC ERROR:",
            authStatusError
          );
        }
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Student updated successfully.",

          data:
            student,
        });
    } catch (
      error
    ) {
      console.error(
        "UPDATE STUDENT ERROR:",
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
              "Student ID, CNIC/B-Form or another unique value already exists.",
          });
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to update student."
            ),
        });
    }
  };

// ======================================================
// UPDATE STUDENT STATUS
// ======================================================

const updateStudentStatus =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      if (
        typeof req.body
          .is_active !==
        "boolean"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "is_active must be true or false.",
          });
      }

      const existing =
        await studentModel.getStudentById(
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
              "Student not found.",
          });
      }

      const manualIsActive =
        req.body.is_active;

      const academicBlocked =
        Boolean(
          existing.academic_blocked
        );

      const effectiveActive =
        manualIsActive &&
        !academicBlocked;

      const student =
        await studentModel.updateStudentStatus(
          id,
          manualIsActive,
          academicBlocked
        );

      const {
        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .updateUserById(
            id,
            {
              ban_duration:
                effectiveActive
                  ? "none"
                  : "876000h",
            }
          );

      if (
        authError
      ) {
        await studentModel
          .updateStudentStatus(
            id,
            existing
              .manual_is_active ??
              existing
                .is_active,

            academicBlocked
          )
          .catch(
            () => {}
          );

        return res
          .status(500)
          .json({
            success: false,

            message:
              `Student status could not be synchronized with login account. ${authError.message}`,
          });
      }

      let message;

      if (
        !manualIsActive
      ) {
        message =
          "Student account deactivated successfully.";
      } else if (
        academicBlocked
      ) {
        message =
          "Student manual status is Active, but login remains blocked because the current academic structure is inactive.";
      } else {
        message =
          "Student account activated successfully.";
      }

      return res
        .status(200)
        .json({
          success: true,

          message,

          data:
            student,
        });
    } catch (
      error
    ) {
      console.error(
        "UPDATE STUDENT STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to update student status."
            ),
        });
    }
  };

// ======================================================
// RESET STUDENT PASSWORD
// ======================================================

const resetStudentPassword =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      const password =
        req.body.password;

      if (
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "New password is required.",
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
              "Password must be at least 6 characters.",
          });
      }

      const student =
        await studentModel.getStudentById(
          id
        );

      if (
        !student
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Student not found.",
          });
      }

      const {
        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .updateUserById(
            id,
            {
              password,
            }
          );

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

      const updatedStudent =
        await studentModel.updateStudent({
          id,

          must_change_password:
            true,
        });

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Student password reset successfully.",

          data:
            updatedStudent,
        });
    } catch (
      error
    ) {
      console.error(
        "RESET STUDENT PASSWORD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to reset student password."
            ),
        });
    }
  };

// ======================================================
// DELETE STUDENT
// ======================================================

const deleteStudent =
  async (
    req,
    res
  ) => {
    try {
      const id =
        req.params.id;

      const existing =
        await studentModel.getStudentById(
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
              "Student not found.",
          });
      }

      try {
        await studentModel.deleteStudentProfile(
          id
        );
      } catch (
        profileError
      ) {
        console.error(
          "DELETE STUDENT PROFILE ERROR:",
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
                "Student has linked data and the hard-delete database migration is not applied.",
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
          "DELETE STUDENT AUTH ERROR:",
          authError
        );

        return res
          .status(500)
          .json({
            success: false,

            message:
              authError.message ||
              "Student authentication account could not be deleted.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Student deleted permanently.",
        });
    } catch (
      error
    ) {
      console.error(
        "DELETE STUDENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            getErrorMessage(
              error,
              "Failed to delete student."
            ),
        });
    }
  };

module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  updateStudentStatus,
  resetStudentPassword,
  deleteStudent,
};