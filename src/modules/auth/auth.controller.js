const authService = require('./auth.service');

async function login(req, res) {
    try {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
            return res.status(400).json({ message: 'email y password son requeridos' });
        }

        const token = await authService.login(email, password);
        return res.json(token);
    } catch (err) {
        return res.status(401).json({ message: err.message || 'Credenciales inválidas' });
    }
}

async function register(req, res) {
    try {
        const { email, password, fullName, cecytId } = req.body ?? {};

        if (!email || !password || !fullName || !cecytId) {
            return res.status(400).json({
                message: 'email, password, fullName y cecytId son requeridos'
            });
        }

        await authService.register({
            email,
            password,
            fullName,
            cecytId
        });

        return res.status(201).json({
            message: 'Usuario registrado. Espera aprobación del director.'
        });

    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
}


module.exports = { login, register };
