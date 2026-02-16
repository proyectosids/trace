const usersService = require('./users.service');

async function getPending(req, res) {
    try {
        const users = await usersService.getPendingUsers(req.user);
        res.json(users);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}

async function approve(req, res) {
    try {
        const { id } = req.params;
        await usersService.approveUser(id, req.user);
        res.json({ message: 'Usuario aprobado correctamente' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}

async function assignRole(req, res) {
    try {
        const { id } = req.params;
        const { roleName } = req.body;

        if (!roleName) {
            return res.status(400).json({ message: 'roleName es requerido' });
        }

        await usersService.assignRole(id, roleName, req.user);
        res.json({ message: 'Rol actualizado correctamente' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}

module.exports = {
    getPending,
    approve,
    assignRole
};
