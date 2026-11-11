import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';

const pages = ['index.html', 'privacy.html', 'terms.html', 'legal.css'];
const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });

// Refuse to publish unexpected folders, symlinks or stale files from a prior build.
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (!entry.isFile() || !pages.includes(entry.name)) {
    throw new Error('Unexpected entry in dist: ' + entry.name);
  }
  await unlink(new URL(entry.name, output));
}

await Promise.all(pages.map(name => copyFile(new URL('../' + name, import.meta.url), new URL(name, output))));
