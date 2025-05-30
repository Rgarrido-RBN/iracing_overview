const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// Configuración del logging básico
const logger = {
    info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
    error: (message) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
    debug: (message) => console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`),
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permite todas las origenes, ajusta según tus necesidades de seguridad
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 5000;

// Middleware para servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));
// Middleware para parsear JSON en las solicitudes
app.use(express.json());

// Objeto para almacenar los datos de cada cliente (en lugar de diccionario)
let clients_data = {};

// Ruta principal para servir el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta API para actualizar datos
app.post('/api/update', (req, res) => {
    try {
        const data = req.body;
        const clientId = data.client_id;

        if (!clientId) {
            logger.error("client_id is required in /api/update");
            return res.status(400).json({ status: "error", message: "client_id is required" });
        }

        clients_data[clientId] = data;
        // Broadcast los datos actualizados de este cliente a todos los sockets conectados
        io.emit('update_data', data); // El cliente espera un objeto de datos, no el objeto entero clients_data
        logger.debug(`Received data for ${clientId}: ${JSON.stringify(data)}`);
        return res.json({ status: "success", message: `Data updated for client ${clientId}` });

    } catch (e) {
        logger.error(`Error updating data: ${e.message}`);
        return res.status(500).json({ status: "error", message: e.message });
    }
});

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Al conectar, enviar todos los datos actuales al cliente que se conecta
    socket.emit('all_clients_data', clients_data);

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        // Opcional: podrías querer emitir un evento para notificar a otros clientes
        // o limpiar datos si el cliente no se espera que vuelva.
        // Por ejemplo, si un client_id está asociado a un socket.id:
        // let disconnectedClientId = null;
        // for (const id in clients_data) {
        //     if (clients_data[id].socketId === socket.id) { // Necesitarías almacenar socket.id en clients_data[id]
        //         disconnectedClientId = id;
        //         delete clients_data[id]; // O marcar como offline
        //         break;
        //     }
        // }
        // if (disconnectedClientId) {
        //    io.emit('client_disconnected', { client_id: disconnectedClientId }); // Necesitarías manejar esto en el cliente
        //    logger.info(`Removed data for disconnected client: ${disconnectedClientId}`);
        // }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    logger.info(`iRacing Fuel Calculator (Node.js) server running on http://0.0.0.0:${PORT}`);
});