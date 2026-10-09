const { supabaseAdmin } = require("../config/supabase");

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check Authorization header
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    // Get token
    const token = authHeader.split(" ")[1];

    // Verify token with Supabase
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
    }

    // Check admin profile
    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admins")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("ADMIN CHECK ERROR:", adminError);

      return res.status(500).json({
        success: false,
        message: "Failed to verify admin",
      });
    }

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin account required",
      });
    }

    // Attach authenticated user and admin profile
    req.user = user;
    req.admin = admin;

    next();

  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = authenticateAdmin;