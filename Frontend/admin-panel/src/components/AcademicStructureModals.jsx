import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import FormField, { inputClass } from "./FormField";

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Unable to save changes";

const ModalShell = ({ title, subtitle, onClose, wide = false, children }) => (
  <div className="fixed bottom-0 left-0 right-0 top-20 z-40 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm lg:left-64">
    <div
      className={`relative flex max-h-[calc(100vh-7rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 ${
        wide ? "max-w-5xl" : "max-w-lg"
      }`}
    >
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FormActions = ({ loading, onClose, submitLabel = "Save" }) => (
  <div className="flex gap-3 pt-4">
    <button
      type="button"
      onClick={onClose}
      disabled={loading}
      className="h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={loading}
      className="h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Saving..." : submitLabel}
    </button>
  </div>
);

const checkboxClass = (checked) =>
  `flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
    checked
      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/10 dark:bg-blue-500/10"
      : "border-slate-200 hover:border-blue-300 dark:border-slate-700"
  }`;

const sortedProgramSemesters = (semesters, programId) =>
  semesters
    .filter(
      (semester) =>
        String(semester.program_id) === String(programId) && semester.status === "active"
    )
    .sort((a, b) => Number(a.semester_number) - Number(b.semester_number));

// ======================================================
// BATCH WIZARD
// Departments are a UI filter. Only selected Programs are persisted.
// ======================================================

