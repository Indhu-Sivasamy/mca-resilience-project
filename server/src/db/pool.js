require('dotenv').config();
const { Pool } = require('pg');
const { sslConfig } = require('./ssl');

module.exports = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(process.env.DATABASE_URL, process.env.DATABASE_SSL),
});
