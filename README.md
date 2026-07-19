# Shinobi RPG

RPG entre amigos com GitHub Pages no frontend e Supabase para autenticação, banco de dados, regras de acesso e IA segura.

## Publicar

Siga [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Depois ative **Settings > Pages > GitHub Actions** no repositório. O workflow publica automaticamente a pasta `public/` a cada atualização na `main`.

## Papéis

- **Player:** cria e vê somente a própria ficha.
- **Mestre:** vê todas as fichas, publica crônicas e guarda notas secretas.
- **Administrador:** tem acesso do mestre e pode abrir sessões de demonstração player/mestre.

## Segurança

As permissões ficam no banco por Row Level Security: players só acessam a própria ficha, mestre/admin podem consultar fichas e editar crônicas, e notas do mestre são invisíveis para players. A chave da OpenAI é segredo da função Supabase e não é enviada ao GitHub Pages.
