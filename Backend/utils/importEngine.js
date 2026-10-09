const crypto = require("crypto");
const path = require("path");

const { supabaseAdmin } = require("../config/supabase");

const DEFAULT_MAX_VALIDATION_ROWS = 2000;
const DEFAULT_MAX_COMMIT_ROWS = 2000;
const DEFAULT_DATABASE_PAGE_SIZE = 1000;
const DEFAULT_CONCURRENCY = 4;

// ======================================================
// NORMALIZATION HELPERS
// ======================================================

const text = (value) =>
  String(value ?? "").trim();

const comparable = (value) =>
  text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeEmail = (value) =>
  text(value).toLowerCase();

const normalizeCnic = (value) =>
  text(value).replace(/\D/g, "");

const formatCnic = (value) => {
  const digits =
    normalizeCnic(value);

  return digits.length === 13
    ? `${digits.slice(0, 5)}-${digits.slice(
        5,
        12
      )}-${digits.slice(12)}`
    : text(value);
};

const integer = (value) => {
  if (
    value === "" ||
    value == null
  ) {
    return null;
  }

  const parsed =
    Number.parseInt(
      String(value),
      10
    );

  return Number.isFinite(parsed)
    ? parsed
    : null;
};

const booleanValue = (
  value,
  defaultValue = true
) => {
  if (
    value === "" ||
    value == null
  ) {
    return {
      value:
        Boolean(defaultValue),
      valid: true,
    };
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return {
      value,
      valid: true,
    };
  }

  const normalized =
    text(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "y",
      "active",
    ].includes(normalized)
  ) {
    return {
      value: true,
      valid: true,
    };
  }

  if (
    [
      "false",
      "0",
      "no",
      "n",
      "inactive",
    ].includes(normalized)
  ) {
    return {
      value: false,
      valid: true,
    };
  }

  return {
    value:
      Boolean(defaultValue),
    valid: false,
  };
};

// ======================================================
// IMPORT ERRORS AND LIMITS
// ======================================================

const createImportError = (
  message,
  status = 400
) => {
  const error =
    new Error(message);

  error.status = status;

  return error;
};

const ensureRowCount = (
  rows,
  maximum,
  pluralLabel = "records"
) => {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    throw createImportError(
      `The import file does not contain any ${pluralLabel.toLowerCase()} rows.`
    );
  }

  if (
    rows.length > maximum
  ) {
    throw createImportError(
      `A single request can contain no more than ${maximum} ${pluralLabel.toLowerCase()} rows.`
    );
  }
};

// ======================================================
// PAGINATED DATABASE LOADER
// ======================================================

const fetchAllRows = async (
  table,
  select,
  configure = (query) =>
    query,
  pageSize =
    DEFAULT_DATABASE_PAGE_SIZE,
  orderColumn = "id"
) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query =
      supabaseAdmin
        .from(table)
        .select(select)
        .range(
          from,
          from +
            pageSize -
            1
        );

    query =
      configure(query);

    if (orderColumn) {
      query =
        query.order(
          orderColumn,
          {
            ascending: true,
          }
        );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      throw error;
    }

    const page =
      data || [];

    rows.push(...page);

    if (
      page.length <
      pageSize
    ) {
      break;
    }

    from += pageSize;
  }

  return rows;
};

// ======================================================
// LOAD SUPABASE AUTH EMAILS
// ======================================================

const loadAuthEmailSet =
  async (
    warningPrefix = "IMPORT"
  ) => {
    const emails =
      new Set();

    const perPage = 1000;
    let page = 1;

    while (true) {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .auth.admin
          .listUsers({
            page,
            perPage,
          });

      if (error) {
        /*
         * Profile validation can still continue.
         * Any orphan Auth duplicate will be checked
         * again by createUser during import.
         */
        console.warn(
          `${warningPrefix} AUTH LIST WARNING:`,
          error.message
        );

        return emails;
      }

      const users =
        data?.users || [];

      users.forEach(
        (user) => {
          const email =
            normalizeEmail(
              user.email
            );

          if (email) {
            emails.add(email);
          }
        }
      );

      if (
        users.length <
        perPage
      ) {
        break;
      }

      page += 1;
    }

    return emails;
  };

// ======================================================
// MAP HELPERS
// ======================================================

