// ======================================================
// ACADEMIC MAPPING HELPERS
//
// Latest Academic Structure:
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
//
// IMPORTANT:
// - Batch filters are optional.
// - If Batch is not selected, normal master hierarchy
//   remains available.
// - If Batch is selected, only Programs configured in
//   academic_batch_programs are available.
// - Semester behavior is preserved.
// ======================================================

const sameId = (first, second) =>
  String(first || "") === String(second || "");

const isActive = (item) =>
  item?.status !== "inactive";

// ======================================================
// ACTIVE BATCH MAPPINGS
// ======================================================

const activeMappings = (
  mappings = [],
  batchId = null
) =>
  (mappings || []).filter(
    (mapping) =>
      isActive(mapping) &&
      (
        !batchId ||
        sameId(
          mapping.batch_id,
          batchId
        )
      )
  );

// ======================================================
// MAPPED DEPARTMENTS
//
// No Batch:
// -> all active Departments
//
// Batch selected:
// -> only Departments whose Programs are configured
//    in that Batch.
// ======================================================

export const mappedDepartmentsForBatch = (
  departments = [],
  programs = [],
  mappings = [],
  batchId = null
) => {
  const activeDepartments =
    (departments || []).filter(
      isActive
    );

  if (!batchId) {
    return activeDepartments
      .slice()
      .sort((first, second) =>
        String(
          first.name || ""
        ).localeCompare(
          String(
            second.name || ""
          )
        )
      );
  }

  const batchMappings =
    activeMappings(
      mappings,
      batchId
    );

  const programIds = new Set(
    batchMappings.map(
      (mapping) =>
        String(
          mapping.program_id
        )
    )
  );

  const departmentIds = new Set(
    (programs || [])
      .filter(
        (program) =>
          programIds.has(
            String(
              program.id
            )
          )
      )
      .map(
        (program) =>
          String(
            program.department_id
          )
      )
  );

  return activeDepartments
    .filter(
      (department) =>
        departmentIds.has(
          String(
            department.id
          )
        )
    )
    .sort((first, second) =>
      String(
        first.name || ""
      ).localeCompare(
        String(
          second.name || ""
        )
      )
    );
};

// ======================================================
// MAPPED PROGRAMS
//
// No Batch:
// -> all active Programs, optionally filtered by
//    Department.
//
// Batch selected:
// -> only Programs configured in selected Batch,
//    optionally filtered by Department.
// ======================================================

export const mappedProgramsForBatch = (
  programs = [],
  mappings = [],
  batchId = null,
  departmentId = null
) => {
  let availablePrograms =
    (programs || []).filter(
      isActive
    );

  if (departmentId) {
    availablePrograms =
      availablePrograms.filter(
        (program) =>
          sameId(
            program.department_id,
            departmentId
          )
      );
  }

  if (!batchId) {
    return availablePrograms
      .slice()
      .sort((first, second) =>
        String(
          first.name || ""
        ).localeCompare(
          String(
            second.name || ""
          )
        )
      );
  }

  const programIds = new Set(
    activeMappings(
      mappings,
      batchId
    ).map(
      (mapping) =>
        String(
          mapping.program_id
        )
    )
  );

  return availablePrograms
    .filter(
      (program) =>
        programIds.has(
          String(
            program.id
          )
        )
    )
    .sort((first, second) =>
      String(
        first.name || ""
      ).localeCompare(
        String(
          second.name || ""
        )
      )
    );
};

// ======================================================
// SEMESTERS FOR PROGRAM / BATCH
//
// Semester behavior is intentionally preserved.
//
// No Program:
// -> []
//
// Program selected without Batch:
// -> all active Semesters of Program
//
// Program + Batch:
// -> Program Semesters, respecting that Batch mapping's
//    Entry Semester.
// ======================================================

export const mappedSemestersForBatchProgram = (
  semesters = [],
  mappings = [],
  batchId = null,
  programId = null
) => {
  if (!programId) {
    return [];
  }

  let availableSemesters =
    (semesters || [])
      .filter(
        (semester) =>
          isActive(
            semester
          ) &&
          sameId(
            semester.program_id,
            programId
          )
      );

  // ----------------------------------------------
  // NO BATCH:
  // Keep normal Program -> Semester relationship.
  // ----------------------------------------------

  if (!batchId) {
    return availableSemesters
      .slice()
      .sort(
        (
          first,
          second
        ) =>
          Number(
            first.semester_number ||
              0
          ) -
          Number(
            second.semester_number ||
              0
          )
      );
  }

  // ----------------------------------------------
  // BATCH + PROGRAM MAPPING
  // ----------------------------------------------

  const mapping =
    activeMappings(
      mappings,
      batchId
    ).find(
      (item) =>
        sameId(
          item.program_id,
          programId
        )
    );

  if (!mapping) {
    return [];
  }

  // ----------------------------------------------
  // ENTRY SEMESTER RESTRICTION
  // ----------------------------------------------

  const entryNumber = Number(
    mapping
      ?.entry_semester
      ?.semester_number ||
      0
  );

  if (entryNumber) {
    availableSemesters =
      availableSemesters.filter(
        (semester) =>
          Number(
            semester.semester_number ||
              0
          ) >= entryNumber
      );
  }

  return availableSemesters
    .slice()
    .sort(
      (
        first,
        second
      ) =>
        Number(
          first.semester_number ||
            0
        ) -
        Number(
          second.semester_number ||
            0
        )
    );
};

// ======================================================
// GET ONE BATCH-PROGRAM MAPPING
// ======================================================

export const getBatchProgramMapping = (
  mappings = [],
  batchId = null,
  programId = null
) => {
  if (
    !batchId ||
    !programId
  ) {
    return null;
  }

  return (
    activeMappings(
      mappings,
      batchId
    ).find(
      (mapping) =>
        sameId(
          mapping.program_id,
          programId
        )
    ) || null
  );
};

// ======================================================
// GET PROGRAM IDS CONFIGURED IN BATCH
// ======================================================

export const mappedProgramIdsForBatch = (
  mappings = [],
  batchId = null
) => {
  if (!batchId) {
    return [];
  }

  return activeMappings(
    mappings,
    batchId
  ).map(
    (mapping) =>
      mapping.program_id
  );
};

// ======================================================
// GET DEPARTMENT IDS CONFIGURED IN BATCH
// ======================================================

export const mappedDepartmentIdsForBatch = (
  programs = [],
  mappings = [],
  batchId = null
) => {
  if (!batchId) {
    return [];
  }

  const programIds = new Set(
    mappedProgramIdsForBatch(
      mappings,
      batchId
    ).map(String)
  );

  return [
    ...new Set(
      (programs || [])
        .filter(
          (program) =>
            programIds.has(
              String(
                program.id
              )
            )
        )
        .map(
          (program) =>
            program.department_id
        )
        .filter(Boolean)
    ),
  ];
};

// ======================================================
// VALIDATE BATCH-PROGRAM RELATION
// ======================================================

export const isProgramMappedToBatch = (
  mappings = [],
  batchId = null,
  programId = null
) => {
  if (
    !batchId ||
    !programId
  ) {
    return false;
  }

  return Boolean(
    getBatchProgramMapping(
      mappings,
      batchId,
      programId
    )
  );
};

// ======================================================
// EXPORT ACTIVE MAPPING HELPER
// ======================================================

export const activeBatchMappings =
  activeMappings;