export const BatchModal = ({
  isOpen,
  onClose,
  onSave,
  batch = null,
  departments = [],
  programs = [],
  semesters = [],
}) => {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ start_year: "", end_year: "", status: "active" });
  const [departmentIds, setDepartmentIds] = useState([]);
  const [programIds, setProgramIds] = useState([]);
  const [settings, setSettings] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const activeMappings = (batch?.program_mappings || []).filter(
      (mapping) => mapping.status !== "inactive"
    );
    const selectedPrograms = activeMappings.map((mapping) => mapping.program_id);
    const selectedDepartments = [
      ...new Set(
        activeMappings
          .map(
            (mapping) =>
              mapping.program?.department_id ||
              programs.find((program) => String(program.id) === String(mapping.program_id))
                ?.department_id
          )
          .filter(Boolean)
      ),
    ];
    const nextSettings = {};
    activeMappings.forEach((mapping) => {
      const available = sortedProgramSemesters(semesters, mapping.program_id);
      const firstId = available[0]?.id || "";
      nextSettings[mapping.program_id] = {
        admission_type:
          mapping.admission_type === "legacy" ? "regular" : mapping.admission_type || "regular",
        entry_semester_id: mapping.entry_semester_id || firstId,
        current_semester_id:
          mapping.current_semester_id || mapping.entry_semester_id || firstId,
      };
    });

    setDetails({
      start_year: batch?.start_year || "",
      end_year: batch?.end_year || "",
      status: batch?.status || "active",
    });
    setDepartmentIds(selectedDepartments);
    setProgramIds(selectedPrograms);
    setSettings(nextSettings);
    setStep(0);
    setError("");
  }, [batch, isOpen, programs, semesters]);

  const selectedPrograms = useMemo(
    () => programs.filter((program) => programIds.includes(program.id)),
    [programIds, programs]
  );

  const steps = ["Batch details", "Departments", "Programs", "Placement", "Review"];

  const ensureProgramSettings = (programId, current = settings) => {
    if (current[programId]) return current;
    const available = sortedProgramSemesters(semesters, programId);
    const firstId = available[0]?.id || "";
    return {
      ...current,
      [programId]: {
        admission_type: "regular",
        entry_semester_id: firstId,
        current_semester_id: firstId,
      },
    };
  };

  const toggleDepartment = (id) => {
    const removing = departmentIds.includes(id);
    setDepartmentIds((old) =>
      removing ? old.filter((value) => value !== id) : [...old, id]
    );
    if (removing) {
      const removedProgramIds = new Set(
        programs.filter((program) => program.department_id === id).map((program) => program.id)
      );
      setProgramIds((old) => old.filter((programId) => !removedProgramIds.has(programId)));
    }
    setError("");
  };

  const toggleProgram = (id) => {
    if (programIds.includes(id)) {
      setProgramIds((old) => old.filter((value) => value !== id));
    } else {
      setProgramIds((old) => [...old, id]);
      setSettings((old) => ensureProgramSettings(id, old));
    }
    setError("");
  };

  const updateSetting = (programId, key, value) => {
    setSettings((old) => {
      const next = ensureProgramSettings(programId, old);
      const updated = { ...next[programId], [key]: value };
      const available = sortedProgramSemesters(semesters, programId);
      if (key === "admission_type") {
        const suggested =
          value === "lateral"
            ? available.find((semester) => Number(semester.semester_number) === 5) || available[0]
            : available[0];
        if (suggested) {
          updated.entry_semester_id = suggested.id;
          updated.current_semester_id = suggested.id;
        }
      }
      if (key === "entry_semester_id") {
        const entry = available.find((semester) => semester.id === value);
        const current = available.find(
          (semester) => semester.id === updated.current_semester_id
        );
        if (!current || Number(current.semester_number) < Number(entry?.semester_number)) {
          updated.current_semester_id = value;
        }
      }
      return { ...next, [programId]: updated };
    });
    setError("");
  };

  const validateStep = (targetStep = step) => {
    if (targetStep === 0) {
      if (!details.start_year || !details.end_year) return "Start and end year are required";
      if (Number(details.end_year) < Number(details.start_year)) {
        return "End year cannot be earlier than start year";
      }
    }
    if (targetStep === 1 && departmentIds.length === 0) return "Select at least one Department";
    if (targetStep === 2 && programIds.length === 0) return "Select at least one Program";
    if (targetStep >= 3) {
      for (const program of selectedPrograms) {
        const value = settings[program.id];
        if (!value?.entry_semester_id || !value?.current_semester_id) {
          return `${program.name} requires entry and current semester`;
        }
      }
    }
    return "";
  };

  const next = () => {
    const message = validateStep();
    if (message) return setError(message);
    setError("");
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const submit = async () => {
    const message = validateStep(3);
    if (message) return setError(message);
    setLoading(true);
    setError("");
    try {
      await onSave({
        start_year: Number(details.start_year),
        end_year: Number(details.end_year),
        status: details.status,
        programs: selectedPrograms.map((program) => ({
          program_id: program.id,
          admission_type: settings[program.id].admission_type,
          entry_semester_id: settings[program.id].entry_semester_id,
          current_semester_id: settings[program.id].current_semester_id,
          status: "active",
        })),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      title={batch ? "Edit Batch configuration" : "Create Batch"}
      subtitle="Choose existing Departments and Programs, then configure intake placement."
      onClose={onClose}
      wide
    >
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <div className="grid gap-2 sm:grid-cols-5">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  index < step
                    ? "bg-emerald-500 text-white"
                    : index === step
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                }`}
              >
                {index < step ? <Check size={14} /> : index + 1}
              </span>
              <span className={`text-xs font-semibold ${index === step ? "text-blue-600" : "text-slate-500"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="mx-auto max-w-xl space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start year" required>
                <input
                  type="number"
                  className={inputClass}
                  value={details.start_year}
                  onChange={(event) => setDetails((old) => ({ ...old, start_year: event.target.value }))}
                  placeholder="2024"
                />
              </FormField>
              <FormField label="End year" required>
                <input
                  type="number"
                  className={inputClass}
                  value={details.end_year}
                  onChange={(event) => setDetails((old) => ({ ...old, end_year: event.target.value }))}
                  placeholder="2028"
                />
              </FormField>
            </div>
            <FormField label="Status">
              <select
                className={inputClass}
                value={details.status}
                onChange={(event) => setDetails((old) => ({ ...old, status: event.target.value }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </FormField>
            <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              Example: BS Regular can be 2024–2028, while BS Lateral and ADP can both be 2024–2026 as separate Batch records.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Which Departments participate?</h3>
            <p className="mb-4 text-sm text-slate-500">This selection only filters the next screen; Departments are not duplicated inside the Batch.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {departments
                .filter(
                  (item) => item.status === "active" || departmentIds.includes(item.id)
                )
                .map((department) => {
                const checked = departmentIds.includes(department.id);
                return (
                  <button key={department.id} type="button" onClick={() => toggleDepartment(department.id)} className={checkboxClass(checked)}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                      {checked && <Check size={13} />}
                    </span>
                    <span>
                      <span className="block font-semibold text-slate-800 dark:text-slate-200">{department.name}</span>
                      <span className="text-xs text-slate-500">{department.code || "No code"}{department.status !== "active" ? " · Inactive" : ""}</span>
                    </span>
                  </button>
                );
                })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Select Programs</h3>
              <p className="text-sm text-slate-500">Only these Program mappings will be stored against the Batch.</p>
            </div>
            {departmentIds.map((departmentId) => {
              const department = departments.find((item) => item.id === departmentId);
              const departmentPrograms = programs.filter(
                (program) =>
                  program.department_id === departmentId &&
                  (program.status === "active" || programIds.includes(program.id))
              );
              return (
                <section key={departmentId}>
                  <h4 className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-300">{department?.name}</h4>
                  {departmentPrograms.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {departmentPrograms.map((program) => {
                        const checked = programIds.includes(program.id);
                        return (
                          <button key={program.id} type="button" onClick={() => toggleProgram(program.id)} className={checkboxClass(checked)}>
                            <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`}>
                              {checked && <Check size={13} />}
                            </span>
                            <span>
                              <span className="block font-semibold text-slate-800 dark:text-slate-200">{program.name}</span>
                              <span className="text-xs text-slate-500">{program.code || program.degree_title || "Program"}{program.status !== "active" ? " · Inactive" : ""}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No active Programs in this Department.</p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Configure each intake</h3>
              <p className="text-sm text-slate-500">Entry semester stays fixed; current semester changes as the cohort progresses.</p>
            </div>
            {selectedPrograms.map((program) => {
              const available = sortedProgramSemesters(semesters, program.id);
              const value = settings[program.id] || {};
              const department = departments.find((item) => item.id === program.department_id);
              return (
                <section key={program.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-4">
                    <h4 className="font-bold text-slate-900 dark:text-white">{program.name}</h4>
                    <p className="text-xs text-slate-500">{department?.name} · {program.code || "No code"}</p>
                  </div>
                  {available.length ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <FormField label="Admission type" required>
                        <select className={inputClass} value={value.admission_type || "regular"} onChange={(event) => updateSetting(program.id, "admission_type", event.target.value)}>
                          <option value="regular">Regular</option>
                          <option value="lateral">Lateral</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </FormField>
                      <FormField label="Entry semester" required>
                        <select className={inputClass} value={value.entry_semester_id || ""} onChange={(event) => updateSetting(program.id, "entry_semester_id", event.target.value)}>
                          <option value="">Select semester</option>
                          {available.map((semester) => <option key={semester.id} value={semester.id}>{semester.name || `Semester ${semester.semester_number}`}</option>)}
                        </select>
                      </FormField>
                      <FormField label="Current semester" required>
                        <select className={inputClass} value={value.current_semester_id || ""} onChange={(event) => updateSetting(program.id, "current_semester_id", event.target.value)}>
                          <option value="">Select semester</option>
                          {available
                            .filter((semester) => {
                              const entry = available.find((item) => item.id === value.entry_semester_id);
                              return !entry || Number(semester.semester_number) >= Number(entry.semester_number);
                            })
                            .map((semester) => <option key={semester.id} value={semester.id}>{semester.name || `Semester ${semester.semester_number}`}</option>)}
                        </select>
                      </FormField>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Add Semesters to this Program before using it in a Batch.</p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Batch</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{details.start_year}–{details.end_year}</p>
              <p className="text-sm capitalize text-slate-500">{details.status}</p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="px-4 py-3">Program</th><th className="px-4 py-3">Admission</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Current</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPrograms.map((program) => {
                    const value = settings[program.id];
                    const available = sortedProgramSemesters(semesters, program.id);
                    return (
                      <tr key={program.id}>
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{program.name}</td>
                        <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{value?.admission_type}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{available.find((item) => item.id === value?.entry_semester_id)?.name || "—"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{available.find((item) => item.id === value?.current_semester_id)?.name || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800">
        <button
          type="button"
          onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {step === 0 ? "Cancel" : <><ChevronLeft size={16} /> Back</>}
        </button>
        {step < steps.length - 1 ? (
          <button type="button" onClick={next} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading} className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {loading ? "Saving..." : batch ? "Update Batch" : "Create Batch"}
          </button>
        )}
      </div>
    </ModalShell>
  );
};

// ======================================================
// MASTER DATA MODALS
// ======================================================

export const DepartmentModal = ({ isOpen, onClose, onSave, department = null }) => {
  const [form, setForm] = useState({ name: "", code: "", description: "", status: "active" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      name: department?.name || "",
      code: department?.code || "",
      description: department?.description || "",
      status: department?.status || "active",
    });
    setError("");
  }, [department, isOpen]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("Department name is required");
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <ModalShell title={department ? "Edit Department" : "Create Department"} subtitle="Departments are created once and reused in every Batch." onClose={onClose}>
      <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
        <FormField label="Department name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="Computer Science" /></FormField>
        <FormField label="Code"><input className={inputClass} value={form.code} onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))} placeholder="CS" /></FormField>
        <FormField label="Description"><textarea rows="3" className={inputClass} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></FormField>
        <FormField label="Status"><select className={inputClass} value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>
        <FormActions loading={loading} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

export const ProgramModal = ({ isOpen, onClose, onSave, program = null, departments = [] }) => {
  const [form, setForm] = useState({ department_id: "", name: "", code: "", degree_title: "", status: "active" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      department_id: program?.department_id || "",
      name: program?.name || "",
      code: program?.code || "",
      degree_title: program?.degree_title || "",
      status: program?.status || "active",
    });
    setError("");
  }, [program, isOpen]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.department_id) return setError("Department is required");
    if (!form.name.trim()) return setError("Program name is required");
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <ModalShell title={program ? "Edit Program" : "Create Program"} subtitle="A Program belongs to one master Department, not to a Batch." onClose={onClose}>
      <form onSubmit={submit} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
        <FormField label="Department" required><select className={inputClass} value={form.department_id} onChange={(event) => setForm((old) => ({ ...old, department_id: event.target.value }))}><option value="">Select Department</option>{departments.filter((item) => item.status === "active" || item.id === program?.department_id).map((item) => <option key={item.id} value={item.id}>{item.name}{item.code ? ` (${item.code})` : ""}</option>)}</select></FormField>
        <FormField label="Program name" required><input className={inputClass} value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="BS Computer Science" /></FormField>
        <FormField label="Code"><input className={inputClass} value={form.code} onChange={(event) => setForm((old) => ({ ...old, code: event.target.value }))} placeholder="BSCS" /></FormField>
        <FormField label="Degree title"><input className={inputClass} value={form.degree_title} onChange={(event) => setForm((old) => ({ ...old, degree_title: event.target.value }))} placeholder="Bachelor of Science" /></FormField>
        <FormField label="Status"><select className={inputClass} value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>
        <FormActions loading={loading} onClose={onClose} />
      </form>
    </ModalShell>
  );
};

const createSemesterRow = (semesterNumber) => ({
  row_id: `semester-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  semester_number: semesterNumber,
  name: `Semester ${semesterNumber}`,
  status: "active",
});

export const SemesterModal = ({
  isOpen,
  onClose,
  onSave,
  semester = null,
  programs = [],
  semesters = [],
}) => {
  const editing = Boolean(semester?.id);
  const [form, setForm] = useState({
    program_id: "",
    semester_number: "",
    name: "",
    status: "active",
  });
  const [programId, setProgramId] = useState("");
  const [semesterCount, setSemesterCount] = useState("8");
  const [semesterRows, setSemesterRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm({
      program_id: semester?.program_id || "",
      semester_number: semester?.semester_number || "",
      name: semester?.name || "",
      status: semester?.status || "active",
    });
    setProgramId("");
    setSemesterCount("8");
    setSemesterRows([]);
    setError("");
  }, [semester, isOpen]);

  const existingProgramSemesters = useMemo(
    () =>
      semesters.filter(
        (item) => String(item.program_id) === String(programId)
      ),
    [programId, semesters]
  );

  const usedSemesterNumbers = () =>
    new Set([
      ...existingProgramSemesters.map((item) => Number(item.semester_number)),
      ...semesterRows.map((item) => Number(item.semester_number)),
    ]);

  const nextAvailableSemesterNumber = (usedNumbers) => {
    let number = 1;
    while (usedNumbers.has(number)) number += 1;
    return number;
  };

  const generateRows = () => {
    setError("");

    if (!programId) {
      setError("Select a Program first");
      return;
    }

    const count = Number(semesterCount);
    if (!Number.isInteger(count) || count < 1) {
      setError("Enter a valid number of semesters");
      return;
    }

    const usedNumbers = new Set(
      existingProgramSemesters.map((item) => Number(item.semester_number))
    );
    const rows = [];

    while (rows.length < count) {
      const nextNumber = nextAvailableSemesterNumber(usedNumbers);
      rows.push(createSemesterRow(nextNumber));
      usedNumbers.add(nextNumber);
    }

    setSemesterRows(rows);
  };

  const addSemesterRow = () => {
    if (!programId) {
      setError("Select a Program first");
      return;
    }

    const nextNumber = nextAvailableSemesterNumber(usedSemesterNumbers());
    setSemesterRows((old) => [...old, createSemesterRow(nextNumber)]);
    setError("");
  };

  const updateSemesterRow = (rowId, field, value) => {
    setSemesterRows((old) =>
      old.map((row) => {
        if (row.row_id !== rowId) return row;

        const updated = { ...row, [field]: value };
        if (field === "semester_number" && /^Semester \d+$/.test(row.name)) {
          updated.name = value ? `Semester ${value}` : "";
        }
        return updated;
      })
    );
    setError("");
  };

  const removeSemesterRow = (rowId) => {
    setSemesterRows((old) => old.filter((row) => row.row_id !== rowId));
    setError("");
  };

  const validateBulkRows = () => {
    if (!programId) return "Program is required";
    if (!semesterRows.length) return "Generate or add at least one Semester";

    const existingNumbers = new Set(
      existingProgramSemesters.map((item) => Number(item.semester_number))
    );
    const requestNumbers = new Set();

    for (const row of semesterRows) {
      const semesterNumber = Number(row.semester_number);

      if (!Number.isInteger(semesterNumber) || semesterNumber < 1) {
        return "Every Semester must have a valid positive number";
      }
      if (!row.name.trim()) {
        return `Semester ${semesterNumber} requires a name`;
      }
      if (existingNumbers.has(semesterNumber)) {
        return `Semester ${semesterNumber} already exists for the selected Program`;
      }
      if (requestNumbers.has(semesterNumber)) {
        return `Semester number ${semesterNumber} is repeated`;
      }

      requestNumbers.add(semesterNumber);
    }

    return "";
  };

  const submit = async (event) => {
    event.preventDefault();

    if (editing) {
      if (!form.program_id || !form.semester_number || !form.name.trim()) {
        setError("Program, semester number and name are required");
        return;
      }

      setLoading(true);
      setError("");
      try {
        await onSave({
          ...form,
          semester_number: Number(form.semester_number),
        });
        onClose();
      } catch (saveError) {
        setError(errorMessage(saveError));
      } finally {
        setLoading(false);
      }
      return;
    }

    const validationError = validateBulkRows();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await onSave({
        program_id: programId,
        semesters: semesterRows.map((row) => ({
          semester_number: Number(row.semester_number),
          name: row.name.trim(),
          status: row.status === "inactive" ? "inactive" : "active",
        })),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (editing) {
    return (
      <ModalShell
        title="Edit Semester"
        subtitle="Update this reusable Program semester."
        onClose={onClose}
      >
        <form
          onSubmit={submit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
        >
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">
              {error}
            </p>
          )}

          <FormField label="Program" required>
            <select
              className={inputClass}
              value={form.program_id}
              onChange={(event) =>
                setForm((old) => ({ ...old, program_id: event.target.value }))
              }
            >
              <option value="">Select Program</option>
              {programs
                .filter(
                  (item) =>
                    item.status === "active" || item.id === semester?.program_id
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.code ? ` (${item.code})` : ""}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="Semester number" required>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.semester_number}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  semester_number: event.target.value,
                }))
              }
              placeholder="1"
            />
          </FormField>

          <FormField label="Semester name" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(event) =>
                setForm((old) => ({ ...old, name: event.target.value }))
              }
              placeholder="Semester 1"
            />
          </FormField>

          <FormField label="Status">
            <select
              className={inputClass}
              value={form.status}
              onChange={(event) =>
                setForm((old) => ({ ...old, status: event.target.value }))
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>

          <FormActions loading={loading} onClose={onClose} />
        </form>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Create Semesters"
      subtitle="Select one Program, generate as many Semesters as needed, then review and save them together."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={submit}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
      >
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">
            {error}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <FormField label="Program" required>
            <select
              className={inputClass}
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
                setSemesterRows([]);
                setError("");
              }}
            >
              <option value="">Select Program</option>
              {programs
                .filter((item) => item.status === "active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.code ? ` (${item.code})` : ""}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="New semesters" required>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={semesterCount}
              onChange={(event) => setSemesterCount(event.target.value)}
              placeholder="8"
            />
          </FormField>

          <button
            type="button"
            onClick={generateRows}
            className="mb-4 h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Generate
          </button>
        </div>

        {programId && existingProgramSemesters.length > 0 && (
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            This Program already has {existingProgramSemesters.length} Semester(s).
            Existing semester numbers will not be generated again.
          </div>
        )}

        {semesterRows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="hidden grid-cols-[130px_1fr_150px_44px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid dark:border-slate-700 dark:bg-slate-800/60">
              <span>Number</span>
              <span>Semester name</span>
              <span>Status</span>
              <span />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {semesterRows.map((row) => (
                <div
                  key={row.row_id}
                  className="grid gap-3 p-4 md:grid-cols-[130px_1fr_150px_44px] md:items-center"
                >
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                      Number
                    </label>
                    <input
                      type="number"
                      min="1"
                      className={inputClass}
                      value={row.semester_number}
                      onChange={(event) =>
                        updateSemesterRow(
                          row.row_id,
                          "semester_number",
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                      Semester name
                    </label>
                    <input
                      className={inputClass}
                      value={row.name}
                      onChange={(event) =>
                        updateSemesterRow(row.row_id, "name", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500 md:hidden">
                      Status
                    </label>
                    <select
                      className={inputClass}
                      value={row.status}
                      onChange={(event) =>
                        updateSemesterRow(row.row_id, "status", event.target.value)
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSemesterRow(row.row_id)}
                    title="Remove Semester"
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              No Semester rows generated yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Select a Program, enter the required count and press Generate.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <button
            type="button"
            onClick={addSemesterRow}
            disabled={!programId || loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Plus size={17} />
            Add another Semester
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || semesterRows.length === 0}
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Saving..."
                : `Create ${semesterRows.length || ""} Semester${
                    semesterRows.length === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};
