import api from "../api/axiosClient";

// ======================================================
// CREATE SAFE IMPORT API PATH
// ======================================================

const importPath = (
  type,
  action
) => {
  const resource =
    String(type || "")
      .trim()
      .toLowerCase();

  if (
    !/^[a-z][a-z-]*$/.test(
      resource
    )
  ) {
    throw new Error(
      "Invalid import type."
    );
  }

  return (
    "/" +
    resource +
    "/import/" +
    action
  );
};

// ======================================================
// VALIDATE IMPORT ROWS
// ======================================================

export const validateImportRows = (
  type,
  rows
) =>
  api.post(
    importPath(
      type,
      "validate"
    ),
    {
      rows,
    }
  );

// ======================================================
// CREATE IMPORTED ACCOUNTS
// ======================================================

export const commitImportRows = (
  type,
  rows
) =>
  api.post(
    importPath(
      type,
      "commit"
    ),
    {
      rows,
    }
  );

// ======================================================
// UPLOAD PROFILE IMAGE BATCH
// ======================================================

export const uploadImportImageBatch = (
  type,
  files
) => {
  const formData =
    new FormData();

  files.forEach(
    (file) => {
      formData.append(
        "images",
        file,
        file.name
      );
    }
  );

  return api.post(
    importPath(
      type,
      "images"
    ),
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
      },
    }
  );
};