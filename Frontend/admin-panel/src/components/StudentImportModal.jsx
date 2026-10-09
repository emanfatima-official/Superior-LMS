import { useEffect, useState } from "react";

import ImportModal from "./ImportModal";
import { studentImportDefinition } from "../config/importDefinitions";
import AcademicStructureService from "../services/AcademicStructureService";

const rowsFromResponse = (response) => {
  const value = response?.data?.data ?? response?.data ?? response;
  return Array.isArray(value) ? value : [];
};

function StudentImportModal({
  open,
  onClose,
  onImported,

  // Optional fallback props. Existing callers do not need to pass these.
  batches = [],
  departments = [],
  programs = [],
  semesters = [],
  batchPrograms = [],
}) {
  const [context, setContext] = useState({
    batches,
    departments,
    programs,
    semesters,
    batchPrograms,
  });

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const loadAcademicContext = async () => {
      try {
        const [
          batchesResponse,
          departmentsResponse,
          programsResponse,
          semestersResponse,
          batchProgramsResponse,
        ] = await Promise.all([
          AcademicStructureService.getBatches(),
          AcademicStructureService.getDepartments(),
          AcademicStructureService.getPrograms(),
          AcademicStructureService.getSemesters(),
          AcademicStructureService.getBatchPrograms(),
        ]);

        if (cancelled) return;

        setContext({
          batches: rowsFromResponse(batchesResponse),
          departments: rowsFromResponse(departmentsResponse),
          programs: rowsFromResponse(programsResponse),
          semesters: rowsFromResponse(semestersResponse),
          batchPrograms: rowsFromResponse(batchProgramsResponse),
        });
      } catch (error) {
        // Validation itself is performed by the backend, so import can still
        // work even if template-context loading temporarily fails.
        console.error("Student import academic context error:", error);

        if (!cancelled) {
          setContext({
            batches,
            departments,
            programs,
            semesters,
            batchPrograms,
          });
        }
      }
    };

    loadAcademicContext();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    batches,
    departments,
    programs,
    semesters,
    batchPrograms,
  ]);

  return (
    <ImportModal
      open={open}
      onClose={onClose}
      onImported={onImported}
      definition={studentImportDefinition}
      context={context}
    />
  );
}

export default StudentImportModal;
