import logo from "../assets/Logo.png";

export const branding = {
  universityName: "Superior University Pattoki",
  shortName: "Superior",
  lmsName: "Learning Management System",
  panelName: "LMS Admin Panel",
  logo,
  primaryColor: "#007A7F",
  secondaryColor: "#007A7F",
  adminEmailPlaceholder: "admin@superior.com",
  teacherEmailPlaceholder: "teacher@superior.com",
  studentEmailPlaceholder: "student@superior.com",
  copyrightName: "Superior University Pattoki",
};

export function applyBranding() {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.primaryColor);
  root.style.setProperty("--brand-secondary", branding.secondaryColor);
  document.title = `${branding.shortName} - ${branding.panelName}`;
}

export default branding;
