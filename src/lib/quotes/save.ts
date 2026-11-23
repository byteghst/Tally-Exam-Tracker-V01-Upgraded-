import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

/** Saves a downloaded picture: into Documents on the phone, or as a normal browser download on the web. */
export async function saveImage(url: string, filename: string): Promise<'device' | 'browser'> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the image');
  const blob = await res.blob();

  if (Capacitor.isNativePlatform()) {
    // A plain <a download> does nothing inside a Capacitor WebView, so the file is written directly.
    const data = await blobToBase64(blob);
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Documents });
    return 'device';
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return 'browser';
}
