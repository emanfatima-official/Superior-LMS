const {
  comparable,
  normalizeEmail,
  normalizeCnic,
  formatCnic,
  integer,
  booleanValue,
  createImportEngine,
  createProfileImageImporter,
} = require("../utils/importEngine");

const { authEmailFromCnic } = require("../utils/authIdentity");

// ======================================================
// SEMESTER NORMALIZATION
// ======================================================

const SEMESTER_WORDS = new Map([
  ["first", 1],
  ["one", 1],
  ["second", 2],
  ["two", 2],
  ["third", 3],
  ["three", 3],
  ["fourth", 4],
  ["forth", 4],
  ["four", 4],
  ["fifth", 5],
  ["five", 5],
  ["sixth", 6],
  ["six", 6],
  ["seventh", 7],
  ["seven", 7],
  ["eighth", 8],
  ["eight", 8],
  ["ninth", 9],
  ["nine", 9],
  ["tenth", 10],
  ["ten", 10],
]);

const semesterNumber = (value) => {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) {
    return null;
  }

  const numericMatch = raw.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\b/
  );

  if (numericMatch) {
    const parsed = Number.parseInt(
      numericMatch[1],
      10
    );

    return parsed >= 1 && parsed <= 20
      ? parsed
      : null;
  }

  for (const [word, number] of SEMESTER_WORDS) {
    if (
      new RegExp(
        `\\b${word}\\b`,
        "i"
      ).test(raw)
    ) {
      return number;
    }
  }

  return null;
};

// ======================================================
// SESSION / BATCH NORMALIZATION
// ======================================================

const sessionInfo = (value) => {
  const raw = String(
    value ?? ""
  ).trim();

  const lower =
    raw.toLowerCase();

  const years =
    raw.match(
      /\b(?:19|20|21)\d{2}\b/g
    ) || [];

  let term = null;

  if (
    /\b(fall|autumn)\b/.test(
      lower
    )
  ) {
    term = "fall";
  } else if (
    /\bspring\b/.test(lower)
  ) {
    term = "spring";
  } else if (
    /\bsummer\b/.test(lower)
  ) {
    term = "summer";
  }

  return {
    label: raw || null,
    term,

    start_year:
      integer(years[0]),

    end_year:
      integer(years[1]),
  };
};

const normalizeAdmissionType = (
  value
) => {
  const raw = String(
    value ?? ""
  )
    .trim()
    .toLowerCase();

  if (!raw) {
    return null;
  }

  const key =
    comparable(raw);

  if (
    [
      "regular",
      "normal",
      "fresh",
      "freshadmission",
    ].includes(key)
  ) {
    return "regular";
  }

  if (
    [
      "lateral",
      "lateralentry",
      "lateraladmission",
      "5thsemesterentry",
      "fifthsemesterentry",
    ].includes(key)
  ) {
    return "lateral";
  }

  if (
    [
      "transfer",
      "migration",
      "migrated",
      "transferstudent",
    ].includes(key)
  ) {
    return "transfer";
  }

  if (key === "legacy") {
    return "legacy";
  }

  return "__invalid__";
};

// ======================================================
// CNIC / PHONE HELPERS
// ======================================================

const extractCnic = (value) => {
  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return "";
  }

  const formatted =
    raw.match(
      /(?:^|\D)(\d{5})[-\s]?(\d{7})[-\s]?(\d)(?:\D|$)/
    );

  if (formatted) {
    return `${formatted[1]}${formatted[2]}${formatted[3]}`;
  }

  const digits =
    normalizeCnic(raw);

  return digits.length === 13
    ? digits
    : "";
};

const extractPhone = (value) => {
  const raw = String(
    value ?? ""
  ).trim();

  if (!raw) {
    return null;
  }

  const match =
    raw.match(
      /(?:\+92|0092|92|0)?3\d{2}[-\s]?\d{7}/
    );

  return match
    ? match[0].replace(
        /\s+/g,
        ""
      )
    : null;
};

// ======================================================
// NORMALIZE IMPORT ROW
// ======================================================

