const { hashTestUserPassword } = require('./src/controllers/authController');

hashTestUserPassword().then(() => {
    console.log('Hashing completed');
    process.exit(0);
}).catch((error) => {
    console.error('Error during hashing:', error);
    process.exit(1);
});