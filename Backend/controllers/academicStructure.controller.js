const academicModel =
  require("../models/academicStructure.model");

const {
  supabaseAdmin,
} =
  require("../config/supabase");

// ======================================================
// HELPERS
// ======================================================

const sendServerError = (
  res,
  label,
  error,
  message
) => {
  console.error(
    label,
    error
  );

  return res
    .status(500)
    .json({
      success: false,
      message,
      error:
        error?.message ||
        String(error),
    });
};

// ======================================================
// GET AFFECTED COURSE ASSIGNMENTS
// Used for Active / Inactive academic access.
// ======================================================

const getAffectedAssignmentIds =
  async (
    type,
    id
  ) => {
    let query =
      supabaseAdmin
        .from(
          "course_assignments"
        )
        .select("id");

    if (
      type ===
      "batch"
    ) {
      query =
        query.eq(
          "batch_id",
          id
        );
    } else if (
      type ===
      "semester"
    ) {
      query =
        query.eq(
          "semester_id",
          id
        );
    } else {
      let programIds =
        [];

      if (
        type ===
        "program"
      ) {
        programIds = [
          id,
        ];
      } else if (
        type ===
        "department"
      ) {
        const {
          data:
            programRows,
          error:
            programError,
        } =
          await supabaseAdmin
            .from(
              "academic_programs"
            )
            .select(
              "id"
            )
            .eq(
              "department_id",
              id
            );

        if (
          programError
        ) {
          throw programError;
        }

        programIds =
          (
            programRows ||
            []
          ).map(
            (row) =>
              row.id
          );
      }

      if (
        !programIds.length
      ) {
        return [];
      }

      const {
        data:
          semesterRows,
        error:
          semesterError,
      } =
        await supabaseAdmin
          .from(
            "academic_semesters"
          )
          .select(
            "id"
          )
          .in(
            "program_id",
            programIds
          );

      if (
        semesterError
      ) {
        throw semesterError;
      }

      const semesterIds =
        (
          semesterRows ||
          []
        ).map(
          (row) =>
            row.id
        );

      if (
        !semesterIds.length
      ) {
        return [];
      }

      query =
        query.in(
          "semester_id",
          semesterIds
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw error;
    }

    return (
      data || []
    ).map(
      (row) =>
        row.id
    );
  };

// ======================================================
// GET AFFECTED STUDENTS
// ======================================================

const getAffectedStudentIds =
  async (
    type,
    id
  ) => {
    let query =
      supabaseAdmin
        .from(
          "profiles"
        )
        .select(
          "id"
        )
        .eq(
          "role",
          "student"
        );

    if (
      type ===
      "batch"
    ) {
      query =
        query.eq(
          "batch_id",
          id
        );
    }

    if (
      type ===
      "department"
    ) {
      query =
        query.eq(
          "department_id",
          id
        );
    }

    if (
      type ===
      "program"
    ) {
      query =
        query.eq(
          "program_id",
          id
        );
    }

    if (
      type ===
      "semester"
    ) {
      query =
        query.eq(
          "semester_id",
          id
        );
    }

    const {
      data,
      error,
    } =
      await query;

    if (error) {
      throw error;
    }

    return (
      data || []
    ).map(
      (row) =>
        row.id
    );
  };

// ======================================================
// SYNC SUPABASE AUTH ACCESS
// ======================================================

const syncAuthAccess =
  async (
    rows = []
  ) => {
    const failures =
      [];

    for (
      const row of
      rows
    ) {
      const {
        error,
      } =
        await supabaseAdmin.auth.admin
          .updateUserById(
            row.student_id,
            {
              ban_duration:
                row.is_active
                  ? "none"
                  : "876000h",
            }
          );

      if (error) {
        failures.push(
          {
            id:
              row.student_id,

            message:
              error.message,
          }
        );
      }
    }

    if (
      failures.length
    ) {
      const error =
        new Error(
          `${failures.length} student login account(s) could not be synchronized.`
        );

      error.details =
        failures;

      throw error;
    }
  };

// ======================================================
// ACTIVE / INACTIVE ACCESS SYNC
// ======================================================

const syncAcademicAccessForEntity =
  async (
    type,
    id
  ) => {
    const [
      assignmentIds,
      studentIds,
    ] =
      await Promise.all([
        getAffectedAssignmentIds(
          type,
          id
        ),

        getAffectedStudentIds(
          type,
          id
        ),
      ]);

    if (
      assignmentIds.length
    ) {
      const {
        error:
          assignmentError,
      } =
        await supabaseAdmin.rpc(
          "recompute_course_assignment_academic_access",
          {
            p_assignment_ids:
              assignmentIds,
          }
        );

      if (
        assignmentError
      ) {
        throw assignmentError;
      }
    }

    if (
      studentIds.length
    ) {
      const {
        data:
          accessRows,
        error:
          accessError,
      } =
        await supabaseAdmin.rpc(
          "recompute_student_academic_access",
          {
            p_student_ids:
              studentIds,
          }
        );

      if (
        accessError
      ) {
        throw accessError;
      }

      await syncAuthAccess(
        accessRows ||
          []
      );
    }
  };

// ======================================================
// BATCH PROGRAM ACCESS
// ======================================================

const syncBatchProgramAccess =
  async (
    batchId
  ) => {
    const mappings =
      await academicModel
        .getAllBatchPrograms(
          batchId
        );

    const authRows =
      [];

    for (
      const mapping of
      mappings
    ) {
      const {
        data:
          semesterRows,
        error:
          semesterError,
      } =
        await supabaseAdmin
          .from(
            "academic_semesters"
          )
          .select(
            "id"
          )
          .eq(
            "program_id",
            mapping.program_id
          );

      if (
        semesterError
      ) {
        throw semesterError;
      }

      const semesterIds =
        (
          semesterRows ||
          []
        ).map(
          (row) =>
            row.id
        );

      let assignmentRows =
        [];

      if (
        semesterIds.length
      ) {
        const {
          data,
          error,
        } =
          await supabaseAdmin
            .from(
              "course_assignments"
            )
            .select(`
              id,
              status,
              lifecycle_status,
              academic_blocked,
              status_before_academic_block
            `)
            .eq(
              "batch_id",
              batchId
            )
            .in(
              "semester_id",
              semesterIds
            );

        if (error) {
          throw error;
        }

        assignmentRows =
          data || [];
      }

      const {
        data:
          studentRows,
        error:
          studentError,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .select(`
            id,
            is_active,
            manual_is_active,
            academic_blocked
          `)
          .eq(
            "role",
            "student"
          )
          .eq(
            "batch_id",
            batchId
          )
          .eq(
            "program_id",
            mapping.program_id
          );

      if (
        studentError
      ) {
        throw studentError;
      }

      if (
        mapping.status ===
        "active"
      ) {
        if (
          assignmentRows.length
        ) {
          const {
            error,
          } =
            await supabaseAdmin.rpc(
              "recompute_course_assignment_academic_access",
              {
                p_assignment_ids:
                  assignmentRows.map(
                    (row) =>
                      row.id
                  ),
              }
            );

          if (error) {
            throw error;
          }
        }

        if (
          (
            studentRows ||
            []
          ).length
        ) {
          const {
            data,
            error,
          } =
            await supabaseAdmin.rpc(
              "recompute_student_academic_access",
              {
                p_student_ids:
                  studentRows.map(
                    (row) =>
                      row.id
                  ),
              }
            );

          if (error) {
            throw error;
          }

          authRows.push(
            ...(
              data ||
              []
            )
          );
        }

        continue;
      }

      // Mapping inactive
      for (
        const assignment of
        assignmentRows
      ) {
        const {
          error,
        } =
          await supabaseAdmin
            .from(
              "course_assignments"
            )
            .update({
              academic_blocked:
                true,

              status_before_academic_block:
                assignment
                  .status_before_academic_block ||
                assignment
                  .lifecycle_status ||
                assignment
                  .status,

              status:
                "inactive",
            })
            .eq(
              "id",
              assignment.id
            );

        if (error) {
          throw error;
        }
      }

      for (
        const student of
        studentRows ||
        []
      ) {
        const {
          error,
        } =
          await supabaseAdmin
            .from(
              "profiles"
            )
            .update({
              academic_blocked:
                true,

              is_active:
                false,
            })
            .eq(
              "id",
              student.id
            );

        if (error) {
          throw error;
        }

        authRows.push({
          student_id:
            student.id,

          is_active:
            false,
        });
      }
    }

    if (
      authRows.length
    ) {
      await syncAuthAccess(
        authRows
      );
    }
  };

// ======================================================
// DELETE STUDENT AUTH ACCOUNTS
// ======================================================

const deleteStudentAuthUsers =
  async (
    studentIds
  ) => {
    const failures =
      [];

    for (
      const id of
      studentIds ||
      []
    ) {
      const {
        error,
      } =
        await supabaseAdmin.auth.admin
          .deleteUser(
            id
          );

      if (error) {
        failures.push(
          {
            id,
            message:
              error.message,
          }
        );
      }
    }

    return failures;
  };

// ======================================================
// SUPABASE STORAGE URL -> BUCKET/PATH
// ======================================================

const parseSupabaseStorageObject =
  (value) => {
    const raw =
      String(
        value ||
          ""
      ).trim();

    if (!raw) {
      return null;
    }

    try {
      const url =
        new URL(raw);

      const marker =
        "/storage/v1/object/";

      const markerIndex =
        url.pathname.indexOf(
          marker
        );

      if (
        markerIndex !==
        -1
      ) {
        let remainder =
          url.pathname.slice(
            markerIndex +
              marker.length
          );

        for (
          const prefix of
          [
            "public/",
            "sign/",
            "authenticated/",
          ]
        ) {
          if (
            remainder.startsWith(
              prefix
            )
          ) {
            remainder =
              remainder.slice(
                prefix.length
              );

            break;
          }
        }

        const slashIndex =
          remainder.indexOf(
            "/"
          );

        if (
          slashIndex > 0
        ) {
          return {
            bucket:
              decodeURIComponent(
                remainder.slice(
                  0,
                  slashIndex
                )
              ),

            path:
              decodeURIComponent(
                remainder.slice(
                  slashIndex +
                    1
                )
              ),
          };
        }
      }
    } catch (_) {
      // Not a full URL.
    }

    // Older code may save only a Storage path.
    if (
      !/^https?:\/\//i.test(
        raw
      ) &&
      raw.includes("/")
    ) {
      return {
        bucket:
          "campusz-files",

        path:
          raw.replace(
            /^\/+/,
            ""
          ),
      };
    }

    return null;
  };

// ======================================================
// DELETE MATERIAL STORAGE OBJECTS
// ======================================================

const deleteStoredFiles =
  async (
    urls = []
  ) => {
    const grouped =
      new Map();

    const skipped =
      [];

    for (
      const value of
      urls
    ) {
      const object =
        parseSupabaseStorageObject(
          value
        );

      if (
        !object?.bucket ||
        !object?.path
      ) {
        if (value) {
          skipped.push(
            String(
              value
            )
          );
        }

        continue;
      }

      if (
        !grouped.has(
          object.bucket
        )
      ) {
        grouped.set(
          object.bucket,
          new Set()
        );
      }

      grouped
        .get(
          object.bucket
        )
        .add(
          object.path
        );
    }

    const failures =
      [];

    let deleted =
      0;

    for (
      const [
        bucket,
        pathSet,
      ] of
      grouped.entries()
    ) {
      const paths = [
        ...pathSet,
      ];

      for (
        let index = 0;
        index <
        paths.length;
        index += 100
      ) {
        const chunk =
          paths.slice(
            index,
            index + 100
          );

        const {
          data,
          error,
        } =
          await supabaseAdmin.storage
            .from(
              bucket
            )
            .remove(
              chunk
            );

        if (error) {
          failures.push({
            bucket,
            paths:
              chunk,
            message:
              error.message,
          });

          continue;
        }

        deleted +=
          Array.isArray(
            data
          )
            ? data.length
            : chunk.length;
      }
    }

    return {
      deleted,
      skipped,
      failures,
    };
  };

// ======================================================
// BATCH VALIDATION
// ======================================================

const ADMISSION_TYPES =
  new Set([
    "regular",
    "lateral",
    "transfer",
    "legacy",
  ]);

const validateBatchPrograms =
  async (
    programs,
    {
      allowLegacy =
        false,
    } = {}
  ) => {
    if (
      !Array.isArray(
        programs
      ) ||
      programs.length ===
        0
    ) {
      const error =
        new Error(
          "Select at least one Program for the Batch"
        );

      error.status =
        400;

      throw error;
    }

    const seen =
      new Set();

    const normalized =
      [];

    for (
      const item of
      programs
    ) {
      const programId =
        item?.program_id;

      if (!programId) {
        const error =
          new Error(
            "Every Batch Program must include program_id"
          );

        error.status =
          400;

        throw error;
      }

      if (
        seen.has(
          programId
        )
      ) {
        const error =
          new Error(
            "A Program cannot be selected twice in the same Batch"
          );

        error.status =
          400;

        throw error;
      }

      seen.add(
        programId
      );

      const program =
        await academicModel
          .getProgramById(
            programId
          );

      if (!program) {
        const error =
          new Error(
            "One of the selected Programs was not found"
          );

        error.status =
          404;

        throw error;
      }

      const admissionType =
        String(
          item.admission_type ||
            "regular"
        ).toLowerCase();

      const mappingStatus =
        item.status ===
        "inactive"
          ? "inactive"
          : "active";

      if (
        !ADMISSION_TYPES.has(
          admissionType
        ) ||
        (
          admissionType ===
            "legacy" &&
          !allowLegacy
        )
      ) {
        const error =
          new Error(
            "Admission type must be regular, lateral or transfer"
          );

        error.status =
          400;

        throw error;
      }

      if (
        mappingStatus ===
          "active" &&
        program.status !==
          "active"
      ) {
        const error =
          new Error(
            `${program.name}: activate the Program before adding it to a Batch`
          );

        error.status =
          400;

        throw error;
      }

      if (
        mappingStatus ===
        "active"
      ) {
        const department =
          await academicModel
            .getDepartmentById(
              program.department_id
            );

        if (
          !department ||
          department.status !==
            "active"
        ) {
          const error =
            new Error(
              `${program.name}: activate its Department before adding it to a Batch`
            );

          error.status =
            400;

          throw error;
        }
      }

      const entrySemesterId =
        item.entry_semester_id ||
        null;

      const currentSemesterId =
        item.current_semester_id ||
        null;

      if (
        admissionType !==
          "legacy" &&
        (
          !entrySemesterId ||
          !currentSemesterId
        )
      ) {
        const error =
          new Error(
            `${program.name}: entry and current semester are required`
          );

        error.status =
          400;

        throw error;
      }

      const [
        entrySemester,
        currentSemester,
      ] =
        await Promise.all([
          entrySemesterId
            ? academicModel.getSemesterById(
                entrySemesterId
              )
            : null,

          currentSemesterId
            ? academicModel.getSemesterById(
                currentSemesterId
              )
            : null,
        ]);

      if (
        entrySemesterId &&
        (
          !entrySemester ||
          entrySemester.program_id !==
            programId
        )
      ) {
        const error =
          new Error(
            `${program.name}: entry semester does not belong to this Program`
          );

        error.status =
          400;

        throw error;
      }

      if (
        currentSemesterId &&
        (
          !currentSemester ||
          currentSemester.program_id !==
            programId
        )
      ) {
        const error =
          new Error(
            `${program.name}: current semester does not belong to this Program`
          );

        error.status =
          400;

        throw error;
      }

      if (
        mappingStatus ===
          "active" &&
        (
          (
            entrySemester &&
            entrySemester.status !==
              "active"
          ) ||
          (
            currentSemester &&
            currentSemester.status !==
              "active"
          )
        )
      ) {
        const error =
          new Error(
            `${program.name}: select active entry and current Semesters`
          );

        error.status =
          400;

        throw error;
      }

      if (
        entrySemester &&
        currentSemester &&
        Number(
          currentSemester.semester_number
        ) <
          Number(
            entrySemester.semester_number
          )
      ) {
        const error =
          new Error(
            `${program.name}: current semester cannot be earlier than entry semester`
          );

        error.status =
          400;

        throw error;
      }

      normalized.push({
        program_id:
          programId,

        admission_type:
          admissionType,

        entry_semester_id:
          entrySemesterId,

        current_semester_id:
          currentSemesterId,

        status:
          mappingStatus,
      });
    }

    if (
      !normalized.some(
        (item) =>
          item.status ===
          "active"
      )
    ) {
      const error =
        new Error(
          "A Batch must contain at least one active Program"
        );

      error.status =
        400;

      throw error;
    }

    return normalized;
  };

const sendValidationError =
  (
    res,
    error
  ) => {
    if (
      !error?.status ||
      error.status >=
        500
    ) {
      return false;
    }

    res
      .status(
        error.status
      )
      .json({
        success:
          false,

        message:
          error.message,
      });

    return true;
  };

// ======================================================
// BATCHES
// ======================================================

const getBatches =
  async (
    req,
    res
  ) => {
    try {
      const batches =
        await academicModel
          .getAllBatches();

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Batches fetched successfully",
          data:
            batches,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET BATCHES ERROR:",
        error,
        "Failed to fetch batches"
      );
    }
  };

