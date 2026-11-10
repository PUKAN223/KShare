const fs = require("fs");
const path = require("path");

const icon512 = path.resolve(__dirname, "../../web/public/icon-512.png");
const fallbackIcon = path.resolve(__dirname, "../../web/public/scius-logo.png");
const assetsDir = path.resolve(__dirname, "../assets");
const destIcon = path.join(assetsDir, "icon.png");

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const srcIcon = fs.existsSync(icon512) ? icon512 : fallbackIcon;
if (fs.existsSync(srcIcon)) {
  fs.copyFileSync(srcIcon, destIcon);
  console.log(`Synced desktop icon from ${srcIcon} -> ${destIcon}`);
}

// Bake KSHARE_WEB_URL into src/config.json at build time if provided
const configPath = path.resolve(__dirname, "../src/config.json");
let existingUrl = "http://localhost:3000";
if (fs.existsSync(configPath)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (parsed.defaultWebUrl) existingUrl = parsed.defaultWebUrl;
  } catch {
    // ignore
  }
}

const defaultWebUrl = (process.env.KSHARE_WEB_URL || existingUrl).trim();
fs.writeFileSync(
  configPath,
  JSON.stringify({ defaultWebUrl }, null, 2) + "\n",
  "utf8"
);
console.log(`Configured defaultWebUrl -> ${defaultWebUrl}`);
