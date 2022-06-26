const mysql = require('mysql');
require('dotenv').config()

// DAtabase
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'hmsdatabase'
});
connection.connect(err => {
    if (err) throw err;
    console.log("connected to db");
});

module.exports = connection;