const getBatch =
  async (
    req,
    res
  ) => {
    try {
      const batch =
        await academicModel
          .getBatchById(
            req.params.id
          );

      if (!batch) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Batch not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Batch fetched successfully",
          data:
            batch,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET BATCH ERROR:",
        error,
        "Failed to fetch batch"
      );
    }
  };

const createBatch =
  async (
    req,
    res
  ) => {
    try {
      const {
        start_year,
        end_year,
        status,
        programs,
      } =
        req.body;

      if (
        start_year ===
          undefined ||
        start_year ===
          null ||
        start_year ===
          ""
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "start_year is required",
          });
      }

      if (
        end_year ===
          undefined ||
        end_year ===
          null ||
        end_year ===
          ""
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "end_year is required",
          });
      }

      const startYear =
        Number(
          start_year
        );

      const endYear =
        Number(
          end_year
        );

      if (
        !Number.isInteger(
          startYear
        ) ||
        !Number.isInteger(
          endYear
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "start_year and end_year must be valid years",
          });
      }

      if (
        endYear <
        startYear
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "end_year cannot be earlier than start_year",
          });
      }

      const normalizedPrograms =
        await validateBatchPrograms(
          programs
        );

      const batch =
        await academicModel
          .saveBatchConfiguration({
            start_year:
              startYear,

            end_year:
              endYear,

            status:
              status ===
              "inactive"
                ? "inactive"
                : "active",

            programs:
              normalizedPrograms,
          });

      await syncBatchProgramAccess(
        batch.id
      );

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Batch created successfully",
          data:
            batch,
        });
    } catch (error) {
      if (
        sendValidationError(
          res,
          error
        )
      ) {
        return;
      }

      return sendServerError(
        res,
        "CREATE BATCH ERROR:",
        error,
        "Failed to create batch"
      );
    }
  };

