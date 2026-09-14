import { readdir } from "node:fs/promises";
import { extname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceDirectory = fileURLToPath(new URL("../src/assets/uploads/", import.meta.url));
const files = await readdir(sourceDirectory);

for (const file of files) {
  const extension = extname(file).toLowerCase();
  if (extension !== ".jpg" && extension !== ".jpeg" && extension !== ".png") continue;

  const source = join(sourceDirectory, file);
  const destination = join(sourceDirectory, `${parse(file).name}.webp`);
  await sharp(source)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 95, smartSubsample: true })
    .toFile(destination);

  console.log(`${file} -> ${parse(file).name}.webp`);
}
