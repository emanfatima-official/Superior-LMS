import AcademicStructure from "./AcademicStructure";

// Sidebar routes share one implementation so CRUD rules and the Batch wizard
// cannot drift between separate pages.
export const AcademicBatches = () => <AcademicStructure initialTab="batches" />;
export const AcademicDepartments = () => <AcademicStructure initialTab="departments" />;
export const AcademicPrograms = () => <AcademicStructure initialTab="programs" />;
export const AcademicSemesters = () => <AcademicStructure initialTab="semesters" />;

export default AcademicBatches;
