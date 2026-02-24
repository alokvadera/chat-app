import { supabase } from "../config/supabase";

const upload = async (file) => {
  // Remove spaces and special characters from filename
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const fileName = `${Date.now()}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from("chat-images")
    .upload(fileName, file);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from("chat-images")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

export default upload;
