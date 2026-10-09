const normalizeCode = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeName = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";

const matchesIdentity = (course, department, program) => {
  const courseDepartmentCode = normalizeCode(
    course.catalog_department_code || course.linked_department?.code
  );
  const courseProgramCode = normalizeCode(
    course.catalog_program_code || course.linked_program?.code
  );
  const targetDepartmentCode = normalizeCode(department?.code);
  const targetProgramCode = normalizeCode(program?.code);

  const courseDepartmentName = normalizeName(
    course.linked_department?.name || course.department
  );
  const courseProgramName = normalizeName(
    course.linked_program?.name || course.program
  );
  const targetDepartmentName = normalizeName(department?.name);
  const targetProgramName = normalizeName(program?.name);

  const sameDepartment =
    courseDepartmentCode && targetDepartmentCode
      ? courseDepartmentCode === targetDepartmentCode
      : courseDepartmentName && targetDepartmentName
        ? courseDepartmentName === targetDepartmentName
        : course.department_id === department?.id;

  const sameProgram =
    courseProgramCode && targetProgramCode
      ? courseProgramCode === targetProgramCode
      : courseProgramName && targetProgramName
        ? courseProgramName === targetProgramName
        : course.program_id === program?.id;

  return Boolean(sameDepartment && sameProgram);
};

module.exports = { normalizeCode, normalizeName, matchesIdentity };
