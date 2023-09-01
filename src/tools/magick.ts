/**
 * ImageMagick magick command wrapper
 */
import imagemagickCli from 'imagemagick-cli';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import { tempOpen } from '../environment/nodejs';

export async function svgElementToPNGFile(
  svgElement: string,
  pngFilePath: string,
  imageMagickPath: string = '',
): Promise<string> {
  const info = await tempOpen({ prefix: 'mume-svg', suffix: '.svg' });
  fs.writeFileSync(info.fd, svgElement); // write svgElement to temp .svg file
  const args = [info.path, pngFilePath];
  try {
    if (imageMagickPath && imageMagickPath.length) {
      await execFileSync(imageMagickPath, args);
    } else {
      await imagemagickCli.exec(`convert ${args.join(' ')}`);
    }
  } catch (error) {
    throw new Error(
      'imagemagick-cli failure\n' +
        error.toString() +
        '\n\nPlease make sure you have ImageMagick installed.',
    );
  }

  return pngFilePath;
}
