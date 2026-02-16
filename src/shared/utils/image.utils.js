const sharp = require('sharp');
const fs = require('fs');

async function optimizeImage(filePath) {
    const optimizedPath = filePath.replace(/\.(jpg|jpeg|png)$/i, '.webp');

    await sharp(filePath)
        .rotate() // corrige orientación EXIF
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({
            quality: 80,          // muy buen balance calidad/peso
            effort: 5
        })
        .toFile(optimizedPath);

    // borrar archivo original
    fs.unlinkSync(filePath);

    return optimizedPath;
}

module.exports = { optimizeImage };
