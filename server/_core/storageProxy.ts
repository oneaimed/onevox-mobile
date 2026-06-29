import type { Express, Response } from "express";
import { storageGetSignedUrl } from "../storage";

async function redirectSignedStorageUrl(key: string | undefined, res: Response) {
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  try {
    const url = await storageGetSignedUrl(key);
    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage proxy error");
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/api/storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    await redirectSignedStorageUrl(key, res);
  });

  // Temporary compatibility for older generated audio URLs.
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    await redirectSignedStorageUrl(key, res);
  });
}