const updateBatch =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        start_year,
        end_year,
        status,
        programs,
      } =
        req.body;

      const existing =
        await academicModel
          .getBatchById(
            id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Batch not found",
          });
      }

      if (
        start_year ===
          undefined ||
        start_year ===
          null ||
        start_year ===
          "" ||
        end_year ===
          undefined ||
        end_year ===
          null ||
        end_year ===
          ""
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "start_year and end_year are required",
          });
      }

      const startYear =
        Number(
          start_year
        );

      const endYear =
        Number(
          end_year
        );

      if (
        !Number.isInteger(
          startYear
        ) ||
        !Number.isInteger(
          endYear
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "start_year and end_year must be valid years",
          });
      }

      if (
        endYear <
        startYear
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "end_year cannot be earlier than start_year",
          });
      }

      const sourcePrograms =
        Array.isArray(
          programs
        )
          ? programs
          : (
              existing.program_mappings ||
              []
            ).map(
              (
                mapping
              ) => ({
                program_id:
                  mapping.program_id,

                admission_type:
                  mapping.admission_type,

                entry_semester_id:
                  mapping.entry_semester_id,

                current_semester_id:
                  mapping.current_semester_id,

                status:
                  mapping.status,
              })
            );

      const normalizedPrograms =
        await validateBatchPrograms(
          sourcePrograms,
          {
            allowLegacy:
              true,
          }
        );

      const nextStatus =
        status ===
        "inactive"
          ? "inactive"
          : "active";

      const updatedBatch =
        await academicModel
          .saveBatchConfiguration({
            id,

            start_year:
              startYear,

            end_year:
              endYear,

            status:
              nextStatus,

            programs:
              normalizedPrograms,
          });

      await syncBatchProgramAccess(
        id
      );

      await syncAcademicAccessForEntity(
        "batch",
        id
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Batch updated successfully",
          data:
            updatedBatch,
        });
    } catch (error) {
      if (
        sendValidationError(
          res,
          error
        )
      ) {
        return;
      }

      return sendServerError(
        res,
        "UPDATE BATCH ERROR:",
        error,
        "Failed to update batch"
      );
    }
  };

