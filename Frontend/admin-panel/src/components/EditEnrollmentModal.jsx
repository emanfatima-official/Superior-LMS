import {
  useEffect,
  useState,
} from "react";

import Modal
  from "./Modal";

import FormField, {
  Alert,
  inputClass,
} from "./FormField";

import {
  updateEnrollment,
} from "../services/enrollmentService";


const dateValue = (
  value
) => {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  return date
    .toISOString()
    .slice(
      0,
      10
    );
};


export default function EditEnrollmentModal({
  open,
  enrollment,
  onClose,
  onUpdated,
}) {

  const [
    form,
    setForm,
  ] =
    useState({
      status:
        "active",

      enrollment_type:
        "regular",

      access_start_date:
        "",

      access_expiry_date:
        "",
    });


  const [
    saving,
    setSaving,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  useEffect(() => {

    if (
      !open ||
      !enrollment
    ) {
      return;
    }


    setError("");


    setForm({
      status:
        enrollment.status ||
        "active",

      enrollment_type:
        enrollment
          .enrollment_type ||
        "regular",

      access_start_date:
        dateValue(
          enrollment
            .access_start_date
        ),

      access_expiry_date:
        dateValue(
          enrollment
            .access_expiry_date
        ),
    });

  }, [
    open,
    enrollment,
  ]);


  if (!enrollment) {
    return null;
  }


  const student =
    enrollment.student;


  const course =
    enrollment.course;


  const assignment =
    enrollment
      .course_assignment;


  const submit =
    async (
      event
    ) => {

      event.preventDefault();

      setSaving(true);
      setError("");


      try {

        const response =
          await updateEnrollment(
            enrollment.id,
            {
              status:
                form.status,

              enrollment_type:
                form
                  .enrollment_type,

              access_start_date:
                form
                  .access_start_date ||
                null,

              access_expiry_date:
                form
                  .access_expiry_date ||
                null,
            }
          );


        onUpdated?.(
          response?.data
        );


        onClose();

      } catch (err) {

        setError(
          err?.message ||
            "Unable to update enrollment."
        );

      } finally {

        setSaving(false);

      }
    };


  return (
    <Modal
      open={open}

      onClose={() =>
        !saving &&
        onClose()
      }

      title="Edit Enrollment"

      subtitle="Update enrollment lifecycle and access settings. Student, Course and Course Assignment remain unchanged."
    >

      <form
        onSubmit={
          submit
        }

        className="space-y-5 text-slate-700 dark:text-slate-200"
      >

        <Alert
          message={
            error
          }
        />


        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">

          <div className="grid gap-4 sm:grid-cols-2">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Student
              </p>

              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {student?.full_name ||
                  "Unknown"}
              </p>

              <p className="truncate text-xs text-slate-500">
                {student?.email ||
                  ""}
              </p>
            </div>


            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Course
              </p>

              <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                {course?.name ||
                  "Unknown"}
              </p>

              <p className="text-xs text-slate-500">
                {course?.course_code ||
                  ""}
              </p>
            </div>


            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Semester
              </p>

              <p className="mt-1 text-sm font-medium">
                {assignment
                  ?.semester
                  ?.name ||
                  enrollment
                    ?.semester
                    ?.name ||
                  "—"}
              </p>
            </div>


            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Batch
              </p>

              <p className="mt-1 text-sm font-medium">
                {enrollment
                  ?.batch
                  ?.start_year &&
                enrollment
                  ?.batch
                  ?.end_year

                  ? `${enrollment.batch.start_year}–${enrollment.batch.end_year}`

                  : "—"}
              </p>
            </div>

          </div>

        </div>


        <div className="grid gap-4 sm:grid-cols-2">

          <FormField
            label="Status"
            required
          >

            <select
              className={
                inputClass
              }

              value={
                form.status
              }

              onChange={(
                event
              ) =>
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    status:
                      event
                        .target
                        .value,
                  })
                )
              }
            >

              <option value="active">
                Active
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="inactive">
                Inactive
              </option>

              <option value="suspended">
                Suspended
              </option>

              <option value="expired">
                Expired
              </option>

            </select>

          </FormField>


          <FormField
            label="Enrollment Type"
            required
          >

            <select
              className={
                inputClass
              }

              value={
                form
                  .enrollment_type
              }

              onChange={(
                event
              ) =>
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    enrollment_type:
                      event
                        .target
                        .value,
                  })
                )
              }
            >

              <option value="regular">
                Regular
              </option>

              <option value="supply">
                Supply
              </option>

            </select>

          </FormField>


          <FormField
            label="Access Start Date"
          >

            <input
              type="date"

              value={
                form
                  .access_start_date
              }

              onChange={(
                event
              ) =>
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    access_start_date:
                      event
                        .target
                        .value,
                  })
                )
              }
            />

          </FormField>


          <FormField
            label="Access Expiry Date"
          >

            <input
              type="date"

              value={
                form
                  .access_expiry_date
              }

              onChange={(
                event
              ) =>
                setForm(
                  (
                    previous
                  ) => ({
                    ...previous,

                    access_expiry_date:
                      event
                        .target
                        .value,
                  })
                )
              }
            />

          </FormField>

        </div>


        {form.status ===
          "completed" && (

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">

            Completed enrollment will be removed from Current Courses, while history and linked academic data will remain preserved.

          </div>

        )}


        {form.status ===
          "active" &&
          form.enrollment_type ===
            "regular" && (

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">

            A Regular enrollment can only remain Active in the student's current semester.

          </div>

        )}


        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-slate-700 sm:flex-row sm:justify-end">

          <button
            type="button"

            disabled={
              saving
            }

            onClick={
              onClose
            }

            className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>


          <button
            type="submit"

            disabled={
              saving
            }

            className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </button>

        </div>

      </form>

    </Modal>
  );
}