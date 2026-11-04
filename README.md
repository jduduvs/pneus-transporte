# MAINTIX

Sistema de gestão de pneus. Por padrão, abre sem login e guarda os dados no
IndexedDB do navegador atual. Cada computador e navegador tem uma base
separada; os dados não são compartilhados. A integração opcional com Supabase
permite compartilhar os dados, mas requer autenticação e políticas de segurança
RLS.

O modo sem login é adequado somente para dados que podem ser acessados por
qualquer pessoa que use o mesmo navegador neste computador. O endereço do site
é público; não use esse modo para informações que precisem de controle de
acesso.

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
   para `js/supabase-config.js` e habilite o modo compartilhado:

   ```js
   window.MAINTIX_SUPABASE_CONFIG = Object.freeze({
       enabled: true,
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
5. Na configuração padrão, o site abre sem login, mas cada navegador armazena
   seus próprios dados localmente. Para compartilhar uma base entre
   computadores, configure o Supabase conforme as instruções acima; nesse modo,
   cada pessoa precisa entrar com uma conta ativa.

O endereço do GitHub Pages é público. No modo local sem login, os dados não são
enviados ao Supabase nem sincronizados, mas qualquer pessoa que use o mesmo
navegador neste computador pode consultar e alterar os registros locais. No
modo Supabase, os dados compartilhados são protegidos por autenticação e RLS.
Nunca inclua uma chave `service_role` ou outra chave secreta no repositório ou
no frontend.

## Migração do navegador

Depois de habilitar o Supabase e entrar com o usuário administrador, use a
opção de importação para enviar equipamentos, pneus,
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
pneus instalados. No modo local sem login, qualquer pessoa que use o mesmo
navegador pode arquivar ou restaurar registros.

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
