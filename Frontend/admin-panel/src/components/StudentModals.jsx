import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  Loader2,
  Save,
  KeyRound,
  Mail,
  Phone,
  IdCard,
  GraduationCap,
  Layers,
  BookOpen,
  Users,
} from "lucide-react";

import Modal from "./Modal";

import FormField, {
  Alert,
  inputClass,
} from "./FormField";

import {
  updateStudent,
  uploadAvatar,
  resetStudentPassword,
} from "../services/studentService";

// ======================================================
// HELPERS
// ======================================================

const getInitials = (
  name = ""
) => {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(
        Boolean
      );

  return (
    parts
      .slice(
        0,
        2
      )
      .map(
        (
          part
        ) =>
          part
            .charAt(
              0
            )
            .toUpperCase()
      )
      .join(
        ""
      ) ||
    "S"
  );
};

// ======================================================
// AVATAR PICKER
// ======================================================

function AvatarPicker({
  preview,
  name,
  onChange,
  inputRef,
  disabled,
}) {
  return (
    <div className="flex justify-center py-1">
      <div className="relative">
        {preview ? (
          <img
            src={
              preview
            }
            alt="Student"
            className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-500/10"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            {getInitials(
              name
            )}
          </div>
        )}

        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            inputRef.current?.click()
          }
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Camera
            size={
              16
            }
          />
        </button>

        <input
          ref={
            inputRef
          }
          type="file"
          accept="image/*"
          onChange={
            onChange
          }
          className="hidden"
        />
      </div>
    </div>
  );
}

// ======================================================
// SUBMIT BUTTON
// ======================================================

function SubmitButton({
  loading,
  label,
  icon,
}) {
  return (
    <button
      type="submit"
      disabled={
        loading
      }
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <Loader2
          size={
            18
          }
          className="animate-spin"
        />
      ) : (
        icon
      )}

      {loading
        ? "Please wait..."
        : label}
    </button>
  );
}

// ======================================================
// INFO ITEM
// ======================================================

function InfoItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon
          size={
            14
          }
        />

        {label}
      </div>

      <p className="mt-1 truncate text-sm font-medium text-slate-800 dark:text-white">
        {value ||
          "—"}
      </p>
    </div>
  );
}

// ======================================================
// EDIT STUDENT
// ======================================================

