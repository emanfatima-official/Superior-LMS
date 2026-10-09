const {
  getImporter,
} = require("../models/importRegistry.model");

const errorMessage = (
  error,
  fallback
) =>
  error?.message ||
  fallback;

const createImportController = (
  importType
) => {
  const importer =
    getImporter(importType);

  const singular =
    importer.singularLabel;

  const plural =
    importer.pluralLabel;

  const moduleName =
    singular.toLowerCase();

  // ====================================================
  // VALIDATE IMPORT ROWS
  // ====================================================

  const validate =
    async (
      req,
      res
    ) => {
      try {
        // Validation is read-only, so it should
        // not be saved in the activity history.
        req.skipActivityLog =
          true;

        const result =
          await importer.validateRows(
            req.body?.rows
          );

        return res
          .status(200)
          .json({
            success: true,

            message:
              result.summary
                .invalid > 0
                ? "Validation completed. Correct the invalid rows before importing."
                : `All ${plural.toLowerCase()} rows are ready to import.`,

            data: {
              summary:
                result.summary,

              rows:
                result.rows,
            },
          });
      } catch (error) {
        console.error(
          `VALIDATE ${singular.toUpperCase()} IMPORT ERROR:`,
          error
        );

        return res
          .status(
            error.status ||
              500
          )
          .json({
            success: false,

            message:
              errorMessage(
                error,
                `${singular} import could not be validated.`
              ),
          });
      }
    };

  // ====================================================
  // COMMIT IMPORT
  // ====================================================

  const commit =
    async (
      req,
      res
    ) => {
      try {
        const result =
          await importer.importRows(
            req.body?.rows,
            req.admin?.id
          );

        req.activitySummary = {
          action:
            `bulk_import_${importer.key}`,

          module:
            moduleName,

          targetType:
            moduleName,

          targetLabel:
            `${result.summary.imported} ${plural.toLowerCase()} imported`,

          values:
            result.summary,
        };

        return res
          .status(200)
          .json({
            success: true,

            message:
              result.summary
                .failed > 0
                ? `${result.summary.imported} ${plural.toLowerCase()} imported and ${result.summary.failed} failed.`
                : `${result.summary.imported} ${plural.toLowerCase()} imported successfully.`,

            data:
              result,
          });
      } catch (error) {
        console.error(
          `COMMIT ${singular.toUpperCase()} IMPORT ERROR:`,
          error
        );

        return res
          .status(
            error.status ||
              500
          )
          .json({
            success: false,

            message:
              errorMessage(
                error,
                `${plural} could not be imported.`
              ),
          });
      }
    };

  // ====================================================
  // IMPORT PROFILE IMAGES
  // ====================================================

  const images =
    typeof importer
      .importImages ===
    "function"
      ? async (
          req,
          res
        ) => {
          try {
            const result =
              await importer.importImages(
                req.files ||
                  []
              );

            req.activitySummary = {
              action:
                `bulk_upload_${moduleName}_avatars`,

              module:
                moduleName,

              targetType:
                moduleName,

              targetLabel:
                `${result.summary.uploaded} ${moduleName} images uploaded`,

              values:
                result.summary,
            };

            return res
              .status(200)
              .json({
                success:
                  true,

                message:
                  result
                    .summary
                    .failed >
                  0
                    ? `${result.summary.uploaded} images uploaded and ${result.summary.failed} failed.`
                    : `${result.summary.uploaded} ${moduleName} images uploaded successfully.`,

                data:
                  result,
              });
          } catch (
            error
          ) {
            console.error(
              `IMPORT ${singular.toUpperCase()} IMAGES ERROR:`,
              error
            );

            return res
              .status(
                error.status ||
                  500
              )
              .json({
                success:
                  false,

                message:
                  errorMessage(
                    error,
                    `${singular} images could not be imported.`
                  ),
              });
          }
        }
      : null;

  return {
    validate,
    commit,
    images,
  };
};

module.exports = {
  createImportController,
};