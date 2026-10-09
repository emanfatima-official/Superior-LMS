const { supabaseAdmin } = require("../config/supabase");

const getActivityLogs = async ({
  limit = 100,
  module = null,
  action = null,
  search = null,
  from = null,
  to = null,
} = {}) => {
  let query = supabaseAdmin
    .from("activity_logs")
    .select(`
      id,
      actor_id,
      actor_role,
      action,
      module,
      target_type,
      target_id,
      target_label,
      old_values,
      new_values,
      ip_address,
      user_agent,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    })
    .limit(Math.min(Number(limit) || 100, 500));

  if (module) {
    query = query.eq("module", module);
  }

  if (action) {
    query = query.eq("action", action);
  }

  if (from) {
    query = query.gte("created_at", from);
  }

  if (to) {
    query = query.lte("created_at", to);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let logs = data || [];

  // Search is intentionally done after fetching the bounded result.
  // This keeps the API simple and works well for the admin activity feed.
  if (search?.trim()) {
    const value = search.trim().toLowerCase();

    logs = logs.filter((log) =>
      [
        log.action,
        log.module,
        log.target_type,
        log.target_label,
        log.actor_role,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(value)
        )
    );
  }

  // Resolve admin names without requiring an FK relationship.
  const actorIds = [
    ...new Set(
      logs
        .map((log) => log.actor_id)
        .filter(Boolean)
    ),
  ];

  let adminsById = {};

  if (actorIds.length) {
    const {
      data: admins,
      error: adminsError,
    } = await supabaseAdmin
      .from("admins")
      .select("id, full_name, email")
      .in("id", actorIds);

    if (adminsError) {
      throw adminsError;
    }

    adminsById = Object.fromEntries(
      (admins || []).map((admin) => [
        admin.id,
        admin,
      ])
    );
  }

  return logs.map((log) => ({
    ...log,
    actor: log.actor_id
      ? adminsById[log.actor_id] || null
      : null,
  }));
};

const createActivityLog = async ({
  actor_id = null,
  actor_role = "admin",
  action,
  module,
  target_type = null,
  target_id = null,
  target_label = null,
  old_values = null,
  new_values = null,
  ip_address = null,
  user_agent = null,
}) => {
  const payload = {
    actor_id,
    actor_role,
    action,
    module,
    target_type,
    target_id,
    target_label,
    old_values,
    new_values,
    ip_address,
    user_agent,
  };

  const { data, error } = await supabaseAdmin
    .from("activity_logs")
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error(
      "CREATE ACTIVITY LOG ERROR:",
      error
    );

    // Logging should never break the actual LMS operation.
    return null;
  }

  return data;
};

module.exports = {
  getActivityLogs,
  createActivityLog,
};