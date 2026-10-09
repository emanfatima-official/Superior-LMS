import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  UserPlus,
  BookOpen,
} from "lucide-react";

import Modal from "./Modal";
import branding from "../config/branding";

import FormField, {
  Alert,
  inputClass,
} from "./FormField";

import PasswordField from "./PasswordField";
import AcademicSelectors from "./AcademicSelectors";
import AcademicStructureService from "../services/AcademicStructureService";

import {
  createTeacher,
  uploadAvatar as uploadTeacherAvatar,
} from "../services/teacherService";

import {
  createStudent,
  uploadAvatar as uploadStudentAvatar,
} from "../services/studentService";

import {
  createCourse,
} from "../services/courseService";

// ======================================================
// SUBMIT BUTTON
// ======================================================

const SubmitButton = ({
  loading,
  label,
  icon,
}) => {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? (
        <Loader2
          size={18}
          className="animate-spin"
        />
      ) : (
        icon
      )}

      {loading ? "Please wait..." : label}
    </button>
  );
};

// ======================================================
// AVATAR PICKER
// ======================================================

function AvatarPicker({
  preview,
  onChange,
  inputRef,
  disabled,
  label,
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {preview ? (
          <img
            src={preview}
            alt="Profile preview"
            className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-50 dark:ring-blue-500/10"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-3xl font-semibold text-slate-400 dark:bg-slate-800">
            ?
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={disabled}
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60"
        >
          <Camera size={15} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
      />

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {label || "Profile picture · Max 5 MB"}
      </p>
    </div>
  );
}

// ======================================================
// ACADEMIC SELECTORS
// ======================================================

function AcademicStatusFields({
  form,
  setForm,
  disabled,
  required,
}) {
  return (
    <AcademicSelectors
      value={form}
      required={required}
      disabled={disabled}
      onChange={setForm}
    />
  );
}

// ======================================================
// ADD TEACHER
// ======================================================

export function AddTeacherModal({
  open,
  onClose,
  onCreated,
}) {
  const initial = {
    full_name: "",
    email: "",
    password: "",

    phone: "",
    cnic: "",
    avatar_url: "",

    department: "",

    bio: "",

    is_active: true,
    must_change_password: true,
  };

  const [form, setForm] =
    useState(initial);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [avatarFile, setAvatarFile] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const fileInputRef =
    useRef(null);

  useEffect(() => {
    if (!open) return;

    setForm(initial);
    setError("");
    setAvatarFile(null);
    setPreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [open]);

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setForm((prev) => ({
      ...prev,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setError("");
  };

  const handleAvatarChange = (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
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
    setAvatarFile(file);

    if (
      preview?.startsWith(
        "blob:"
      )
    ) {
      URL.revokeObjectURL(
        preview
      );
    }

    setPreview(
      URL.createObjectURL(
        file
      )
    );
  };

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      setError("");

      if (
        !form.full_name.trim()
      ) {
        setError(
          "Full name is required."
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
          "CNIC must contain exactly 13 digits."
        );

        return;
      }

      if (
        form.password.length <
        6
      ) {
        setError(
          "Password must be at least 6 characters."
        );

        return;
      }

      setLoading(true);

      try {
        let avatar_url =
          null;

        if (avatarFile) {
          const uploadRes =
            await uploadTeacherAvatar(
              avatarFile
            );

          avatar_url =
            uploadRes?.data
              ?.avatar_url ||
            uploadRes?.data
              ?.data
              ?.avatar_url ||
            uploadRes?.avatar_url ||
            null;

          if (!avatar_url) {
            throw new Error(
              "Avatar uploaded but URL was not returned."
            );
          }
        }

        const payload = {
          full_name:
            form.full_name.trim(),

          email:
            form.email.trim() ||
            null,

          password:
            form.password,

          phone:
            form.phone.trim() ||
            null,

          cnic:
            form.cnic.trim(),

          avatar_url,

          department:
            form.department.trim() ||
            null,

          bio:
            form.bio.trim() ||
            null,

          is_active:
            Boolean(
              form.is_active
            ),

          must_change_password:
            Boolean(
              form.must_change_password
            ),
        };

        const res =
          await createTeacher(
            payload
          );

        onCreated?.(
          res?.data
        );

        onClose();
      } catch (err) {
        setError(
          err?.response?.data
            ?.message ||
            err?.message ||
            "Failed to create teacher."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Teacher"
      subtitle="Create a teacher profile and login credentials."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Alert
          message={error}
        />

        <AvatarPicker
          preview={preview}
          onChange={
            handleAvatarChange
          }
          inputRef={
            fileInputRef
          }
          disabled={loading}
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
            placeholder="Dr. Ayesha Malik"
          />
        </FormField>

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
            placeholder={
              branding.teacherEmailPlaceholder
            }
          />
        </FormField>

        <PasswordField
          label="Temporary password"
          value={
            form.password
          }
          onChange={(value) =>
            setForm(
              (prev) => ({
                ...prev,

                password:
                  value,
              })
            )
          }
          placeholder="Enter manually or generate"
        />

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
              placeholder="03xx-xxxxxxx"
            />
          </FormField>

          <FormField label="CNIC (Login Username)">
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
              placeholder="35202-1234567-1"
            />
          </FormField>
        </div>

        <FormField label="Department / Faculty">
          <input
            name="department"
            className={
              inputClass
            }
            value={
              form.department
            }
            onChange={
              handleChange
            }
            placeholder="Faculty of Computer Science"
          />
        </FormField>

        <FormField label="Bio">
          <textarea
            name="bio"
            rows={3}
            className={
              inputClass
            }
            value={
              form.bio
            }
            onChange={
              handleChange
            }
            placeholder="Short teacher profile..."
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="is_active"
              checked={
                form.is_active
              }
              onChange={
                handleChange
              }
            />

            Active account
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="must_change_password"
              checked={
                form.must_change_password
              }
              onChange={
                handleChange
              }
            />

            Must change password
          </label>
        </div>

        <SubmitButton
          loading={loading}
          label="Create Teacher"
          icon={
            <UserPlus
              size={18}
            />
          }
        />
      </form>
    </Modal>
  );
}

// ======================================================
// ADD STUDENT
// ======================================================

export function AddStudentModal({
  open,
  onClose,
  onCreated,
}) {
  const initial = {
    full_name: "",
    father_name: "",
    email: "",
    password: "",

    student_id: "",

    phone: "",
    cnic: "",
    bio: "",
    avatar_url: "",

    department_id: "",
    program_id: "",
    batch_id: "",
    semester_id: "",

    is_active: true,
    must_change_password: true,
  };

  const [form, setForm] =
    useState(initial);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [avatarFile, setAvatarFile] =
    useState(null);

  const [preview, setPreview] =
    useState("");

  const fileInputRef =
    useRef(null);

  useEffect(() => {
    if (!open) return;

    setForm(initial);
    setError("");
    setAvatarFile(null);
    setPreview("");

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  }, [open]);

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setForm((prev) => ({
      ...prev,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));

    setError("");
  };

  const handleAvatarChange =
    (e) => {
      const file =
        e.target.files?.[0];

      if (!file) return;

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
      setAvatarFile(file);

      if (
        preview?.startsWith(
          "blob:"
        )
      ) {
        URL.revokeObjectURL(
          preview
        );
      }

      setPreview(
        URL.createObjectURL(
          file
        )
      );
    };

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      setError("");

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

      if (
        form.password.length <
        6
      ) {
        setError(
          "Password must be at least 6 characters."
        );

        return;
      }

      const requiredAcademicFields =
        [
          "department_id",
          "program_id",
          "batch_id",
          "semester_id",
        ];

      const missingAcademic =
        requiredAcademicFields.some(
          (field) =>
            !form[field]
        );

      if (
        missingAcademic
      ) {
        setError(
          "Please complete Department, Program, Batch and Semester."
        );

        return;
      }

      setLoading(true);

      try {
        let avatar_url =
          null;

        if (avatarFile) {
          const uploadRes =
            await uploadStudentAvatar(
              avatarFile
            );

          avatar_url =
            uploadRes?.data
              ?.avatar_url ||
            uploadRes?.data
              ?.data
              ?.avatar_url ||
            uploadRes?.avatar_url ||
            null;

          if (!avatar_url) {
            throw new Error(
              "Avatar uploaded but URL was not returned."
            );
          }
        }

        const payload = {
          full_name:
            form.full_name.trim(),

          father_name:
            form.father_name.trim(),

          email:
            form.email.trim() ||
            null,

          password:
            form.password,

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

          avatar_url,

          department_id:
            form.department_id,

          program_id:
            form.program_id,

          batch_id:
            form.batch_id,

          semester_id:
            form.semester_id,

          is_active:
            Boolean(
              form.is_active
            ),

          must_change_password:
            Boolean(
              form.must_change_password
            ),
        };

        const res =
          await createStudent(
            payload
          );

        onCreated?.(
          res?.data
        );

        onClose();
      } catch (err) {
        setError(
          err?.response?.data
            ?.message ||
            err?.message ||
            "Failed to create student."
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Student"
      subtitle="Register a student using the Academic Structure hierarchy."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Alert
          message={error}
        />

        <AvatarPicker
          preview={preview}
          onChange={
            handleAvatarChange
          }
          inputRef={
            fileInputRef
          }
          disabled={loading}
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
            placeholder="Student full name"
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
              placeholder={
                branding.studentEmailPlaceholder
              }
            />
          </FormField>

          <PasswordField
            label="Temporary password"
            value={
              form.password
            }
            onChange={(value) =>
              setForm(
                (prev) => ({
                  ...prev,

                  password:
                    value,
                })
              )
            }
            placeholder="Enter manually or generate"
          />
        </div>

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
            placeholder="STU-001"
          />
        </FormField>

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
              placeholder="03xx-xxxxxxx"
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
              placeholder="35202-1234567-1"
            />
          </FormField>
        </div>

        <AcademicStatusFields
          form={form}
          setForm={setForm}
          disabled={loading}
          required
        />

        <FormField label="Bio">
          <textarea
            name="bio"
            rows={3}
            className={
              inputClass
            }
            value={
              form.bio
            }
            onChange={
              handleChange
            }
            placeholder="Short student profile..."
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="is_active"
              checked={
                form.is_active
              }
              onChange={
                handleChange
              }
            />

            Active account
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              name="must_change_password"
              checked={
                form.must_change_password
              }
              onChange={
                handleChange
              }
            />

            Must change password
          </label>
        </div>

        <SubmitButton
          loading={loading}
          label="Create Student"
          icon={
            <UserPlus
              size={18}
            />
          }
        />
      </form>
    </Modal>
  );
}

// ======================================================
// ADD COURSE
// ======================================================

export function AddCourseModal({
  open,
  onClose,
  onCreated,
}) {
  const initial = {
    name: "",
    course_code: "",
    description: "",
    status: "published",
    level: "",
    credits: "",
    duration_weeks: "",
    department_id: "",
    program_ids: [],
  };

  const [form, setForm] = useState(initial);
  const [programs, setPrograms] = useState([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    setForm(initial);
    setError("");
    setAcademicLoading(true);

    AcademicStructureService.getPrograms()
      .then((response) => {
        if (cancelled) return;

        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.data)
              ? response.data.data
              : [];

        setPrograms(list);
      })
      .catch((loadError) => {
        if (cancelled) return;

        setPrograms([]);
        setError(
          loadError?.response?.data?.message ||
            loadError?.message ||
            "Unable to load Programs."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setAcademicLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
  };

  const handleAcademicChange = (value) => {
    const nextDepartmentId = value.department_id || "";

    setForm((prev) => ({
      ...prev,
      department_id: nextDepartmentId,
      program_ids:
        String(prev.department_id || "") ===
        String(nextDepartmentId || "")
          ? prev.program_ids
          : [],
    }));

    setError("");
  };

  const availablePrograms = programs
    .filter(
      (program) =>
        program?.status !== "inactive" &&
        String(program?.department_id || "") ===
          String(form.department_id || "")
    )
    .slice()
    .sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""))
    );

  const toggleProgram = (programId) => {
    setForm((prev) => {
      const selected = prev.program_ids.some(
        (id) => String(id) === String(programId)
      );

      return {
        ...prev,
        program_ids: selected
          ? prev.program_ids.filter(
              (id) => String(id) !== String(programId)
            )
          : [...prev.program_ids, programId],
      };
    });

    setError("");
  };

  const selectAllPrograms = () => {
    setForm((prev) => ({
      ...prev,
      program_ids: availablePrograms.map((program) => program.id),
    }));
    setError("");
  };

  const clearPrograms = () => {
    setForm((prev) => ({
      ...prev,
      program_ids: [],
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.department_id ||
      form.program_ids.length === 0
    ) {
      setError(
        "Course name, department and at least one program are required."
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        course_code: form.course_code.trim() || null,
        description: form.description.trim() || null,
        status: form.status || "published",
        level: form.level.trim() || null,
        credits:
          form.credits === "" ? null : Number(form.credits),
        duration_weeks:
          form.duration_weeks === ""
            ? null
            : Number(form.duration_weeks),
        department_id: form.department_id,
        program_ids: form.program_ids,
      };

      const res = await createCourse(payload);

      onCreated?.(res?.data);
      onClose();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create course."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Course"
      subtitle="Create one course for one or more programs in the selected department."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Alert message={error} />

        <FormField label="Course name">
          <input
            required
            name="name"
            className={inputClass}
            value={form.name}
            onChange={handleChange}
            placeholder="Introduction to Programming"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Course code">
            <input
              name="course_code"
              className={inputClass}
              value={form.course_code}
              onChange={handleChange}
              placeholder="CS-101"
            />
          </FormField>

          <FormField label="Level">
            <input
              name="level"
              className={inputClass}
              value={form.level}
              onChange={handleChange}
              placeholder="Undergraduate"
            />
          </FormField>
        </div>

        {/* Department only. Programs are multi-select below. */}
        <AcademicSelectors
          value={{ department_id: form.department_id }}
          onChange={handleAcademicChange}
          disabled={loading}
          required
          showBatch={false}
          showDepartment={true}
          showProgram={false}
          showSemester={false}
        />

        <FormField label="Programs">
          {!form.department_id ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              Select a Department first to load its Programs.
            </div>
          ) : academicLoading ? (
            <div className="flex min-h-20 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <Loader2 size={17} className="mr-2 animate-spin" />
              Loading Programs...
            </div>
          ) : availablePrograms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              No active Programs are available in this Department.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {form.program_ids.length} of {availablePrograms.length} selected
                </span>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllPrograms}
                    disabled={loading}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
                  >
                    Select all
                  </button>

                  <button
                    type="button"
                    onClick={clearPrograms}
                    disabled={loading || form.program_ids.length === 0}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {availablePrograms.map((program) => {
                  const checked = form.program_ids.some(
                    (id) => String(id) === String(program.id)
                  );

                  return (
                    <label
                      key={program.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                        checked
                          ? "border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={loading}
                        onChange={() => toggleProgram(program.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      />

                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {program.name}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {program.code || "No program code"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Credits">
            <input
              type="number"
              step="0.5"
              min="0"
              name="credits"
              className={inputClass}
              value={form.credits}
              onChange={handleChange}
              placeholder="3"
            />
          </FormField>

          <FormField label="Duration (weeks)">
            <input
              type="number"
              min="0"
              name="duration_weeks"
              className={inputClass}
              value={form.duration_weeks}
              onChange={handleChange}
              placeholder="16"
            />
          </FormField>
        </div>

        <FormField label="Status">
          <select
            name="status"
            className={inputClass}
            value={form.status}
            onChange={handleChange}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </FormField>

        <FormField label="Description">
          <textarea
            name="description"
            rows={4}
            className={inputClass}
            value={form.description}
            onChange={handleChange}
            placeholder="Course description..."
          />
        </FormField>

        <SubmitButton
          loading={loading}
          label={
            form.program_ids.length > 1
              ? `Create for ${form.program_ids.length} Programs`
              : "Create Course"
          }
          icon={<BookOpen size={18} />}
        />
      </form>
    </Modal>
  );
}

// ======================================================
// ENROLL STUDENTS
// ======================================================

export { default as EnrollStudentsModal } from "./EnrollStudentsModal";