const pushMapValue = (
  map,
  key,
  value
) => {
  if (!key) {
    return;
  }

  const current =
    map.get(key) || [];

  current.push(value);

  map.set(
    key,
    current
  );
};

const duplicateCounts = (
  rows,
  keyOf
) => {
  const counts =
    new Map();

  rows.forEach((row) => {
    const key =
      keyOf(row);

    if (!key) {
      return;
    }

    counts.set(
      key,
      (
        counts.get(key) ||
        0
      ) + 1
    );
  });

  return counts;
};

// ======================================================
// CONTROLLED CONCURRENCY
// ======================================================

const mapWithConcurrency =
  async (
    items,
    concurrency =
      DEFAULT_CONCURRENCY,
    worker
  ) => {
    const results =
      new Array(
        items.length
      );

    let cursor = 0;

    const runner =
      async () => {
        while (true) {
          const index =
            cursor;

          cursor += 1;

          if (
            index >=
            items.length
          ) {
            return;
          }

          results[index] =
            await worker(
              items[index],
              index
            );
        }
      };

    await Promise.all(
      Array.from(
        {
          length:
            Math.min(
              concurrency,
              Math.max(
                items.length,
                1
              )
            ),
        },

        () => runner()
      )
    );

    return results;
  };

// ======================================================
// TEMPORARY PASSWORD
// ======================================================

const generateTemporaryPassword =
  () => {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    const random =
      crypto.randomBytes(10);

    let middle = "";

    for (
      let index = 0;
      index < random.length;
      index += 1
    ) {
      middle +=
        alphabet[
          random[index] %
            alphabet.length
        ];
    }

    return `Cz!${middle}7`;
  };

// ======================================================
// HELPERS AVAILABLE TO IMPORT DEFINITIONS
// ======================================================

const engineHelpers = {
  supabaseAdmin,
  text,
  comparable,
  normalizeEmail,
  normalizeCnic,
  formatCnic,
  integer,
  booleanValue,
  createImportError,
  ensureRowCount,
  fetchAllRows,
  loadAuthEmailSet,
  pushMapValue,
  duplicateCounts,
  mapWithConcurrency,
  generateTemporaryPassword,
};

const requiredFunction = (
  definition,
  name
) => {
  if (
    typeof definition?.[
      name
    ] !== "function"
  ) {
    throw new Error(
      `Import definition requires a ${name} function.`
    );
  }
};

// ======================================================
// GENERIC ROW IMPORT ENGINE
// ======================================================

