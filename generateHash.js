const bcrypt = require('bcryptjs');

// Contraseña en texto plano
const password = '_temp_password';

// Generar un salt y un hash
bcrypt.genSalt(10, (err, salt) => {
  if (err) throw err;

  bcrypt.hash(password, salt, (err, hash) => {
    if (err) throw err;

    console.log('Salt:', salt);
    console.log('Hash:', hash);
  });
});