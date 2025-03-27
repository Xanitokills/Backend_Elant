const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const doorRoutes = require('./routes/doorRoutes');
const movementRoutes = require('./routes/movementRoutes');
const userRoutes = require('./routes/userRoutes');
const { login, validate } = require('./controllers/authController');

const app = express();

// Habilitar CORS
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Usar las rutas
app.use('/api', authRoutes);
app.use('/api', doorRoutes);
app.use('/api', movementRoutes);
app.use('/api', userRoutes);
app.post('/api/login', login);
app.get('/api/validate', validate);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});