const getBatchPrograms =
  async (
    req,
    res
  ) => {
    try {
      const rows =
        await academicModel
          .getAllBatchPrograms(
            req.query
              .batch_id ||
              null,

            req.query
              .status ||
              null
          );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Batch Programs fetched successfully",
          data:
            rows,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET BATCH PROGRAMS ERROR:",
        error,
        "Failed to fetch Batch Programs"
      );
    }
  };

const deleteBatch =
  async (
    req,
    res
  ) => {
    try {
      const existing =
        await academicModel
          .getBatchById(
            req.params.id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Batch not found",
          });
      }

      const studentIds =
        await getAffectedStudentIds(
          "batch",
          req.params.id
        );

      await academicModel
        .deleteBatch(
          req.params.id
        );

      const authFailures =
        await deleteStudentAuthUsers(
          studentIds
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            authFailures.length
              ? "Batch and linked database data were deleted, but some student Auth accounts could not be removed."
              : "Batch and linked data deleted permanently",

          auth_cleanup_failures:
            authFailures,
        });
    } catch (error) {
      return sendServerError(
        res,
        "DELETE BATCH ERROR:",
        error,
        "Failed to delete batch"
      );
    }
  };

// ======================================================
// DEPARTMENTS
// ======================================================

const getDepartments =
  async (
    req,
    res
  ) => {
    try {
      const batchId =
        req.query
          .batch_id ||
        null;

      const departments =
        await academicModel
          .getAllDepartments(
            batchId
          );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Departments fetched successfully",
          data:
            departments,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET DEPARTMENTS ERROR:",
        error,
        "Failed to fetch departments"
      );
    }
  };

