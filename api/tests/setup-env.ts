// Carregado antes de cada arquivo de teste: força o banco de teste e um segredo fixo.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';
require('dotenv').config();
