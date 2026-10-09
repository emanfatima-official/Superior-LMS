// ======================================================
// HTTP ERROR
// ======================================================

const httpError = (message, status = 400) =>
  Object.assign(new Error(message), {
    status,
  });

// ======================================================
// UUID VALIDATION
// ======================================================

const uuid = (value, label = "ID") => {
  if (
    typeof value !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      value
    )
  ) {
    throw httpError(
      `${label} must be a valid ID`
    );
  }

  return value;
};

// ======================================================
// MULTIPLE UUID VALIDATION
// ======================================================

const ids = (values, label, max = 500) => {
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > max
  ) {
    throw httpError(
      `Select between 1 and ${max} ${label}`
    );
  }

  return [
    ...new Set(
      values.map((value) =>
        uuid(value, label)
      )
    ),
  ];
};

// ======================================================
// SUPABASE QUERY RESULT
// ======================================================

const result = async (query) => {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
};

// ======================================================
// DATABASE ERROR MESSAGES
//
// Do not label every missing column or relationship
// as a missing migration.
// ======================================================

const DATABASE_ERROR_MESSAGES = {
  "42P01":
    "A database table referenced by this feature was not found. Check the table name and applied migrations.",

  "42703":
    "A database column referenced by this feature was not found. Check the backend select/insert fields against the current schema.",

  PGRST200:
    "A Supabase relationship could not be resolved. Check the foreign-key relationship and the select() join name.",

  PGRST201:
    "A Supabase relationship is ambiguous. Specify the foreign-key name in the select() join.",

  PGRST202:
    "A Supabase database function could not be found. Check its name and arguments, then refresh the schema cache.",

  PGRST204:
    "A column in this request is missing from Supabase's schema cache. Check the column name and refresh the schema cache if it exists.",

  PGRST205:
    "A table used by this feature is missing from Supabase's schema cache. Check the table name and refresh the schema cache if it exists.",

  "42883":
    "A database function or operator used by this feature was not found. Check the function name and argument types.",
};

// ======================================================
// SEND API ERROR
// ======================================================

const sendError = (res, error) => {
  console.error(
    "API error:",
    error
  );

  // ----------------------------------------------------
  // APPLICATION ERRORS
  // ----------------------------------------------------

  if (
    Number.isInteger(error?.status) &&
    error.status >= 400 &&
    error.status < 600
  ) {
    return res
      .status(error.status)
      .json({
        success: false,

        message:
          error.message,

        ...(error.code
          ? {
              code: error.code,
            }
          : {}),
      });
  }

  // ----------------------------------------------------
  // DATABASE ERROR CODE
  // ----------------------------------------------------

  const code =
    error?.code ||
    "INTERNAL_ERROR";

  const isSchemaError =
    Object.prototype.hasOwnProperty.call(
      DATABASE_ERROR_MESSAGES,
      code
    );

  // ----------------------------------------------------
  // HTTP STATUS
  // ----------------------------------------------------

  const status = isSchemaError
    ? 500
    : {
        "23505": 409,

        "23503": 409,

        "23514": 400,

        "22P02": 400,

        "22007": 400,

        "42501": 403,
      }[code] || 500;

  // ----------------------------------------------------
  // USER-FACING MESSAGE
  // ----------------------------------------------------

  const message = isSchemaError
    ? DATABASE_ERROR_MESSAGES[code]
    : status === 409
      ? "A duplicate or linked record prevents this change. Check existing data."
      : status === 400
        ? "The selected values are invalid or do not match the database constraints."
        : status === 403
          ? "You do not have permission to perform this operation."
          : "Unable to complete the request. Please try again.";

  // ----------------------------------------------------
  // DEBUG DETAILS
  //
  // Show database details only in development.
  // ----------------------------------------------------

  const isDevelopment =
    process.env.NODE_ENV !== "production";

  return res
    .status(status)
    .json({
      success: false,

      message,

      code,

      ...(isDevelopment
        ? {
            debug: {
              message:
                error?.message ||
                null,

              details:
                error?.details ||
                null,

              hint:
                error?.hint ||
                null,
            },
          }
        : {}),
    });
};

// ======================================================
// ASYNC CONTROLLER WRAPPER
// ======================================================

const handle = (fn) =>
  async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      sendError(
        res,
        error
      );
    }
  };

// ======================================================
// FETCH ALL ROWS
//
// Supabase may apply a per-request row limit.
// Fetch records in pages of 500.
// ======================================================

const allRows = async (buildQuery) => {
  const rows = [];

  for (
    let start = 0;
    ;
    start += 500
  ) {
    const page = await result(
      buildQuery().range(
        start,
        start + 499
      )
    );

    rows.push(
      ...(page || [])
    );

    if (
      !page ||
      page.length < 500
    ) {
      return rows;
    }
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  httpError,
  uuid,
  ids,
  result,
  sendError,
  handle,
  allRows,
};