const normalizeRow = (
  row,
  index,
  helpers
) => {
  const session =
    sessionInfo(
      row.session ??
        row.intake_session ??
        row.admission_session ??
        row.academic_session ??
        row.batch ??
        row.batch_name ??
        row.batch_year
    );

  const active =
    booleanValue(
      row.is_active ??
        row.status,
      true
    );

  const combinedCnic =
    row.cnic ??
    row.cnic_no ??
    row.cnic_number ??
    row.national_id ??
    row.b_form ??
    row.bform ??
    row.username ??
    row.cnic_and_mobile;

  const cnicKey =
    extractCnic(
      combinedCnic
    );

  const rawProgramName =
    helpers.text(
      row.program_name ??
        row.program ??
        row.programme ??
        row.degree_program ??
        row.program_and_session
    );

  const rawProgramCode =
    helpers.text(
      row.program_code ??
        row.degree_code ??
        row.programme_code
    );

  const admissionTypeRaw =
    helpers.text(
      row.admission_type ??
        row.intake_type ??
        row.entry_type ??
        row.student_type
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
          row.student_name ??
          row.student_details ??
          row.name
      ),

    father_name:
      helpers.text(
        row.father_name ??
          row.father ??
          row.fathers_name ??
          row.guardian_father_name
      ),

    email:
      normalizeEmail(
        row.email ??
          row.email_address ??
          row.student_email ??
          row.personal_email ??
          row.contact_email
      ) || null,

    student_id:
      helpers.text(
        row.student_id ??
          row.registration_no ??
          row.registration_number ??
          row.registration_id ??
          row.reg_no
      ),

    cnic:
      formatCnic(
        cnicKey
      ),

    cnic_key:
      cnicKey,

    auth_email:
      cnicKey.length === 13
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
      ) ||
      extractPhone(
        combinedCnic
      ) ||
      null,

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

    session:
      session.label,

    session_term:
      session.term,

    batch_start_year:
      integer(
        row.batch_start_year ??
          row.start_year ??
          row.intake_year
      ) ??
      session.start_year,

    batch_end_year:
      integer(
        row.batch_end_year ??
          row.end_year
      ) ??
      session.end_year,

    admission_type_raw:
      admissionTypeRaw || null,

    admission_type:
      normalizeAdmissionType(
        admissionTypeRaw
      ),

    department_reference:
      helpers.text(
        row.department_code ??
          row.department ??
          row.department_name ??
          row.dept ??
          row.dept_code
      ),

    program_name:
      rawProgramName,

    program_code:
      rawProgramCode,

    semester_number:
      semesterNumber(
        row.semester_number ??
          row.semester ??
          row.semester_name ??
          row.semester_no ??
          row.current_semester
      ),

    is_active:
      active.value,

    is_active_valid:
      active.valid,
  };
};

// ======================================================
// EXACT MASTER-DATA MATCHING
// ======================================================

const activeStatus = (
  row
) =>
  String(
    row?.status ||
      "active"
  ).toLowerCase() ===
  "active";

const matchByNameOrCode = (
  rows,
  reference
) => {
  const key =
    comparable(reference);

  if (!key) {
    return [];
  }

  return rows.filter(
    (row) =>
      comparable(
        row.name
      ) === key ||
      comparable(
        row.code
      ) === key
  );
};

const matchByName = (
  rows,
  reference
) => {
  const key =
    comparable(reference);

  if (!key) {
    return [];
  }

  return rows.filter(
    (row) =>
      comparable(
        row.name
      ) === key
  );
};

const matchByCode = (
  rows,
  reference
) => {
  const key =
    comparable(reference);

  if (!key) {
    return [];
  }

  return rows.filter(
    (row) =>
      comparable(
        row.code
      ) === key
  );
};

const resolveOptionalDepartment = (
  row,
  catalog,
  errors
) => {
  if (
    !row.department_reference
  ) {
    return null;
  }

  const matches =
    matchByNameOrCode(
      catalog.departments,
      row.department_reference
    );

  if (!matches.length) {
    errors.push(
      `Department "${row.department_reference}" was not found in Academic Structure.`
    );

    return null;
  }

  if (
    matches.length > 1
  ) {
    errors.push(
      `Department "${row.department_reference}" is ambiguous. Use its exact code.`
    );

    return null;
  }

  return matches[0];
};

