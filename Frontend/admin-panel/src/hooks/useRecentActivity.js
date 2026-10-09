import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getActivityLogs,
} from "../services/activityService";



const ACTION_LABELS = {
  create: "created",
  update: "updated",
  delete: "deleted",
  activate: "activated",
  deactivate: "deactivated",
  reset_password:
    "reset password for",
  bulk_enroll:
    "bulk enrolled students",
  upload_avatar:
    "uploaded a profile picture",
  login: "signed in",
  signup: "created an admin account",
};

const MODULE_LABELS = {
  student: "student",
  teacher: "teacher",
  course: "course",
  enrollment: "enrollment",
  academic_structure:
    "academic structure",
  auth: "authentication",
  system: "system",
};

const getActionText = (
  action
) =>
  ACTION_LABELS[action] ||
  action
    ?.replaceAll("_", " ") ||
  "performed an action";

const getModuleText = (
  module
) =>
  MODULE_LABELS[module] ||
  module
    ?.replaceAll("_", " ") ||
  "record";

const getInitial = (
  module
) => {
  const map = {
    student: "S",
    teacher: "T",
    course: "C",
    enrollment: "E",
    academic_structure: "A",
    auth: "A",
    system: "S",
  };

  return map[module] || "A";
};

export const mapActivity = (
  log
) => ({
  ...log,
  letter: getInitial(
    log.module
  ),
  title: `${getModuleText(
    log.module
  )} ${getActionText(
    log.action
  )}`,
  description:
    log.target_label ||
    `Admin ${getActionText(
      log.action
    )} ${getModuleText(
      log.module
    )}`,
});

export function useRecentActivity(
  limit = 20
) {
  const [activities, setActivities] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const load = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await getActivityLogs({
            limit,
          });

        const logs =
          response?.data || [];

        setActivities(
          logs.map(mapActivity)
        );
      } catch (err) {
        setError(
          err?.message ||
            "Failed to load recent activity."
        );
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    load();

    const interval =
      window.setInterval(
        load,
        15000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [load]);

  return {
    activities,
    loading,
    error,
    reload: load,
  };
}

export function timeAgo(
  dateString
) {
  if (!dateString) {
    return "";
  }

  const date =
    new Date(dateString);

  const diffMs =
    Date.now() -
    date.getTime();

  const minutes =
    Math.floor(
      diffMs / 60000
    );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days =
    Math.floor(hours / 24);

  return `${days} day${
    days === 1 ? "" : "s"
  } ago`;
}