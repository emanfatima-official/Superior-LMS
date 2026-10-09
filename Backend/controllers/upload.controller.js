const { supabaseAdmin } = require("../config/supabase");

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile picture is required",
      });
    }

    const file = req.file;

    // Get file extension
    const extension = file.originalname
      .split(".")
      .pop()
      .toLowerCase();

    // Generate unique file name
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${extension}`;

    // avatars is a FOLDER inside campusz-files bucket
    const filePath = `avatars/${fileName}`;

    // Upload file
    const { error: uploadError } =
      await supabaseAdmin.storage
        .from("campusz-files")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "AVATAR UPLOAD ERROR:",
        uploadError
      );

      return res.status(400).json({
        success: false,
        message: uploadError.message,
      });
    }

    // Get public URL
    const { data } = supabaseAdmin.storage
      .from("campusz-files")
      .getPublicUrl(filePath);

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        avatar_url: data.publicUrl,
      },
    });
  } catch (error) {
    console.error(
      "UPLOAD AVATAR ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


const uploadAnnouncementAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Attachment file is required" });
    }

    const file = req.file;
    const extension = (file.originalname.split(".").pop() || "bin").toLowerCase();
    const safeBase = file.originalname
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "attachment";
    const fileName = `${Date.now()}-${safeBase}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const filePath = `announcements/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("campusz-files")
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(400).json({ success: false, message: uploadError.message });
    }

    const { data } = supabaseAdmin.storage.from("campusz-files").getPublicUrl(filePath);
    return res.status(200).json({
      success: true,
      message: "Announcement attachment uploaded successfully",
      data: {
        attachment_url: data.publicUrl,
        attachment_name: file.originalname,
        attachment_type: file.mimetype,
        attachment_size_bytes: file.size,
      },
    });
  } catch (error) {
    console.error("UPLOAD ANNOUNCEMENT ATTACHMENT ERROR:", error);
    return res.status(500).json({ success: false, message: "Unable to upload announcement attachment" });
  }
};

module.exports = {
  uploadAvatar,
  uploadAnnouncementAttachment,
};