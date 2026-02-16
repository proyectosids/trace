require('dotenv').config();
const app = require('./app');
const { initializeSystem } = require('./config/system.init');
const { ensureUploadDirectories } = require('./config/storage.config');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Backend corriendo en puerto ${PORT}`);
    try {
        await initializeSystem();
        await ensureUploadDirectories();
    } catch (err) {
        console.error('❌ Error inicializando sistema:', err.message);
    }
});
