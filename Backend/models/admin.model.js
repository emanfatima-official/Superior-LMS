const { supabaseAdmin } = require("../config/supabase");

const createAdmin = async ({ id, full_name, email }) => {
  const adminData = {
    id,
    full_name,
    email,
    role: "admin",
  };

  const { data, error } = await supabaseAdmin
    .from("admins")
    .insert([adminData])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const findAdminByEmail = async (email) => {
  const { data, error } = await supabaseAdmin
    .from("admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

module.exports = {
  createAdmin,
  findAdminByEmail,
};