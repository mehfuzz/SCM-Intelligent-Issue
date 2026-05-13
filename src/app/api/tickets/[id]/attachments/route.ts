import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ok, err } from "@/lib/http";

const BUCKET = "ticket-attachments";
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = [
  "image/png", "image/jpeg", "image/gif", "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv"
];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return err("Unauthorized", 401);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return err("Missing file", 400);
  if (file.size > MAX_SIZE) return err("File too large (max 25 MB)", 413);
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return err(`Unsupported file type: ${file.type}`, 415);
  }

  const supabase = createSupabaseServerClient();
  const path = `${params.id}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return err(upErr.message, 500);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      ticket_id: params.id,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id
    })
    .select("*")
    .single();
  if (error) return err(error.message, 500);
  return ok(data, { status: 201 });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("ticket_id", params.id)
    .order("uploaded_at", { ascending: false });
  if (error) return err(error.message, 500);
  return ok(data);
}