const resolveProgram = (
  row,
  catalog,
  department,
  errors
) => {
  if (
    !row.program_name &&
    !row.program_code
  ) {
    errors.push(
      "Program name or Program code is required."
    );

    return null;
  }

  const pool = department
    ? catalog.programs.filter(
        (program) =>
          String(
            program.department_id
          ) ===
          String(
            department.id
          )
      )
    : catalog.programs;

  let program = null;

  if (
    row.program_name &&
    row.program_code
  ) {
    const nameMatches =
      matchByName(
        pool,
        row.program_name
      );

    const codeMatches =
      matchByCode(
        pool,
        row.program_code
      );

    if (
      !nameMatches.length
    ) {
      errors.push(
        `Program name "${row.program_name}" was not found.`
      );

      return null;
    }

    if (
      !codeMatches.length
    ) {
      errors.push(
        `Program code "${row.program_code}" was not found.`
      );

      return null;
    }

    if (
      nameMatches.length > 1
    ) {
      errors.push(
        `Program name "${row.program_name}" matches more than one Program. Use Program code.`
      );

      return null;
    }

    if (
      codeMatches.length > 1
    ) {
      errors.push(
        `Program code "${row.program_code}" is duplicated.`
      );

      return null;
    }

    if (
      String(
        nameMatches[0].id
      ) !==
      String(
        codeMatches[0].id
      )
    ) {
      errors.push(
        `Program name "${row.program_name}" and code "${row.program_code}" do not refer to the same Program.`
      );

      return null;
    }

    program =
      nameMatches[0];
  } else if (
    row.program_code
  ) {
    const matches =
      matchByCode(
        pool,
        row.program_code
      );

    if (
      !matches.length
    ) {
      errors.push(
        `Program code "${row.program_code}" was not found.`
      );

      return null;
    }

    if (
      matches.length > 1
    ) {
      errors.push(
        `Program code "${row.program_code}" is duplicated.`
      );

      return null;
    }

    program =
      matches[0];
  } else {
    // A generic "Program" column may contain
    // either Program Name or Program Code.

    const matches =
      matchByNameOrCode(
        pool,
        row.program_name
      );

    if (
      !matches.length
    ) {
      errors.push(
        `Program "${row.program_name}" was not found by exact name or code.`
      );

      return null;
    }

    if (
      matches.length > 1
    ) {
      errors.push(
        `Program "${row.program_name}" is ambiguous. Add a Program Code column.`
      );

      return null;
    }

    program =
      matches[0];
  }

  if (
    !activeStatus(
      program
    )
  ) {
    errors.push(
      `Program ${program.name} is inactive.`
    );
  }

  return program;
};

// ======================================================
// RESOLVE BATCH-PROGRAM MAPPING
// ======================================================

const mappingLabel = (
  mapping,
  batch
) =>
  `${String(
    mapping.admission_type ||
      "regular"
  )} ${batch.start_year}-${batch.end_year}`;

