import axiosClient from "../api/axiosClient";

export const getAdminAnnouncements = () =>
  axiosClient.get("/admin-notifications/announcements");

export const sendAdminAnnouncement = (payload) =>
  axiosClient.post("/admin-notifications/announcements", payload);

export const uploadAnnouncementAttachment = (file) => {
  const formData = new FormData();
  formData.append("attachment", file);
  return axiosClient.post("/upload/announcement-attachment", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
