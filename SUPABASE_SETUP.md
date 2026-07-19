# Configurar o site seguro no Supabase

1. Crie um projeto em [Supabase](https://supabase.com), abra o **SQL Editor** e execute `supabase/schema.sql` após substituir os dois códigos de exemplo por valores longos e secretos.
2. Em **Authentication > Providers**, mantenha e-mail habilitado. Em **URL Configuration**, adicione `https://yuri-mirus.github.io/RPG-DE-NARUTO/` como URL do site e de redirecionamento.
3. Em **Settings > API**, copie a URL do projeto e a chave `anon` para `public/supabase-config.js`. Essa chave pode ser pública.
4. Instale a CLI do Supabase e publique a função: `supabase functions deploy ask-sensei`.
5. No painel do Supabase, defina o segredo: `supabase secrets set OPENAI_API_KEY=...`. Use uma chave exclusiva do projeto; nunca coloque essa chave no GitHub.
6. Em GitHub, abra **Settings > Pages**, selecione **GitHub Actions** como fonte. O workflow publica o conteúdo de `public/`.
