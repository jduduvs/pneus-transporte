"use strict";

(function configurarAutenticacaoLocal() {
    const nomeBanco = "MAINTIX_DB";
    const versaoBanco = 8;
    const nomeTabelaUsuarios = "usuarios";
    const iteracoesDerivacao = 310000;
    const tentativasMaximas = 5;
    const tempoBloqueioMs = 30000;
    const telasAplicacao = [
        document.querySelector(".topbar"),
        document.getElementById("btnAlternarMenu"),
        document.getElementById("menuLateral"),
        document.querySelector("main")
    ].filter(Boolean);

    const telaAuth = document.getElementById("authScreen");
    const tituloAuth = document.getElementById("authTitle");
    const descricaoAuth = document.getElementById("authDescription");
    const mensagemAuth = document.getElementById("mensagemAuthLocal");
    const formularioLogin = document.getElementById("formLoginLocal");
    const formularioCadastro = document.getElementById("formCadastroUsuarioLocal");
    const botaoEntrar = document.getElementById("btnEntrarLocal");
    const botaoCadastrar = document.getElementById("btnSalvarUsuarioLocal");
    const botaoAdicionarUsuario =
        document.getElementById("btnAdicionarUsuarioLocal");
    const botaoEncerrarSessao =
        document.getElementById("btnEncerrarSessaoLocal");
    const nomeUsuarioSessao =
        document.getElementById("usuarioSessaoNome");

    let usuarioSessao = null;
    let modoAuth = "carregando";
    let tentativasFalhas = 0;
    let bloqueadoAte = 0;
    const apiSupabase = window.maintixApi;
    const config = window.MAINTIX_SUPABASE_CONFIG || {};

    if (config.accessMode === "local-open") {
        telaAuth.hidden = true;
        telaAuth.removeAttribute("aria-modal");
        definirTelasAplicacaoInertes(false);
        document.body.classList.add("autenticado");
        nomeUsuarioSessao.hidden = true;
        botaoAdicionarUsuario.hidden = true;
        botaoEncerrarSessao.hidden = true;
        document.getElementById("btnImportarDadosLocais").hidden = true;
        document.getElementById("btnMenuArquivados").hidden = false;
        document.getElementById("avisoAutenticacao").textContent =
            "Acesso sem login. Os dados ficam somente neste navegador e não são compartilhados entre computadores.";
        return;
    }

    if (apiSupabase?.isConfigured) {
        configurarAutenticacaoSupabase();
        return;
    }

    function configurarAutenticacaoSupabase() {
        const formularioEmail = document.getElementById("loginEmailGroup");
        const grupoMatricula = document
            .getElementById("loginMatricula")
            .closest(".form-group");
        const campoEmail = document.getElementById("loginEmail");
        const campoEmailNovo = document.getElementById("novoUsuarioEmail");
        const grupoEmailNovo = document.getElementById("novoUsuarioEmailGroup");
        const botaoImportar = document.getElementById("btnImportarDadosLocais");
        const mensagemSessao = document.getElementById("mensagemImportacaoDados");
        document.getElementById("avisoAutenticacao").textContent =
            "Acesso compartilhado pelo Supabase. Cada computador precisa de internet; os dados ficam na base PostgreSQL da organização.";

        if (!apiSupabase.client) {
            mostrarFalhaSupabase(
                "A configuração do Supabase está incompleta ou a biblioteca não carregou. Confira URL, chave publicável e conexão."
            );
            return;
        }

        formularioEmail.hidden = false;
        formularioLogin.querySelector("#loginMatricula").required = false;
        campoEmail.required = true;
        grupoMatricula.hidden = true;
        grupoEmailNovo.hidden = false;
        campoEmailNovo.required = true;
        mensagemAuth.textContent =
            "A autenticação compartilhada usa contas administradas no Supabase.";

        function bloquearInterface(inerte) {
            telasAplicacao.forEach(elemento => {
                elemento.inert = inerte;
                if (inerte) elemento.setAttribute("aria-hidden", "true");
                else elemento.removeAttribute("aria-hidden");
            });
        }

        function mostrarTelaAcesso(mensagem = "") {
            usuarioSessao = null;
            document.body.classList.remove("autenticado");
            telaAuth.hidden = false;
            telaAuth.setAttribute("aria-modal", "true");
            bloquearInterface(true);
            formularioLogin.hidden = false;
            formularioCadastro.hidden = true;
            tituloAuth.textContent = "Acesso ao sistema";
            descricaoAuth.textContent =
                "Entre com seu e-mail e senha cadastrados no MAINTIX.";
            mensagemAuth.textContent = mensagem;
            document.getElementById("usuarioSessaoNome").hidden = true;
            document.getElementById("btnAdicionarUsuarioLocal").hidden = true;
            botaoImportar.hidden = true;
            document.getElementById("btnEncerrarSessaoLocal").hidden = true;
            document.getElementById("btnMenuArquivados").hidden = true;
        }

        function mostrarFalhaSupabase(mensagem) {
            mostrarTelaAcesso(mensagem);
            formularioLogin.hidden = true;
        }

        async function validarPerfil(usuario) {
            const perfil = await apiSupabase.obterPerfil(usuario.id);
            if (!perfil || !["admin", "operador"].includes(perfil.role)) {
                await apiSupabase.client.auth.signOut();
                throw new Error(
                    "Sua conta ainda não tem um perfil MAINTIX ativo. Solicite ajuda ao administrador."
                );
            }

            usuarioSessao = { ...perfil, email: usuario.email };
            telaAuth.hidden = true;
            telaAuth.removeAttribute("aria-modal");
            bloquearInterface(false);
            document.body.classList.add("autenticado");

            const nome = document.getElementById("usuarioSessaoNome");
            nome.textContent = perfil.nome || usuario.email;
            nome.hidden = false;
            document.getElementById("btnEncerrarSessaoLocal").hidden = false;
            const ehAdmin = perfil.role === "admin";
            document.getElementById("btnAdicionarUsuarioLocal").hidden = !ehAdmin;
            botaoImportar.hidden = !ehAdmin;
            document.getElementById("btnMenuArquivados").hidden = !ehAdmin;
            await Promise.all([
                atualizarIndicadores(),
                atualizarDashboardOperacional(),
                atualizarListaEquipamentos()
            ]);
        }

        formularioLogin.addEventListener("submit", async evento => {
            evento.preventDefault();
            botaoEntrar.disabled = true;
            mensagemAuth.textContent = "Validando acesso...";

            try {
                const { error } = await apiSupabase.client.auth.signInWithPassword({
                    email: campoEmail.value.trim(),
                    password: document.getElementById("loginSenha").value
                });
                if (error) throw error;
            } catch (erro) {
                console.error("Erro ao autenticar no Supabase:", erro);
                mensagemAuth.textContent =
                    "Não foi possível entrar. Confira o e-mail e a senha e tente novamente.";
            } finally {
                botaoEntrar.disabled = false;
            }
        });

        formularioCadastro.addEventListener("submit", async evento => {
            evento.preventDefault();
            botaoCadastrar.disabled = true;
            mensagemAuth.textContent = "Enviando convite...";

            try {
                const { error } =
                    await apiSupabase.client.functions.invoke("criar-usuario", {
                        body: {
                            nome: document.getElementById("novoUsuarioNome").value.trim(),
                            email: campoEmailNovo.value.trim(),
                            matricula: document.getElementById("novoUsuarioMatricula").value.trim()
                        }
                    });
                if (error) throw error;
                formularioCadastro.reset();
                formularioCadastro.hidden = true;
                formularioLogin.hidden = false;
                tituloAuth.textContent = "Acesso ao sistema";
                descricaoAuth.textContent =
                    "O convite foi enviado. O usuário deve definir a senha pelo e-mail recebido.";
                mensagemAuth.textContent = "Convite enviado com sucesso.";
            } catch (erro) {
                console.error("Erro ao convidar usuário:", erro);
                mensagemAuth.textContent =
                    erro.message || "Não foi possível enviar o convite.";
            } finally {
                botaoCadastrar.disabled = false;
            }
        });

        document.getElementById("btnAdicionarUsuarioLocal")
            .addEventListener("click", () => {
                tituloAuth.textContent = "Convidar usuário";
                descricaoAuth.textContent =
                    "Envie um convite seguro para o e-mail do novo usuário.";
                mensagemAuth.textContent = "";
                formularioLogin.hidden = true;
                formularioCadastro.hidden = false;
                campoEmailNovo.required = true;
                document.getElementById("novoUsuarioNome").focus();
                telaAuth.hidden = false;
                telaAuth.setAttribute("aria-modal", "true");
                bloquearInterface(true);
            });

        document.getElementById("btnEncerrarSessaoLocal")
            .addEventListener("click", async () => {
                const { error } = await apiSupabase.client.auth.signOut();
                if (error) {
                    console.error("Erro ao encerrar sessão:", error);
                    mensagemSessao.textContent =
                        "Não foi possível encerrar a sessão. Tente novamente.";
                    return;
                }
                document.body.classList.remove("autenticado");
                mostrarTelaAcesso();
            });

        botaoImportar.addEventListener("click", async () => {
            botaoImportar.disabled = true;
            mensagemSessao.textContent = "Importando dados deste navegador...";
            try {
                const resultado = await apiSupabase.importarIndexedDB();
                const total = Object.values(resultado)
                    .reduce((soma, quantidade) => soma + quantidade, 0);
                mensagemSessao.textContent = total
                    ? `${total} registros processados; os IDs já existentes foram preservados.`
                    : "Nenhum registro local encontrado para importar.";
                await Promise.all([
                    atualizarIndicadores(),
                    atualizarListaEquipamentos()
                ]);
            } catch (erro) {
                console.error("Erro ao importar dados locais:", erro);
                mensagemSessao.textContent =
                    erro.message || "Não foi possível importar os dados locais.";
            } finally {
                botaoImportar.disabled = false;
            }
        });

        apiSupabase.client.auth.onAuthStateChange((evento, sessao) => {
            if (evento === "SIGNED_OUT" || !sessao) {
                mostrarTelaAcesso();
                return;
            }
            if (evento === "SIGNED_IN") {
                validarPerfil(sessao.user).catch(erro => {
                    console.error("Erro ao carregar perfil:", erro);
                    mostrarFalhaSupabase(erro.message);
                });
            }
        });

        apiSupabase.client.auth.getSession().then(({ data, error }) => {
            if (error) throw error;
            if (data.session) return validarPerfil(data.session.user);
            mostrarTelaAcesso();
        }).catch(erro => {
            console.error("Erro ao inicializar sessão Supabase:", erro);
            mostrarFalhaSupabase(
                "Não foi possível verificar a sessão. Verifique a configuração do Supabase."
            );
        });
    }

    function normalizarMatricula(matricula) {
        return matricula.trim().toLocaleUpperCase("pt-BR");
    }

    function abrirBanco() {
        return new Promise((resolve, reject) => {
            const requisicao = indexedDB.open(nomeBanco, versaoBanco);
            let bloqueado = false;

            requisicao.onupgradeneeded = evento => {
                const banco = evento.target.result;
                const tabelas = [
                    ["pneus", "id"],
                    ["equipamentos", "id"],
                    ["posicoes", "id"],
                    ["movimentacoes", "id"],
                    ["recapagens", "id"],
                    [nomeTabelaUsuarios, "matricula"]
                ];

                tabelas.forEach(([nome, chave]) => {
                    if (!banco.objectStoreNames.contains(nome)) {
                        banco.createObjectStore(nome, { keyPath: chave });
                    }
                });
            };

            requisicao.onsuccess = () => {
                if (bloqueado) {
                    requisicao.result.close();
                    return;
                }
                resolve(requisicao.result);
            };
            requisicao.onerror = () => reject(requisicao.error);
            requisicao.onblocked = () => {
                bloqueado = true;
                reject(new Error(
                    "Feche outras abas do MAINTIX para atualizar o banco local."
                ));
            };
        });
    }

    async function listarUsuarios() {
        const banco = await abrirBanco();

        try {
            return await new Promise((resolve, reject) => {
                const transacao = banco.transaction(nomeTabelaUsuarios, "readonly");
                const requisicao = transacao.objectStore(nomeTabelaUsuarios).getAll();

                requisicao.onsuccess = () => resolve(requisicao.result || []);
                requisicao.onerror = () => reject(requisicao.error);
                transacao.onerror = () => reject(transacao.error);
            });
        } finally {
            banco.close();
        }
    }

    async function adicionarUsuario(usuario) {
        const banco = await abrirBanco();

        try {
            await new Promise((resolve, reject) => {
                const transacao = banco.transaction(nomeTabelaUsuarios, "readwrite");
                transacao.objectStore(nomeTabelaUsuarios).add(usuario);
                transacao.oncomplete = () => resolve();
                transacao.onerror = () => reject(transacao.error);
                transacao.onabort = () => reject(transacao.error);
            });
        } finally {
            banco.close();
        }
    }

    function bytesParaHexadecimal(bytes) {
        return Array.from(bytes, byte =>
            byte.toString(16).padStart(2, "0")
        ).join("");
    }

    function hexadecimalParaBytes(hexadecimal) {
        const bytes = new Uint8Array(hexadecimal.length / 2);
        for (let indice = 0; indice < bytes.length; indice++) {
            bytes[indice] = Number.parseInt(
                hexadecimal.slice(indice * 2, indice * 2 + 2),
                16
            );
        }
        return bytes;
    }

    async function derivarHashSenha(senha, salHexadecimal) {
        const material = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(senha),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const bits = await crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: hexadecimalParaBytes(salHexadecimal),
            iterations: iteracoesDerivacao,
            hash: "SHA-256"
        }, material, 256);

        return bytesParaHexadecimal(new Uint8Array(bits));
    }

    function compararHashes(hashCalculado, hashArmazenado) {
        if (hashCalculado.length !== hashArmazenado.length) return false;

        let diferenca = 0;
        for (let indice = 0; indice < hashCalculado.length; indice++) {
            diferenca |= hashCalculado.charCodeAt(indice) ^
                hashArmazenado.charCodeAt(indice);
        }
        return diferenca === 0;
    }

    function definirTelasAplicacaoInertes(inertes) {
        document.documentElement.style.overflowX = inertes ? "hidden" : "";
        telasAplicacao.forEach(elemento => {
            elemento.inert = inertes;
            if (inertes) {
                elemento.setAttribute("aria-hidden", "true");
            } else {
                elemento.removeAttribute("aria-hidden");
            }
        });
    }

    function mostrarModo(modo, textoMensagem = "") {
        modoAuth = modo;
        mensagemAuth.textContent = textoMensagem;
        telaAuth.hidden = false;
        telaAuth.setAttribute("aria-modal", "true");
        definirTelasAplicacaoInertes(true);

        const cadastro = modo === "primeiro-cadastro" || modo === "adicionar-usuario";
        formularioLogin.hidden = cadastro || modo === "carregando";
        formularioCadastro.hidden = !cadastro;

        if (modo === "primeiro-cadastro") {
            tituloAuth.textContent = "Criar primeiro usuário";
            descricaoAuth.textContent =
                "Cadastre o primeiro acesso local do MAINTIX.";
            botaoCadastrar.textContent = "Criar usuário e entrar";
        } else if (modo === "adicionar-usuario") {
            tituloAuth.textContent = "Adicionar usuário";
            descricaoAuth.textContent =
                "Crie um novo acesso local para este navegador.";
            botaoCadastrar.textContent = "Cadastrar usuário";
        } else if (modo === "login") {
            tituloAuth.textContent = "Acesso ao sistema";
            descricaoAuth.textContent =
                "Entre com sua matrícula e senha local.";
        } else {
            tituloAuth.textContent = "Preparando acesso local";
            descricaoAuth.textContent =
                "Verificando os usuários cadastrados neste navegador.";
        }
    }

    function liberarAplicacao(usuario) {
        usuarioSessao = usuario;
        telaAuth.hidden = true;
        telaAuth.removeAttribute("aria-modal");
        definirTelasAplicacaoInertes(false);
        document.body.classList.add("autenticado");
        nomeUsuarioSessao.textContent = usuario.nome;
        nomeUsuarioSessao.hidden = false;
        botaoAdicionarUsuario.hidden = false;
        botaoEncerrarSessao.hidden = false;
        document.getElementById("btnMenuArquivados").hidden = false;
    }

    function bloquearAplicacao() {
        usuarioSessao = null;
        formularioLogin.reset();
        formularioCadastro.reset();
        document.body.classList.remove("autenticado");
        nomeUsuarioSessao.hidden = true;
        botaoAdicionarUsuario.hidden = true;
        botaoEncerrarSessao.hidden = true;
        mostrarModo("login");
        document.getElementById("loginMatricula").focus();
    }

    async function salvarUsuario(dados) {
        const matricula = normalizarMatricula(dados.matricula);
        const nome = dados.nome.trim();
        const senha = dados.senha;

        if (nome.length < 2 || !matricula) {
            throw new Error("Informe nome e matrícula válidos.");
        }

        if (senha.length < 8) {
            throw new Error("A senha local deve ter pelo menos 8 caracteres.");
        }

        if (senha !== dados.confirmarSenha) {
            throw new Error("As senhas informadas não coincidem.");
        }

        const usuarios = await listarUsuarios();
        if (usuarios.some(usuario =>
            normalizarMatricula(usuario.matricula) === matricula
        )) {
            throw new Error("Já existe um usuário cadastrado com essa matrícula.");
        }

        const sal = crypto.getRandomValues(new Uint8Array(16));
        const salHexadecimal = bytesParaHexadecimal(sal);
        const hashSenha = await derivarHashSenha(senha, salHexadecimal);

        await adicionarUsuario({
            matricula,
            nome,
            sal: salHexadecimal,
            hashSenha,
            algoritmo: "PBKDF2-SHA-256",
            iteracoes: iteracoesDerivacao,
            criadoEm: new Date().toISOString()
        });

        return { matricula, nome };
    }

    formularioLogin.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (Date.now() < bloqueadoAte) {
            mensagemAuth.textContent =
                "Muitas tentativas. Aguarde 30 segundos antes de tentar novamente.";
            return;
        }

        botaoEntrar.disabled = true;
        mensagemAuth.textContent = "Validando acesso...";

        try {
            const matricula = normalizarMatricula(
                document.getElementById("loginMatricula").value
            );
            const senha = document.getElementById("loginSenha").value;
            const usuarios = await listarUsuarios();
            const usuario = usuarios.find(item =>
                normalizarMatricula(item.matricula) === matricula
            );
            const sal = usuario?.sal || "00000000000000000000000000000000";
            const hashCalculado = await derivarHashSenha(senha, sal);

            if (!usuario || !compararHashes(hashCalculado, usuario.hashSenha)) {
                tentativasFalhas++;
                if (tentativasFalhas >= tentativasMaximas) {
                    bloqueadoAte = Date.now() + tempoBloqueioMs;
                    tentativasFalhas = 0;
                }
                mensagemAuth.textContent =
                    "Matrícula ou senha inválida. Verifique os dados e tente novamente.";
                return;
            }

            tentativasFalhas = 0;
            formularioLogin.reset();
            liberarAplicacao(usuario);
        } catch (erro) {
            console.error("Erro ao validar acesso local:", erro);
            mensagemAuth.textContent =
                "Não foi possível validar o acesso. Verifique o banco local e tente novamente.";
        } finally {
            botaoEntrar.disabled = false;
        }
    });

    formularioCadastro.addEventListener("submit", async evento => {
        evento.preventDefault();
        botaoCadastrar.disabled = true;
        mensagemAuth.textContent = "Salvando usuário...";

        try {
            const usuario = await salvarUsuario({
                nome: document.getElementById("novoUsuarioNome").value,
                matricula: document.getElementById("novoUsuarioMatricula").value,
                senha: document.getElementById("novoUsuarioSenha").value,
                confirmarSenha:
                    document.getElementById("confirmarUsuarioSenha").value
            });

            formularioCadastro.reset();
            if (modoAuth === "primeiro-cadastro") {
                liberarAplicacao(usuario);
            } else if (usuarioSessao) {
                liberarAplicacao(usuarioSessao);
            } else {
                mostrarModo("login", "Usuário cadastrado. Entre com matrícula e senha.");
            }
        } catch (erro) {
            if (erro.name === "ConstraintError") {
                mensagemAuth.textContent =
                    "Já existe um usuário cadastrado com essa matrícula.";
            } else {
                console.error("Erro ao cadastrar usuário local:", erro);
                mensagemAuth.textContent = erro.message ||
                    "Não foi possível cadastrar o usuário.";
            }
        } finally {
            botaoCadastrar.disabled = false;
        }
    });

    botaoAdicionarUsuario.addEventListener("click", () => {
        mostrarModo("adicionar-usuario");
        document.getElementById("novoUsuarioNome").focus();
    });

    botaoEncerrarSessao.addEventListener("click", bloquearAplicacao);

    async function inicializar() {
        mostrarModo("carregando");

        if (!crypto.subtle || !crypto.getRandomValues) {
            mostrarModo(
                "login",
                "Este navegador não oferece criptografia local segura. O acesso foi bloqueado."
            );
            formularioLogin.hidden = true;
            return;
        }

        try {
            const usuarios = await listarUsuarios();
            if (usuarios.length === 0) {
                mostrarModo("primeiro-cadastro");
                document.getElementById("novoUsuarioNome").focus();
            } else {
                mostrarModo("login");
                document.getElementById("loginMatricula").focus();
            }
        } catch (erro) {
            console.error("Erro ao inicializar autenticação local:", erro);
            mostrarModo(
                "login",
                "Não foi possível abrir o banco local. Feche outras abas do MAINTIX e tente novamente."
            );
            formularioLogin.hidden = true;
        }
    }

    inicializar();
})();
