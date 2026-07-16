# Shinobi RPG

Aplicação web local para uma mesa de RPG inspirada em ninjas. O backend usa apenas Node.js nativo: contas com senha derivada por `scrypt`, sessões aleatórias em memória e autorização no servidor para fichas, notas e painel de mestre.

## Executar

1. Instale o Node.js 20 ou superior.
2. Crie `.env.local` com base em `.env.example` e defina `MASTER_CODE` e `ADMIN_CODE` como códigos longos e exclusivos. A chave `OPENAI_API_KEY` já é lida desse arquivo quando configurada.
3. Execute `npm start` e abra `http://localhost:3000`.

## Papéis

- **Player:** cria e vê somente a própria ficha.
- **Mestre:** vê todas as fichas, publica crônicas e guarda notas secretas.
- **Administrador:** tem acesso do mestre e pode abrir sessões de demonstração player/mestre.

## Segurança e produção

Esta é uma base local de campanha. Antes de publicar, use banco de dados com migrações, sessões persistentes/expiráveis, HTTPS, rate limiting, validação CSRF, auditoria de ações administrativas e um provedor de identidade. Não publique os arquivos `data/store.json` ou `.env.local`.
