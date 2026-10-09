const {
  createActivityLog,
} = require("../models/activityLog.model");

const SENSITIVE_KEYS = new Set([
  "password",
  "confirm_password",
  "new_password",
  "current_password",
  "temporary_password",
  "access_token",
  "refresh_token",
  "token",
]);

// ======================================================
// REMOVE SENSITIVE DATA
// ======================================================

const sanitize = (value) => {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return value ?? null;
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      sanitize
    );
  }

  const result = {};

  Object.entries(
    value
  ).forEach(
    ([
      key,
      val,
    ]) => {
      if (
        SENSITIVE_KEYS.has(
          key.toLowerCase()
        )
      ) {
        result[key] =
          "[REDACTED]";
      } else if (
        val &&
        typeof val ===
          "object"
      ) {
        result[key] =
          sanitize(val);
      } else {
        result[key] =
          val;
      }
    }
  );

  return result;
};

// ======================================================
// ROUTE INFORMATION
// ======================================================

const getRouteInfo = (
  req
) => {
  const pathname =
    req.originalUrl
      .split("?")[0]
      .replace(
        /^\/api\/?/,
        ""
      );

  const parts =
    pathname
      .split("/")
      .filter(Boolean);

  const root =
    parts[0] || "";

  let module =
    root;

  let targetType =
    null;

  const moduleMap = {
    students:
      "student",

    teachers:
      "teacher",

    courses:
      "course",

    "course-assignments":
      "course_assignment",

    enrollments:
      "enrollment",

    promotions:
      "promotion",

    "academic-structure":
      "academic_structure",

    upload:
      "system",
  };

  module =
    moduleMap[root] ||
    root;

  if (
    root ===
    "students"
  ) {
    targetType =
      "student";
  } else if (
    root ===
    "teachers"
  ) {
    targetType =
      "teacher";
  } else if (
    root ===
    "courses"
  ) {
    targetType =
      "course";
  } else if (
    root ===
    "course-assignments"
  ) {
    targetType =
      "course_assignment";
  } else if (
    root ===
    "enrollments"
  ) {
    targetType =
      "enrollment";
  } else if (
    root ===
    "academic-structure"
  ) {
    if (parts[1]) {
      targetType =
        parts[1].replace(
          /s$/,
          ""
        );
    }
  }

  return {
    pathname,
    parts,
    root,
    module,
    targetType,
  };
};

// ======================================================
// TARGET ID
// ======================================================

const getTargetId = (
  req
) =>
  req.params?.id ||
  req.params?.student_id ||
  req.params?.course_id ||
  req.body?.id ||
  null;

// ======================================================
// ACTION NAME
// ======================================================

const getAction = (
  req,
  info
) => {
  const method =
    req.method.toUpperCase();

  const path =
    info.pathname.toLowerCase();

  const importMatch =
    path.match(
      /^(students|teachers)\/import\/(commit|images)$/
    );

  if (
    method ===
      "POST" &&
    importMatch
  ) {
    const [
      ,
      resource,
      operation,
    ] = importMatch;

    const singular =
      resource.replace(
        /s$/,
        ""
      );

    return operation ===
      "commit"
      ? `bulk_import_${resource}`
      : `bulk_upload_${singular}_avatars`;
  }

  if (
    method ===
      "POST" &&
    path.includes(
      "promotions/bulk"
    )
  ) {
    return "bulk_promote";
  }

  if (
    method ===
      "POST" &&
    path.includes(
      "promotions/student/"
    )
  ) {
    return "promote";
  }

  if (
    method ===
      "POST" &&
    path.includes(
      "enrollments/bulk"
    )
  ) {
    return "bulk_enroll";
  }

  if (
    method ===
      "PUT" &&
    path.includes(
      "course-assignments/"
    ) &&
    path.endsWith(
      "/teacher"
    )
  ) {
    return "change_teacher";
  }

  if (
    method ===
      "POST" &&
    path.includes(
      "/avatar"
    )
  ) {
    return "upload_avatar";
  }

  if (
    method ===
      "PATCH" &&
    path.includes(
      "/status"
    )
  ) {
    return req.body
      ?.is_active ===
      false
      ? "deactivate"
      : "activate";
  }

  if (
    method ===
      "PATCH" &&
    (
      path.includes(
        "/reset-password"
      ) ||
      path.includes(
        "/password"
      )
    )
  ) {
    return "reset_password";
  }

  if (
    method ===
    "POST"
  ) {
    return "create";
  }

  if (
    method ===
      "PUT" ||
    method ===
      "PATCH"
  ) {
    return "update";
  }

  if (
    method ===
    "DELETE"
  ) {
    return "delete";
  }

  return method.toLowerCase();
};

