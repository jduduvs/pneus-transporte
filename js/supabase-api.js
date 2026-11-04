"use strict";

(function configurarApiSupabase() {
    const config = window.MAINTIX_SUPABASE_CONFIG || {};
    const temConfiguracao = Boolean(config.url || config.publishableKey);
    const configuracaoCompleta = Boolean(config.url && config.publishableKey);
    const cliente = configuracaoCompleta && window.supabase?.createClient
        ? window.supabase.createClient(config.url, config.publishableKey)
        : null;
    const tabelasImportaveis = [
        ["equipamentos", "equipamentos"],
        ["pneus", "pneus"],
        ["posicoes", "posicoes"],
        ["movimentacoes", "movimentacoes"],
        ["recapagens", "recapagens"]
    ];

    function paraColuna(nome) {
        return nome.replace(/[A-Z]/g, letra => "_" + letra.toLowerCase());
    }

    function paraPropriedade(nome) {
        return nome.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());
    }

    function converterLinhaParaBanco(registro) {
        const linha = {};

        Object.entries(registro).forEach(([chave, valor]) => {
            const coluna = paraColuna(chave);
            linha[coluna] = [
                "data_entrada",
                "data_movimentacao",
                "data_envio",
                "data_retorno"
            ].includes(coluna) && valor === "" ? null : valor;
        });

        return linha;
    }

    function converterLinhaDoBanco(linha) {
        return Object.fromEntries(
            Object.entries(linha).map(([chave, valor]) => [
                paraPropriedade(chave),
                valor
            ])
        );
    }

    function garantirConfigurado() {
        if (!cliente) {
            throw new Error(
                "Configure o URL e a chave publicável do Supabase em js/supabase-config.js."
            );
        }
    }

    async function verificarResposta(requisicao) {
        const { data, error } = await requisicao;
        if (error) throw error;
        return data;
    }

    async function listar(tabela) {
        garantirConfigurado();
        const tamanhoPagina = 1000;
        const linhasCompletas = [];

        for (let inicio = 0; ; inicio += tamanhoPagina) {
            const pagina = await verificarResposta(
                cliente.from(tabela)
                    .select("*")
                    .range(inicio, inicio + tamanhoPagina - 1)
            );
            linhasCompletas.push(...pagina);
            if (pagina.length < tamanhoPagina) break;
        }

        return linhasCompletas.map(converterLinhaDoBanco);
    }

    async function buscar(tabela, id) {
        garantirConfigurado();
        const linha = await verificarResposta(
            cliente.from(tabela).select("*").eq("id", id).maybeSingle()
        );
        return linha ? converterLinhaDoBanco(linha) : undefined;
    }

    async function inserir(tabela, registro) {
        garantirConfigurado();
        const linha = await verificarResposta(
            cliente.from(tabela)
                .insert(converterLinhaParaBanco(registro))
                .select("*")
                .single()
        );
        return converterLinhaDoBanco(linha);
    }

    async function atualizar(tabela, registro) {
        garantirConfigurado();
        const linha = await verificarResposta(
            cliente.from(tabela)
                .upsert(converterLinhaParaBanco(registro), { onConflict: "id" })
                .select("*")
                .single()
        );
        return converterLinhaDoBanco(linha);
    }

    async function inserirVarios(
        tabela,
        registros,
        { manterExistentes = false } = {}
    ) {
        garantirConfigurado();
        if (!registros.length) return 0;

        const tamanhoLote = 250;
        for (let inicio = 0; inicio < registros.length; inicio += tamanhoLote) {
            await verificarResposta(
                cliente.from(tabela).upsert(
                    registros
                        .slice(inicio, inicio + tamanhoLote)
                        .map(converterLinhaParaBanco),
                    {
                        onConflict: "id",
                        ignoreDuplicates: manterExistentes
                    }
                )
            );
        }
        return registros.length;
    }

    async function criarEquipamentoComPosicoes(equipamento, posicoes) {
        garantirConfigurado();
        return verificarResposta(
            cliente.rpc("criar_equipamento_com_posicoes", {
                p_equipamento: converterLinhaParaBanco(equipamento),
                p_posicoes: posicoes.map(converterLinhaParaBanco)
            })
        );
    }

    async function instalarPneu({
        idPneu,
        idEquipamento,
        idPosicao,
        idMovimentacao,
        data
    }) {
        garantirConfigurado();
        return verificarResposta(
            cliente.rpc("instalar_pneu", {
                p_id_pneu: idPneu,
                p_id_equipamento: idEquipamento,
                p_id_posicao: idPosicao,
                p_id_movimentacao: idMovimentacao,
                p_data: data
            })
        );
    }

    async function retirarPneu({
        idEquipamento,
        idPosicao,
        idMovimentacao,
        data,
        motivo,
        statusAposRetirada
    }) {
        garantirConfigurado();
        return verificarResposta(
            cliente.rpc("retirar_pneu", {
                p_id_equipamento: idEquipamento,
                p_id_posicao: idPosicao,
                p_id_movimentacao: idMovimentacao,
                p_data: data,
                p_motivo: motivo,
                p_status_apos_retirada: statusAposRetirada
            })
        );
    }

    async function obterPerfil(idUsuario) {
        garantirConfigurado();
        const perfil = await verificarResposta(
            cliente.from("profiles")
                .select("id, email, nome, matricula, role")
                .eq("id", idUsuario)
                .maybeSingle()
        );
        return perfil;
    }

    async function ehAdministrador() {
        garantirConfigurado();
        const { data, error } = await cliente.auth.getSession();
        if (error) throw error;
        const usuario = data.session?.user;
        if (!usuario) return false;
        const perfil = await obterPerfil(usuario.id);
        return perfil?.role === "admin";
    }

    async function alterarArquivamento(tabela, id, arquivar) {
        garantirConfigurado();
        return verificarResposta(
            cliente.rpc("alterar_arquivamento", {
                p_tabela: tabela,
                p_id: id,
                p_arquivar: arquivar
            })
        );
    }

    async function importarIndexedDB() {
        garantirConfigurado();

        const { data: sessaoData, error: erroSessao } =
            await cliente.auth.getSession();
        if (erroSessao) throw erroSessao;

        const usuario = sessaoData.session?.user;
        if (!usuario) {
            throw new Error("Entre no sistema para importar os dados locais.");
        }

        const perfil = await obterPerfil(usuario.id);
        if (perfil?.role !== "admin") {
            throw new Error("Somente um administrador pode importar dados locais.");
        }

        const registros = await new Promise((resolve, reject) => {
            const requisicao = indexedDB.open("MAINTIX_DB");

            requisicao.onerror = () => reject(requisicao.error);
            requisicao.onsuccess = () => {
                const bancoLocal = requisicao.result;
                const tabelasDisponiveis = tabelasImportaveis.filter(
                    ([nomeLocal]) => bancoLocal.objectStoreNames.contains(nomeLocal)
                );

                if (!tabelasDisponiveis.length) {
                    bancoLocal.close();
                    resolve([]);
                    return;
                }

                const transacao = bancoLocal.transaction(
                    tabelasDisponiveis.map(([nomeLocal]) => nomeLocal),
                    "readonly"
                );
                const resultado = {};

                tabelasDisponiveis.forEach(([nomeLocal, nomeRemoto]) => {
                    const requisicaoStore = transacao
                        .objectStore(nomeLocal)
                        .getAll();
                    requisicaoStore.onsuccess = () => {
                        resultado[nomeRemoto] = requisicaoStore.result || [];
                    };
                    requisicaoStore.onerror = () => reject(requisicaoStore.error);
                });

                transacao.oncomplete = () => {
                    bancoLocal.close();
                    resolve(resultado);
                };
                transacao.onerror = () => {
                    bancoLocal.close();
                    reject(transacao.error);
                };
                transacao.onabort = () => {
                    bancoLocal.close();
                    reject(transacao.error || new Error(
                        "A leitura dos dados locais foi cancelada."
                    ));
                };
            };
        });

        const importados = {};
        for (const [nomeLocal, nomeRemoto] of tabelasImportaveis) {
            importados[nomeLocal] = await inserirVarios(
                nomeRemoto,
                registros[nomeRemoto] || [],
                { manterExistentes: true }
            );
        }

        return importados;
    }

    window.maintixApi = Object.freeze({
        isConfigured: temConfiguracao,
        client: cliente,
        listar,
        buscar,
        inserir,
        atualizar,
        inserirVarios,
        criarEquipamentoComPosicoes,
        instalarPneu,
        retirarPneu,
        obterPerfil,
        ehAdministrador,
        alterarArquivamento,
        importarIndexedDB
    });
})();
