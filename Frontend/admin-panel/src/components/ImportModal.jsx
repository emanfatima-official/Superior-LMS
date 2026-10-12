import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";

import Modal from "./Modal";

import {
  commitImportRows,
  uploadImportImageBatch,
  validateImportRows,
} from "../services/importService";

import {
  IMPORT_FILE_ROW_LIMIT,
  IMPORT_IMAGE_BATCH_SIZE,
  IMPORT_IMAGE_MAX_BYTES,
  SUPPORTED_IMPORT_FILE_TYPES,
  chunksOf,
  downloadImportReport,
  downloadImportTemplate,
  imageIdentifierFromFilename,
  readImportFile,
  validProfileImage,
} from "../utils/importWorkbook";

// ======================================================
// CONFIG
// ======================================================

const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp";

// ======================================================
// HELPERS
// ======================================================

const safeArray = (
  value
) =>
  Array.isArray(value)
    ? value
    : [];

const messageFromError = (
  error,
  fallback
) =>
  error?.response?.data
    ?.message ||
  error?.response?.data
    ?.error ||
  error?.message ||
  fallback;

const statusTone = (
  status
) => {
  if (
    status === "valid" ||
    status === "success"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (
    status === "invalid" ||
    status === "failed"
  ) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300";
};

// ======================================================
// IMPORT MODAL
// ======================================================

export default function ImportModal({
  open,
  onClose,
  onImported,
  definition,
  context = {},
}) {
  // ====================================================
  // SAFE DEFINITION
  // ====================================================

  const config =
    definition || {};

  const definitionReady =
    Boolean(
      config &&
        config.key
    );

  const pluralLabel =
    config.pluralLabel ||
    "Records";

  const pluralLower =
    config.pluralLower ||
    "records";

  const dataDescription =
    config.dataDescription ||
    "Import records from Excel, CSV or another supported file.";

  const templateDescription =
    config.templateDescription ||
    "Download the template, fill in the required data and upload it below.";

  const previewColumns =
    Array.isArray(
      config.previewColumns
    )
      ? config.previewColumns
      : [];

  const resultColumns =
    Array.isArray(
      config.resultColumns
    )
      ? config.resultColumns
      : [];

  // ====================================================
  // REFS
  // ====================================================

  const fileInputRef =
    useRef(null);

  const imageInputRef =
    useRef(null);

  // ====================================================
  // STATE
  // ====================================================

  const [
    parsedRows,
    setParsedRows,
  ] = useState([]);

  const [
    validationRows,
    setValidationRows,
  ] = useState([]);

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    selectedImages,
    setSelectedImages,
  ] = useState([]);

  const [
    parsing,
    setParsing,
  ] = useState(false);

  const [
    validating,
    setValidating,
  ] = useState(false);

  const [
    importing,
    setImporting,
  ] = useState(false);

  const [
    uploadingImages,
    setUploadingImages,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    importResults,
    setImportResults,
  ] = useState([]);

  // ====================================================
  // DERIVED
  // ====================================================

  const validRows =
    useMemo(
      () =>
        validationRows.filter(
          (
            row
          ) =>
            row.status ===
            "valid"
        ),
      [
        validationRows,
      ]
    );

  const invalidRows =
    useMemo(
      () =>
        validationRows.filter(
          (
            row
          ) =>
            row.status ===
            "invalid"
        ),
      [
        validationRows,
      ]
    );

  const hasValidation =
    validationRows.length >
    0;

  const hasImported =
    importResults.length >
    0;

  const busy =
    parsing ||
    validating ||
    importing ||
    uploadingImages;

  // ====================================================
  // CHECK DEFINITION
  // ====================================================

  const ensureDefinition =
    () => {
      if (
        !definitionReady
      ) {
        setError(
          "Import configuration is missing. Please close this window and reopen the import from the Students or Teachers page."
        );

        return false;
      }

      return true;
    };

  // ====================================================
  // RESET
  // ====================================================

  const resetState =
    () => {
      setParsedRows(
        []
      );

      setValidationRows(
        []
      );

      setSelectedFile(
        null
      );

      setSelectedImages(
        []
      );

      setError("");

      setSuccess("");

      setImportResults(
        []
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      if (
        imageInputRef.current
      ) {
        imageInputRef.current.value =
          "";
      }
    };

  const close =
    () => {
      if (busy) {
        return;
      }

      resetState();

      onClose?.();
    };

  // ====================================================
  // DOWNLOAD TEMPLATE
  // ====================================================

  const handleDownloadTemplate =
    () => {
      if (
        !ensureDefinition()
      ) {
        return;
      }

      setError("");

      try {
        downloadImportTemplate(
          config,
          context
        );
      } catch (
        templateError
      ) {
        setError(
          messageFromError(
            templateError,
            "Unable to create import template."
          )
        );
      }
    };

  // ====================================================
  // PARSE DATA FILE
  // ====================================================

  const handleDataFile =
    async (
      event
    ) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
        return;
      }

      if (
        !ensureDefinition()
      ) {
        event.target.value =
          "";

        return;
      }

      setError("");

      setSuccess("");

      setValidationRows(
        []
      );

      setImportResults(
        []
      );

      setSelectedFile(
        file
      );

      setParsing(
        true
      );

      try {
        const parsed =
          await readImportFile(
            file,
            config
          );

        const rows =
          safeArray(
            parsed?.rows ||
              parsed
          );

        if (
          !rows.length
        ) {
          throw new Error(
            "No usable data rows were found in the selected file."
          );
        }

        if (
          rows.length >
          IMPORT_FILE_ROW_LIMIT
        ) {
          throw new Error(
            `A maximum of ${IMPORT_FILE_ROW_LIMIT} rows can be imported at one time.`
          );
        }

        setParsedRows(
          rows
        );

        setSuccess(
          `${rows.length} row${
            rows.length === 1
              ? ""
              : "s"
          } loaded. Validate them before import.`
        );
      } catch (
        parseError
      ) {
        setParsedRows(
          []
        );

        setSelectedFile(
          null
        );

        setError(
          messageFromError(
            parseError,
            "Unable to read the import file."
          )
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }
      } finally {
        setParsing(
          false
        );
      }
    };

  // ====================================================
  // VALIDATE ROWS
  // ====================================================

  const validateRows =
    async () => {
      if (
        !ensureDefinition()
      ) {
        return;
      }

      if (
        !parsedRows.length
      ) {
        setError(
          "Upload an import file first."
        );

        return;
      }

      setError("");

      setSuccess("");

      setValidationRows(
        []
      );

      setValidating(
        true
      );

      try {
        const response =
          await validateImportRows(
            config.key,
            parsedRows
          );

        const responseData =
          response?.data?.data ??
          response?.data ??
          response;

        const rows =
          safeArray(
            responseData?.rows ||
              responseData
          );

        setValidationRows(
          rows
        );

        const validCount =
          rows.filter(
            (
              row
            ) =>
              row.status ===
              "valid"
          ).length;

        const invalidCount =
          rows.filter(
            (
              row
            ) =>
              row.status ===
              "invalid"
          ).length;

        setSuccess(
          `${validCount} valid row${
            validCount === 1
              ? ""
              : "s"
          } · ${invalidCount} invalid row${
            invalidCount === 1
              ? ""
              : "s"
          }.`
        );
      } catch (
        validationError
      ) {
        setValidationRows(
          []
        );

        setError(
          messageFromError(
            validationError,
            "Validation failed."
          )
        );
      } finally {
        setValidating(
          false
        );
      }
    };

  // ====================================================
  // COMMIT IMPORT
  // ====================================================

  const commitImport =
    async () => {
      if (
        !ensureDefinition()
      ) {
        return;
      }

      if (
        !validRows.length
      ) {
        setError(
          "There are no valid rows to import."
        );

        return;
      }

      setError("");

      setSuccess("");

      setImporting(
        true
      );

      try {
        const records =
          validRows.map(
            (
              row
            ) =>
              row.record ||
              row
          );

        const response =
          await commitImportRows(
            config.key,
            records
          );

        const responseData =
          response?.data?.data ??
          response?.data ??
          response;

        const results =
          safeArray(
            responseData?.results ||
              responseData
          );

        setImportResults(
          results
        );

        const succeeded =
          results.filter(
            (
              row
            ) =>
              row.success ===
                true ||
              row.status ===
                "success"
          ).length;

        const failed =
          results.length -
          succeeded;

        setSuccess(
          `${succeeded} ${pluralLower} imported successfully${
            failed
              ? ` · ${failed} failed`
              : ""
          }.`
        );

        onImported?.(
          responseData
        );
      } catch (
        importError
      ) {
        setError(
          messageFromError(
            importError,
            "Import failed."
          )
        );
      } finally {
        setImporting(
          false
        );
      }
    };

  // ====================================================
  // IMAGE SELECTION
  // ====================================================

  const handleImages =
    (
      event
    ) => {
      if (
        !ensureDefinition()
      ) {
        event.target.value =
          "";

        return;
      }

      const files =
        Array.from(
          event.target
            .files ||
            []
        );

      setError("");

      setSuccess("");

      if (
        !files.length
      ) {
        setSelectedImages(
          []
        );

        return;
      }

      const accepted =
        [];

      const errors =
        [];

      const seen =
        new Set();

      for (
        const file of files
      ) {
        if (
          !validProfileImage(
            file
          )
        ) {
          if (
            file.size >
            IMPORT_IMAGE_MAX_BYTES
          ) {
            errors.push(
              `${file.name}: image exceeds 3 MB.`
            );
          } else {
            errors.push(
              `${file.name}: unsupported image type.`
            );
          }

          continue;
        }

        const identity =
          imageIdentifierFromFilename(
            file.name
          );

        if (
          !identity ||
          String(
            identity
          ).replace(
            /\D/g,
            ""
          ).length !==
            13
        ) {
          errors.push(
            `${file.name}: filename must contain the 13-digit ${
              config.imageIdentityLabel ||
              "CNIC"
            }.`
          );

          continue;
        }

        const normalizedIdentity =
          String(
            identity
          ).replace(
            /\D/g,
            ""
          );

        if (
          seen.has(
            normalizedIdentity
          )
        ) {
          errors.push(
            `${file.name}: duplicate identity filename.`
          );

          continue;
        }

        seen.add(
          normalizedIdentity
        );

        accepted.push(
          file
        );
      }

      setSelectedImages(
        accepted
      );

      if (
        errors.length
      ) {
        setError(
          errors
            .slice(
              0,
              8
            )
            .join(
              "\n"
            ) +
            (
              errors.length >
              8
                ? `\n+${
                    errors.length -
                    8
                  } more image issue(s)`
                : ""
            )
        );
      }

      if (
        accepted.length
      ) {
        setSuccess(
          `${accepted.length} profile image${
            accepted.length ===
            1
              ? ""
              : "s"
          } ready to upload.`
        );
      }
    };

  // ====================================================
  // IMAGE UPLOAD
  // ====================================================

  const uploadImages =
    async () => {
      if (
        !ensureDefinition()
      ) {
        return;
      }

      if (
        !selectedImages.length
      ) {
        setError(
          "Select profile images first."
        );

        return;
      }

      setError("");

      setSuccess("");

      setUploadingImages(
        true
      );

      try {
        const batches =
          chunksOf(
            selectedImages,
            IMPORT_IMAGE_BATCH_SIZE
          );

        let uploaded =
          0;

        let matched =
          0;

        let failed =
          0;

        const messages =
          [];

        for (
          const batch of
            batches
        ) {
          const response =
            await uploadImportImageBatch(
              config.key,
              batch
            );

          const data =
            response?.data
              ?.data ??
            response?.data ??
            response ??
            {};

          uploaded +=
            Number(
              data.uploaded ||
                0
            );

          matched +=
            Number(
              data.matched ||
                data.updated ||
                0
            );

          failed +=
            Number(
              data.failed ||
                0
            );

          const results =
            safeArray(
              data.results
            );

          for (
            const row of
              results
          ) {
            if (
              (
                row.success ===
                  false ||
                row.status ===
                  "failed"
              ) &&
              row.message
            ) {
              messages.push(
                row.message
              );
            }
          }
        }

        setSuccess(
          `Images processed: ${
            uploaded ||
            selectedImages.length
          } · matched: ${matched} · failed: ${failed}.`
        );

        if (
          messages.length
        ) {
          setError(
            messages
              .slice(
                0,
                8
              )
              .join(
                "\n"
              )
          );
        }

        setSelectedImages(
          []
        );

        if (
          imageInputRef.current
        ) {
          imageInputRef.current.value =
            "";
        }

        onImported?.();
      } catch (
        imageError
      ) {
        setError(
          messageFromError(
            imageError,
            "Profile image upload failed."
          )
        );
      } finally {
        setUploadingImages(
          false
        );
      }
    };

  // ====================================================
  // DOWNLOAD RESULTS
  // ====================================================

  const downloadResults =
    () => {
      if (
        !ensureDefinition()
      ) {
        return;
      }

      if (
        !importResults.length
      ) {
        return;
      }

      try {
        downloadImportReport(
          config,
          importResults
        );
      } catch (
        resultError
      ) {
        setError(
          messageFromError(
            resultError,
            "Unable to download import results."
          )
        );
      }
    };

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <Modal
      open={open}
      onClose={
        close
      }
      title={`Import ${pluralLabel}`}
      subtitle={
        dataDescription
      }
      maxWidth="6xl"
    >
      <div className="space-y-6">
        {/* ==================================================
            CONFIGURATION ERROR
        ================================================== */}

        {!definitionReady && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="font-semibold">
                  Import configuration missing
                </p>

                <p className="mt-1">
                  This modal was opened without a valid
                  import definition. The page opening this
                  modal must pass the correct Student or
                  Teacher import definition.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            ALERTS
        ================================================== */}

        {error && (
          <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={
                  17
                }
                className="mt-0.5 shrink-0"
              />

              <span>
                {error}
              </span>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <div className="flex items-start gap-2">
              <CheckCircle2
                size={
                  17
                }
                className="mt-0.5 shrink-0"
              />

              <span>
                {success}
              </span>
            </div>
          </div>
        )}

        {/* ==================================================
            TEMPLATE
        ================================================== */}

        <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                1. Download Template
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                {
                  templateDescription
                }
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleDownloadTemplate
              }
              disabled={
                !definitionReady ||
                busy
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300"
            >
              <Download
                size={
                  16
                }
              />

              Download Template
            </button>
          </div>
        </section>

        {/* ==================================================
            DATA FILE
        ================================================== */}

        <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            2. Upload Data File
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Supported:
            Excel, CSV, TSV,
            ODS and TXT.
            Maximum{" "}
            {
              IMPORT_FILE_ROW_LIMIT
            }{" "}
            rows.
          </p>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept={
              SUPPORTED_IMPORT_FILE_TYPES
            }
            onChange={
              handleDataFile
            }
            className="hidden"
          />

          <button
            type="button"
            onClick={() =>
              fileInputRef.current?.click()
            }
            disabled={
              !definitionReady ||
              parsing ||
              validating ||
              importing
            }
            className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-5 text-center transition hover:border-blue-400 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-blue-500/5"
          >
            {parsing ? (
              <>
                <Loader2
                  size={
                    24
                  }
                  className="animate-spin text-blue-500"
                />

                <span className="mt-2 text-sm font-semibold">
                  Reading file...
                </span>
              </>
            ) : (
              <>
                <FileSpreadsheet
                  size={
                    26
                  }
                  className="text-blue-500"
                />

                <span className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile
                    ? selectedFile.name
                    : "Choose import file"}
                </span>

                <span className="mt-1 text-xs text-slate-400">
                  Click to browse
                </span>
              </>
            )}
          </button>

          {parsedRows.length >
            0 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                {
                  parsedRows.length
                }{" "}
                row
                {parsedRows.length ===
                1
                  ? ""
                  : "s"}{" "}
                ready
              </p>

              <button
                type="button"
                onClick={
                  validateRows
                }
                disabled={
                  validating ||
                  importing
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {validating ? (
                  <Loader2
                    size={
                      16
                    }
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={
                      16
                    }
                  />
                )}

                {validating
                  ? "Validating..."
                  : "Validate Rows"}
              </button>
            </div>
          )}
        </section>

        {/* ==================================================
            VALIDATION PREVIEW
        ================================================== */}

        {hasValidation && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  3. Validation Preview
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {validRows.length} valid ·{" "}
                  {invalidRows.length} invalid
                </p>
              </div>

              <button
                type="button"
                onClick={
                  commitImport
                }
                disabled={
                  !validRows.length ||
                  importing
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {importing ? (
                  <Loader2
                    size={
                      16
                    }
                    className="animate-spin"
                  />
                ) : (
                  <UploadCloud
                    size={
                      16
                    }
                  />
                )}

                {importing
                  ? "Importing..."
                  : `Import ${validRows.length} Valid`}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                style={{
                  minWidth:
                    config.previewTableMinWidth ||
                    760,
                }}
              >
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">
                      Row
                    </th>

                    <th className="px-4 py-3">
                      Status
                    </th>

                    {previewColumns.map(
                      (
                        column,
                        index
                      ) => (
                        <th
                          key={
                            column.key ||
                            column.label ||
                            index
                          }
                          className="px-4 py-3"
                        >
                          {
                            column.label ||
                            column.key ||
                            "Field"
                          }
                        </th>
                      )
                    )}

                    <th className="px-4 py-3">
                      Issues
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {validationRows.map(
                    (
                      row,
                      index
                    ) => (
                      <tr
                        key={`${row.row_number || index}-${index}`}
                        className="border-t border-slate-100 align-top dark:border-slate-800"
                      >
                        <td className="px-4 py-4">
                          {row.row_number ||
                            index +
                              2}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold capitalize ${statusTone(
                              row.status
                            )}`}
                          >
                            {row.status ||
                              "unknown"}
                          </span>
                        </td>

                        {previewColumns.map(
                          (
                            column,
                            columnIndex
                          ) => {
                            const source =
                              row.record ||
                              row;

                            const value =
                              typeof column.value ===
                              "function"
                                ? column.value(
                                    row
                                  )
                                : source[
                                    column.key
                                  ];

                            const key =
                              column.key ||
                              column.label ||
                              columnIndex;

                            if (
                              value &&
                              typeof value ===
                                "object" &&
                              !Array.isArray(
                                value
                              )
                            ) {
                              return (
                                <td
                                  key={
                                    key
                                  }
                                  className="px-4 py-4"
                                >
                                  <p
                                    className={`font-medium ${
                                      value.tone ===
                                      "danger"
                                        ? "text-red-600 dark:text-red-400"
                                        : value.tone ===
                                            "warning"
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-slate-800 dark:text-slate-200"
                                    }`}
                                  >
                                    {value.primary ||
                                      "—"}
                                  </p>

                                  {value.secondary && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      {
                                        value.secondary
                                      }
                                    </p>
                                  )}
                                </td>
                              );
                            }

                            return (
                              <td
                                key={
                                  key
                                }
                                className="px-4 py-4"
                              >
                                {value ??
                                  "—"}
                              </td>
                            );
                          }
                        )}

                        <td className="px-4 py-4">
                          {safeArray(
                            row.errors
                          ).map(
                            (
                              item,
                              errorIndex
                            ) => (
                              <p
                                key={`${item}-${errorIndex}`}
                                className="mb-1 text-xs text-red-600 dark:text-red-400"
                              >
                                {
                                  item
                                }
                              </p>
                            )
                          )}

                          {safeArray(
                            row.warnings
                          ).map(
                            (
                              item,
                              warningIndex
                            ) => (
                              <p
                                key={`${item}-${warningIndex}`}
                                className="mb-1 text-xs text-amber-600 dark:text-amber-400"
                              >
                                {
                                  item
                                }
                              </p>
                            )
                          )}

                          {!safeArray(
                            row.errors
                          ).length &&
                            !safeArray(
                              row.warnings
                            ).length && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                Ready
                              </span>
                            )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ==================================================
            RESULTS
        ================================================== */}

        {hasImported && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Import Results
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Save these credentials before closing if
                  temporary passwords were generated.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  downloadResults
                }
                disabled={
                  !resultColumns.length
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
              >
                <Download
                  size={
                    16
                  }
                />

                Download Results
              </button>
            </div>

            {resultColumns.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                    <tr>
                      {resultColumns.map(
                        (
                          column,
                          index
                        ) => (
                          <th
                            key={
                              column.key ||
                              column.label ||
                              index
                            }
                            className="px-4 py-3"
                            style={{
                              width:
                                column.width
                                  ? `${column.width}ch`
                                  : undefined,
                            }}
                          >
                            {
                              column.label ||
                              column.key ||
                              "Field"
                            }
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {importResults.map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={`${row.row_number || index}-${index}`}
                          className="border-t border-slate-100 dark:border-slate-800"
                        >
                          {resultColumns.map(
                            (
                              column,
                              columnIndex
                            ) => {
                              const value =
                                typeof column.value ===
                                "function"
                                  ? column.value(
                                      row
                                    )
                                  : row[
                                      column.key
                                    ];

                              return (
                                <td
                                  key={
                                    column.key ||
                                    column.label ||
                                    columnIndex
                                  }
                                  className="px-4 py-4"
                                >
                                  {value ??
                                    "—"}
                                </td>
                              );
                            }
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-500">
                Import completed. No result-column
                configuration was provided.
              </div>
            )}
          </section>
        )}

        {/* ==================================================
            PROFILE IMAGES
        ================================================== */}

        <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Profile Images
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {config.imageDescription ||
              "Upload profile images using the user's 13-digit CNIC as the filename."}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Example:{" "}
            {config.filenameExample ||
              "3520212345671.jpg"}{" "}
            · Maximum 3 MB per image.
          </p>

          <input
            ref={
              imageInputRef
            }
            type="file"
            accept={
              IMAGE_ACCEPT
            }
            multiple
            onChange={
              handleImages
            }
            className="hidden"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() =>
                imageInputRef.current?.click()
              }
              disabled={
                !definitionReady ||
                uploadingImages
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
            >
              <ImagePlus
                size={
                  16
                }
              />

              Select Images
            </button>

            <button
              type="button"
              onClick={
                uploadImages
              }
              disabled={
                !definitionReady ||
                !selectedImages.length ||
                uploadingImages
              }
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {uploadingImages ? (
                <Loader2
                  size={
                    16
                  }
                  className="animate-spin"
                />
              ) : (
                <UploadCloud
                  size={
                    16
                  }
                />
              )}

              {uploadingImages
                ? "Uploading..."
                : selectedImages.length
                  ? `Upload ${selectedImages.length} Image${
                      selectedImages.length === 1
                        ? ""
                        : "s"
                    }`
                  : "Upload Images"}
            </button>
          </div>

          {selectedImages.length >
          0 ? (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              {
                selectedImages.length
              }{" "}
              image
              {selectedImages.length ===
              1
                ? ""
                : "s"}{" "}
              selected.
            </div>
          ) : null}
        </section>

        {/* ==================================================
            CLOSE
        ================================================== */}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={
              close
            }
            disabled={
              busy
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            <X
              size={
                15
              }
            />

            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}