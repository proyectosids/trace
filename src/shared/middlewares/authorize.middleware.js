module.exports = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        next();
    };
};