const getDepartment =
  async (
    req,
    res
  ) => {
    try {
      const department =
        await academicModel
          .getDepartmentById(
            req.params.id
          );

      if (
        !department
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Department not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Department fetched successfully",
          data:
            department,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET DEPARTMENT ERROR:",
        error,
        "Failed to fetch department"
      );
    }
  };

const createDepartment =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        code,
        description,
        status,
      } =
        req.body;

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Department name is required",
          });
      }

      const department =
        await academicModel
          .createDepartment({
            name:
              name.trim(),

            code:
              code?.trim() ||
              null,

            description:
              description?.trim() ||
              null,

            status:
              status ===
              "inactive"
                ? "inactive"
                : "active",
          });

      return res
        .status(201)
        .json({
          success: true,
          message:
            "Department created successfully",
          data:
            department,
        });
    } catch (error) {
      return sendServerError(
        res,
        "CREATE DEPARTMENT ERROR:",
        error,
        "Failed to create department"
      );
    }
  };

const updateDepartment =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        name,
        code,
        description,
        status,
      } =
        req.body;

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Department name is required",
          });
      }

      const existing =
        await academicModel
          .getDepartmentById(
            id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Department not found",
          });
      }

      const nextStatus =
        status ===
        "inactive"
          ? "inactive"
          : "active";

      const department =
        await academicModel
          .updateDepartment(
            id,
            {
              name:
                name.trim(),

              code:
                code?.trim() ||
                null,

              description:
                description?.trim() ||
                null,

              status:
                nextStatus,
            }
          );

      await syncAcademicAccessForEntity(
        "department",
        id
      );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Department updated successfully",
          data:
            department,
        });
    } catch (error) {
      return sendServerError(
        res,
        "UPDATE DEPARTMENT ERROR:",
        error,
        "Failed to update department"
      );
    }
  };

