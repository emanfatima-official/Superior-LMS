const commonAliases = {
  full_name: [
    "name",
    "full name",
  ],

  email: [
    "email address",
    "personal email",
    "contact email",
  ],

  cnic: [
    "cnic no",
    "cnic number",
    "national id",
    "national id number",
    "username",
    "cnic & mobile",
    "cnic and mobile",
  ],

  phone: [
    "mobile",
    "mobile no",
    "mobile number",
    "contact",
    "contact number",
  ],

  password: [
    "temporary password",
    "temp password",
  ],

  is_active: [
    "active",
    "account status",
    "status",
  ],

  must_change_password: [
    "must change password",
    "force password change",
    "change password on login",
  ],

  bio: [
    "notes",
    "remarks",
  ],
};

// ======================================================
// ACADEMIC TEMPLATE HELPERS
//
// New structure:
//
// Department
//    ↓
// Program
//    ↓
// Semester
//
// Batch
//    ↓
// academic_batch_programs
//    ↓
// Program
// ======================================================

const byId = (
  rows = []
) =>
  new Map(
    rows.map(
      (row) => [
        String(row.id),
        row,
      ]
    )
  );

const academicMaps = ({
  batches = [],
  departments = [],
  programs = [],
  semesters = [],
  batchPrograms = [],
}) => ({
  batchMap:
    byId(batches),

  departmentMap:
    byId(departments),

  programMap:
    byId(programs),

  semesterMap:
    byId(semesters),

  batchPrograms,
});

const active = (
  row
) =>
  String(
    row?.status ||
      "active"
  ).toLowerCase() ===
  "active";

// ======================================================
// FIND FIRST USABLE ACADEMIC OPTION
// Used for downloadable template example data.
// ======================================================

const firstUsableAcademicOption = (
  context
) => {
  const {
    batchMap,
    departmentMap,
    programMap,
    semesterMap,
    batchPrograms,
  } =
    academicMaps(
      context
    );

  for (
    const mapping of
    batchPrograms
  ) {
    const batch =
      batchMap.get(
        String(
          mapping.batch_id
        )
      );

    const program =
      programMap.get(
        String(
          mapping.program_id
        )
      );

    const department =
      program
        ? departmentMap.get(
            String(
              program.department_id
            )
          )
        : null;

    const currentSemester =
      mapping.current_semester_id
        ? semesterMap.get(
            String(
              mapping.current_semester_id
            )
          )
        : null;

    if (
      batch &&
      program &&
      department &&
      active(mapping) &&
      active(batch) &&
      active(program) &&
      active(department)
    ) {
      return {
        mapping,
        batch,
        department,
        program,
        semester:
          currentSemester,
      };
    }
  }

  return null;
};

// ======================================================
// ACADEMIC OPTIONS SHEET
// ======================================================

const academicOptionRows = (
  context
) => {
  const {
    batchMap,
    departmentMap,
    programMap,
    semesterMap,
    batchPrograms,
  } =
    academicMaps(
      context
    );

  return batchPrograms
    .map(
      (mapping) => {
        const batch =
          batchMap.get(
            String(
              mapping.batch_id
            )
          );

        const program =
          programMap.get(
            String(
              mapping.program_id
            )
          );

        const department =
          program
            ? departmentMap.get(
                String(
                  program.department_id
                )
              )
            : null;

        const entrySemester =
          mapping.entry_semester_id
            ? semesterMap.get(
                String(
                  mapping.entry_semester_id
                )
              )
            : null;

        const currentSemester =
          mapping.current_semester_id
            ? semesterMap.get(
                String(
                  mapping.current_semester_id
                )
              )
            : null;

        if (
          !batch ||
          !program ||
          !department
        ) {
          return null;
        }

        return {
          batch_start_year:
            batch.start_year,

          batch_end_year:
            batch.end_year,

          admission_type:
            mapping.admission_type ||
            "regular",

          department_code:
            department.code ||
            "",

          department_name:
            department.name,

          program_code:
            program.code ||
            "",

          program_name:
            program.name,

          entry_semester:
            entrySemester?.name ||
            "Not configured",

          current_semester:
            currentSemester?.name ||
            "Not configured",

          structure_status:
            [
              batch,
              department,
              program,
              mapping,
            ].every(active)
              ? "active"
              : "inactive",
        };
      }
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        Number(
          b.batch_start_year
        ) -
          Number(
            a.batch_start_year
          ) ||
        a.department_name.localeCompare(
          b.department_name
        ) ||
        a.program_name.localeCompare(
          b.program_name
        ) ||
        String(
          a.admission_type
        ).localeCompare(
          String(
            b.admission_type
          )
        )
    );
};

