const AUTH_USERNAME_DOMAIN = String(
  process.env.AUTH_USERNAME_DOMAIN ||
    "auth.campusz.app"
)
  .trim()
  .toLowerCase();

// ======================================================
// NORMALIZE CNIC
// ======================================================

const normalizeCnic = (
  value
) =>
  String(
    value ?? ""
  ).replace(
    /\D/g,
    ""
  );

// ======================================================
// VALIDATE CNIC
// ======================================================

const isValidCnic = (
  value
) =>
  normalizeCnic(
    value
  ).length === 13;

// ======================================================
// FORMAT CNIC
// ======================================================

const formatCnic = (
  value
) => {
  const digits =
    normalizeCnic(
      value
    );

  if (
    digits.length !== 13
  ) {
    return String(
      value ?? ""
    ).trim();
  }

  return `${digits.slice(
    0,
    5
  )}-${digits.slice(
    5,
    12
  )}-${digits.slice(
    12
  )}`;
};

// ======================================================
// INTERNAL SUPABASE AUTH EMAIL
// ======================================================

const authEmailFromCnic = (
  value
) => {
  const digits =
    normalizeCnic(
      value
    );

  if (
    digits.length !== 13
  ) {
    return null;
  }

  return `cnic.${digits}@${AUTH_USERNAME_DOMAIN}`;
};

module.exports = {
  AUTH_USERNAME_DOMAIN,
  normalizeCnic,
  isValidCnic,
  formatCnic,
  authEmailFromCnic,
};