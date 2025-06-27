# Guia de Deployment - Sistema de Ponto WhatsApp

## Pré-requisitos no Servidor

1. **Node.js** (versão 18 ou superior)
2. **NPM** ou **Yarn**
3. **PostgreSQL** ou **SQLite** (já configurado para SQLite)
4. **PM2** (para manter a aplicação a correr)

## Passos para Deployment

### 1. Preparar os ficheiros
```bash
# No seu computador local, fazer download de todos os ficheiros do projeto
# Copiar para o servidor via FTP, SCP ou Git
```

### 2. Instalar dependências no servidor
```bash
cd /caminho/para/o/projeto
npm install
```

### 3. Configurar variáveis de ambiente
Criar ficheiro `.env` na raiz do projeto:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./database.sqlite
```

### 4. Fazer build da aplicação
```bash
npm run build
```

### 5. Instalar PM2 (gestor de processos)
```bash
npm install -g pm2
```

### 6. Criar ficheiro de configuração PM2
Criar `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-ponto',
    script: './server/index.ts',
    interpreter: 'node',
    interpreter_args: '--loader tsx',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### 7. Iniciar a aplicação
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. Configurar Nginx (opcional, mas recomendado)
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Comandos Úteis PM2

```bash
# Ver status das aplicações
pm2 status

# Ver logs
pm2 logs whatsapp-ponto

# Reiniciar aplicação
pm2 restart whatsapp-ponto

# Parar aplicação
pm2 stop whatsapp-ponto

# Apagar aplicação
pm2 delete whatsapp-ponto
```

## Notas Importantes

1. **Base de Dados**: Por defeito usa SQLite (ficheiro local). Se quiser PostgreSQL, altere a `DATABASE_URL`
2. **WhatsApp**: Terá de autenticar novamente o WhatsApp no servidor
3. **Portas**: Certifique-se que a porta 3000 está disponível ou altere no `.env`
4. **Firewall**: Abrir a porta no firewall do servidor
5. **SSL**: Para produção, configurar HTTPS com certificado SSL

## Estrutura de Ficheiros para Upload
Fazer upload de todos estes ficheiros/pastas:
- `client/` (toda a pasta)
- `server/` (toda a pasta)  
- `shared/` (toda a pasta)
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `drizzle.config.ts`
- `postcss.config.js`