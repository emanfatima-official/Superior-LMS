import ImportModal from "./ImportModal";

import {
  teacherImportDefinition,
} from "../config/importDefinitions";

function TeacherImportModal({
  open,
  onClose,
  onImported,
}) {
  return (
    <ImportModal
      open={open}
      onClose={onClose}
      onImported={
        onImported
      }
      definition={
        teacherImportDefinition
      }
    />
  );
}

export default TeacherImportModal;