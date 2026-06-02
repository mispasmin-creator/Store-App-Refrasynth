import { supabase } from '@/lib/supabase';

/**
 * Upload a file to Supabase Storage.
 *
 * @param file        - The File object to upload.
 * @param folderId    - The Supabase **bucket name** to upload into
 *                      (e.g. "po_image", "photo_of_bill", "indent_attachment").
 * @param uploadType  - Kept for API compatibility; ignored for Supabase uploads.
 * @param email       - Kept for API compatibility; ignored for Supabase uploads.
 * @param emailSubject - Kept for API compatibility; ignored.
 * @param emailBody   - Kept for API compatibility; ignored.
 * @returns The public URL of the uploaded file.
 */
export async function uploadFile({
    file,
    folderId,
    uploadType = 'upload',
    email,
    emailSubject,
    emailBody,
}: {
    file: File;
    folderId: string;
    uploadType?: 'upload' | 'email';
    email?: string;
    emailSubject?: string;
    emailBody?: string;
}): Promise<string> {
    // Suppress unused-variable warnings for legacy params
    void uploadType;
    void email;
    void emailSubject;
    void emailBody;

    // All files go into the single 'images' bucket, organised by folder (folderId)
    const BUCKET = 'images';
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${folderId}/${timestamp}-${safeName}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error(`Failed to upload file to Supabase: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
        throw new Error('Failed to retrieve public URL from Supabase Storage');
    }

    console.log('✅ Uploaded to Supabase Storage:', urlData.publicUrl);
    return urlData.publicUrl;
}