export function EditStudentModal({
  open,
  onClose,
  student,
  onUpdated,
}) {
  const [
    form,
    setForm,
  ] = useState({
    full_name: "",
    father_name: "",
    email: "",
    student_id: "",
    phone: "",
    cnic: "",
    bio: "",

    department_id: "",
    program_id: "",
    batch_id: "",
    semester_id: "",

    avatar_url: "",

    is_active: true,

    must_change_password: true,
  });

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    avatarFile,
    setAvatarFile,
  ] = useState(null);

  const [
    avatarPreview,
    setAvatarPreview,
  ] = useState("");

  const fileInputRef =
    useRef(null);

  // ====================================================
  // LOAD STUDENT
  // ====================================================

  useEffect(() => {
    if (
      !open ||
      !student
    ) {
      return;
    }

    setForm({
      full_name:
        student.full_name ||
        "",

      father_name:
        student.father_name ||
        "",

      email:
        student.email ||
        "",

      student_id:
        student.student_id ||
        "",

      phone:
        student.phone ||
        "",

      cnic:
        student.cnic ||
        "",

      bio:
        student.bio ||
        "",

      department_id:
        student.department_id ||
        "",

      program_id:
        student.program_id ||
        "",

      batch_id:
        student.batch_id ||
        "",

      semester_id:
        student.semester_id ||
        "",

      avatar_url:
        student.avatar_url ||
        "",

      is_active:
        student.is_active !==
        false,

      must_change_password:
        student.must_change_password !==
        false,
    });

    setAvatarFile(
      null
    );

    setAvatarPreview(
      student.avatar_url ||
        ""
    );

    setError("");

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }, [
    open,
    student,
  ]);

  // ====================================================
  // CHANGE
  // ====================================================

  const handleChange =
    (
      event
    ) => {
      const {
        name,
        value,
        type,
        checked,
      } =
        event.target;

      setForm(
        (
          previous
        ) => ({
          ...previous,

          [name]:
            type ===
            "checkbox"
              ? checked
              : value,
        })
      );

      setError("");
    };

  // ====================================================
  // AVATAR
  // ====================================================

  const handleAvatarChange =
    (
      event
    ) => {
      const file =
        event.target
          .files?.[0];

      if (
        !file
      ) {
        return;
      }

      if (
        !file.type.startsWith(
          "image/"
        )
      ) {
        setError(
          "Please select an image file."
        );

        return;
      }

      if (
        file.size >
        5 * 1024 * 1024
      ) {
        setError(
          "Image size must be less than 5 MB."
        );

        return;
      }

      setError("");

      setAvatarFile(
        file
      );

      if (
        avatarPreview?.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          avatarPreview
        );
      }

      setAvatarPreview(
        URL.createObjectURL(
          file
        )
      );
    };

  // ====================================================
  // SUBMIT
  // ====================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      setError("");

      if (
        !student?.id
      ) {
        setError(
          "Student ID is missing."
        );

        return;
      }

      if (
        !form.full_name.trim()
      ) {
        setError(
          "Full name is required."
        );

        return;
      }

      if (
        !form.father_name.trim()
      ) {
        setError(
          "Father name is required."
        );

        return;
      }

      if (
        !form.student_id.trim()
      ) {
        setError(
          "Student ID is required."
        );

        return;
      }

      const normalizedCnic =
        form.cnic.replace(
          /\D/g,
          ""
        );

      if (
        normalizedCnic.length !==
        13
      ) {
        setError(
          "CNIC/B-Form must contain exactly 13 digits."
        );

        return;
      }

      setLoading(true);

      try {
        let avatarUrl =
          form.avatar_url ||
          null;

        if (
          avatarFile
        ) {
          const response =
            await uploadAvatar(
              avatarFile
            );

          avatarUrl =
            response?.data
              ?.avatar_url ||
            response
              ?.avatar_url ||
            null;

          if (
            !avatarUrl
          ) {
            throw new Error(
              "Profile picture uploaded but URL was not returned."
            );
          }
        }

        const response =
          await updateStudent(
            student.id,
            {
              full_name:
                form.full_name.trim(),

              father_name:
                form.father_name.trim(),

              email:
                form.email.trim() ||
                null,

              student_id:
                form.student_id.trim(),

              phone:
                form.phone.trim() ||
                null,

              cnic:
                form.cnic.trim(),

              bio:
                form.bio.trim() ||
                null,

              avatar_url:
                avatarUrl,

              is_active:
                Boolean(
                  form.is_active
                ),

              must_change_password:
                Boolean(
                  form.must_change_password
                ),
            }
          );

        onUpdated?.(
          response?.data
        );

        onClose();
      } catch (
        err
      ) {
        console.error(
          "UPDATE STUDENT ERROR:",
          err
        );

        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Failed to update student."
        );
      } finally {
        setLoading(false);
      }
    };

  if (
    !student
  ) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Student"
      subtitle={`Update ${
        student.full_name ||
        "student"
      } information`}
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        <Alert
          message={error}
        />

        <AvatarPicker
          preview={
            avatarPreview
          }
          name={
            form.full_name
          }
          onChange={
            handleAvatarChange
          }
          inputRef={
            fileInputRef
          }
          disabled={
            loading
          }
        />

        <FormField label="Full name">
          <input
            required
            name="full_name"
            className={
              inputClass
            }
            value={
              form.full_name
            }
            onChange={
              handleChange
            }
          />
        </FormField>

        <FormField label="Father name">
          <input
            required
            name="father_name"
            className={
              inputClass
            }
            value={
              form.father_name
            }
            onChange={
              handleChange
            }
            placeholder="Father name"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email address (optional)">
            <input
              type="email"
              name="email"
              className={
                inputClass
              }
              value={
                form.email
              }
              onChange={
                handleChange
              }
            />
          </FormField>

          <FormField label="Student ID">
            <input
              required
              name="student_id"
              className={
                inputClass
              }
              value={
                form.student_id
              }
              onChange={
                handleChange
              }
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Phone">
            <input
              name="phone"
              className={
                inputClass
              }
              value={
                form.phone
              }
              onChange={
                handleChange
              }
              placeholder="03XX-XXXXXXX"
            />
          </FormField>

          <FormField label="CNIC / B-Form (Login Username)">
            <input
              required
              name="cnic"
              maxLength={
                15
              }
              className={
                inputClass
              }
              value={
                form.cnic
              }
              onChange={
                handleChange
              }
              placeholder="XXXXX-XXXXXXX-X"
            />
          </FormField>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="mb-4 text-sm font-semibold text-slate-800 dark:text-white">
            Academic Information
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoItem
              icon={
                Layers
              }
              label="Batch"
              value={
                student.linked_batch
                  ? `${student.linked_batch.start_year || ""}${
                      student.linked_batch.end_year
                        ? ` - ${student.linked_batch.end_year}`
                        : ""
                    }`
                  : null
              }
            />

            <InfoItem
              icon={
                Users
              }
              label="Department"
              value={
                student.linked_department?.name ||
                student.department
              }
            />

            <InfoItem
              icon={
                GraduationCap
              }
              label="Program"
              value={
                student.linked_program?.name
              }
            />

            <InfoItem
              icon={
                BookOpen
              }
              label="Semester"
              value={
                student.linked_semester?.name ||
                student.semester
              }
            />
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Academic placement is read-only here. Use Promotion to move the student to a later semester so academic history stays correct.
          </p>
        </div>

        <FormField label="Bio">
          <textarea
            name="bio"
            rows={4}
            className={`${inputClass} h-auto py-3`}
            value={
              form.bio
            }
            onChange={
              handleChange
            }
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
         <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="is_active"
              checked={Boolean(
                form.is_active
              )}
              onChange={
                handleChange
              }
              className="h-4 w-4"
            />

            Active account
          </label>

         <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="must_change_password"
              checked={Boolean(
                form.must_change_password
              )}
              onChange={
                handleChange
              }
              className="h-4 w-4"
            />

            Must change password
          </label>
        </div>

        <p className="text-xs text-slate-400">
          Last login:{" "}
          {student.last_login_at
            ? new Date(
                student.last_login_at
              ).toLocaleString()
            : "Never"}
        </p>

        <SubmitButton
          loading={
            loading
          }
          label="Save Changes"
          icon={
            <Save
              size={
                18
              }
            />
          }
        />
      </form>
    </Modal>
  );
}

