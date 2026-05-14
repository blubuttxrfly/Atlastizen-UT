#!/usr/bin/env node
/**
 * Bump the project version in package.json (and any hard-coded UI display strings)
 * Usage:
 *   node scripts/bump-version.js patch   # +0.0.1 (caps at .9 then exits)
 *   node scripts/bump-version.js minor   # +0.1.0 (deploy bump)
 */
import fs from "fs";
import path from "path";

const bumpType = process.argv[2] ?? "patch";
const pkgPath = path.resolve("package.json");
const uiFiles = [path.resolve("src/index.tsx"), path.resolve("src/comet/AtlasCometMap.tsx")];

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const [major, minor, patch] = pkg.version.split(".").map((n) => parseInt(n, 10));

let nextMajor = major;
let nextMinor = minor;
let nextPatch = patch;

if (bumpType === "patch") {
  if (patch >= 9) {
    console.error(`Patch bump capped at .9 for minor edits. Current version ${pkg.version}. Run "npm run version:deploy" for the next minor.`);
    process.exit(1);
  }
  nextPatch = patch + 1;
} else if (bumpType === "minor") {
  nextMinor = minor + 1;
  nextPatch = 0;
} else {
  console.error(`Unknown bump type "${bumpType}". Use "patch" or "minor".`);
  process.exit(1);
}

const nextVersion = [nextMajor, nextMinor, nextPatch].join(".");
pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

// Update any UI version strings like "V1.2.3"
const versionPattern = /V\d+\.\d+\.\d+/g;
uiFiles.forEach((filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  if (!versionPattern.test(content)) return;
  const updated = content.replace(versionPattern, `V${nextVersion}`);
  fs.writeFileSync(filePath, updated, "utf8");
});

console.log(`Version bumped to ${nextVersion}`);
