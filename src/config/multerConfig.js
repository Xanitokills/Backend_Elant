const multer = require("multer");

// Configuración de Multer para almacenar imágenes en memoria
const storage = multer.memoryStorage(); // Usar almacenamiento en memoria para obtener el buffer de la imagen

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Límite de 5MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten imágenes JPEG, JPG o PNG"));
  },
});

module.exports = upload;