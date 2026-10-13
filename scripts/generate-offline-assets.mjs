import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDirectory = join(process.cwd(), ".output", "public");
const assetDirectory = join(publicDirectory, "assets");
const assetNames = (await readdir(assetDirectory)).filter((name) => /\.(js|css)$/.test(name)).sort();
const assets = assetNames.map((name) => `/assets/${name}`);
const buildId = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);

await writeFile(join(publicDirectory, "offline-assets.json"), JSON.stringify(assets));
const workerPath = join(publicDirectory, "sw.js");
const worker = await readFile(workerPath, "utf8");
await writeFile(workerPath, worker.replace("__BUILD_ID__", buildId));