// ======================================================
// TARGET LABEL
// ======================================================

const getTargetLabel = ({
  req,
  responseBody,
  action,
}) => {
  const responseData =
    responseBody?.data;

  if (
    responseData &&
    !Array.isArray(
      responseData
    )
  ) {
    return (
      responseData
        .full_name ||
      responseData.name ||
      responseData.email ||
      responseData.course
        ?.name ||
      null
    );
  }

  const body =
    req.body || {};

  if (
    Array.isArray(
      body.student_ids
    )
  ) {
    return `${body.student_ids.length} students`;
  }

  return (
    body.full_name ||
    body.name ||
    body.email ||
    (
      action ===
      "delete"
        ? "Deleted record"
        : null
    )
  );
};

// ======================================================
// ACTIVITY LOGGER
// ======================================================

const activityLogger = (
  req,
  res,
  next
) => {
  const method =
    req.method.toUpperCase();

  const shouldLog =
    [
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
    ].includes(method);

  if (!shouldLog) {
    return next();
  }

  let responseBody =
    null;

  const originalJson =
    res.json.bind(res);

  res.json = (
    body
  ) => {
    responseBody =
      body;

    return originalJson(
      body
    );
  };

  res.on(
    "finish",
    () => {
      // Authentication middleware runs before the
      // controller. req.admin is available here when
      // the response has completed.
      if (!req.admin) {
        return;
      }

      // Read-only import validation must not be logged.
      if (
        req.skipActivityLog
      ) {
        return;
      }

      // Only successful operations are saved.
      if (
        res.statusCode >=
        400
      ) {
        return;
      }

      const info =
        getRouteInfo(req);

      const action =
        req.activitySummary
          ?.action ||
        getAction(
          req,
          info
        );

      const targetId =
        getTargetId(req);

      const targetLabel =
        req.activitySummary
          ?.targetLabel ||
        getTargetLabel({
          req,
          responseBody,
          action,
        });

      let newValues =
        sanitize(
          req.activitySummary
            ?.values ||
          responseBody
            ?.data ||
          req.body ||
          null
        );

      // Save only compact details for bulk enrollment.
      if (
        action ===
          "bulk_enroll" &&
        req.body
      ) {
        newValues = {
          course_id:
            req.body
              .course_id ||
            null,

          student_count:
            Array.isArray(
              req.body
                .student_ids
            )
              ? req.body
                  .student_ids
                  .length
              : 0,

          enrollment_type:
            req.body
              .enrollment_type ||
            "regular",

          status:
            req.body
              .status ||
            null,
        };
      }

      createActivityLog({
        actor_id:
          req.admin.id ||
          req.user?.id ||
          null,

        actor_role:
          req.admin.role ||
          "admin",

        action,

        module:
          req.activitySummary
            ?.module ||
          info.module,

        target_type:
          req.activitySummary
            ?.targetType ||
          info.targetType,

        target_id:
          targetId,

        target_label:
          targetLabel,

        old_values:
          null,

        new_values:
          newValues,

        ip_address:
          req.ip?.replace(
            "::ffff:",
            ""
          ) ||
          null,

        user_agent:
          req.get(
            "user-agent"
          ) ||
          null,
      }).catch(
        (error) => {
          console.error(
            "ACTIVITY LOGGER ERROR:",
            error
          );
        }
      );
    }
  );

  next();
};

module.exports =
  activityLogger;