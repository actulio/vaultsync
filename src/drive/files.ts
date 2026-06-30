import { driveFetch, DriveError } from './client';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const FOLDER_NAME = 'VaultSync';
export const VAULT_FILE_NAME = 'vault.enc';

type DriveFile = { id: string; name: string; modifiedTime: string };

async function searchByName(name: string, isFolder: boolean, parentId?: string): Promise<DriveFile | null> {
  const mime = isFolder ? "mimeType = 'application/vnd.google-apps.folder'" : "mimeType != 'application/vnd.google-apps.folder'";
  const parent = parentId ? ` and '${parentId}' in parents` : '';
  const q = encodeURIComponent(`name = '${name}' and trashed = false and ${mime}${parent}`);
  const res = await driveFetch(`${API}/files?q=${q}&fields=files(id,name,modifiedTime)`);
  if (!res.ok) throw new DriveError(res.status, await res.text());
  const j = (await res.json()) as { files: DriveFile[] };
  return j.files[0] ?? null;
}

async function createFolder(name: string): Promise<DriveFile> {
  const res = await driveFetch(`${API}/files?fields=id,name,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new DriveError(res.status, await res.text());
  return res.json() as Promise<DriveFile>;
}

export async function findOrCreateVaultFolder(): Promise<DriveFile> {
  const existing = await searchByName(FOLDER_NAME, true);
  return existing ?? createFolder(FOLDER_NAME);
}

export async function findVaultFile(): Promise<DriveFile | null> {
  const folder = await searchByName(FOLDER_NAME, true);
  if (!folder) return null;
  return searchByName(VAULT_FILE_NAME, false, folder.id);
}

export async function uploadVaultFile(bytes: Uint8Array): Promise<DriveFile> {
  const folder = await findOrCreateVaultFolder();
  const existing = await searchByName(VAULT_FILE_NAME, false, folder.id);
  if (existing) return uploadMultipart(bytes, existing.id);
  return createMultipart(bytes, folder.id);
}

async function createMultipart(bytes: Uint8Array, folderId: string): Promise<DriveFile> {
  const boundary = 'vaultsync-' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name: VAULT_FILE_NAME, parents: [folderId] });
  const body = buildMultipart(boundary, metadata, bytes);
  const res = await driveFetch(`${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new DriveError(res.status, await res.text());
  return res.json() as Promise<DriveFile>;
}

async function uploadMultipart(bytes: Uint8Array, fileId: string): Promise<DriveFile> {
  const boundary = 'vaultsync-' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name: VAULT_FILE_NAME });
  const body = buildMultipart(boundary, metadata, bytes);
  const res = await driveFetch(`${UPLOAD}/files/${fileId}?uploadType=multipart&fields=id,name,modifiedTime`, {
    method: 'PATCH',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new DriveError(res.status, await res.text());
  return res.json() as Promise<DriveFile>;
}

function buildMultipart(boundary: string, metadata: string, payload: Uint8Array): Blob {
  const head =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  return new Blob([head, payload as unknown as BlobPart, tail]);
}

export async function downloadVaultFile(): Promise<{ bytes: Uint8Array; modifiedTime: string } | null> {
  const f = await findVaultFile();
  if (!f) return null;
  const res = await driveFetch(`${API}/files/${f.id}?alt=media`);
  if (!res.ok) throw new DriveError(res.status, await res.text());
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), modifiedTime: f.modifiedTime };
}

export async function fetchVaultFileMetadata(): Promise<DriveFile | null> {
  return findVaultFile();
}
