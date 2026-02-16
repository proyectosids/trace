const fs = require('fs/promises');
const path = require('path');

const ensureUploadDirectories = async () => {
    const baseDir = path.join(process.cwd(), process.env.UPLOAD_DIR, 'evidence');

    try {
        await fs.mkdir(baseDir, { recursive: true });
        console.log('📁 uploads/evidence verificada o creada correctamente');
    } catch (error) {
        console.error('❌ Error creando carpeta uploads:', error);
        throw error; // importante para que server no arranque si falla
    }
};

module.exports = { ensureUploadDirectories };
