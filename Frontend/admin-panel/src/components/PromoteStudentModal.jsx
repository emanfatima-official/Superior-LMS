import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import FormField, { Alert, inputClass } from "./FormField";
import AcademicStructureService from "../services/AcademicStructureService";
import { promoteStudent } from "../services/promotionService";

export default function PromoteStudentModal({ open, student, onClose, onDone }) {
  const [semesters, setSemesters] = useState([]);
  const [targetSemesterId, setTargetSemesterId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !student?.program_id) return undefined;
    let cancelled = false;
    setTargetSemesterId("");
    setError("");
    setFetching(true);

    AcademicStructureService.getSemesters(student.program_id)
      .then((response) => {
        if (!cancelled) setSemesters(response?.data || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load semesters");
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, student?.program_id]);

  const currentNumber =
    student?.linked_semester?.semester_number ??
    semesters.find((semester) => semester.id === student?.semester_id)?.semester_number ??
    0;

  const targetOptions = useMemo(
    () => semesters.filter((semester) => Number(semester.semester_number) > Number(currentNumber)),
    [semesters, currentNumber]
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!targetSemesterId) return;
    setLoading(true);
    setError("");
    try {
      await promoteStudent(student.id, targetSemesterId);
      onDone?.();
      onClose();
    } catch (err) {
      setError(err?.message || "Student promotion failed");
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="Promote Student"
      subtitle="Promotion changes the current semester and preserves the previous academic history. It does not enroll courses automatically."
    >
      <form onSubmit={submit} className="space-y-4">
        <Alert message={error} />

        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <p className="font-semibold">{student.full_name}</p>
          <p className="text-slate-500">
            Current: {student.linked_semester?.name || student.semester || "Unknown semester"}
          </p>
        </div>

        <FormField label="Promote to" required>
          <select
            className={inputClass}
            value={targetSemesterId}
            onChange={(event) => setTargetSemesterId(event.target.value)}
            disabled={fetching || loading}
            required
          >
            <option value="">{fetching ? "Loading semesters..." : "Select next semester"}</option>
            {targetOptions.map((semester) => (
              <option key={semester.id} value={semester.id}>{semester.name}</option>
            ))}
          </select>
        </FormField>

        {!fetching && !targetOptions.length && (
          <p className="text-sm text-slate-500">No later semester exists for this program.</p>
        )}

        <button
          disabled={!targetSemesterId || loading}
          className="h-11 w-full rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Promoting..." : "Promote Student"}
        </button>
      </form>
    </Modal>
  );
}