// ======================================================
// STUDENT FRONTEND ROW NORMALIZATION
//
// This allows:
//
// Program & Session:
// "BS Computer Science Fall 2024"
//
// to be automatically separated into:
//
// Program = BS Computer Science
// Session = Fall 2024
// ======================================================

const normalizeStudentFrontendRow = (
  row
) => {
  const next = {
    ...row,
  };

  if (
    next.program_name &&
    !next.session
  ) {
    const raw =
      String(
        next.program_name
      ).trim();

    const sessionMatch =
      raw.match(
        /\b(?:Fall|Autumn|Spring|Summer)\s+(?:19|20|21)\d{2}\b/i
      );

    if (
      sessionMatch
    ) {
      next.session =
        sessionMatch[0];

      next.program_name =
        raw
          .replace(
            sessionMatch[0],
            ""
          )
          .replace(
            /[|,;/\-–—]+\s*$/,
            ""
          )
          .trim();
    }
  }

  return next;
};

// ======================================================
// STUDENTS
//
// EXCEL + CSV BOTH USE THIS SAME DEFINITION.
// ======================================================

export const studentImportDefinition = {
  key: "students",

  singularLabel: "Student",
  pluralLabel: "Students",

  singularLower: "student",
  pluralLower: "students",

  filePrefix: "student",
  sheetName: "Students",

  imageIdentityLabel: "CNIC / B-Form",

  filenameExample: "35202-1234567-1.jpg",

  dataDescription:
    "Import students from Excel or CSV. Program can be supplied by name, code, or both. Department and Batch are resolved automatically from the Academic Structure.",

  templateDescription:
    "Student personal information comes first. Academic placement is resolved using Program, Session/Intake and Admission Type.",

  imageDescription:
    "Use each student's 13-digit CNIC/B-Form as the image filename. Dashes are optional.",

  // ====================================================
  // TEMPLATE HEADERS
  //
  // PERSONAL INFORMATION FIRST
  // ACADEMIC INFORMATION AFTER
  // ====================================================

  headers: [
    // Personal information
    "full_name",
    "father_name",
    "email",
    "phone",
    "student_id",
    "cnic",
    "password",

    // Academic information
    "program_name",
    "program_code",
    "session",
    "admission_type",
    "semester_number",

    // Account / optional information
    "is_active",
    "bio",
  ],

  widths: [
    // Personal
    26, // full_name
    26, // father_name
    32, // email
    18, // phone
    22, // student_id
    20, // cnic
    22, // password

    // Academic
    30, // program_name
    18, // program_code
    18, // session
    18, // admission_type
    18, // semester_number

    // Account
    14, // is_active
    30, // bio
  ],

  // ====================================================
  // HEADER ALIASES
  //
  // SAME FOR EXCEL + CSV
  // ====================================================

  aliases: {
    ...commonAliases,

    // --------------------------------------------------
    // PERSONAL INFORMATION
    // --------------------------------------------------

    full_name: [
      ...commonAliases.full_name,
      "student name",
      "student full name",
      "student details",
    ],

    father_name: [
      "father name",
      "father",
      "father's name",
      "fathers name",
      "guardian father name",
    ],

    email: [
      ...commonAliases.email,
      "student email",
    ],

    phone: [
      ...commonAliases.phone,
      "student phone",
      "student mobile",
      "mobile",
      "mobile no",
      "mobile number",
      "contact no",
      "contact number",
    ],

    student_id: [
      "student id",
      "registration no",
      "registration number",
      "registration id",
      "reg no",
      "reg. no",
      "reg #",
    ],

    cnic: [
      ...commonAliases.cnic,
      "b form",
      "b-form",
      "bform",
      "cnic & mobile",
      "cnic and mobile",
    ],

    password: [
      ...commonAliases.password,
      "temporary password",
      "temp password",
    ],

    // --------------------------------------------------
    // PROGRAM
    // --------------------------------------------------

    program_name: [
      "program",
      "programme",
      "program name",
      "programme name",
      "degree program",
      "degree programme",
      "program & session",
      "program and session",
    ],

    program_code: [
      "program code",
      "programme code",
      "degree code",
      "prog code",
    ],

    // --------------------------------------------------
    // SESSION / INTAKE
    // --------------------------------------------------

    session: [
      "session",
      "intake",
      "intake session",
      "admission session",
      "academic session",
      "batch session",
      "admission year",
      "intake year",
    ],

    // --------------------------------------------------
    // ADMISSION TYPE
    // --------------------------------------------------

    admission_type: [
      "admission type",
      "intake type",
      "entry type",
      "student type",
      "admission category",
    ],

    // --------------------------------------------------
    // SEMESTER
    // --------------------------------------------------

    semester_number: [
      "semester",
      "semester no",
      "semester number",
      "current semester",
      "sem",
    ],

    // --------------------------------------------------
    // ACCOUNT
    // --------------------------------------------------

    is_active: [
      ...commonAliases.is_active,
      "student status",
    ],

    bio: [
      ...commonAliases.bio,
      "remarks",
      "notes",
    ],
  },

  // ====================================================
  // REQUIRED HEADERS
  // ====================================================

  requiredHeaders: [
    "full_name",
    "father_name",
    "student_id",
    "cnic",
  ],

  // Program Name OR Program Code required
  requiredAnyHeaders: [
    [
      "program_name",
      "program_code",
    ],

    [
      "session",
    ],
  ],

  headerAnchor: [
    "full_name",
    "student_id",
    "cnic",
  ],

  minimumRecognizedHeaders: 4,

  // ====================================================
  // ROW TRANSFORM
  //
  // Supports:
  //
  // Program & Session =
  // "BS English Literature Fall 2024"
  //
  // and separates it automatically.
  // ====================================================

  transformRow:
    normalizeStudentFrontendRow,

  // ====================================================
  // TEMPLATE EXAMPLE
  // ====================================================

  example: (context) => {
    const option =
      firstUsableAcademicOption(
        context
      );

    return {
      // -----------------------------------------------
      // PERSONAL INFORMATION
      // -----------------------------------------------

      full_name:
        "Ali Raza",

      father_name:
        "Muhammad Raza",

      email:
        "ali.raza@example.com",

      phone:
        "03001234567",

      student_id:
        "2026-GCUF-000001",

      cnic:
        "35202-1234567-1",

      password:
        "",

      // -----------------------------------------------
      // ACADEMIC INFORMATION
      // -----------------------------------------------

      program_name:
        option?.program?.name ||
        "BS Computer Science",

      program_code:
        option?.program?.code ||
        "BSCS",

      session:
        option?.batch?.start_year
          ? `Fall ${option.batch.start_year}`
          : "Fall 2026",

      admission_type:
        option?.mapping
          ?.admission_type ||
        "regular",

      semester_number:
        option?.semester
          ?.semester_number ||
        "",

      // -----------------------------------------------
      // ACCOUNT
      // -----------------------------------------------

      is_active:
        "Yes",

      bio:
        "",
    };
  },

  // ====================================================
  // EXCEL EXTRA SHEET
  //
  // CSV cannot contain multiple sheets.
  // This is only included in generated Excel template.
  // ====================================================

  extraSheets: (context) => [
    {
      name: "Academic Options",

      kind: "json",

      rows:
        academicOptionRows(
          context
        ),

      widths: [
        18,
        18,
        18,
        18,
        24,
        18,
        30,
        22,
        22,
        18,
      ],
    },
  ],

  // ====================================================
  // INSTRUCTIONS
  // ====================================================

  instructions: () => [
    [
      "File types",
      "Both Excel and CSV are supported. The same headers and aliases work in both formats.",
    ],

    [
      "Personal information",
      "Enter student name, father name, email, phone number, Student ID/Registration No, CNIC/B-Form and password first.",
    ],

    [
      "Required",
      "Full Name, Father Name, Student ID/Registration No and CNIC/B-Form are required.",
    ],

    [
      "Program",
      "You may enter Program Name, Program Code, or both.",
    ],

    [
      "Program matching",
      "If both Program Name and Program Code are provided, both must refer to the same Program.",
    ],

    [
      "Department",
      "Department does not need to be entered in the sheet. It is automatically resolved from the selected Program.",
    ],

    [
      "Session",
      "Examples: Fall 2024, Spring 2025 or simply 2024. Session identifies the intake year; it is not treated as the Batch itself.",
    ],

    [
      "Batch",
      "The actual Batch is automatically resolved using Program + intake year + Admission Type through the Academic Structure.",
    ],

    [
      "Admission Type",
      "Use Regular, Lateral or Transfer. If only one matching Batch mapping exists for the Program and intake year, Admission Type may be left blank.",
    ],

    [
      "Semester",
      "Semester may be entered as 1, 2, Semester 3, Third, etc. If blank, the Batch-Program Current Semester can be used.",
    ],

    [
      "Username",
      "CNIC/B-Form is used as the student's login username. It must contain 13 digits; dashes are optional.",
    ],

    [
      "Email",
      "Email is a contact email and is not used as the login username.",
    ],

    [
      "Password",
      "Leave Password blank if you want the system to generate a secure temporary password.",
    ],

    [
      "Validation",
      "No student account is created until the row passes Academic Structure and duplicate validation.",
    ],
  ],

  // ====================================================
  // PREVIEW
  // ====================================================

  previewTableMinWidth: 1050,

  previewColumns: [
    {
      label: "Student",

      value: (row) => ({
        primary:
          row.record
            ?.full_name ||
          "Missing name",

        secondary:
          row.record
            ?.father_name
            ? `Father: ${row.record.father_name}`
            : "Missing father name",
      }),
    },

    {
      label:
        "Contact / ID",

      value: (row) => ({
        primary:
          row.record?.email ||
          row.record?.phone ||
          "No contact",

        secondary:
          `${row.record?.student_id || "No Student ID"} · ${
            row.record?.cnic || "No CNIC"
          }`,
      }),
    },

    {
      label:
        "Academic Mapping",

      value: (row) =>
        row.mapping
          ? {
              primary:
                `${row.mapping.program}${
                  row.mapping
                    .program_code
                    ? ` (${row.mapping.program_code})`
                    : ""
                } · ${row.mapping.semester}`,

              secondary:
                `${row.mapping.department} · ${row.mapping.batch} · ${row.mapping.admission_type}`,
            }
          : {
              primary:
                "Not mapped",

              tone:
                "danger",
            },
    },
  ],

  // ====================================================
  // IMPORT RESULT EXPORT
  // ====================================================

  resultColumns: [
    {
      label: "Row",
      key: "row_number",
      width: 12,
    },

    {
      label: "Status",

      value: (row) =>
        row.success
          ? "Imported"
          : "Failed",

      width: 12,
    },

    {
      label:
        "Full Name",

      key:
        "full_name",

      width: 26,
    },

    {
      label:
        "Father Name",

      key:
        "father_name",

      width: 26,
    },

    {
      label: "Email",
      key: "email",
      width: 30,
    },

    {
      label:
        "CNIC / Username",

      key:
        "cnic",

      width: 20,
    },

    {
      label:
        "Student ID",

      key:
        "campus_student_id",

      width: 22,
    },

    {
      label:
        "Temporary Password",

      key:
        "temporary_password",

      width: 22,
    },

    {
      label:
        "Message",

      key:
        "message",

      width: 54,
    },
  ],
};

