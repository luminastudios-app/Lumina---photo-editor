import type { SavedProject } from '../types/editor';

const PROJECTS_STORAGE_KEY = 'lumina_studio_projects_v1';
const AUTOSAVE_PREF_KEY = 'lumina_studio_autosave_v1';

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(custom?: StorageBackend): StorageBackend | null {
  if (custom) return custom;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getAutoSaveEnabled(storage?: StorageBackend): boolean {
  try {
    const s = getStorage(storage);
    const val = s?.getItem(AUTOSAVE_PREF_KEY);
    return val === null || val === undefined ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setAutoSaveEnabled(enabled: boolean, storage?: StorageBackend): void {
  try {
    const s = getStorage(storage);
    s?.setItem(AUTOSAVE_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage write errors
  }
}

export function loadSavedProjects(storage?: StorageBackend): SavedProject[] {
  try {
    const s = getStorage(storage);
    const raw = s?.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...parsed].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

export function saveProjectToStorage(
  project: SavedProject,
  storage?: StorageBackend,
): { ok: boolean; projects: SavedProject[]; error?: string } {
  const s = getStorage(storage);
  if (!s) {
    return { ok: false, projects: [], error: 'Browser localStorage is unavailable.' };
  }

  const existing = loadSavedProjects(s).filter((p) => p.id !== project.id);
  const candidates = [project, ...existing].slice(0, 16);

  // Attempt saving full list, progressively pruning oldest entries if quota is tight
  for (let limit = candidates.length; limit >= 1; limit--) {
    const subset = candidates.slice(0, limit);
    try {
      s.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(subset));
      return { ok: true, projects: subset };
    } catch {
      // Try fewer older projects on QuotaExceededError
    }
  }

  return {
    ok: false,
    projects: existing,
    error: 'Browser storage quota exceeded for this image size. Delete older saved photos or export directly.',
  };
}

export function deleteProjectFromStorage(
  id: string,
  storage?: StorageBackend,
): SavedProject[] {
  const s = getStorage(storage);
  const next = loadSavedProjects(s ?? undefined).filter((p) => p.id !== id);
  try {
    s?.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

import { decodeRawFileToDataUrl, isRawFilename } from '../engine/rawDecoder';

export async function fileOrBlobToDataUrl(file: File | Blob): Promise<string> {
  const name = file instanceof File ? file.name.toLowerCase() : '';
  if (name && isRawFilename(name)) {
    return decodeRawFileToDataUrl(file);
  }

  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');

  let targetBlob: Blob = file;
  if (isHeic) {
    const heic2any = (await import('heic2any')).default;
    const converted = await heic2any({
      blob: file,
      toType: 'image/png',
      quality: 0.95,
    });
    targetBlob = Array.isArray(converted) ? converted[0] : converted;
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(targetBlob);
  });
}
