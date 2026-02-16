const activitiesService = require('./activities.service');

async function create(req, res) {
    try {
        const { semesterId, type, title, scheduledDate } = req.body ?? {};
        if (!semesterId || !type || !title || !scheduledDate) {
            return res.status(400).json({ message: 'semesterId, type, title, scheduledDate son requeridos' });
        }

        await activitiesService.createActivity(
            { semesterId, type, title, scheduledDate },
            req.user
        );

        return res.status(201).json({ message: 'Actividad creada' });
    } catch (err) {
        return res.status(400).json({ message: err.message || 'No se pudo crear la actividad' });
    }
}

async function list(req, res) {
    try {
        const { semesterId, type } = req.query ?? {};
        const data = await activitiesService.listActivities(
            { semesterId, type },
            req.user
        );
        return res.json(data);
    } catch (err) {
        return res.status(400).json({ message: err.message || 'No se pudieron listar actividades' });
    }
}

async function registerActivity(req, res) {
    try {
        const { id } = req.params;
        await activitiesService.registerActivity(id, req.user);
        return res.json({ message: 'Actividad registrada (con evidencia válida)' });
    } catch (err) {
        return res.status(400).json({ message: err.message || 'No se pudo registrar' });
    }
}

async function updateTitle(req, res) {
    try {
        const { id } = req.params;
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ message: 'Título requerido' });
        }

        await activitiesService.updateActivityTitle(
            id,
            title,
            req.user
        );

        return res.json({ message: 'Actividad actualizada' });
    } catch (err) {
        return res.status(400).json({
            message: err.message || 'No se pudo actualizar'
        });
    }
}

async function cancel(req, res) {
    try {
        const { id } = req.params;

        await activitiesService.cancelActivity(id, req.user);

        return res.json({ message: 'Actividad cancelada' });
    } catch (err) {
        return res.status(400).json({
            message: err.message || 'No se pudo cancelar'
        });
    }
}


async function reprogram(req, res) {
    try {
        const { id } = req.params;
        const { newDate } = req.body ?? {};
        if (!newDate) return res.status(400).json({ message: 'newDate es requerido' });

        await activitiesService.reprogramActivity(id, newDate, req.user);
        return res.json({ message: 'Actividad reprogramada' });
    } catch (err) {
        return res.status(400).json({ message: err.message || 'No se pudo reprogramar' });
    }
}

module.exports = { create, list, registerActivity, reprogram, updateTitle, cancel };
