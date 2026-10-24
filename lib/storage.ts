import "server-only";
import { put, del } from "@vercel/blob";
import { isLocalDev } from "./db";
import { randomId } from "./ids";

export type Stored = { url: string; pathname: string };

const LOCAL_DIR = ".local-data/files";

export async function saveFile(
  folder: string,
  ext: string,
  body: Blob,
  contentType: string
): Promise<Stored> {
  const name = `${folder}/${randomId(16)}.${ext}`;
  if (isLocalDev()) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.join(LOCAL_DIR, name);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, Buffer.from(await body.arrayBuffer()));
    return { url: `/api/local-file/${name}`, pathname: name };
  }
  const res = await put(name, body, {
    access: "public",
    contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return { url: res.url, pathname: res.pathname };
}

export async function deleteFiles(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u);
  if (!list.length) return;
  if (isLocalDev()) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await Promise.all(
      list.map((u) =>
        fs.rm(path.join(LOCAL_DIR, u.replace("/api/local-file/", "")), { force: true })
      )
    );
    return;
  }
  for (let i = 0; i < list.length; i += 500) {
    await del(list.slice(i, i + 500));
  }
}

/** Reads a stored file (used by the download proxy so ZIP export stays same-origin). */
export async function readFile(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (isLocalDev() && url.startsWith("/api/local-file/")) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    try {
      const buf = await fs.readFile(path.join(LOCAL_DIR, url.replace("/api/local-file/", "")));
      return {
        body: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        type: "image/jpeg",
      };
    } catch {
      return null;
    }
  }
  const res = await fetch(url);
  if (!res.ok) return null;
  return { body: await res.arrayBuffer(), type: res.headers.get("content-type") || "image/jpeg" };
}