const resolveBatchProgramMapping = (
  row,
  program,
  catalog,
  errors,
  warnings
) => {
  if (
    !row.batch_start_year
  ) {
    errors.push(
      "Session / intake year is required. Example: Fall 2024, 2024 or Batch 2024-2028."
    );

    return null;
  }

  if (
    row.admission_type ===
    "__invalid__"
  ) {
    errors.push(
      `Admission Type "${row.admission_type_raw}" is invalid. Use Regular, Lateral or Transfer.`
    );

    return null;
  }

  const batchById =
    catalog.batchById;

  let candidates =
    catalog.batchPrograms
      .filter(
        (mapping) =>
          String(
            mapping.program_id
          ) ===
            String(
              program.id
            ) &&
          activeStatus(
            mapping
          )
      )
      .map(
        (mapping) => ({
          mapping,

          batch:
            batchById.get(
              String(
                mapping.batch_id
              )
            ),
        })
      )
      .filter(
        ({ batch }) =>
          batch &&
          activeStatus(
            batch
          )
      )
      .filter(
        ({ batch }) =>
          Number(
            batch.start_year
          ) ===
          Number(
            row.batch_start_year
          )
      );

  if (
    row.batch_end_year
  ) {
    candidates =
      candidates.filter(
        ({ batch }) =>
          Number(
            batch.end_year
          ) ===
          Number(
            row.batch_end_year
          )
      );
  }

  if (
    row.admission_type
  ) {
    candidates =
      candidates.filter(
        ({ mapping }) =>
          String(
            mapping.admission_type ||
              "regular"
          ).toLowerCase() ===
          row.admission_type
      );
  }

  if (
    !candidates.length
  ) {
    const typeText =
      row.admission_type
        ? ` / ${row.admission_type}`
        : "";

    const endText =
      row.batch_end_year
        ? `-${row.batch_end_year}`
        : "";

    errors.push(
      `No active Batch mapping exists for ${program.name} / ${row.batch_start_year}${endText}${typeText}. Configure this Program in Academic Structure first.`
    );

    return null;
  }

  if (
    candidates.length >
    1
  ) {
    const options =
      candidates
        .map(
          ({
            mapping,
            batch,
          }) =>
            mappingLabel(
              mapping,
              batch
            )
        )
        .join(", ");

    if (
      !row.admission_type
    ) {
      errors.push(
        `More than one Batch matches ${program.name} and intake ${row.batch_start_year}: ${options}. Add Admission Type (Regular/Lateral/Transfer) or an exact Batch end year.`
      );
    } else {
      errors.push(
        `More than one Batch mapping still matches this row: ${options}. Add an exact Batch end year.`
      );
    }

    return null;
  }

  const selected =
    candidates[0];

  if (
    !row.admission_type
  ) {
    warnings.push(
      `Admission Type was not supplied; ${selected.mapping.admission_type} was resolved from the only matching Batch mapping.`
    );
  }

  if (
    String(
      selected.mapping
        .admission_type
    ) === "legacy"
  ) {
    warnings.push(
      "This is a legacy Batch-Program mapping. Configure its Entry and Current Semester in Academic Structure when possible."
    );
  }

  return selected;
};

// ======================================================
// RESOLVE SEMESTER
// ======================================================

const resolveSemester = (
  row,
  program,
  mapping,
  catalog,
  errors,
  warnings
) => {
  const programSemesters =
    catalog.semesters.filter(
      (semester) =>
        String(
          semester.program_id
        ) ===
        String(
          program.id
        )
    );

  const entrySemester =
    mapping.entry_semester_id
      ? catalog.semesterById.get(
          String(
            mapping.entry_semester_id
          )
        )
      : null;

  const currentSemester =
    mapping.current_semester_id
      ? catalog.semesterById.get(
          String(
            mapping.current_semester_id
          )
        )
      : null;

  let semester = null;

  if (
    row.semester_number
  ) {
    const matches =
      programSemesters.filter(
        (item) =>
          Number(
            item.semester_number
          ) ===
          Number(
            row.semester_number
          )
      );

    if (
      !matches.length
    ) {
      errors.push(
        `Semester ${row.semester_number} is not available for ${program.name}. Create it in Academic Structure first.`
      );

      return null;
    }

    if (
      matches.length > 1
    ) {
      errors.push(
        `Semester ${row.semester_number} has duplicate records in ${program.name}.`
      );

      return null;
    }

    semester =
      matches[0];
  } else if (
    currentSemester
  ) {
    semester =
      currentSemester;

    warnings.push(
      `Semester was not supplied; ${currentSemester.name} was taken from the Batch current-semester mapping.`
    );
  } else {
    errors.push(
      "Semester is missing and this Batch mapping has no Current Semester configured. Add a Semester column or configure Current Semester in Academic Structure."
    );

    return null;
  }

  if (
    !activeStatus(
      semester
    )
  ) {
    errors.push(
      `${semester.name} is inactive.`
    );
  }

  if (
    entrySemester &&
    Number(
      semester.semester_number
    ) <
      Number(
        entrySemester.semester_number
      )
  ) {
    errors.push(
      `${semester.name} is earlier than the ${mapping.admission_type} intake entry semester (${entrySemester.name}).`
    );
  }

  if (
    currentSemester &&
    String(
      semester.id
    ) !==
      String(
        currentSemester.id
      )
  ) {
    warnings.push(
      `Imported semester (${semester.name}) differs from this Batch's configured current semester (${currentSemester.name}).`
    );
  }

  return {
    semester,
    entrySemester,
    currentSemester,
  };
};

