const fs = require('fs');

function deleteFileIfExists(filePath) {
    try {
        console.log('Intentando eliminar RAW:', JSON.stringify(filePath));

        if (fs.existsSync(filePath)) {
            console.log('Archivo existe, eliminando...');
            fs.unlinkSync(filePath);
            console.log('Archivo eliminado correctamente');
        } else {
            console.log('Archivo NO existe en esa ruta');
        }
    } catch (err) {
        console.error('Error eliminando archivo:', err);
    }
}

module.exports = { deleteFileIfExists };