const createImportEngine = (
  definition
) => {
  requiredFunction(
    definition,
    "normalizeRow"
  );

  requiredFunction(
    definition,
    "loadContext"
  );

  requiredFunction(
    definition,
    "validateRow"
  );

  requiredFunction(
    definition,
    "toPublicRow"
  );

  requiredFunction(
    definition,
    "toInvalidResult"
  );

  requiredFunction(
    definition,
    "createRow"
  );

  const singularLabel =
    definition
      .singularLabel ||
    "Record";

  const pluralLabel =
    definition
      .pluralLabel ||
    "Records";

  const maxValidationRows =
    definition
      .maxValidationRows ||
    DEFAULT_MAX_VALIDATION_ROWS;

  const maxCommitRows =
    definition
      .maxCommitRows ||
    DEFAULT_MAX_COMMIT_ROWS;

  const concurrency =
    definition.concurrency ||
    DEFAULT_CONCURRENCY;

  const uniqueFields =
    definition.uniqueFields ||
    [];

  // ====================================================
  // VALIDATE ROWS
  // ====================================================

  const validateRows =
    async (
      inputRows,
      {
        checkExternal = true,
        maximum =
          maxValidationRows,
      } = {}
    ) => {
      ensureRowCount(
        inputRows,
        maximum,
        pluralLabel
      );

      const normalizedRows =
        inputRows.map(
          (
            row,
            index
          ) =>
            definition.normalizeRow(
              row || {},
              index,
              engineHelpers
            )
        );

      const context =
        await definition
          .loadContext({
            checkExternal,
            helpers:
              engineHelpers,
          });

      const existingRows =
        definition
          .existingRows
          ? definition.existingRows(
              context
            ) || []
          : context
              ?.existingRows ||
            [];

      const fileIndexes =
        new Map();

      const existingIndexes =
        new Map();

      uniqueFields.forEach(
        (field) => {
          fileIndexes.set(
            field.name,

            duplicateCounts(
              normalizedRows,
              field.rowKey
            )
          );

          const index =
            new Map();

          existingRows.forEach(
            (row) => {
              pushMapValue(
                index,
                field.existingKey(
                  row
                ),
                row
              );
            }
          );

          existingIndexes.set(
            field.name,
            index
          );
        }
      );

      const checkedRows =
        normalizedRows.map(
          (row) => {
            const errors = [];
            const warnings = [];

            uniqueFields.forEach(
              (field) => {
                const key =
                  field.rowKey(
                    row
                  );

                if (!key) {
                  return;
                }

                const fileCount =
                  fileIndexes
                    .get(
                      field.name
                    )
                    ?.get(
                      key
                    ) || 0;

                if (
                  fileCount > 1
                ) {
                  errors.push(
                    typeof field
                      .fileDuplicateMessage ===
                      "function"
                      ? field.fileDuplicateMessage(
                          row
                        )
                      : field.fileDuplicateMessage ||
                          `${field.label || field.name} is repeated inside the import file.`
                  );
                }

                const matches =
                  existingIndexes
                    .get(
                      field.name
                    )
                    ?.get(
                      key
                    ) || [];

                if (
                  matches.length
                ) {
                  errors.push(
                    typeof field
                      .existingMessage ===
                      "function"
                      ? field.existingMessage(
                          matches[0],
                          row
                        )
                      : field.existingMessage ||
                          `${field.label || field.name} already exists.`
                  );
                }
              }
            );

            const resolved =
              definition
                .validateRow(
                  row,
                  {
                    context,
                    errors,
                    warnings,
                    helpers:
                      engineHelpers,
                  }
                );

            return {
              ...row,

              resolved:
                resolved ??
                null,

              errors: [
                ...new Set(
                  errors.filter(
                    Boolean
                  )
                ),
              ],

              warnings: [
                ...new Set(
                  warnings.filter(
                    Boolean
                  )
                ),
              ],
            };
          }
        );

      const validRows =
        checkedRows.filter(
          (row) =>
            row.errors
              .length === 0
        );

      const invalidRows =
        checkedRows.filter(
          (row) =>
            row.errors
              .length > 0
        );

      return {
        summary: {
          total:
            checkedRows.length,

          valid:
            validRows.length,

          invalid:
            invalidRows.length,

          with_warnings:
            checkedRows.filter(
              (row) =>
                row.warnings
                  .length
            ).length,
        },

        rows:
          checkedRows.map(
            (row) =>
              definition
                .toPublicRow(
                  row,
                  {
                    context,
                    singularLabel,
                    helpers:
                      engineHelpers,
                  }
                )
          ),

        validRows,
        invalidRows,
        context,
      };
    };

  // ====================================================
  // IMPORT VALID ROWS
  // ====================================================

  const importRows =
    async (
      inputRows,
      actorId
    ) => {
      ensureRowCount(
        inputRows,
        maxCommitRows,
        pluralLabel
      );

      /*
       * Always validate each import batch again.
       * This catches records created after initial
       * spreadsheet validation.
       */
      const validation =
        await validateRows(
          inputRows,
          {
            checkExternal:
              false,

            maximum:
              maxCommitRows,
          }
        );

      const invalidResults =
        validation.invalidRows.map(
          (row) =>
            definition
              .toInvalidResult(
                row,
                row.errors.join(
                  " "
                ),
                engineHelpers
              )
        );

      const importedResults =
        await mapWithConcurrency(
          validation.validRows,
          concurrency,

          (row) =>
            definition
              .createRow(
                row,
                {
                  actorId,

                  context:
                    validation
                      .context,

                  helpers:
                    engineHelpers,
                }
              )
        );

      const results = [
        ...invalidResults,
        ...importedResults,
      ].sort(
        (
          first,
          second
        ) =>
          Number(
            first.row_number
          ) -
          Number(
            second.row_number
          )
      );

      const imported =
        results.filter(
          (row) =>
            row.success
        ).length;

      return {
        summary: {
          total:
            results.length,

          imported,

          failed:
            results.length -
            imported,
        },

        results,
      };
    };

  return {
    key:
      definition.key,

    singularLabel,
    pluralLabel,
    maxValidationRows,
    maxCommitRows,
    validateRows,
    importRows,
  };
};

