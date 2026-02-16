const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./modules/auth/auth.routes');
const activitiesRoutes = require('./modules/activities/activities.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const evidenceRoutes = require('./modules/evidence/evidence.routes');
const usersRoutes = require('./modules/user/users.routes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas de la API
app.use('/auth', authRoutes);
app.use('/activities', activitiesRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/evidence', evidenceRoutes);
app.use('/users', usersRoutes);

// Servir evidencias (solo lectura, seguro)
app.use(
    '/uploads',
    express.static(
        path.join(process.cwd(), 'uploads'),
        {
            index: false,           // no listar directorios
            maxAge: '7d',           // cache control (opcional)
            setHeaders: (res) => {
                res.set('X-Content-Type-Options', 'nosniff');
            }
        }
    )
);

module.exports = app;
