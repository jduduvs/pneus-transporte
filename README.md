# MAINTIX

Sistema de gestão de pneus para uma organização. Todos os usuários ativos
compartilham os mesmos equipamentos e pneus. O modo atual continua usando
IndexedDB enquanto a configuração do Supabase estiver vazia. A integração
compartilhada usa Supabase Auth e PostgreSQL com Row Level Security (RLS).

## Preparar a base compartilhada

1. Crie um projeto no Supabase.
2. No SQL Editor do projeto, execute `supabase/schema.sql`.
3. Crie um usuário inicial em **Authentication → Users**.
4. No SQL Editor, torne esse primeiro usuário administrador e informe os dados
   de perfil:

   ```sql
   update public.profiles
   set role = 'admin',
       nome = 'NOME DO ADMINISTRADOR',
       matricula = 'MATRICULA_DO_ADMINISTRADOR'
   where email = 'email-do-admin@exemplo.com';
   ```

5. Em **Authentication → Providers → Email**, desative o cadastro público.
   Usuários novos devem ser convidados por um administrador. Configure um
   provedor SMTP próprio para envio confiável de convites em produção.
6. Copie a URL do projeto e a chave **publishable** (ou a chave pública `anon`)
   para `js/supabase-config.js`:

   ```js
   window.MAINTIX_SUPABASE_CONFIG = Object.freeze({
       url: "https://SEU-PROJETO.supabase.co",
       publishableKey: "SUA_CHAVE_PUBLICA"
   });
   ```

   Nunca coloque a `service_role` key no navegador ou no código do MAINTIX.
   A chave publicável pode ficar no cliente porque o acesso aos dados é
   protegido pelas políticas RLS instaladas pelo schema.
7. Instale o Supabase CLI. Se necessário, inicialize-o na pasta do projeto,
   autentique-se e associe a pasta ao projeto:

   ```powershell
   supabase init
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   ```

8. Publique a Edge Function de convite `criar-usuario` com Supabase CLI:

   ```powershell
   supabase functions deploy criar-usuario
   ```

   O Supabase disponibiliza as chaves da API no ambiente da função. Não
   cadastre nem exponha uma chave `service_role`/secret no site.

9. Sirva o site por HTTP(S) local ou por uma hospedagem estática. Evite abrir
   o `index.html` diretamente por `file://` para usar recursos online.

### Publicar no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` publica automaticamente o
site a cada envio para a branch `main`. Para ativá-lo:

1. Crie um repositório GitHub e envie o conteúdo desta pasta (`maintix`) para a
   raiz do repositório, incluindo o diretório `.github`.
2. No GitHub, abra **Settings → Pages** e escolha **GitHub Actions** como
   origem da publicação.
3. Envie um commit para `main` ou execute **Actions → Deploy MAINTIX to GitHub
   Pages → Run workflow**. Aguarde o workflow concluir e abra o endereço
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
4. No Supabase, em **Authentication → URL Configuration**, defina `Site URL`
   como o endereço acima e adicione esse endereço e
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/**` em `Redirect URLs`.
   Convites e outros links de autenticação usarão essas URLs.
5. Abra o endereço publicado nos dois computadores e entre com contas ativas
   do Supabase. Os usuários locais do IndexedDB não são contas compartilhadas:
   um administrador deve convidar cada pessoa pelo MAINTIX.

O endereço do GitHub Pages e a tela de login ficam acessíveis pela internet;
somente contas ativas autenticadas podem consultar ou alterar os dados, que
continuam protegidos pelo Supabase e suas políticas RLS. O código do site e a
chave publicável do Supabase são enviados ao navegador; nunca inclua uma chave
`service_role` ou outra chave secreta no repositório ou no frontend.

## Migração do navegador

Depois de conectar a aplicação ao Supabase e entrar com o usuário
administrador, use a opção de importação para enviar equipamentos, pneus,
posições, movimentações e recapagens do IndexedDB deste navegador. A importação
usa os IDs existentes como chave, preserva registros que já estejam na base e
pode ser repetida sem duplicar os mesmos registros. A importação não é uma
transação única: se falhar no meio, corrija a causa e repita-a. Os usuários locais não são importados: cada pessoa deve receber um
convite e definir sua senha no Supabase Auth.

O IndexedDB original não é apagado pela migração. Faça uma cópia/exportação dos
dados antes de importar. Os dados remotos só ficam sincronizados entre
computadores depois que a aplicação estiver configurada e usando o Supabase.

## Arquivar registros

Pneus, equipamentos, posições, movimentações e recapagens podem ser arquivados
sem apagar seus dados ou vínculos. Os registros arquivados deixam de aparecer
nas telas operacionais e ficam disponíveis em **Arquivados** para restauração.
No Supabase, somente administradores podem arquivar ou restaurar; o banco
também impede arquivar pneus aplicados, posições ocupadas ou equipamentos com
pneus instalados. No modo local, as contas não têm perfis ou níveis de acesso,
portanto qualquer usuário autenticado nesse navegador pode usar o arquivo.

Para habilitar esse recurso em uma base Supabase existente, execute novamente
`supabase/schema.sql` no SQL Editor. As colunas de arquivamento são adicionadas
sem remover os registros atuais.

## Ficha de posição do equipamento

Em **Equipamentos → Ver posições**, use **Gerar ficha PDF** para abrir a ficha
de impressão do equipamento selecionado. Na janela de impressão do navegador,
escolha **Salvar como PDF**. A ficha inclui os dados do equipamento, o mapa
atual das posições e duas tabelas em branco para registrar pneus retirados e
aplicados, compactadas em sequência para aproveitar melhor a página impressa.

O layout **Caminhão 6×6 — 12 posições** considera quatro eixos: um pneu por
lado nos eixos dianteiro e bitruck, e dois pneus por lado em cada um dos dois
eixos traseiros. Equipamentos já cadastrados com as 10 posições antigas mantêm
seus códigos, posições instaladas e layout legado; somente novos equipamentos
usam automaticamente as 12 posições. Não é feita remarcação automática dos
registros existentes.
