const nodemailer =
  require(
    "nodemailer"
  );

// ======================================================
// ENV HELPERS
// ======================================================

const env =
  (
    key,
    fallback = ""
  ) =>
    String(
      process.env[
        key
      ] ??
        fallback
    ).trim();

const isTruthy =
  (
    value
  ) =>
    [
      "1",
      "true",
      "yes",
      "on",
    ].includes(
      String(
        value ?? ""
      )
        .trim()
        .toLowerCase()
    );

// ======================================================
// SMTP CONFIG
// ======================================================

const getTransporter =
  () => {
    const host =
      env(
        "SMTP_HOST"
      );

    const port =
      Number(
        env(
          "SMTP_PORT",
          "587"
        )
      );

    const user =
      env(
        "SMTP_USER"
      );

    const pass =
      env(
        "SMTP_PASS"
      );

    if (
      !host ||
      !user ||
      !pass
    ) {
      return null;
    }

    return nodemailer.createTransport(
      {
        host,

        port,

        secure:
          isTruthy(
            env(
              "SMTP_SECURE",
              port ===
                465
                ? "true"
                : "false"
            )
          ),

        auth: {
          user,
          pass,
        },
      }
    );
  };

// ======================================================
// SEND CREDENTIALS
// ======================================================

const sendCredentialsEmail =
  async ({
    to,
    fullName,
    role,
    password,
    studentId = null,
    username = null,
    mustChangePassword = true,
  }) => {
    const normalizedTo =
      String(
        to || ""
      ).trim();

    if (
      !normalizedTo
    ) {
      return {
        sent:
          false,

        reason:
          "Email address was not provided.",
      };
    }

    const transporter =
      getTransporter();

    if (!transporter) {
      return {
        sent:
          false,

        reason:
          "SMTP is not configured.",
      };
    }

    const appName =
      env(
        "APP_NAME",
        "CampusZ LMS"
      );

    const fromName =
      env(
        "SMTP_FROM_NAME",
        appName
      );

    const fromEmail =
      env(
        "SMTP_FROM_EMAIL",
        env(
          "SMTP_USER"
        )
      );

    const safeRole =
      String(
        role ||
          "user"
      );

    const roleLabel =
      safeRole
        .charAt(0)
        .toUpperCase() +
      safeRole.slice(
        1
      );

    const loginUsername =
      String(
        username ||
          ""
      ).trim();

    const subject =
      `${appName} ${roleLabel} Account Credentials`;

    const text = [
      `Hello ${
        fullName ||
        roleLabel
      },`,
      "",
      `Your ${appName} ${safeRole} account has been created.`,
      "",
      loginUsername
        ? `Username (CNIC/B-Form): ${loginUsername}`
        : null,
      studentId
        ? `Student ID: ${studentId}`
        : null,
      `Temporary Password: ${password}`,
      "",
      mustChangePassword
        ? "You will be required to change this password after login."
        : null,
      "",
      "Please keep these credentials secure.",
    ]
      .filter(
        Boolean
      )
      .join(
        "\n"
      );

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b;">
        <h2 style="margin-bottom:8px;">${appName}</h2>

        <p>Hello <strong>${
          fullName ||
          roleLabel
        }</strong>,</p>

        <p>
          Your ${roleLabel} account has been created successfully.
        </p>

        <div style="
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:12px;
          padding:16px;
          margin:18px 0;
        ">
          ${
            loginUsername
              ? `
                <p style="margin:0 0 10px;">
                  <strong>Username (CNIC/B-Form):</strong>
                  ${loginUsername}
                </p>
              `
              : ""
          }

          ${
            studentId
              ? `
                <p style="margin:0 0 10px;">
                  <strong>Student ID:</strong>
                  ${studentId}
                </p>
              `
              : ""
          }

          <p style="margin:0;">
            <strong>Temporary Password:</strong>
            ${password}
          </p>
        </div>

        ${
          mustChangePassword
            ? `
              <p>
                You will be required to change the temporary password
                after login.
              </p>
            `
            : ""
        }

        <p>
          Please keep your login credentials secure.
        </p>
      </div>
    `;

    const info =
      await transporter.sendMail(
        {
          from:
            `"${fromName}" <${fromEmail}>`,

          to:
            normalizedTo,

          subject,

          text,

          html,
        }
      );

    return {
      sent:
        true,

      message_id:
        info.messageId ||
        null,
    };
  };

module.exports = {
  sendCredentialsEmail,
};