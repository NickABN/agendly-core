import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = process.argv.slice(2);
const targetRoots = roots.length > 0 ? roots : ['.'];
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue']);
const onlyPattern =
  /\b(?:(?:describe|it|test)\.only(?:\s*(?:<[^>\r\n]+>\s*)?\(|\.each\s*(?:<[^>\r\n]+>\s*)?(?:\(|`))|fdescribe\s*\(|fit\s*\()/;
const ignoredDirectories = new Set([
  '.git',
  '.nuxt',
  '.output',
  'coverage',
  'dist',
  'node_modules',
]);

function extensionOf(filePath) {
  const index = filePath.lastIndexOf('.');
  return index === -1 ? '' : filePath.slice(index);
}

async function collectFiles(path, files) {
  const entries = await readdir(path, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        await collectFiles(join(path, entry.name), files);
      }
      continue;
    }

    const filePath = join(path, entry.name);
    if (entry.isFile() && allowedExtensions.has(extensionOf(entry.name))) {
      files.push(filePath);
    }
  }
}

const files = [];
for (const root of targetRoots) {
  await collectFiles(root, files);
}

const violations = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (onlyPattern.test(line)) {
      violations.push(`${file}:${index + 1}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Focused tests are not allowed in committed test suites:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}