// ======================================================
// GENERIC SUPABASE AUTH + PROFILE CREATION
// ======================================================

const createProfileAccount =
  async ({
    row,
    actorId,
    role,
    authMetadata = {},
    buildProfile,
    afterProfileCreated,
    rollbackCreatedData,
    successResult,
    failureResult,
  }) => {
    let authUserId = null;

    let profileSaved =
      false;

    const password =
      row.password ||
      generateTemporaryPassword();

    try {
      // ================================================
      // CREATE AUTH USER
      // ================================================

      const {
        data: authData,
        error: authError,
      } =
        await supabaseAdmin
          .auth.admin
          .createUser({
            email:
              row.email,

            password,

            email_confirm:
              true,

            user_metadata: {
              role,

              full_name:
                row.full_name,

              ...authMetadata,
            },
          });

      if (authError) {
        throw authError;
      }

      authUserId =
        authData?.user?.id;

      if (!authUserId) {
        throw new Error(
          "Authentication account was not created."
        );
      }

      // ================================================
      // PREPARE PROFILE
      // ================================================

      const prepared =
        await buildProfile({
          row,
          actorId,
          authUserId,
          password,
          helpers:
            engineHelpers,
        });

      if (
        !prepared?.profile
      ) {
        throw new Error(
          "Import definition did not return profile data."
        );
      }

      // ================================================
      // CREATE OR COMPLETE PROFILE
      // ================================================

      const {
        error:
          profileError,
      } =
        await supabaseAdmin
          .from(
            "profiles"
          )
          .upsert(
            prepared.profile,
            {
              onConflict:
                "id",

              ignoreDuplicates:
                false,
            }
          );

      if (
        profileError
      ) {
        throw profileError;
      }

      profileSaved =
        true;

      // ================================================
      // OPTIONAL ENTITY-SPECIFIC DATA
      // ================================================

      const afterData =
        afterProfileCreated
          ? await afterProfileCreated(
              {
                row,
                actorId,
                authUserId,
                password,
                prepared,
                helpers:
                  engineHelpers,
              }
            )
          : null;

      return successResult({
        row,
        actorId,
        authUserId,
        password,
        prepared,
        afterData,
        helpers:
          engineHelpers,
      });
    } catch (error) {
      // ================================================
      // ROLLBACK ENTITY-SPECIFIC DATA
      // ================================================

      if (
        authUserId &&
        rollbackCreatedData
      ) {
        try {
          await rollbackCreatedData(
            {
              row,
              actorId,
              authUserId,
              helpers:
                engineHelpers,
            }
          );
        } catch (
          rollbackError
        ) {
          console.error(
            `${String(
              role
            ).toUpperCase()} IMPORT DATA ROLLBACK ERROR:`,

            rollbackError
              ?.message ||
              rollbackError
          );
        }
      }

      // ================================================
      // ROLLBACK PROFILE
      // ================================================

      if (
        profileSaved &&
        authUserId
      ) {
        try {
          const {
            error:
              profileRollbackError,
          } =
            await supabaseAdmin
              .from(
                "profiles"
              )
              .delete()
              .eq(
                "id",
                authUserId
              );

          if (
            profileRollbackError
          ) {
            throw profileRollbackError;
          }
        } catch (
          rollbackError
        ) {
          console.error(
            `${String(
              role
            ).toUpperCase()} IMPORT PROFILE ROLLBACK ERROR:`,

            rollbackError
              ?.message ||
              rollbackError
          );
        }
      }

      // ================================================
      // ROLLBACK AUTH USER
      // ================================================

      if (authUserId) {
        try {
          const {
            error:
              authRollbackError,
          } =
            await supabaseAdmin
              .auth.admin
              .deleteUser(
                authUserId
              );

          if (
            authRollbackError
          ) {
            throw authRollbackError;
          }
        } catch (
          rollbackError
        ) {
          console.error(
            `${String(
              role
            ).toUpperCase()} IMPORT AUTH ROLLBACK ERROR:`,

            rollbackError
              ?.message ||
              rollbackError
          );
        }
      }

      return failureResult({
        row,
        error,
        helpers:
          engineHelpers,
      });
    }
  };