// ======================================================
// DEPARTMENT HARD DELETE
// ======================================================

const deleteDepartment =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const existing =
        await academicModel
          .getDepartmentById(
            id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Department not found",
          });
      }

      // Capture Auth IDs + material URLs before DB hard delete.
      const deletionContext =
        await academicModel
          .collectDepartmentDeletionContext(
            id
          );

      // Transactional Postgres hard delete.
      const databaseResult =
        await academicModel
          .deleteDepartment(
            id
          );

      // Profiles are already deleted in Postgres.
      // Remove corresponding Supabase Auth users.
      const authFailures =
        await deleteStudentAuthUsers(
          deletionContext
            ?.student_ids ||
            []
        );

      // Material rows are already deleted from DB.
      // Now remove physical Storage objects.
      const storageCleanup =
        await deleteStoredFiles(
          (
            deletionContext
              ?.materials ||
            []
          )
            .map(
              (material) =>
                material.file_url
            )
            .filter(
              Boolean
            )
        );

      const hasCleanupWarnings =
        authFailures.length >
          0 ||
        storageCleanup
          .failures
          .length >
          0 ||
        storageCleanup
          .skipped
          .length >
          0;

      return res
        .status(200)
        .json({
          success: true,

          message:
            hasCleanupWarnings
              ? "Department and all linked database records were deleted permanently. Some external Auth/Storage cleanup needs attention."
              : "Department, linked courses, enrollments, materials and academic data deleted permanently.",

          data:
            databaseResult ||
            null,

          cleanup: {
            student_auth_accounts_requested:
              deletionContext
                ?.student_ids
                ?.length ||
              0,

            student_auth_cleanup_failures:
              authFailures,

            material_records_found:
              deletionContext
                ?.materials
                ?.length ||
              0,

            storage_objects_deleted:
              storageCleanup
                .deleted,

            storage_cleanup_failures:
              storageCleanup
                .failures,

            storage_urls_skipped:
              storageCleanup
                .skipped,
          },
        });
    } catch (error) {
      return sendServerError(
        res,
        "DELETE DEPARTMENT ERROR:",
        error,
        "Failed to permanently delete department and its linked data"
      );
    }
  };

// ======================================================
// PROGRAMS
// ======================================================

const getPrograms =
  async (
    req,
    res
  ) => {
    try {
      const departmentId =
        req.query
          .department_id ||
        null;

      const batchId =
        req.query
          .batch_id ||
        null;

      const programs =
        await academicModel
          .getAllPrograms(
            departmentId,
            batchId
          );

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Programs fetched successfully",
          data:
            programs,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET PROGRAMS ERROR:",
        error,
        "Failed to fetch programs"
      );
    }
  };

const getProgram =
  async (
    req,
    res
  ) => {
    try {
      const program =
        await academicModel
          .getProgramById(
            req.params.id
          );

      if (!program) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Program not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          message:
            "Program fetched successfully",
          data:
            program,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET PROGRAM ERROR:",
        error,
        "Failed to fetch program"
      );
    }
  };