// ======================================================
// RESOLVE ACADEMIC STRUCTURE
// Program -> Department -> Batch Program mapping -> Semester
// ======================================================

const resolveAcademicRow = (
  row,
  catalog,
  errors,
  warnings
) => {
  const suppliedDepartment =
    resolveOptionalDepartment(
      row,
      catalog,
      errors
    );

  if (
    row.department_reference &&
    !suppliedDepartment
  ) {
    return null;
  }

  const program =
    resolveProgram(
      row,
      catalog,
      suppliedDepartment,
      errors
    );

  if (!program) {
    return null;
  }

  const department =
    catalog.departmentById.get(
      String(
        program.department_id
      )
    );

  if (!department) {
    errors.push(
      `Department for ${program.name} was not found.`
    );

    return null;
  }

  if (
    !activeStatus(
      department
    )
  ) {
    errors.push(
      `Department ${department.name} is inactive.`
    );
  }

  if (
    suppliedDepartment &&
    String(
      suppliedDepartment.id
    ) !==
      String(
        department.id
      )
  ) {
    errors.push(
      `Program ${program.name} belongs to ${department.name}, not ${suppliedDepartment.name}.`
    );

    return null;
  }

  const selected =
    resolveBatchProgramMapping(
      row,
      program,
      catalog,
      errors,
      warnings
    );

  if (!selected) {
    return null;
  }

  const semesterData =
    resolveSemester(
      row,
      program,
      selected.mapping,
      catalog,
      errors,
      warnings
    );

  if (!semesterData) {
    return null;
  }

  return {
    batch:
      selected.batch,

    batchProgram:
      selected.mapping,

    department,

    program,

    semester:
      semesterData.semester,

    entrySemester:
      semesterData.entrySemester,

    currentSemester:
      semesterData.currentSemester,
  };
};

// ======================================================
// LOAD IMPORT CONTEXT
// ======================================================