// ======================================================
// VERIFY REAL IMAGE CONTENT
// ======================================================

const detectImageType = (
  buffer
) => {
  if (
    !Buffer.isBuffer(
      buffer
    ) ||
    buffer.length < 12
  ) {
    return null;
  }

  // JPEG
  if (
    buffer[0] ===
      0xff &&
    buffer[1] ===
      0xd8 &&
    buffer[2] ===
      0xff
  ) {
    return {
      extension: "jpg",
      contentType:
        "image/jpeg",
    };
  }

  // PNG
  if (
    buffer
      .subarray(0, 8)
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ])
      )
  ) {
    return {
      extension: "png",
      contentType:
        "image/png",
    };
  }

  // WEBP
  if (
    buffer
      .subarray(0, 4)
      .toString(
        "ascii"
      ) === "RIFF" &&
    buffer
      .subarray(8, 12)
      .toString(
        "ascii"
      ) === "WEBP"
  ) {
    return {
      extension: "webp",
      contentType:
        "image/webp",
    };
  }

  return null;
};

// ======================================================
// DEFAULT CNIC FILENAME READER
// ======================================================

const defaultImageIdentityFromName =
  (filename) => {
    const base =
      path.basename(
        text(filename),

        path.extname(
          text(filename)
        )
      );

    const compact =
      base.replace(
        /[\s-]/g,
        ""
      );

    return /^\d{13}$/.test(
      compact
    )
      ? compact
      : null;
  };

// ======================================================
// GENERIC PROFILE IMAGE IMPORTER
// ======================================================

