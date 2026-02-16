const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');

//const UPLOAD_DIR = path.join(__dirname, '../../uploads/evidence');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'evidence');

const storage = multer.diskStorage({
    destination: (_, __, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuid()}${ext}`);
    }
});

// function fileFilter(_, file, cb) {
//     const allowed = ['image/jpeg', 'image/png', 'image/webp'];
//     if (!allowed.includes(file.mimetype)) {
//         cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
//     } else {
//         cb(null, true);
//     }
// }
function fileFilter(_, file, cb) {
    console.log('MIMETYPE RECIBIDO:', file.mimetype);
    console.log('ORIGINALNAME:', file.originalname);

    if (!file.mimetype.startsWith('image/')) {
        cb(new Error('Solo se permiten archivos de imagen'));
    } else {
        cb(null, true);
    }
}

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB antes de optimizar
    }
});