const loadContext = async ({
  checkExternal,
  helpers,
}) => {
  const [
    batches,
    departments,
    programs,
    semesters,
    batchPrograms,
    profiles,
    authEmails,
  ] = await Promise.all([
    helpers.fetchAllRows(
      "academic_batches",
      `
        id,
        start_year,
        end_year,
        status
      `
    ),

    helpers.fetchAllRows(
      "academic_departments",
      `
        id,
        name,
        code,
        status
      `
    ),

    helpers.fetchAllRows(
      "academic_programs",
      `
        id,
        department_id,
        name,
        code,
        degree_title,
        status
      `
    ),

    helpers.fetchAllRows(
      "academic_semesters",
      `
        id,
        program_id,
        semester_number,
        name,
        status
      `
    ),

    helpers.fetchAllRows(
      "academic_batch_programs",
      `
        id,
        batch_id,
        program_id,
        admission_type,
        entry_semester_id,
        current_semester_id,
        status
      `
    ),

    helpers.fetchAllRows(
      "profiles",
      `
        id,
        role,
        email,
        student_id,
        cnic
      `
    ),

    checkExternal
      ? helpers.loadAuthEmailSet(
          "STUDENT IMPORT"
        )
      : Promise.resolve(
          new Set()
        ),
  ]);

  return {
    batches,
    departments,
    programs,
    semesters,
    batchPrograms,
    profiles,
    authEmails,

    batchById:
      new Map(
        batches.map(
          (row) => [
            String(
              row.id
            ),
            row,
          ]
        )
      ),

    departmentById:
      new Map(
        departments.map(
          (row) => [
            String(
              row.id
            ),
            row,
          ]
        )
      ),

    semesterById:
      new Map(
        semesters.map(
          (row) => [
            String(
              row.id
            ),
            row,
          ]
        )
      ),
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
  if (!row.full_name) {
    errors.push(
      "Full name is required."
    );
  }

  if (!row.father_name) {
    errors.push(
      "Father name is required."
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

  if (!row.student_id) {
    errors.push(
      "Student ID / Registration No is required."
    );
  }

  if (!row.cnic_key) {
    errors.push(
      "CNIC/B-Form is required. It is also the login username."
    );
  } else if (
    row.cnic_key.length !==
    13
  ) {
    errors.push(
      "CNIC/B-Form must contain exactly 13 digits."
    );
  }

  if (
    row.password &&
    row.password.length < 6
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
    row.auth_email &&
    context.authEmails.has(
      row.auth_email
    )
  ) {
    errors.push(
      "This CNIC/B-Form already has an authentication account."
    );
  }

  const academic =
    resolveAcademicRow(
      row,
      context,
      errors,
      warnings
    );

  if (!row.email) {
    warnings.push(
      "Contact email is blank. Student can still log in using CNIC/B-Form."
    );
  }

  if (!row.password) {
    warnings.push(
      "A secure temporary password will be generated."
    );
  }

  return academic;
};

// ======================================================
// PUBLIC ACADEMIC RESPONSE
// ======================================================

const publicAcademic = (
  academic
) =>
  academic
    ? {
        batch_id:
          academic.batch.id,

        batch:
          `${academic.batch.start_year}-${academic.batch.end_year}`,

        batch_start_year:
          academic.batch
            .start_year,

        batch_end_year:
          academic.batch
            .end_year,

        admission_type:
          academic.batchProgram
            .admission_type,

        department_id:
          academic.department.id,

        department:
          academic.department.name,

        department_code:
          academic.department
            .code || null,

        program_id:
          academic.program.id,

        program:
          academic.program.name,

        program_code:
          academic.program
            .code || null,

        semester_id:
          academic.semester.id,

        semester:
          academic.semester.name,

        semester_number:
          academic.semester
            .semester_number,

        entry_semester:
          academic.entrySemester
            ?.name || null,

        current_semester:
          academic.currentSemester
            ?.name || null,
      }
    : null;

// ======================================================
// PUBLIC VALIDATION ROW
// ImportModal sends this normalized record back to
// the commit endpoint for final validation.
// ======================================================

const toPublicRow = (
  row
) => {
  const record = {
    row_number:
      row.row_number,

    full_name:
      row.full_name,

    father_name:
      row.father_name,

    email:
      row.email,

    student_id:
      row.student_id,

    cnic:
      row.cnic,

    phone:
      row.phone,

    password:
      row.password,

    bio:
      row.bio,

    is_active:
      row.is_active,

    session:
      row.session,

    batch_start_year:
      row.batch_start_year,

    batch_end_year:
      row.batch_end_year,

    admission_type:
      row.admission_type &&
      row.admission_type !==
        "__invalid__"
        ? row.admission_type
        : row.admission_type_raw,

    department:
      row.department_reference ||
      null,

    program_name:
      row.program_name ||
      null,

    program_code:
      row.program_code ||
      null,

    semester_number:
      row.semester_number,
  };

  const mapping =
    publicAcademic(
      row.resolved
    );

  return {
    row_number:
      row.row_number,

    status:
      row.errors.length
        ? "invalid"
        : "valid",

    record,

    mapping,

    student:
      record,

    academic:
      mapping,

    errors:
      row.errors,

    warnings:
      row.warnings,
  };
};

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

  father_name:
    row.father_name,

  email:
    row.email,

  cnic:
    row.cnic,

  username:
    row.cnic,

  campus_student_id:
    row.student_id,

  temporary_password:
    null,

  message,
});

// ======================================================
// CREATE ONE STUDENT
// ======================================================

const createRow = async (
  row,
  {
    actorId,
    helpers,
  }
) => {
  let authUserId = null;
  let profileSaved = false;
  let historySaved = false;

  const password =
    row.password ||
    helpers.generateTemporaryPassword();

  try {
    const {
      data: authData,
      error: authError,
    } =
      await helpers.supabaseAdmin.auth.admin.createUser(
        {
          email:
            row.auth_email,

          password,

          email_confirm:
            true,

          user_metadata: {
            role:
              "student",

            full_name:
              row.full_name,

            student_id:
              row.student_id,

            login_cnic:
              row.cnic_key,
          },
        }
      );

    if (authError) {
      throw authError;
    }

    authUserId =
      authData?.user?.id;

    if (!authUserId) {
      throw new Error(
        "Authentication account was not created."
      );
    }

    const academic =
      row.resolved;

    const {
      error: profileError,
    } =
      await helpers.supabaseAdmin
        .from("profiles")
        .insert({
          id:
            authUserId,

          full_name:
            row.full_name,

          father_name:
            row.father_name,

          email:
            row.email,

          role:
            "student",

          department:
            academic.department
              .name,

          semester:
            academic.semester
              .name,

          department_id:
            academic.department
              .id,

          program_id:
            academic.program
              .id,

          batch_id:
            academic.batch.id,

          semester_id:
            academic.semester.id,

          phone:
            row.phone,

          student_id:
            row.student_id,

          cnic:
            row.cnic_key,

          avatar_url:
            null,

          bio:
            row.bio,

          manual_is_active:
            row.is_active,

          academic_blocked:
            false,

          is_active:
            row.is_active,

          must_change_password:
            true,

          updated_at:
            new Date().toISOString(),
        });

    if (profileError) {
      throw profileError;
    }

    profileSaved = true;

    const {
      error: historyError,
    } =
      await helpers.supabaseAdmin
        .from(
          "student_academic_history"
        )
        .insert({
          student_id:
            authUserId,

          batch_id:
            academic.batch.id,

          department_id:
            academic.department
              .id,

          program_id:
            academic.program.id,

          semester_id:
            academic.semester.id,

          status:
            "current",

          started_at:
            new Date().toISOString(),

          changed_by:
            actorId || null,
        });

    if (historyError) {
      throw historyError;
    }

    historySaved = true;

    return {
      row_number:
        row.row_number,

      success:
        true,

      profile_id:
        authUserId,

      full_name:
        row.full_name,

      father_name:
        row.father_name,

      email:
        row.email,

      cnic:
        row.cnic,

      username:
        row.cnic,

      campus_student_id:
        row.student_id,

      temporary_password:
        password,

      message:
        "Student imported successfully.",
    };
  } catch (error) {
    if (
      historySaved &&
      authUserId
    ) {
      await helpers.supabaseAdmin
        .from(
          "student_academic_history"
        )
        .delete()
        .eq(
          "student_id",
          authUserId
        );
    }

    if (
      profileSaved &&
      authUserId
    ) {
      await helpers.supabaseAdmin
        .from("profiles")
        .delete()
        .eq(
          "id",
          authUserId
        );
    }

    if (authUserId) {
      await helpers.supabaseAdmin.auth.admin
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
        "Student could not be imported."
    );
  }
};

// ======================================================
// IMPORT ENGINE
// ======================================================

const engine =
  createImportEngine({
    key:
      "students",

    singularLabel:
      "Student",

    pluralLabel:
      "Students",

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
          (profile) =>
            `Email already belongs to an existing ${profile.role || "user"} account.`,
      },

      {
        name:
          "student_id",

        label:
          "Student ID",

        rowKey:
          (row) =>
            comparable(
              row.student_id
            ),

        existingKey:
          (profile) =>
            comparable(
              profile.student_id
            ),
      },

      {
        name:
          "cnic",

        label:
          "CNIC/B-Form",

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
// PROFILE IMAGE IMPORT
// ======================================================

const importImages =
  createProfileImageImporter({
    role:
      "student",

    singularLabel:
      "Student",

    pluralLabel:
      "Students",

    identityLabel:
      "13-digit CNIC/B-Form",

    matchColumn:
      "cnic",

    storageFolder:
      "avatars/students",
  });

module.exports = {
  ...engine,
  importImages,
  semesterNumber,
};