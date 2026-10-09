const model = require('../models/adminNotification.model');
const { handle, httpError, uuid } = require('../utils/api');

const optionalUuid = (value, label) => {
  if (!value) return null;
  return uuid(value, label);
};

const createAnnouncement = handle(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || req.body.message || '').trim();
  const audience = String(req.body.audience || '').toLowerCase();

  if (!title) throw httpError('Announcement title is required');
  if (!body) throw httpError('Announcement message is required');
  if (!['students', 'teachers', 'both'].includes(audience)) {
    throw httpError('Audience must be students, teachers or both');
  }

  const filters = {
    batch_id: optionalUuid(req.body.batch_id, 'Batch'),
    department_id: optionalUuid(req.body.department_id, 'Department'),
    program_id: optionalUuid(req.body.program_id, 'Program'),
    semester_id: optionalUuid(req.body.semester_id, 'Semester'),
    teacher_department: String(req.body.teacher_department || '').trim() || null,
  };

  const groups = [];
  if (audience === 'students' || audience === 'both') {
    groups.push(await model.getActiveRecipients({ audience: 'students', ...filters }));
  }
  if (audience === 'teachers' || audience === 'both') {
    groups.push(await model.getActiveRecipients({ audience: 'teachers', ...filters }));
  }

  const recipientMap = new Map();
  groups.flat().forEach((recipient) => recipientMap.set(recipient.id, recipient));
  const recipients = [...recipientMap.values()];

  if (!recipients.length) {
    throw httpError('No active recipients match the selected filters', 404);
  }

  const createdAt = new Date().toISOString();
  const attachment = {
    attachment_url: String(req.body.attachment_url || '').trim() || null,
    attachment_name: String(req.body.attachment_name || '').trim() || null,
    attachment_type: String(req.body.attachment_type || '').trim() || null,
    attachment_size_bytes: req.body.attachment_size_bytes == null || req.body.attachment_size_bytes === ''
      ? null
      : Number(req.body.attachment_size_bytes),
  };

  await model.createAnnouncementNotifications({
    recipients,
    title,
    body,
    createdBy: req.admin.id,
    createdAt,
    ...attachment,
  });

  const studentCount = recipients.filter((item) => item.role === 'student').length;
  const teacherCount = recipients.filter((item) => item.role === 'teacher').length;

  res.status(201).json({
    success: true,
    message: `Announcement sent to ${recipients.length} active recipient${recipients.length === 1 ? '' : 's'}.`,
    data: {
      title,
      body,
      created_at: createdAt,
      audience,
      recipients: recipients.length,
      students: studentCount,
      teachers: teacherCount,
      filters,
      ...attachment,
    },
  });
});

const listAnnouncements = handle(async (req, res) => {
  const rows = await model.getAnnouncementNotifications(req.query.mine === 'true' ? req.admin.id : null);
  const profiles = await model.getProfilesByIds(rows.map((row) => row.user_id));
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.created_by || ''}|${row.created_at}|${row.title}|${row.body}|${row.attachment_url || ''}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: row.id,
        title: row.title,
        body: row.body,
        created_at: row.created_at,
        created_by: row.created_by,
        attachment_url: row.attachment_url || null,
        attachment_name: row.attachment_name || null,
        attachment_type: row.attachment_type || null,
        attachment_size_bytes: row.attachment_size_bytes || null,
        recipients: 0,
        students: 0,
        teachers: 0,
        read: 0,
      });
    }
    const group = grouped.get(key);
    group.recipients += 1;
    if (row.is_read) group.read += 1;
    const profile = profileMap.get(row.user_id);
    if (profile?.role === 'student') group.students += 1;
    if (profile?.role === 'teacher') group.teachers += 1;
  }

  res.json({ success: true, data: [...grouped.values()] });
});

module.exports = { createAnnouncement, listAnnouncements };
