#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Preparando aplicação para deployment...');

// 1. Instalar dependências
console.log('📦 Instalando dependências...');
try {
  execSync('npm install', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erro ao instalar dependências:', error.message);
  process.exit(1);
}

// 2. Build do frontend
console.log('🔨 Fazendo build do frontend...');
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Erro no build do frontend:', error.message);
  process.exit(1);
}

// 3. Verificar se os ficheiros necessários existem
const requiredFiles = [
  'package.json',
  'server/index.ts',
  'dist/index.html',
  'ecosystem.config.js'
];

console.log('✅ Verificando ficheiros necessários...');
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Ficheiro necessário não encontrado: ${file}`);
    process.exit(1);
  }
}

// 4. Criar directório de logs se não existir
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log('📁 Directório de logs criado');
}

console.log('✅ Aplicação pronta para deployment!');
console.log('');
console.log('📋 Próximos passos:');
console.log('1. Copiar todos os ficheiros para o servidor');
console.log('2. Executar: npm install --production');
console.log('3. Copiar .env.example para .env e configurar');
console.log('4. Executar: pm2 start ecosystem.config.js');
console.log('5. Executar: pm2 save && pm2 startup');