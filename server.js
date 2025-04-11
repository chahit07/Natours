const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();


// Catching uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './.env' });
const app = require('./app');
// C:\Users\chahi\Desktop\Demo-natours-main\natours-main\.env
// C:\Users\chahi\Desktop\Demo-natours-main\natours-main\server.js
// MongoDB database connection
const uri = process.env.DATABASE.replace(
  '<db_password>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(uri, {
    // useNewUrlParser: true,
    // useCreateIndex: true,
    // useFindAndModify: false,
    // useUnifiedTopology: true
  })
  .then(() => console.log('DB Connection Successful 🖐'));

console.log(process.env.NODE_ENV);
  
// Create a server on 127.0.0.1:8000
const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`Server started ${port} 🖐`);
});

// Handling Promise rejections
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
