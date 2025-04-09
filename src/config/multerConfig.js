const multer = require('multer');

// Configuración de Multer para almacenar imágenes en memoria
const storage = multer.memoryStorage();  // Usar almacenamiento en memoria para obtener el buffer de la imagen

const upload = multer({ storage: storage }).single('image');  // Asegúrate de que el campo de la imagen se llame 'image'

module.exports = upload;