const createProfileImageImporter =
  ({
    role,
    singularLabel,
    pluralLabel,

    identityLabel =
      "identifier",

    matchColumn =
      "cnic",

    normalizeIdentity =
      normalizeCnic,

    formatIdentity =
      formatCnic,

    identityFromFilename =
      defaultImageIdentityFromName,

    storageBucket =
      "campusz-files",

    storageFolder,

    concurrency =
      DEFAULT_CONCURRENCY,
  }) => {
    const entity =
      singularLabel
        .toLowerCase();

    const entities =
      pluralLabel
        .toLowerCase();

    if (
      !role ||
      !singularLabel ||
      !pluralLabel ||
      !storageFolder
    ) {
      throw new Error(
        "Profile image importer requires role, labels and storageFolder."
      );
    }

    const resultRow =
      ({
        success,
        file,
        identity,
        profile = null,
        avatarUrl = null,
        message,
      }) => ({
        success,

        file_name:
          file
            ?.originalname ||
          "",

        identifier:
          identity
            ? formatIdentity(
                identity
              )
            : null,

        profile_id:
          profile?.id ||
          null,

        profile_name:
          profile
            ?.full_name ||
          null,

        avatar_url:
          avatarUrl,

        message,
      });

    // ==================================================
    // UPLOAD ONE MATCHED IMAGE
    // ==================================================

    const uploadOne =
      async ({
        file,
        identity,
        profile,
      }) => {
        const detected =
          detectImageType(
            file.buffer
          );

        if (!detected) {
          return resultRow({
            success: false,
            file,
            identity,
            profile,

            message:
              "File content is not a valid JPG, PNG or WEBP image.",
          });
        }

        const filePath =
          `${storageFolder}/${profile.id}.${detected.extension}`;

        const {
          error:
            uploadError,
        } =
          await supabaseAdmin
            .storage
            .from(
              storageBucket
            )
            .upload(
              filePath,
              file.buffer,
              {
                contentType:
                  detected.contentType,

                cacheControl:
                  "3600",

                upsert:
                  true,
              }
            );

        if (uploadError) {
          return resultRow({
            success: false,
            file,
            identity,
            profile,

            message:
              uploadError.message,
          });
        }

        const {
          data:
            publicData,
        } =
          supabaseAdmin
            .storage
            .from(
              storageBucket
            )
            .getPublicUrl(
              filePath
            );

        const baseUrl =
          publicData
            ?.publicUrl;

        if (!baseUrl) {
          return resultRow({
            success: false,
            file,
            identity,
            profile,

            message:
              "Uploaded image URL could not be generated.",
          });
        }

        const avatarUrl =
          `${baseUrl}${
            baseUrl.includes(
              "?"
            )
              ? "&"
              : "?"
          }v=${Date.now()}`;

        const {
          error:
            profileError,
        } =
          await supabaseAdmin
            .from(
              "profiles"
            )
            .update({
              avatar_url:
                avatarUrl,

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              profile.id
            )
            .eq(
              "role",
              role
            );

        if (
          profileError
        ) {
          return resultRow({
            success: false,
            file,
            identity,
            profile,

            message:
              profileError
                .message,
          });
        }

        return resultRow({
          success: true,
          file,
          identity,
          profile,
          avatarUrl,

          message:
            "Profile image matched and uploaded.",
        });
      };

    // ==================================================
    // IMPORT IMAGE BATCH
    // ==================================================

    return async (
      files = []
    ) => {
      if (
        !Array.isArray(
          files
        ) ||
        files.length === 0
      ) {
        throw createImportError(
          `Select at least one ${entity} profile image.`
        );
      }

      const profiles =
        await fetchAllRows(
          "profiles",

          `id,full_name,${matchColumn},avatar_url`,

          (query) =>
            query
              .eq(
                "role",
                role
              )
              .not(
                matchColumn,
                "is",
                null
              )
        );

      const profileIndex =
        new Map();

      profiles.forEach(
        (profile) => {
          pushMapValue(
            profileIndex,

            normalizeIdentity(
              profile[
                matchColumn
              ]
            ),

            profile
          );
        }
      );

      const fileRows =
        files.map(
          (file) => ({
            file,

            identity:
              identityFromFilename(
                file.originalname
              ),
          })
        );

      const fileCounts =
        duplicateCounts(
          fileRows,

          (row) =>
            row.identity
        );

      const immediateResults =
        [];

      const uploadable =
        [];

      fileRows.forEach(
        ({
          file,
          identity,
        }) => {
          if (!identity) {
            immediateResults.push(
              resultRow({
                success:
                  false,

                file,

                identity:
                  null,

                message:
                  `Filename must be a valid ${identityLabel}.`,
              })
            );

            return;
          }

          if (
            (
              fileCounts.get(
                identity
              ) || 0
            ) > 1
          ) {
            immediateResults.push(
              resultRow({
                success:
                  false,

                file,
                identity,

                message:
                  `More than one selected image uses this ${identityLabel}.`,
              })
            );

            return;
          }

          const matches =
            profileIndex.get(
              identity
            ) || [];

          if (
            matches.length ===
            0
          ) {
            immediateResults.push(
              resultRow({
                success:
                  false,

                file,
                identity,

                message:
                  `No ${entity} profile matches this ${identityLabel}.`,
              })
            );

            return;
          }

          if (
            matches.length >
            1
          ) {
            immediateResults.push(
              resultRow({
                success:
                  false,

                file,
                identity,

                message:
                  `Multiple ${entity} profiles use this ${identityLabel}. Correct the duplicate profiles first.`,
              })
            );

            return;
          }

          uploadable.push({
            file,
            identity,

            profile:
              matches[0],
          });
        }
      );

      const uploadedResults =
        await mapWithConcurrency(
          uploadable,
          concurrency,
          uploadOne
        );

      const results = [
        ...immediateResults,
        ...uploadedResults,
      ];

      const uploaded =
        results.filter(
          (row) =>
            row.success
        ).length;

      return {
        summary: {
          total:
            results.length,

          uploaded,

          failed:
            results.length -
            uploaded,
        },

        results,
        entity: entities,
      };
    };
  };

module.exports = {
  DEFAULT_MAX_VALIDATION_ROWS,
  DEFAULT_MAX_COMMIT_ROWS,
  DEFAULT_CONCURRENCY,

  text,
  comparable,
  normalizeEmail,
  normalizeCnic,
  formatCnic,
  integer,
  booleanValue,

  createImportError,
  ensureRowCount,
  fetchAllRows,
  loadAuthEmailSet,
  pushMapValue,
  duplicateCounts,
  mapWithConcurrency,
  generateTemporaryPassword,

  createImportEngine,
  createProfileAccount,
  createProfileImageImporter,
};