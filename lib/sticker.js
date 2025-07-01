import sharp from 'sharp';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';

export async function createSticker(mediaBuffer, mimeType) {
    try {
        let webpBuffer;
        if (mimeType.includes('image')) {
            webpBuffer = await sharp(mediaBuffer)
                .resize(512, 512, {
                    fit: sharp.fit.contain,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 80 })
                .toBuffer();
        } else if (mimeType.includes('video')) {
            console.log("Video to sticker conversion is complex and requires ffmpeg. Skipping for now.");
            return null;
        } else {
            return null;
        }

        return webpBuffer;
    } catch (error) {
        console.error("Error creating sticker:", error);
        return null;
    }
}