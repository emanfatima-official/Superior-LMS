const studentImporter =
  require(
    "./studentImport.model"
  );

const teacherImporter =
  require(
    "./teacherImport.model"
  );

// ======================================================
// SUPPORTED IMPORT MODULES
// ======================================================

/*
 * Security:
 * Route ke input ko direct require path mein
 * convert nahi kiya jata.
 *
 * Sirf yahan registered import modules hi
 * generic import controller use kar sakte hain.
 */

const IMPORTERS =
  Object.freeze({
    students:
      studentImporter,

    teachers:
      teacherImporter,
  });

// ======================================================
// GET IMPORTER
// ======================================================

const getImporter = (
  key
) => {
  const normalizedKey =
    String(key || "")
      .trim()
      .toLowerCase();

  const importer =
    IMPORTERS[
      normalizedKey
    ];

  if (!importer) {
    const error =
      new Error(
        "This import type is not supported."
      );

    error.status = 404;

    throw error;
  }

  return importer;
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getImporter,

  supportedImportTypes:
    Object.keys(
      IMPORTERS
    ),
};