// ======================================================
// VIEW STUDENT
// ======================================================

export function ViewStudentModal({
  open,
  onClose,
  student,
}) {
  if (
    !student
  ) {
    return null;
  }

  const active =
    student.is_active !==
    false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Student Details"
      subtitle="Complete student profile"
    >
      <div className="space-y-5">
        <div
          className={`flex flex-col items-center rounded-2xl border p-5 ${
            active
              ? "border-slate-200 dark:border-slate-700"
              : "border-amber-300 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5"
          }`}
        >
          {student.avatar_url ? (
            <img
              src={
                student.avatar_url
              }
              alt={
                student.full_name
              }
              className={`h-24 w-24 rounded-full object-cover ${
                !active
                  ? "grayscale"
                  : ""
              }`}
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
              {getInitials(
                student.full_name
              )}
            </div>
          )}

          <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
            {student.full_name ||
              "Unnamed Student"}
          </h3>

          <p className="text-sm text-slate-400">
            Username:{" "}
            {student.cnic ||
              "CNIC not set"}
          </p>

          {student.email && (
            <p className="mt-1 text-xs text-slate-400">
              {
                student.email
              }
            </p>
          )}

          <span
            className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              active
                ? "bg-emerald-500/15 text-emerald-500"
                : "bg-amber-500/15 text-amber-500"
            }`}
          >
            {active
              ? "Active"
              : "Inactive"}
          </span>

          {!active && (
            <p className="mt-2 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
              This account is currently blocked from LMS login.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoItem
            icon={
              IdCard
            }
            label="Student ID"
            value={
              student.student_id
            }
          />

          <InfoItem
            icon={
              Users
            }
            label="Father Name"
            value={
              student.father_name
            }
          />

          <InfoItem
            icon={
              Users
            }
            label="Department"
            value={
              student.linked_department?.name ||
              student.department
            }
          />

          <InfoItem
            icon={
              GraduationCap
            }
            label="Program"
            value={
              student.linked_program?.name
            }
          />

          <InfoItem
            icon={
              Layers
            }
            label="Batch"
            value={
              student.linked_batch
                ? `${
                    student.linked_batch.start_year ||
                    student.linked_batch.batch_year ||
                    ""
                  }${
                    student.linked_batch.end_year
                      ? ` - ${student.linked_batch.end_year}`
                      : ""
                  }`
                : null
            }
          />

          <InfoItem
            icon={
              BookOpen
            }
            label="Semester"
            value={
              student.linked_semester?.name ||
              student.semester
            }
          />

          <InfoItem
            icon={
              Phone
            }
            label="Phone"
            value={
              student.phone
            }
          />
        </div>

        <InfoItem
          icon={
            Mail
          }
          label="Email"
          value={
            student.email
          }
        />

        {student.cnic && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-xs text-slate-400">
              CNIC / B-Form · Login Username
            </p>

            <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">
              {
                student.cnic
              }
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            Enrolled Courses
          </p>

          <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white">
            {Number(
              student.enrolled_courses_count ??
                0
            )}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Average Progress
            </p>

            <p className="text-sm font-bold text-blue-600">
              {Math.round(
                Number(
                  student.progress_percentage ??
                    0
                )
              )}
              %
            </p>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    Number(
                      student.progress_percentage ??
                        0
                    )
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        {student.bio && (
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <p className="text-xs text-slate-400">
              Bio
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {
                student.bio
              }
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            Last Login
          </p>

          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-white">
            {student.last_login_at
              ? new Date(
                  student.last_login_at
                ).toLocaleString()
              : "Never"}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ======================================================
// RESET STUDENT PASSWORD
// ======================================================

export function ResetStudentPasswordModal({
  open,
  onClose,
  student,
  onDone,
}) {
  const [
    password,
    setPassword,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (
      !open
    ) {
      return;
    }

    setPassword("");
    setError("");
  }, [
    open,
  ]);

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      setError("");

      if (
        !student?.id
      ) {
        setError(
          "Student ID is missing."
        );

        return;
      }

      if (
        password.length <
        6
      ) {
        setError(
          "Password must be at least 6 characters."
        );

        return;
      }

      setLoading(true);

      try {
        await resetStudentPassword(
          student.id,
          password
        );

        onDone?.();

        onClose();
      } catch (
        err
      ) {
        console.error(
          "RESET PASSWORD ERROR:",
          err
        );

        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Failed to reset password."
        );
      } finally {
        setLoading(false);
      }
    };

  if (
    !student
  ) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset Student Password"
      subtitle={`Set a new password for ${
        student.full_name ||
        "student"
      }`}
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        <Alert
          message={error}
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {
              student.full_name
            }
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Username:{" "}
            {student.cnic ||
              "CNIC not set"}
            {student.email
              ? ` · ${student.email}`
              : ""}
          </p>
        </div>

        <FormField label="New password">
          <input
            required
            type="password"
            minLength={
              6
            }
            className={
              inputClass
            }
            value={
              password
            }
            onChange={(
              e
            ) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="Minimum 6 characters"
          />
        </FormField>

        <SubmitButton
          loading={
            loading
          }
          label="Update Password"
          icon={
            <KeyRound
              size={
                18
              }
            />
          }
        />
      </form>
    </Modal>
  );
}