// ======================================================
// TEACHERS
//
// Teacher import behavior is preserved because this is
// complete replacement for shared importDefinitions.js.
// ======================================================

export const teacherImportDefinition = {
  key:
    "teachers",

  singularLabel:
    "Teacher",

  pluralLabel:
    "Teachers",

  singularLower:
    "teacher",

  pluralLower:
    "teachers",

  filePrefix:
    "teacher",

  sheetName:
    "Teachers",

  imageIdentityLabel:
    "CNIC",

  filenameExample:
    "35202-1234567-1.jpg",

  dataDescription:
    "Validate teacher profiles and login credentials before creating accounts.",

  templateDescription:
    "Teacher import does not assign courses. Existing and future Course Assignments remain separate.",

  imageDescription:
    "Use each teacher's 13-digit CNIC as the image filename. Dashes are optional.",

  headers: [
    "full_name",
    "cnic",
    "email",
    "phone",
    "department",
    "password",
    "is_active",
    "must_change_password",
    "bio",
  ],

  widths: [
    26,
    20,
    32,
    18,
    26,
    22,
    14,
    24,
    30,
  ],

  aliases: {
    ...commonAliases,

    full_name: [
      ...commonAliases.full_name,
      "teacher name",
      "teacher full name",
    ],

    email: [
      ...commonAliases.email,
      "teacher email",
    ],

    department: [
      "department name",
      "faculty",
      "faculty department",
      "department faculty",
      "dept",
    ],
  },

  requiredHeaders: [
    "full_name",
    "cnic",
  ],

  minimumRecognizedHeaders:
    2,

  example: () => ({
    full_name:
      "Dr. Ayesha Malik",

    cnic:
      "35202-1234567-1",

    email:
      "",

    phone:
      "03001234567",

    department:
      "Computer Science",

    password:
      "",

    is_active:
      "Yes",

    must_change_password:
      "Yes",

    bio:
      "",
  }),

  extraSheets:
    () => [],

  instructions: () => [
    [
      "File types",
      "Both Excel and CSV are supported by the same import parser.",
    ],

    [
      "Required",
      "full_name and cnic are required.",
    ],

    [
      "Username",
      "CNIC is the teacher's login username. Use 13 digits. Dashes are optional.",
    ],

    [
      "Email",
      "Email is optional and is stored only as a contact email. It is not the login username.",
    ],

    [
      "Department",
      "Faculty Department is optional because the current teacher import stores it as profile data.",
    ],

    [
      "Course access",
      "Importing a teacher does not assign, remove or modify any course.",
    ],

    [
      "Password",
      "Leave blank to generate a secure temporary password.",
    ],

    [
      "Booleans",
      "Allowed values: Yes, No, Active, Inactive, True, False, 1 or 0.",
    ],

    [
      "Validation",
      "No account is created until valid rows are confirmed for import.",
    ],
  ],

  previewTableMinWidth:
    860,

  previewColumns: [
    {
      label:
        "Teacher",

      value:
        (row) => ({
          primary:
            row.record
              ?.full_name ||
            "Missing name",

          secondary:
            row.record
              ?.email ||
            "No contact email",
        }),
    },

    {
      label:
        "Username / Phone",

      value:
        (row) => ({
          primary:
            row.record
              ?.cnic ||
            "—",

          secondary:
            row.record
              ?.phone ||
            "No phone",
        }),
    },

    {
      label:
        "Profile",

      value:
        (row) => ({
          primary:
            row.record
              ?.department ||
            "Department not supplied",

          secondary:
            row.record
              ?.is_active ===
            false
              ? "Inactive account"
              : "Active account",

          tone:
            row.record
              ?.department
              ? "default"
              : "warning",
        }),
    },
  ],

  resultColumns: [
    {
      label:
        "Row",

      key:
        "row_number",

      width:
        12,
    },

    {
      label:
        "Status",

      value:
        (row) =>
          row.success
            ? "Imported"
            : "Failed",

      width:
        12,
    },

    {
      label:
        "Full Name",

      key:
        "full_name",

      width:
        26,
    },

    {
      label:
        "Username (CNIC)",

      key:
        "cnic",

      width:
        20,
    },

    {
      label:
        "Email",

      key:
        "email",

      width:
        32,
    },

    {
      label:
        "Department",

      key:
        "department",

      width:
        26,
    },

    {
      label:
        "Temporary Password",

      key:
        "temporary_password",

      width:
        22,
    },

    {
      label:
        "Message",

      key:
        "message",

      width:
        54,
    },
  ],
};

// ======================================================
// REGISTRY
// ======================================================

const definitions =
  Object.freeze({
    students:
      studentImportDefinition,

    teachers:
      teacherImportDefinition,
  });

export const getImportDefinition = (
  key
) => {
  const definition =
    definitions[key];

  if (!definition) {
    throw new Error(
      "Unsupported import type."
    );
  }

  return definition;
};