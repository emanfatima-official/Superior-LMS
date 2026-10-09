const academicModel = require("../models/academicStructure.model");
const { uuid, httpError } = require("./api");

async function resolveAcademic(input = {}) {
  const values = Object.fromEntries(["batch_id", "department_id", "program_id", "semester_id"]
    .map((key) => [key, input[key] || null]));
  for (const [key, value] of Object.entries(values)) if (value) uuid(value, key);
  const semester = values.semester_id ? await academicModel.getSemesterById(values.semester_id) : null;
  if (values.semester_id && !semester) throw httpError("Selected semester not found", 404);
  if (semester) {
    if (values.program_id && values.program_id !== semester.program_id) throw httpError("Semester does not belong to selected program");
    values.program_id = semester.program_id;
  }
  const program = values.program_id ? await academicModel.getProgramById(values.program_id) : null;
  if (values.program_id && !program) throw httpError("Selected program not found", 404);
  if (program) {
    if (values.department_id && values.department_id !== program.department_id) throw httpError("Program does not belong to selected department");
    values.department_id = program.department_id;
  }
  const department = values.department_id ? await academicModel.getDepartmentById(values.department_id) : null;
  if (values.department_id && !department) throw httpError("Selected department not found", 404);
  const batch = values.batch_id ? await academicModel.getBatchById(values.batch_id) : null;
  if (values.batch_id && !batch) throw httpError("Selected batch not found", 404);

  let batchProgram = null;
  if (values.batch_id && values.program_id) {
    batchProgram = await academicModel.getBatchProgram(values.batch_id, values.program_id);
    if (!batchProgram || batchProgram.status !== "active") {
      throw httpError("Selected Program is not configured in the selected Batch");
    }

    if (
      semester &&
      batchProgram.entry_semester &&
      Number(semester.semester_number) < Number(batchProgram.entry_semester.semester_number)
    ) {
      throw httpError("Selected semester is earlier than this intake's entry semester");
    }
  }

  return { ...values, batch, department, program, semester, batchProgram };
}
module.exports = { resolveAcademic };
