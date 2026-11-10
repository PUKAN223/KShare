const fs = require("fs");
const path = require("path");

function findPrismaClientDirs(startDir) {
  const results = [];
  const pnpmDir = path.join(startDir, "node_modules", ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir)) {
      if (entry.startsWith("@prisma+client@")) {
        const candidate = path.join(
          pnpmDir,
          entry,
          "node_modules",
          ".prisma",
          "client"
        );
        if (fs.existsSync(candidate)) {
          results.push(candidate);
        }
      }
    }
  }
  const direct = path.join(startDir, "node_modules", ".prisma", "client");
  if (fs.existsSync(direct)) {
    results.push(direct);
  }
  return results;
}

const repoRoot = path.resolve(__dirname, "../../..");
const webRoot = path.resolve(__dirname, "..");

const sourceDirs = [
  ...findPrismaClientDirs(repoRoot),
  ...findPrismaClientDirs(webRoot)
];

if (sourceDirs.length === 0) {
  console.warn("No .prisma/client directory found to copy.");
  process.exit(0);
}

const srcDir = sourceDirs[0];
const destDirs = [
  path.join(webRoot, ".prisma", "client"),
  path.join(webRoot, ".next", "server"),
  path.join(webRoot, ".next", "server", "chunks"),
  path.join(webRoot, ".next", "server", "app", "api", "rooms"),
  path.join(webRoot, ".next", "server", "app", "api", "rooms", "[code]"),
  path.join(webRoot, ".next", "server", "app", "api", "rooms", "[code]", "signal")
];

const files = fs.readdirSync(srcDir).filter((f) => {
  return (
    f.endsWith(".node") ||
    f.endsWith(".so.node") ||
    f.endsWith(".dll.node") ||
    f.endsWith(".dylib.node") ||
    f === "schema.prisma"
  );
});

for (const dest of destDirs) {
  try {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of files) {
      fs.copyFileSync(path.join(srcDir, file), path.join(dest, file));
    }
    console.log(`Copied ${files.length} Prisma engine files -> ${dest}`);
  } catch (err) {
    console.warn(`Skipped copying Prisma files to ${dest}:`, err.message);
  }
}
