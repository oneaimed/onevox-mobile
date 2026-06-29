import { ENV } from "./_core/env";

function getSupabaseConfig() {
  const supabaseUrl = ENV.supabaseUrl.replace(/\/+$/, "");
  const serviceRoleKey = ENV.supabaseServiceRoleKey;
  const bucket = ENV.supabaseStorageBucket;

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error(
      "Supabase storage config missing: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET",
    );
  }

  return { supabaseUrl, serviceRoleKey, bucket };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function storageRoute(key: string): string {
  return `/api/storage/${key}`;
}

export function storageKeyFromUrl(url: string): string {
  return url.replace(/^\/?(?:api\/storage|manus-storage)\//, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const body =
    typeof data === "string" ? data : new Blob([data as BlobPart], { type: contentType });

  const uploadResp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "false",
    },
    body,
  });

  if (!uploadResp.ok) {
    const detail = await uploadResp.text().catch(() => uploadResp.statusText);
    throw new Error(`Supabase storage upload failed (${uploadResp.status}): ${detail}`);
  }

  return { key, url: storageRoute(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: storageRoute(key) };
}

export async function storageGetSignedUrl(relKey: string, expiresIn = 60 * 60): Promise<string> {
  const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseConfig();
  const key = normalizeKey(relKey);
  const signUrl = `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const resp = await fetch(signUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => resp.statusText);
    throw new Error(`Supabase signed URL failed (${resp.status}): ${detail}`);
  }

  const payload = (await resp.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL || payload.signedUrl;
  if (!signedPath) throw new Error("Supabase returned empty signed URL");
  return signedPath.startsWith("http") ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`;
}
