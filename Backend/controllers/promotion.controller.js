const {
  supabaseAdmin,
} = require("../config/supabase");

const assessments = require("../models/assessment.model");

const {
  handle,
  httpError,
  uuid,
  ids,
} = require("../utils/api");


// ======================================================
// RUN PROMOTION RPC
// ======================================================

const runPromotion =
  async ({
    studentIds,
    toSemesterId,
    adminId,
  }) => {

    const {
      data,
      error,
    } =
      await supabaseAdmin.rpc(
        "admin_promote_students",
        {
          p_student_ids:
            studentIds,

          p_to_semester_id:
            toSemesterId,

          p_changed_by:
            adminId || null,
        }
      );


    if (error) {
      throw error;
    }


    return (
      data || {
        promoted: 0,
        skipped: 0,
        errors: [],
      }
    );
  };


// ======================================================
// ASSESSMENT PROMOTION SAFEGUARD
// ======================================================

const ensureNoPendingAssessments = async (studentIds) => {
  try {
    const blockers = await assessments.getPromotionBlockers(studentIds);
    if (!blockers.length) return;

    const preview = blockers.slice(0, 3).map((item) => {
      const course = item.course_assignment?.course?.name || "Course";
      const title = item.plan?.title || "Assessment";
      return `${course}: ${title}`;
    });

    throw httpError(
      `${blockers.length} assessment${blockers.length === 1 ? "" : "s"} still require completion/cancellation before promotion. ${preview.join("; ")}`,
      409
    );
  } catch (error) {
    // Keep the pre-assessment migration promotion flow usable until 005 is installed.
    if (["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(error.code)) return;
    throw error;
  }
};

// Advance the Batch Program's current Semester only when the request promoted
// the complete active cohort from one Batch + Program + Semester. Partial or
// mixed promotions must not move the cohort-level pointer.
const getCompletePromotionCohort = async (studentIds) => {
  const { data: students, error: studentError } = await supabaseAdmin
    .from("profiles")
    .select("id, batch_id, program_id, semester_id, is_active")
    .in("id", studentIds)
    .eq("role", "student");
  if (studentError) throw studentError;
  if ((students || []).length !== studentIds.length || students.some((row) => !row.is_active)) {
    return null;
  }

  const contexts = new Set(
    students.map((row) => `${row.batch_id}:${row.program_id}:${row.semester_id}`)
  );
  if (contexts.size !== 1) return null;

  const [context] = students;
  const { count, error: countError } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "student")
    .eq("is_active", true)
    .eq("batch_id", context.batch_id)
    .eq("program_id", context.program_id)
    .eq("semester_id", context.semester_id);
  if (countError) throw countError;
  if (count !== studentIds.length) return null;

  return {
    batch_id: context.batch_id,
    program_id: context.program_id,
    from_semester_id: context.semester_id,
    size: studentIds.length,
  };
};

const syncCompleteCohortCurrentSemester = async (cohort, toSemesterId, promoted) => {
  if (!cohort || !promoted || promoted !== cohort.size) return false;

  const { data: updatedMappings, error: mappingError } = await supabaseAdmin
    .from("academic_batch_programs")
    .update({ current_semester_id: toSemesterId, updated_at: new Date().toISOString() })
    .eq("batch_id", cohort.batch_id)
    .eq("program_id", cohort.program_id)
    .eq("status", "active")
    .or(
      `current_semester_id.eq.${cohort.from_semester_id},current_semester_id.is.null`
    )
    .select("id");
  if (mappingError) {
    console.error("BATCH PROGRAM CURRENT SEMESTER SYNC ERROR:", mappingError);
    return false;
  }
  return Boolean(updatedMappings?.length);
};

// ======================================================
// SINGLE PROMOTION
// ======================================================

const promoteStudent =
  handle(
    async (
      req,
      res
    ) => {

      const studentId =
        uuid(
          req.params.id,
          "Student"
        );


      const toSemesterId =
        uuid(
          req.body
            .to_semester_id,

          "Target semester"
        );


      const completeCohort =
        await getCompletePromotionCohort([studentId]);


      await ensureNoPendingAssessments([studentId]);

      const data =
        await runPromotion({
          studentIds: [
            studentId,
          ],

          toSemesterId,

          adminId:
            req.admin.id,
        });

      const batchCurrentSemesterUpdated =
        await syncCompleteCohortCurrentSemester(
          completeCohort,
          toSemesterId,
          data.promoted
        );


      if (!data.promoted) {

        const reason =
          Array.isArray(
            data.errors
          )
            ? data.errors[0]
                ?.reason
            : null;


        throw httpError(
          reason ||
            "Student could not be promoted"
        );
      }


      res.json({
        success: true,

        message:
          "Student promoted successfully. Previous-semester Regular enrollments were completed and preserved in history.",

        data: {
          ...data,
          batch_current_semester_updated:
            batchCurrentSemesterUpdated,
        },
      });
    }
  );


// ======================================================
// BULK PROMOTION
// ======================================================

const promoteStudentsBulk =
  handle(
    async (
      req,
      res
    ) => {

      const studentIds =
        ids(
          req.body.student_ids,
          "student IDs"
        );


      const toSemesterId =
        uuid(
          req.body
            .to_semester_id,

          "Target semester"
        );


      const completeCohort =
        await getCompletePromotionCohort(studentIds);


      await ensureNoPendingAssessments(studentIds);

      const data =
        await runPromotion({
          studentIds,

          toSemesterId,

          adminId:
            req.admin.id,
        });

      const batchCurrentSemesterUpdated =
        await syncCompleteCohortCurrentSemester(
          completeCohort,
          toSemesterId,
          data.promoted
        );


      res.json({
        success: true,

        message:
          "Promotion completed. Previous-semester Regular enrollments were completed; students were not automatically enrolled in new-semester courses.",

        data: {
          ...data,
          batch_current_semester_updated:
            batchCurrentSemesterUpdated,
        },
      });
    }
  );


module.exports = {
  promoteStudent,
  promoteStudentsBulk,
};
