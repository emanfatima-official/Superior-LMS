const attendance =
  require(
    "../models/attendance.model"
  );

const {
  handle,
  httpError,
  uuid,
} =
  require(
    "../utils/api"
  );

const allowedStatuses = [
  "present",
  "absent",
  "late",
  "excused",
];

// ======================================================
// FILTER HELPERS
// ======================================================

const optionalUuid = (
  value,
  label
) =>
  value
    ? uuid(
        value,
        label
      )
    : undefined;

const parseFilters = (
  query = {}
) => {
  const status =
    query.status
      ? String(
          query.status
        )
          .trim()
          .toLowerCase()
      : undefined;

  if (
    status &&
    !allowedStatuses.includes(
      status
    )
  ) {
    throw httpError(
      "Attendance status must be Present, Absent, Late or Excused"
    );
  }

  const datePattern =
    /^\d{4}-\d{2}-\d{2}$/;

  const dateFrom =
    query.date_from ||
    undefined;

  const dateTo =
    query.date_to ||
    undefined;

  if (
    dateFrom &&
    !datePattern.test(
      dateFrom
    )
  ) {
    throw httpError(
      "date_from must use YYYY-MM-DD format"
    );
  }

  if (
    dateTo &&
    !datePattern.test(
      dateTo
    )
  ) {
    throw httpError(
      "date_to must use YYYY-MM-DD format"
    );
  }

  if (
    dateFrom &&
    dateTo &&
    dateFrom >
      dateTo
  ) {
    throw httpError(
      "date_from cannot be after date_to"
    );
  }

  return {
    batch_id:
      optionalUuid(
        query.batch_id,
        "Batch"
      ),

    department_id:
      optionalUuid(
        query.department_id,
        "Department"
      ),

    program_id:
      optionalUuid(
        query.program_id,
        "Program"
      ),

    semester_id:
      optionalUuid(
        query.semester_id,
        "Semester"
      ),

    course_assignment_id:
      optionalUuid(
        query.course_assignment_id,
        "Course Assignment"
      ),

    student_id:
      optionalUuid(
        query.student_id,
        "Student"
      ),

    status,

    date_from:
      dateFrom,

    date_to:
      dateTo,

    at_risk_threshold:
      query.at_risk_threshold
        ? Math.max(
            1,
            Math.min(
              100,
              Number(
                query.at_risk_threshold
              ) || 75
            )
          )
        : 75,
  };
};

// ======================================================
// OPTIONS
// ======================================================

const options =
  handle(
    async (
      req,
      res
    ) => {
      const data =
        await attendance.getOptions(
          parseFilters(
            req.query
          )
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// OVERVIEW
// ======================================================

const overview =
  handle(
    async (
      req,
      res
    ) => {
      const data =
        await attendance.getOverview(
          parseFilters(
            req.query
          )
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// SEMESTER
// ======================================================

const semester =
  handle(
    async (
      req,
      res
    ) => {
      const filters =
        parseFilters(
          req.query
        );

      if (
        !filters.semester_id
      ) {
        throw httpError(
          "Select a Semester to view the semester attendance matrix"
        );
      }

      const data =
        await attendance.getSemesterReport(
          filters
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// COURSE
// ======================================================

const course =
  handle(
    async (
      req,
      res
    ) => {
      const filters =
        parseFilters(
          req.query
        );

      if (
        !filters.course_assignment_id
      ) {
        throw httpError(
          "Select a Course to view the course attendance report"
        );
      }

      const data =
        await attendance.getCourseReport(
          filters
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// STUDENT
// ======================================================

const student =
  handle(
    async (
      req,
      res
    ) => {
      const filters =
        parseFilters(
          req.query
        );

      if (
        !filters.student_id
      ) {
        throw httpError(
          "Select a Student to view the student attendance report"
        );
      }

      const data =
        await attendance.getStudentReport(
          filters
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// DETAILED SESSIONS
// ======================================================

const sessions =
  handle(
    async (
      req,
      res
    ) => {
      const data =
        await attendance.getSessions(
          parseFilters(
            req.query
          )
        );

      res.json({
        success: true,
        data,
      });
    }
  );

// ======================================================
// EXPORT
// ======================================================

const exportData =
  handle(
    async (
      req,
      res
    ) => {
      const data =
        await attendance.getExportData(
          parseFilters(
            req.query
          )
        );

      res.json({
        success: true,
        data,
      });
    }
  );

module.exports = {
  options,
  overview,
  semester,
  course,
  student,
  sessions,
  exportData,
};