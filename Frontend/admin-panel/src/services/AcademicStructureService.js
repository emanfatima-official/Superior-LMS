import axiosClient from "../api/axiosClient";

const AcademicStructureService = {
  // ======================================================
  // BATCHES
  // ======================================================

  getBatches: async () => {
    try {
      const response = await axiosClient.get("/academic-structure/batches");
      return response;
    } catch (error) {
      console.error("Error fetching batches:", error);
      throw error;
    }
  },

  getBatch: async (id) => {
    try {
      const response = await axiosClient.get(
        `/academic-structure/batches/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching batch:", error);
      throw error;
    }
  },

  createBatch: async (data) => {
    try {
      const response = await axiosClient.post(
        "/academic-structure/batches",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating batch:", error);
      throw error;
    }
  },

  updateBatch: async (id, data) => {
    try {
      const response = await axiosClient.put(
        `/academic-structure/batches/${id}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating batch:", error);
      throw error;
    }
  },

  deleteBatch: async (id) => {
    try {
      const response = await axiosClient.delete(
        `/academic-structure/batches/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting batch:", error);
      throw error;
    }
  },

  getBatchPrograms: async (batchId = null, status = null) => {
    try {
      const params = {};
      if (batchId) params.batch_id = batchId;
      if (status) params.status = status;
      return await axiosClient.get("/academic-structure/batch-programs", { params });
    } catch (error) {
      console.error("Error fetching Batch Programs:", error);
      throw error;
    }
  },

  // ======================================================
  // DEPARTMENTS
  // ======================================================

  getDepartments: async (batchId = null) => {
    try {
      const params = batchId ? { batch_id: batchId } : {};
      const response = await axiosClient.get(
        "/academic-structure/departments",
        { params }
      );
      return response;
    } catch (error) {
      console.error("Error fetching departments:", error);
      throw error;
    }
  },

  getDepartment: async (id) => {
    try {
      const response = await axiosClient.get(
        `/academic-structure/departments/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching department:", error);
      throw error;
    }
  },

  createDepartment: async (data) => {
    try {
      const response = await axiosClient.post(
        "/academic-structure/departments",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating department:", error);
      throw error;
    }
  },

  updateDepartment: async (id, data) => {
    try {
      const response = await axiosClient.put(
        `/academic-structure/departments/${id}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating department:", error);
      throw error;
    }
  },

  deleteDepartment: async (id) => {
    try {
      const response = await axiosClient.delete(
        `/academic-structure/departments/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting department:", error);
      throw error;
    }
  },

  // ======================================================
  // PROGRAMS
  // ======================================================

  getPrograms: async (departmentId = null, batchId = null) => {
    try {
      const params = {};
      if (departmentId) params.department_id = departmentId;
      if (batchId) params.batch_id = batchId;
      const response = await axiosClient.get(
        "/academic-structure/programs",
        { params }
      );
      return response;
    } catch (error) {
      console.error("Error fetching programs:", error);
      throw error;
    }
  },

  getProgram: async (id) => {
    try {
      const response = await axiosClient.get(
        `/academic-structure/programs/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching program:", error);
      throw error;
    }
  },

  createProgram: async (data) => {
    try {
      const response = await axiosClient.post(
        "/academic-structure/programs",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating program:", error);
      throw error;
    }
  },

  updateProgram: async (id, data) => {
    try {
      const response = await axiosClient.put(
        `/academic-structure/programs/${id}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating program:", error);
      throw error;
    }
  },

  deleteProgram: async (id) => {
    try {
      const response = await axiosClient.delete(
        `/academic-structure/programs/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting program:", error);
      throw error;
    }
  },

  // ======================================================
  // SEMESTERS
  // ======================================================

  getSemesters: async (programId = null) => {
    try {
      const params = programId ? { program_id: programId } : {};
      const response = await axiosClient.get(
        "/academic-structure/semesters",
        { params }
      );
      return response;
    } catch (error) {
      console.error("Error fetching semesters:", error);
      throw error;
    }
  },

  getSemester: async (id) => {
    try {
      const response = await axiosClient.get(
        `/academic-structure/semesters/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error fetching semester:", error);
      throw error;
    }
  },

  createSemester: async (data) => {
    try {
      const response = await axiosClient.post(
        "/academic-structure/semesters",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating semester:", error);
      throw error;
    }
  },

  createSemestersBulk: async (data) => {
    try {
      const response = await axiosClient.post(
        "/academic-structure/semesters/bulk",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating semesters in bulk:", error);
      throw error;
    }
  },

  updateSemester: async (id, data) => {
    try {
      const response = await axiosClient.put(
        `/academic-structure/semesters/${id}`,
        data
      );
      return response;
    } catch (error) {
      console.error("Error updating semester:", error);
      throw error;
    }
  },

  deleteSemester: async (id) => {
    try {
      const response = await axiosClient.delete(
        `/academic-structure/semesters/${id}`
      );
      return response;
    } catch (error) {
      console.error("Error deleting semester:", error);
      throw error;
    }
  },
};

export const getAcademicBatches = () =>
  AcademicStructureService.getBatches();

export const getAcademicDepartments = (batchId = null) =>
  AcademicStructureService.getDepartments(batchId);

export const getAcademicPrograms = (departmentId = null, batchId = null) =>
  AcademicStructureService.getPrograms(departmentId, batchId);

export const getAcademicSemesters = (programId = null) =>
  AcademicStructureService.getSemesters(programId);

export default AcademicStructureService;
