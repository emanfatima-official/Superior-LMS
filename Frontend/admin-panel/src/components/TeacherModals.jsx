import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Loader2,
  Save,
  Camera,
  KeyRound,
} from "lucide-react";

import Modal from "./Modal";
import branding from "../config/branding";

import FormField, {
  inputClass,
  Alert,
} from "./FormField";

import PasswordField from "./PasswordField";

import {
  updateTeacher,
  resetTeacherPassword,
  uploadAvatar,
} from "../services/teacherService";

// ======================================================
// EDIT TEACHER
// ======================================================

export function EditTeacherModal({
  open,
  onClose,
  teacher,
  onUpdated,
}) {
  const [form, setForm] =
    useState({
      full_name: "",
      email: "",
      phone: "",
      cnic: "",
      bio: "",

      department: "",

      is_active: true,
      must_change_password: true,

      avatar_url: "",
    });

  const [
    avatarFile,
    setAvatarFile,
  ] = useState(null);

  const [
    avatarPreview,
    setAvatarPreview,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const fileInputRef =
    useRef(null);

  // ======================================================
  // LOAD TEACHER
  // ======================================================

  useEffect(() => {
    if (!open || !teacher) {
      return;
    }

    setForm({
      full_name:
        teacher.full_name || "",

      email:
        teacher.email || "",

      phone:
        teacher.phone || "",

      cnic:
        teacher.cnic || "",

      bio:
        teacher.bio || "",

      department:
        teacher.department || "",

      is_active:
        teacher.is_active ??
        true,

      must_change_password:
        teacher.must_change_password ??
        true,

      avatar_url:
        teacher.avatar_url || "",
    });

    setAvatarFile(null);

    setAvatarPreview(
      teacher.avatar_url ||
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
    teacher,
  ]);

  // ======================================================
  // CHANGE
  // ======================================================

  const handleChange =
    (event) => {
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

  // ======================================================
  // AVATAR
  // ======================================================

  const handleAvatarChange =
    (event) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
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

  // ======================================================
  // SUBMIT
  // ======================================================

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

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

      setLoading(true);

      try {
        let avatar_url =
          form.avatar_url ||
          null;

        if (
          avatarFile
        ) {
          const uploadRes =
            await uploadAvatar(
              avatarFile
            );

          avatar_url =
            uploadRes?.data
              ?.avatar_url ||
            uploadRes?.data
              ?.data
              ?.avatar_url ||
            uploadRes
              ?.avatar_url ||
            null;

          if (
            !avatar_url
          ) {
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

          phone:
            form.phone.trim() ||
            null,

          cnic:
            form.cnic.trim(),

          bio:
            form.bio.trim() ||
            null,

          avatar_url,

          department:
            form.department.trim() ||
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

        const response =
          await updateTeacher(
            teacher.id,
            payload
          );

        onUpdated?.(
          response?.data
        );

        onClose();
      } catch (
        err
      ) {
        setError(
          err?.response
            ?.data
            ?.message ||
            err?.message ||
            "Failed to update teacher."
        );
      } finally {
        setLoading(false);
      }
    };

  if (
    !teacher
  ) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Teacher"
      subtitle={
        teacher.cnic
          ? `Login Username: ${teacher.cnic}`
          : teacher.full_name
      }
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

        <div className="flex flex-col items-center">
          <div className="relative">
            {avatarPreview ? (
              <img
                src={
                  avatarPreview
                }
                alt="Teacher profile"
                className="h-24 w-24 rounded-full object-cover ring-4 ring-blue-50 dark:ring-blue-500/10"
                onError={(
                  e
                ) => {
                  e.currentTarget.style.display =
                    "none";
                }}
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-3xl font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                {teacher.full_name
                  ?.charAt(
                    0
                  )
                  ?.toUpperCase() ||
                  "T"}
              </div>
            )}

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={
                loading
              }
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Camera
                size={
                  15
                }
              />
            </button>
          </div>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/*"
            onChange={
              handleAvatarChange
            }
            className="hidden"
          />

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Profile picture · Max 5 MB
          </p>
        </div>

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
            placeholder="Teacher full name"
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
              placeholder="xxxxx-xxxxxxx-x"
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
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="is_active"
              checked={Boolean(
                form.is_active
              )}
              onChange={
                handleChange
              }
            />

            Active account
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              name="must_change_password"
              checked={Boolean(
                form.must_change_password
              )}
              onChange={
                handleChange
              }
            />

            Must change password
          </label>
        </div>

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
            <Save
              size={
                18
              }
            />
          )}

          {loading
            ? "Saving..."
            : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
}

// ======================================================
// RESET TEACHER PASSWORD
// ======================================================

export function ResetTeacherPasswordModal({
  open,
  onClose,
  teacher,
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
    if (!open) {
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
        !teacher?.id
      ) {
        setError(
          "Teacher ID is missing."
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
        await resetTeacherPassword(
          teacher.id,
          password
        );

        onDone?.();

        onClose();
      } catch (
        err
      ) {
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
    !teacher
  ) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset Teacher Password"
      subtitle={`Set a new password for ${teacher.full_name}. No confirmation is required.`}
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
              teacher.full_name
            }
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Username:{" "}
            {teacher.cnic ||
              "CNIC not set"}
            {teacher.email
              ? ` · ${teacher.email}`
              : ""}
          </p>
        </div>

        <PasswordField
          label="New password"
          value={
            password
          }
          onChange={
            setPassword
          }
          placeholder="Enter manually or generate"
        />

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
            <KeyRound
              size={
                18
              }
            />
          )}

          {loading
            ? "Updating..."
            : "Update Password"}
        </button>
      </form>
    </Modal>
  );
}