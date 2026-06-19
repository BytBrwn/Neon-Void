import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const linkPath = path.join(packageRoot, "..", "src", "game");
const targetPath = path.join(packageRoot, "..", "..", "game", "src", "game");

if (fs.existsSync(linkPath)) {
  process.exit(0);
}

fs.symlinkSync(path.relative(path.dirname(linkPath), targetPath), linkPath, "dir");
console.log(`Linked ${linkPath} -> ${targetPath}`);
