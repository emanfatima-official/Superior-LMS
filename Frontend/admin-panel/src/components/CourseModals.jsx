import { useEffect, useState } from "react";
import {
  Loader2,
  Save,
} from "lucide-react";

import Modal from "./Modal";
import FormField, {
  Alert,
  inputClass,
} from "./FormField";

import AcademicSelectors from "./AcademicSelectors";

import {
  updateCourse,
} from "../services/courseService";

export function EditCourseModal({
  open,
  onClose,
  course,
  onUpdated,
}) {
  const [form, setForm] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open || !course) return;

    setForm({
      name:
        course.name || "",

      course_code:
        course.course_code || "",

      description:
        course.description || "",

      status:
        course.status || "published",

      level:
        course.level || "",

      credits:
        course.credits ?? "",

      duration_weeks:
        course.duration_weeks ?? "",

      department_id:
        course.department_id || "",

      program_id:
        course.program_id || "",
    });

    setError("");
  }, [
    open,
    course,
  ]);

  const handleChange = (e) => {
    const {
      name,
      value,
    } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleAcademicChange = (
    value
  ) => {
    setForm((prev) => ({
      ...prev,

      department_id:
        value.department_id || "",

      program_id:
        value.program_id || "",
    }));

    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (
      !form.name?.trim() ||
      !form.department_id ||
      !form.program_id
    ) {
      setError(
        "Course name, department and program are required."
      );

      return;
    }

    setLoading(true);

    try {
      const payload = {
        name:
          form.name.trim(),

        course_code:
          form.course_code?.trim() ||
          null,

        description:
          form.description?.trim() ||
          null,

        status:
          form.status ||
          "published",

        level:
          form.level?.trim() ||
          null,

        credits:
          form.credits === ""
            ? null
            : Number(form.credits),

        duration_weeks:
          form.duration_weeks === ""
            ? null
            : Number(
                form.duration_weeks
              ),

        department_id:
          form.department_id,

        program_id:
          form.program_id,
      };

      const res =
        await updateCourse(
          course.id,
          payload
        );

      onUpdated?.(
        res?.data
      );

      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update course."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!course) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Course"
      subtitle="Update course details and academic placement."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Alert
          message={error}
        />

        {/* COURSE NAME */}
        <FormField label="Course name">
          <input
            required
            name="name"
            className={inputClass}
            value={form.name || ""}
            onChange={handleChange}
          />
        </FormField>

        {/* CODE + LEVEL */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Course code">
            <input
              name="course_code"
              className={inputClass}
              value={
                form.course_code || ""
              }
              onChange={handleChange}
            />
          </FormField>

          <FormField label="Level">
            <input
              name="level"
              className={inputClass}
              value={
                form.level || ""
              }
              onChange={handleChange}
            />
          </FormField>
        </div>

        {/* DEPARTMENT + PROGRAM */}
        <AcademicSelectors
          value={form}
          onChange={handleAcademicChange}
          disabled={loading}
          required
          showBatch={false}
          showDepartment={true}
          showProgram={true}
          showSemester={false}
        />

        {/* CREDITS + DURATION */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Credits">
            <input
              type="number"
              step="0.5"
              min="0"
              name="credits"
              className={inputClass}
              value={
                form.credits ?? ""
              }
              onChange={handleChange}
            />
          </FormField>

          <FormField label="Duration (weeks)">
            <input
              type="number"
              min="0"
              name="duration_weeks"
              className={inputClass}
              value={
                form.duration_weeks ?? ""
              }
              onChange={handleChange}
            />
          </FormField>
        </div>

        {/* STATUS */}
        <FormField label="Status">
          <select
            name="status"
            className={inputClass}
            value={
              form.status ||
              "published"
            }
            onChange={handleChange}
          >
            <option value="published">
              Published
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="archived">
              Archived
            </option>
          </select>
        </FormField>

        {/* DESCRIPTION */}
        <FormField label="Description">
          <textarea
            name="description"
            rows={4}
            className={inputClass}
            value={
              form.description || ""
            }
            onChange={handleChange}
          />
        </FormField>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70"
        >
          {loading ? (
            <Loader2
              className="animate-spin"
              size={18}
            />
          ) : (
            <Save size={18} />
          )}

          Save Changes
        </button>
      </form>
    </Modal>
  );
}