const createProgram =
  async (
    req,
    res
  ) => {
    try {
      const {
        department_id,
        name,
        code,
        degree_title,
        status,
      } =
        req.body;

      if (
        !department_id
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "department_id is required",
          });
      }

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Program name is required",
          });
      }

      const department =
        await academicModel
          .getDepartmentById(
            department_id
          );

      if (
        !department
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Selected department not found",
          });
      }

      const program =
        await academicModel
          .createProgram({
            department_id,

            name:
              name.trim(),

            code:
              code?.trim() ||
              null,

            degree_title:
              degree_title?.trim() ||
              null,

            status:
              status ===
              "inactive"
                ? "inactive"
                : "active",
          });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Program created successfully",

          data:
            program,
        });
    } catch (error) {
      return sendServerError(
        res,
        "CREATE PROGRAM ERROR:",
        error,
        "Failed to create program"
      );
    }
  };

const updateProgram =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        department_id,
        name,
        code,
        degree_title,
        status,
      } =
        req.body;

      if (
        !department_id
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "department_id is required",
          });
      }

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Program name is required",
          });
      }

      const existing =
        await academicModel
          .getProgramById(
            id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Program not found",
          });
      }

      const department =
        await academicModel
          .getDepartmentById(
            department_id
          );

      if (
        !department
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Selected department not found",
          });
      }

      const nextStatus =
        status ===
        "inactive"
          ? "inactive"
          : "active";

      const program =
        await academicModel
          .updateProgram(
            id,
            {
              department_id,

              name:
                name.trim(),

              code:
                code?.trim() ||
                null,

              degree_title:
                degree_title?.trim() ||
                null,

              status:
                nextStatus,
            }
          );

      await syncAcademicAccessForEntity(
        "program",
        id
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Program updated successfully",

          data:
            program,
        });
    } catch (error) {
      return sendServerError(
        res,
        "UPDATE PROGRAM ERROR:",
        error,
        "Failed to update program"
      );
    }
  };

const deleteProgram =
  async (
    req,
    res
  ) => {
    try {
      const existing =
        await academicModel
          .getProgramById(
            req.params.id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Program not found",
          });
      }

      const studentIds =
        await getAffectedStudentIds(
          "program",
          req.params.id
        );

      await academicModel
        .deleteProgram(
          req.params.id
        );

      const authFailures =
        await deleteStudentAuthUsers(
          studentIds
        );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            authFailures.length
              ? "Program and linked database data were deleted, but some student Auth accounts could not be removed."
              : "Program and linked data deleted permanently",

          auth_cleanup_failures:
            authFailures,
        });
    } catch (error) {
      return sendServerError(
        res,
        "DELETE PROGRAM ERROR:",
        error,
        "Failed to delete program"
      );
    }
  };

// ======================================================
// SEMESTERS
// ======================================================

const getSemesters =
  async (
    req,
    res
  ) => {
    try {
      const programId =
        req.query
          .program_id ||
        null;

      const semesters =
        await academicModel
          .getAllSemesters(
            programId
          );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Semesters fetched successfully",

          data:
            semesters,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET SEMESTERS ERROR:",
        error,
        "Failed to fetch semesters"
      );
    }
  };

const getSemester =
  async (
    req,
    res
  ) => {
    try {
      const semester =
        await academicModel
          .getSemesterById(
            req.params.id
          );

      if (!semester) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Semester not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Semester fetched successfully",

          data:
            semester,
        });
    } catch (error) {
      return sendServerError(
        res,
        "GET SEMESTER ERROR:",
        error,
        "Failed to fetch semester"
      );
    }
  };

