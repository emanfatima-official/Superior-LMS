const { supabaseAdmin } = require('../config/supabase');
const { allRows } = require('../utils/api');

const getActiveRecipients = async ({ audience, batch_id, department_id, program_id, semester_id, teacher_department }) => {
  const role = audience === 'teachers' ? 'teacher' : 'student';
  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, department, batch_id, department_id, program_id, semester_id, is_active')
    .eq('role', role)
    .eq('is_active', true);

  if (role === 'student') {
    if (batch_id) query = query.eq('batch_id', batch_id);
    if (department_id) query = query.eq('department_id', department_id);
    if (program_id) query = query.eq('program_id', program_id);
    if (semester_id) query = query.eq('semester_id', semester_id);
  } else if (teacher_department) {
    query = query.eq('department', teacher_department);
  }

  const { data, error } = await query.order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
};

const createAnnouncementNotifications = async ({
  recipients,
  title,
  body,
  createdBy,
  createdAt,
  attachment_url,
  attachment_name,
  attachment_type,
  attachment_size_bytes,
}) => {
  if (!recipients.length) return [];
  const rows = recipients.map((recipient) => ({
    user_id: recipient.id,
    title,
    body,
    type: 'admin_announcement',
    is_read: false,
    created_at: createdAt,
    sender_name: 'Administration',
    created_by: createdBy,
    attachment_url: attachment_url || null,
    attachment_name: attachment_name || null,
    attachment_type: attachment_type || null,
    attachment_size_bytes: attachment_size_bytes || null,
  }));

  const inserted = [];
  for (let start = 0; start < rows.length; start += 500) {
    const chunk = rows.slice(start, start + 500);
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(chunk)
      .select('id,user_id,title,body,type,is_read,created_at,created_by,attachment_url,attachment_name,attachment_type,attachment_size_bytes');
    if (error) throw error;
    inserted.push(...(data || []));
  }
  return inserted;
};

const getAnnouncementNotifications = async (createdBy = null) =>
  allRows(() => {
    let query = supabaseAdmin
      .from('notifications')
      .select('id,user_id,title,body,type,is_read,created_at,created_by,attachment_url,attachment_name,attachment_type,attachment_size_bytes')
      .eq('type', 'admin_announcement')
      .order('created_at', { ascending: false });
    if (createdBy) query = query.eq('created_by', createdBy);
    return query;
  });

const getProfilesByIds = async (ids) => {
  const clean = [...new Set((ids || []).filter(Boolean))];
  if (!clean.length) return [];
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id,role,department,batch_id,department_id,program_id,semester_id,is_active')
    .in('id', clean);
  if (error) throw error;
  return data || [];
};

module.exports = {
  getActiveRecipients,
  createAnnouncementNotifications,
  getAnnouncementNotifications,
  getProfilesByIds,
};
