const express =
  require(
    "express"
  );

const {
  signup,
  login,
  userLogin,
} = require(
  "../controllers/auth.controller"
);

const {
  refreshAdminSession,
} = require(
  "../controllers/session.controller"
);

const router =
  express.Router();

// ======================================================
// ADMIN AUTH
// ======================================================

router.post(
  "/signup",
  signup
);

router.post(
  "/login",
  login
);

// ======================================================
// ADMIN SESSION REFRESH
// ======================================================

router.post(
  "/refresh",
  refreshAdminSession
);

// ======================================================
// STUDENT + TEACHER LOGIN
// ======================================================

router.post(
  "/user-login",
  userLogin
);

module.exports =
  router;