const createSemester =
  async (
    req,
    res
  ) => {
    try {
      const {
        program_id,
        semester_number,
        name,
        status,
      } =
        req.body;

      if (!program_id) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "program_id is required",
          });
      }

      if (
        semester_number ===
          undefined ||
        semester_number ===
          null ||
        semester_number ===
          ""
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "semester_number is required",
          });
      }

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Semester name is required",
          });
      }

      const program =
        await academicModel
          .getProgramById(
            program_id
          );

      if (!program) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Selected program not found",
          });
      }

      const semester =
        await academicModel
          .createSemester({
            program_id,

            semester_number:
              Number(
                semester_number
              ),

            name:
              name.trim(),

            status:
              status ===
              "inactive"
                ? "inactive"
                : "active",
          });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Semester created successfully",

          data:
            semester,
        });
    } catch (error) {
      return sendServerError(
        res,
        "CREATE SEMESTER ERROR:",
        error,
        "Failed to create semester"
      );
    }
  };

  const createSemestersBulk = async (req, res) => {
  try {
    const {
      program_id,
      semesters,
    } = req.body;

    // ==================================================
    // PROGRAM
    // ==================================================

    if (!program_id) {
      return res.status(400).json({
        success: false,
        message: "program_id is required",
      });
    }

    const program =
      await academicModel.getProgramById(
        program_id
      );

    if (!program) {
      return res.status(404).json({
        success: false,
        message: "Selected Program not found",
      });
    }

    // ==================================================
    // SEMESTERS ARRAY
    // ==================================================

    if (
      !Array.isArray(semesters) ||
      semesters.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least one Semester is required",
      });
    }

    // ==================================================
    // EXISTING SEMESTERS
    // ==================================================

    const existingSemesters =
      await academicModel.getAllSemesters(
        program_id
      );

    const existingNumbers =
      new Set(
        (existingSemesters || []).map(
          (semester) =>
            Number(
              semester.semester_number
            )
        )
      );

    const requestNumbers =
      new Set();

    const payloads = [];

    // ==================================================
    // VALIDATE EVERY ROW
    // ==================================================

    for (const semester of semesters) {
      const semesterNumber =
        Number(
          semester.semester_number
        );

      const name =
        String(
          semester.name || ""
        ).trim();

      if (
        !Number.isInteger(
          semesterNumber
        ) ||
        semesterNumber < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Every Semester must have a valid positive semester number",
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: `Semester ${semesterNumber} requires a name`,
        });
      }

      // Already exists in DB
      if (
        existingNumbers.has(
          semesterNumber
        )
      ) {
        return res.status(409).json({
          success: false,
          message: `Semester ${semesterNumber} already exists for ${program.name}`,
        });
      }

      // Duplicate in same request
      if (
        requestNumbers.has(
          semesterNumber
        )
      ) {
        return res.status(400).json({
          success: false,
          message: `Semester number ${semesterNumber} is repeated`,
        });
      }

      requestNumbers.add(
        semesterNumber
      );

      payloads.push({
        program_id,

        semester_number:
          semesterNumber,

        name,

        status:
          semester.status ===
          "inactive"
            ? "inactive"
            : "active",
      });
    }

    // ==================================================
    // CREATE ALL
    // ==================================================

    const created =
      await academicModel.createSemestersBulk(
        payloads
      );

    return res.status(201).json({
      success: true,

      message: `${created.length} Semester${
        created.length === 1 ? "" : "s"
      } created successfully`,

      data: created,
    });
  } catch (error) {
    return sendServerError(
      res,
      "CREATE BULK SEMESTERS ERROR:",
      error,
      "Failed to create Semesters"
    );
  }
};

const updateSemester =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      const {
        program_id,
        semester_number,
        name,
        status,
      } =
        req.body;

      if (!program_id) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "program_id is required",
          });
      }

      if (
        semester_number ===
          undefined ||
        semester_number ===
          null ||
        semester_number ===
          ""
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "semester_number is required",
          });
      }

      if (
        typeof name !==
          "string" ||
        !name.trim()
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Semester name is required",
          });
      }

      const existing =
        await academicModel
          .getSemesterById(
            id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Semester not found",
          });
      }

      const program =
        await academicModel
          .getProgramById(
            program_id
          );

      if (!program) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Selected program not found",
          });
      }

      const nextStatus =
        status ===
        "inactive"
          ? "inactive"
          : "active";

      const semester =
        await academicModel
          .updateSemester(
            id,
            {
              program_id,

              semester_number:
                Number(
                  semester_number
                ),

              name:
                name.trim(),

              status:
                nextStatus,
            }
          );

      await syncAcademicAccessForEntity(
        "semester",
        id
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Semester updated successfully",

          data:
            semester,
        });
    } catch (error) {
      return sendServerError(
        res,
        "UPDATE SEMESTER ERROR:",
        error,
        "Failed to update semester"
      );
    }
  };

const deleteSemester =
  async (
    req,
    res
  ) => {
    try {
      const existing =
        await academicModel
          .getSemesterById(
            req.params.id
          );

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Semester not found",
          });
      }

      const studentIds =
        await getAffectedStudentIds(
          "semester",
          req.params.id
        );

      await academicModel
        .deleteSemester(
          req.params.id
        );

      const authFailures =
        await deleteStudentAuthUsers(
          studentIds
        );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            authFailures.length
              ? "Semester and linked database data were deleted, but some student Auth accounts could not be removed."
              : "Semester and linked data deleted permanently",

          auth_cleanup_failures:
            authFailures,
        });
    } catch (error) {
      return sendServerError(
        res,
        "DELETE SEMESTER ERROR:",
        error,
        "Failed to delete semester"
      );
    }
  };

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getBatches,
  getBatch,
  createBatch,
  updateBatch,
  deleteBatch,
  getBatchPrograms,

  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,

  getPrograms,
  getProgram,
  createProgram,
  updateProgram,
  deleteProgram,

  getSemesters,
  getSemester,
  createSemester,
  createSemestersBulk, // IMPORTANT
  updateSemester,
  deleteSemester,
};