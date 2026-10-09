const { supabaseAdmin } = require("../config/supabase");

// Batch and Program are connected ONLY through academic_batch_programs.
// academic_departments.batch_id is legacy and is never used for filtering.

const BATCH_COLUMNS = "id,start_year,end_year,status,created_at,updated_at";

const BATCH_PROGRAM_COLUMNS =
  "id,batch_id,program_id,admission_type,entry_semester_id,current_semester_id,status,created_at,updated_at";

const DEPARTMENT_COLUMNS =
  "id,batch_id,name,code,description,status,created_at,updated_at";

const PROGRAM_COLUMNS =
  "id,department_id,name,code,degree_title,status,created_at,updated_at";

const SEMESTER_COLUMNS =
  "id,program_id,semester_number,name,status,created_at,updated_at";

const unique = (values) => [...new Set(values.filter(Boolean))];

// ======================================================
// COMMON DATABASE HELPERS
// ======================================================

const rowsWhere = async (
  table,
  columns,
  field,
  value,
  multiple = false
) => {
  if (
    multiple &&
    (!Array.isArray(value) || value.length === 0)
  ) {
    return [];
  }

  const query = supabaseAdmin.from(table).select(columns);

  const { data, error } = await (
    multiple
      ? query.in(field, value)
      : query.eq(field, value)
  );

  if (error) throw error;

  return data || [];
};

const findOne = async (table, columns, id) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data;
};

const insertOne = async (table, columns, payload) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .insert(payload)
    .select(columns)
    .single();

  if (error) throw error;

  return data;
};

const updateOne = async (
  table,
  columns,
  id,
  payload
) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .update(payload)
    .eq("id", id)
    .select(columns)
    .single();

  if (error) throw error;

  return data;
};

const deleteOne = async (table, columns, id) => {
  const { data, error } = await supabaseAdmin
    .from(table)
    .delete()
    .eq("id", id)
    .select(columns)
    .single();

  if (error) throw error;

  return data;
};

// ======================================================
// BATCH-PROGRAM MAPPINGS
// ======================================================

const decorateBatchPrograms = async (rows = []) => {
  if (!rows.length) return [];

  const programIds = unique(
    rows.map((row) => row.program_id)
  );

  const semesterIds = unique(
    rows.flatMap((row) => [
      row.entry_semester_id,
      row.current_semester_id,
    ])
  );

  const {
    data: programs,
    error: programError,
  } = await supabaseAdmin
    .from("academic_programs")
    .select(
      "id,department_id,name,code,degree_title,status"
    )
    .in("id", programIds);

  if (programError) throw programError;

  const departmentIds = unique(
    (programs || []).map(
      (program) => program.department_id
    )
  );

  const departments = departmentIds.length
    ? await rowsWhere(
        "academic_departments",
        "id,name,code,description,status",
        "id",
        departmentIds,
        true
      )
    : [];

  const semesters = semesterIds.length
    ? await rowsWhere(
        "academic_semesters",
        "id,program_id,semester_number,name,status",
        "id",
        semesterIds,
        true
      )
    : [];

  const programMap = new Map(
    (programs || []).map((item) => [
      item.id,
      item,
    ])
  );

  const departmentMap = new Map(
    departments.map((item) => [
      item.id,
      item,
    ])
  );

  const semesterMap = new Map(
    semesters.map((item) => [
      item.id,
      item,
    ])
  );

  return rows.map((row) => {
    const program =
      programMap.get(row.program_id) || null;

    return {
      ...row,

      program,

      department: program
        ? departmentMap.get(
            program.department_id
          ) || null
        : null,

      entry_semester: row.entry_semester_id
        ? semesterMap.get(
            row.entry_semester_id
          ) || null
        : null,

      current_semester: row.current_semester_id
        ? semesterMap.get(
            row.current_semester_id
          ) || null
        : null,

      configuration_complete: Boolean(
        row.entry_semester_id &&
        row.current_semester_id &&
        row.admission_type !== "legacy"
      ),
    };
  });
};

