# Deployment Rápido - Sistema de Ponto WhatsApp

## Para Servidor com PM2 Já Instalado

### 1. Fazer Upload dos Ficheiros
Copiar todos os ficheiros do projeto para o servidor:
```bash
# Estrutura necessária:
/caminho/para/whatsapp-ponto/
├── client/
├── server/
├── shared/
├── package.json
├── ecosystem.config.js
├── .env (criar baseado no .env.example)
└── outros ficheiros...
```

### 2. No Servidor
```bash
cd /caminho/para/whatsapp-ponto

# Instalar dependências
npm install --production

# Configurar ambiente
cp .env.example .env
nano .env  # Editar conforme necessário

# Fazer build
npm run build
```

### 3. Iniciar com PM2
```bash
# Iniciar aplicação
pm2 start ecosystem.config.js

# Ver status
pm2 status

# Ver logs
pm2 logs whatsapp-ponto

# Guardar configuração (para reiniciar automaticamente)
pm2 save
```

## Configuração .env Mínima
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:./database.sqlite
```

## Comandos PM2 Úteis
```bash
# Reiniciar
pm2 restart whatsapp-ponto

# Parar
pm2 stop whatsapp-ponto

# Ver detalhes
pm2 show whatsapp-ponto

# Ver logs em tempo real
pm2 logs whatsapp-ponto --lines 50
```

## Notas
- Aplicação corre na porta 3000 (configurável no .env)
- Base de dados SQLite é criada automaticamente
- WhatsApp precisa ser autenticado uma vez no servidor
- Todos os dados ficam persistentes