const getAllBatchPrograms = async (
  batchId = null,
  status = null
) => {
  let query = supabaseAdmin
    .from("academic_batch_programs")
    .select(BATCH_PROGRAM_COLUMNS)
    .order("created_at", {
      ascending: true,
    });

  if (batchId) {
    query = query.eq(
      "batch_id",
      batchId
    );
  }

  if (status) {
    query = query.eq(
      "status",
      status
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  return decorateBatchPrograms(data || []);
};

const getBatchProgram = async (
  batchId,
  programId
) => {
  const { data, error } = await supabaseAdmin
    .from("academic_batch_programs")
    .select(BATCH_PROGRAM_COLUMNS)
    .eq("batch_id", batchId)
    .eq("program_id", programId)
    .maybeSingle();

  if (error) throw error;

  const [mapping] = await decorateBatchPrograms(
    data ? [data] : []
  );

  return mapping || null;
};

const attachBatchPrograms = async (
  batches = []
) => {
  if (!batches.length) return [];

  const mappings =
    await getAllBatchPrograms();

  return batches.map((batch) => {
    const programMappings = mappings.filter(
      (item) => item.batch_id === batch.id
    );

    const activeMappings = programMappings.filter(
      (item) => item.status === "active"
    );

    return {
      ...batch,

      program_mappings: programMappings,

      program_count: activeMappings.length,

      department_count: new Set(
        activeMappings
          .map(
            (item) =>
              item.program?.department_id
          )
          .filter(Boolean)
      ).size,

      configuration_complete:
        activeMappings.length > 0 &&
        activeMappings.every(
          (item) =>
            item.configuration_complete
        ),
    };
  });
};

// ======================================================
// BATCHES
// ======================================================

const getAllBatches = async () => {
  const { data, error } = await supabaseAdmin
    .from("academic_batches")
    .select(BATCH_COLUMNS)
    .order("start_year", {
      ascending: false,
    });

  if (error) throw error;

  return attachBatchPrograms(data || []);
};

const getBatchById = async (id) => {
  const batch = await findOne(
    "academic_batches",
    BATCH_COLUMNS,
    id
  );

  if (!batch) return null;

  const [result] = await attachBatchPrograms([
    batch,
  ]);

  return result;
};

const saveBatchConfiguration = async ({
  id = null,
  start_year,
  end_year,
  status,
  programs,
}) => {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_save_academic_batch",
    {
      p_batch_id: id,

      p_start_year: start_year,

      p_end_year: end_year,

      p_status: status,

      p_programs: programs,
    }
  );

  if (error) throw error;

  return getBatchById(data);
};

const createBatch = (payload) =>
  insertOne(
    "academic_batches",
    BATCH_COLUMNS,
    payload
  );

const updateBatch = (id, payload) =>
  updateOne(
    "academic_batches",
    BATCH_COLUMNS,
    id,
    payload
  );

const deleteBatch = (id) =>
  deleteOne(
    "academic_batches",
    BATCH_COLUMNS,
    id
  );

// ======================================================
// DEPARTMENTS
// ======================================================

const getAllDepartments = async (
  batchId = null
) => {
  const { data, error } = await supabaseAdmin
    .from("academic_departments")
    .select(DEPARTMENT_COLUMNS)
    .order("name", {
      ascending: true,
    });

  if (error) throw error;

  const departments = data || [];

  if (!batchId) {
    return departments;
  }

  // Latest Academic Structure:
  // Batch -> academic_batch_programs -> Program
  // -> Department

  const mappings = await rowsWhere(
    "academic_batch_programs",
    "program_id,status",
    "batch_id",
    batchId
  );

  const activeProgramIds = unique(
    mappings
      .filter(
        (row) =>
          row.status === "active"
      )
      .map(
        (row) =>
          row.program_id
      )
  );

  if (!activeProgramIds.length) {
    return [];
  }

  const programRows = await rowsWhere(
    "academic_programs",
    "department_id",
    "id",
    activeProgramIds,
    true
  );

  const departmentIds = new Set(
    programRows.map(
      (row) =>
        row.department_id
    )
  );

  return departments.filter(
    (row) =>
      departmentIds.has(row.id)
  );
};

const getDepartmentById = (id) =>
  findOne(
    "academic_departments",
    DEPARTMENT_COLUMNS,
    id
  );

const createDepartment = (payload) =>
  insertOne(
    "academic_departments",
    DEPARTMENT_COLUMNS,
    payload
  );

const updateDepartment = (id, payload) =>
  updateOne(
    "academic_departments",
    DEPARTMENT_COLUMNS,
    id,
    payload
  );

// ======================================================
// DEPARTMENT HARD-DELETE CONTEXT
//
// Collect related IDs and material URLs before the
// database RPC deletes the Department.
// ======================================================

const collectDepartmentDeletionContext = async (
  id
) => {
  const department =
    await getDepartmentById(id);

  if (!department) {
    return null;
  }

  // ----------------------------------------------------
  // PROGRAMS
  // ----------------------------------------------------

  const programRows = await rowsWhere(
    "academic_programs",
    "id",
    "department_id",
    id
  );

  const programIds = unique(
    programRows.map(
      (row) =>
        row.id
    )
  );

  // ----------------------------------------------------
  // SEMESTERS
  // ----------------------------------------------------

  const semesterRows = await rowsWhere(
    "academic_semesters",
    "id",
    "program_id",
    programIds,
    true
  );

  const semesterIds = unique(
    semesterRows.map(
      (row) =>
        row.id
    )
  );

  // ----------------------------------------------------
  // COURSES
  // ----------------------------------------------------

  const courseMap = new Map();

  const directCourses = await rowsWhere(
    "courses",
    "id",
    "department_id",
    id
  );

  const programCourses = await rowsWhere(
    "courses",
    "id",
    "program_id",
    programIds,
    true
  );

  // Existing legacy Course rows may have semester_id.
  // Keep this lookup so Department hard-delete also
  // includes those linked Courses.

  const semesterCourses = await rowsWhere(
    "courses",
    "id",
    "semester_id",
    semesterIds,
    true
  );

  for (const row of [
    ...directCourses,
    ...programCourses,
    ...semesterCourses,
  ]) {
    courseMap.set(
      row.id,
      row
    );
  }

  const courseIds = [
    ...courseMap.keys(),
  ];

  // ----------------------------------------------------
  // COURSE ASSIGNMENTS
  // ----------------------------------------------------

  const assignmentMap = new Map();

  const courseAssignments = await rowsWhere(
    "course_assignments",
    "id",
    "course_id",
    courseIds,
    true
  );

  const semesterAssignments = await rowsWhere(
    "course_assignments",
    "id",
    "semester_id",
    semesterIds,
    true
  );

  for (const row of [
    ...courseAssignments,
    ...semesterAssignments,
  ]) {
    assignmentMap.set(
      row.id,
      row
    );
  }

  const courseAssignmentIds = [
    ...assignmentMap.keys(),
  ];

  // ----------------------------------------------------
  // STUDENTS
  // ----------------------------------------------------

  const studentRows = await rowsWhere(
    "profiles",
    "id,department_id,program_id,semester_id",
    "role",
    "student"
  );

  const programSet = new Set(
    programIds.map(String)
  );

  const semesterSet = new Set(
    semesterIds.map(String)
  );

  const studentIds = studentRows
    .filter(
      (row) =>
        String(
          row.department_id || ""
        ) === String(id) ||
        programSet.has(
          String(
            row.program_id || ""
          )
        ) ||
        semesterSet.has(
          String(
            row.semester_id || ""
          )
        )
    )
    .map(
      (row) =>
        row.id
    );

  // ----------------------------------------------------
  // MATERIALS
  // ----------------------------------------------------

  const materialMap = new Map();

  const courseMaterials = await rowsWhere(
    "materials",
    "id,file_url,file_name,course_id,course_assignment_id",
    "course_id",
    courseIds,
    true
  );

  const assignmentMaterials = await rowsWhere(
    "materials",
    "id,file_url,file_name,course_id,course_assignment_id",
    "course_assignment_id",
    courseAssignmentIds,
    true
  );

  for (const row of [
    ...courseMaterials,
    ...assignmentMaterials,
  ]) {
    materialMap.set(
      row.id,
      row
    );
  }

  return {
    department,

    program_ids: programIds,

    semester_ids: semesterIds,

    course_ids: courseIds,

    course_assignment_ids:
      courseAssignmentIds,

    student_ids: studentIds,

    materials: [
      ...materialMap.values(),
    ],
  };
};

// ======================================================
// DEPARTMENT HARD DELETE
//
// Database deletion runs inside the existing SQL RPC.
// Supabase Auth and Storage cleanup is handled by the
// controller after the RPC.
// ======================================================

const deleteDepartment = async (id) => {
  const { data, error } = await supabaseAdmin.rpc(
    "admin_hard_delete_academic_department",
    {
      p_department_id: id,
    }
  );

  if (error) throw error;

  return data;
};

// ======================================================
// PROGRAMS
// ======================================================

const getAllPrograms = async (
  departmentId = null,
  batchId = null
) => {
  let query = supabaseAdmin
    .from("academic_programs")
    .select(PROGRAM_COLUMNS)
    .order("name", {
      ascending: true,
    });

  if (departmentId) {
    query = query.eq(
      "department_id",
      departmentId
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  const programs = data || [];

  if (!batchId) {
    return programs;
  }

  // Do not use the old Department -> Batch relationship.
  // Only active Batch-Program mappings are valid.

  const mappings = await rowsWhere(
    "academic_batch_programs",
    "program_id,status",
    "batch_id",
    batchId
  );

  const activeProgramIds = new Set(
    mappings
      .filter(
        (row) =>
          row.status === "active"
      )
      .map(
        (row) =>
          row.program_id
      )
  );

  return programs.filter(
    (row) =>
      activeProgramIds.has(
        row.id
      )
  );
};

const getProgramById = (id) =>
  findOne(
    "academic_programs",
    PROGRAM_COLUMNS,
    id
  );

const createProgram = (payload) =>
  insertOne(
    "academic_programs",
    PROGRAM_COLUMNS,
    payload
  );

const updateProgram = (id, payload) =>
  updateOne(
    "academic_programs",
    PROGRAM_COLUMNS,
    id,
    payload
  );

const deleteProgram = (id) =>
  deleteOne(
    "academic_programs",
    PROGRAM_COLUMNS,
    id
  );

// ======================================================
// SEMESTERS
//
// Existing Semester behavior is unchanged.
// ======================================================

const getAllSemesters = async (
  programId = null
) => {
  let query = supabaseAdmin
    .from("academic_semesters")
    .select(SEMESTER_COLUMNS)
    .order("semester_number", {
      ascending: true,
    });

  if (programId) {
    query = query.eq(
      "program_id",
      programId
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  return data || [];
};

const getSemesterById = (id) =>
  findOne(
    "academic_semesters",
    SEMESTER_COLUMNS,
    id
  );

const createSemester = (payload) =>
  insertOne(
    "academic_semesters",
    SEMESTER_COLUMNS,
    payload
  );

const createSemestersBulk = async (
  payloads = []
) => {
  if (
    !Array.isArray(payloads) ||
    payloads.length === 0
  ) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("academic_semesters")
    .insert(payloads)
    .select(SEMESTER_COLUMNS);

  if (error) throw error;

  return data || [];
};

const updateSemester = (id, payload) =>
  updateOne(
    "academic_semesters",
    SEMESTER_COLUMNS,
    id,
    payload
  );

const deleteSemester = (id) =>
  deleteOne(
    "academic_semesters",
    SEMESTER_COLUMNS,
    id
  );

// ======================================================
// EXPORTS
//
// Preserve existing controller interface.
// ======================================================

module.exports = {
  // Batches
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  saveBatchConfiguration,

  // Batch-Program mappings
  getAllBatchPrograms,
  getBatchProgram,

  // Departments
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  collectDepartmentDeletionContext,
  deleteDepartment,

  // Programs
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,

  // Semesters
  getAllSemesters,
  getSemesterById,
  createSemester,
  createSemestersBulk,
  updateSemester,
  deleteSemester,
};