
"use strict";

function atualizarStatusConexao() {
    const indicador = document.getElementById("connectionStatus");
    const ponto = document.querySelector(".status-dot");

    if (!indicador || !ponto) {
        console.error("Elementos do indicador de conexão não encontrados.");
        return;
    }

    const remoto = Boolean(window.maintixApi?.isConfigured);
    const conectado = navigator.onLine && (!remoto || Boolean(window.maintixApi.client));

    indicador.textContent = conectado
        ? remoto ? "Supabase configurado" : "Armazenamento local"
        : "Sem conexão com a base";

    ponto.style.backgroundColor = conectado
        ? "#35d39a"
        : "#f2bd4b";

    console.info(
        `Status de rede: ${conectado ? "conectado" : "desconectado"}`
    );
}

window.addEventListener("online", atualizarStatusConexao);
window.addEventListener("offline", atualizarStatusConexao);

document.addEventListener("DOMContentLoaded", atualizarStatusConexao);



/* ==============================
   NAVEGAÇÃO DO MAINTIX
============================== */

const btnAbrirCadastro = document.getElementById("btnAbrirCadastro");
const btnVoltarPainel = document.getElementById("btnVoltarPainel");

const telaCadastro = document.getElementById("telaCadastro");
const secaoBoasVindas = document.querySelector(".welcome");
const secaoIndicadores = document.querySelector(".metrics");
const secaoModulos = document.querySelector(".module-section");

const btnMenuPainel = document.querySelector(
    '.sidebar-item[data-tela="painel"]'
);

const btnMenuCadastro = document.querySelector(
    '.sidebar-item[data-tela="cadastro"]'
);

function ocultarTelasInternas() {
    document.querySelectorAll('[id^="tela"]').forEach(function (tela) {
        tela.hidden = true;
    });
}

function atualizarMenuAtivo(tela) {
    document.querySelectorAll(".sidebar-item").forEach(function (botao) {
        const ativo = botao.dataset.tela === tela;

        botao.classList.toggle("active", ativo);
        botao.setAttribute("aria-current", ativo ? "page" : "false");
    });
}

function abrirTelaCadastro() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = false;

    atualizarMenuAtivo("cadastro");
}

function voltarAoPainel() {
    ocultarTelasInternas();

    secaoBoasVindas.hidden = false;
    secaoIndicadores.hidden = false;
    secaoModulos.hidden = false;

    atualizarMenuAtivo("painel");
}

if (btnAbrirCadastro) {
    btnAbrirCadastro.addEventListener("click", abrirTelaCadastro);
}

if (btnVoltarPainel) {
    btnVoltarPainel.addEventListener("click", voltarAoPainel);
}

if (btnMenuCadastro) {
    btnMenuCadastro.addEventListener("click", abrirTelaCadastro);
}

if (btnMenuPainel) {
    btnMenuPainel.addEventListener("click", voltarAoPainel);
}

// Estado inicial do menu
atualizarMenuAtivo("painel");



/* =====================================
   BANCO LOCAL E CADASTRO DE PNEUS
===================================== */

const nomeBanco = "MAINTIX_DB";
const versaoBanco = 8;
const nomeTabelaPneus = "pneus";

const STATUS_PNEU = Object.freeze({
    APLICADO: "APLICADO",
    CONSERTO_OFICINA: "CONSERTO_OFICINA",
    DESCARTE: "DESCARTE",
    PARA_RECAPE: "PARA_RECAPE",
    EM_RECAPE: "EM_RECAPE",
    RESERVA_PRONTA_UTILIZACAO: "RESERVA_PRONTA_UTILIZACAO"
});

const ROTULOS_STATUS_PNEU = Object.freeze({
    APLICADO: "Aplicado",
    CONSERTO_OFICINA: "Conserto oficina",
    DESCARTE: "Descarte",
    PARA_RECAPE: "Para recape",
    EM_RECAPE: "Em recape",
    RESERVA_PRONTA_UTILIZACAO: "Reserva pronta utilização"
});

const ROTULOS_ESTADO_PNEU = Object.freeze({
    NOVO: "Novo",
    RECAPADO: "Recapado",
    MEIA_VIDA: "Meia vida"
});

function obterStatusPneu(pneu) {
    const status = String(pneu?.status || "ESTOQUE").toUpperCase();
    const statusLegado = {
        ESTOQUE: STATUS_PNEU.RESERVA_PRONTA_UTILIZACAO,
        INSTALADO: STATUS_PNEU.APLICADO,
        MANUTENCAO: STATUS_PNEU.CONSERTO_OFICINA
    };

    return statusLegado[status] || status;
}

function formatarStatusPneu(pneu) {
    const status = obterStatusPneu(pneu);
    return ROTULOS_STATUS_PNEU[status] || status.replaceAll("_", " ");
}

function registrarEventoHistoricoPneu(pneu, tipo, valorAnterior, valor, dataRegistro) {
    if (valorAnterior === valor) return;

    if (!Array.isArray(pneu.historicoIdentificacoes)) {
        pneu.historicoIdentificacoes = [];
    }

    pneu.historicoIdentificacoes.push({
        tipo,
        valorAnterior: valorAnterior || "",
        valor,
        acao: valorAnterior ? "ALTERADO" : "DEFINIDO",
        dataRegistro
    });
}

function abrirBancoMAINTIX() {
    return new Promise((resolve, reject) => {
        const requisicao = indexedDB.open(nomeBanco, versaoBanco);


        requisicao.onupgradeneeded = function(evento) {
            const banco = evento.target.result;

            if (!banco.objectStoreNames.contains(nomeTabelaPneus)) {
                banco.createObjectStore(nomeTabelaPneus, { keyPath: "id" });
            }

            if (!banco.objectStoreNames.contains("equipamentos")) {
                banco.createObjectStore("equipamentos", { keyPath: "id" });
            }

            if (!banco.objectStoreNames.contains("posicoes")) {
                banco.createObjectStore("posicoes", { keyPath: "id" });
            }
            
            if (!banco.objectStoreNames.contains("movimentacoes")) {
                banco.createObjectStore("movimentacoes", { keyPath: "id" });
            }

            if (!banco.objectStoreNames.contains("recapagens")) {
                banco.createObjectStore("recapagens", { keyPath: "id" });
            }

            if (!banco.objectStoreNames.contains("usuarios")) {
                banco.createObjectStore("usuarios", { keyPath: "matricula" });
            }

        };


        requisicao.onsuccess = function () {
            resolve(requisicao.result);
        };

        requisicao.onerror = function () {
            reject(requisicao.error);
        };
    });
}

const TABELAS_ARQUIVAVEIS = Object.freeze([
    ["pneus", "Pneu"],
    ["equipamentos", "Equipamento"],
    ["posicoes", "Posição"],
    ["movimentacoes", "Movimentação"],
    ["recapagens", "Recapagem"]
]);

function filtrarRegistrosAtivos(registros) {
    return registros.filter(registro => !registro.arquivadoEm);
}

async function obterTodosRegistros(nomeStore) {
    if (window.maintixApi?.isConfigured) {
        return window.maintixApi.listar(nomeStore);
    }

    const banco = await abrirBancoMAINTIX();
    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction(nomeStore, "readonly");
            const requisicao = transacao.objectStore(nomeStore).getAll();
            requisicao.onsuccess = () => resolve(requisicao.result || []);
            requisicao.onerror = () => reject(requisicao.error);
            transacao.onerror = () => reject(transacao.error);
        });
    } finally {
        banco.close();
    }
}

async function usuarioPodeArquivar() {
    if (!window.maintixApi?.isConfigured) return true;
    return window.maintixApi.ehAdministrador();
}

async function alterarArquivamento(tabela, id, arquivar) {
    if (window.maintixApi?.isConfigured) {
        return window.maintixApi.alterarArquivamento(tabela, id, arquivar);
    }

    const tabelasDaTransacao = tabela === "pneus" || tabela === "equipamentos"
        ? [tabela, "posicoes"]
        : [tabela];
    const banco = await abrirBancoMAINTIX();
    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction(tabelasDaTransacao, "readwrite");
            const store = transacao.objectStore(tabela);
            const requisicao = store.get(id);
            let erroValidacao = null;
            let gravacaoConcluida = false;

            function concluirAtualizacao(registro) {
                if (!registro || gravacaoConcluida) return;
                gravacaoConcluida = true;

                if (
                    arquivar &&
                    tabela === "pneus" &&
                    obterStatusPneu(registro) === STATUS_PNEU.APLICADO
                ) {
                    erroValidacao = new Error(
                        "Retire o pneu do equipamento antes de arquivá-lo."
                    );
                    transacao.abort();
                    return;
                }

                if (arquivar && tabela === "posicoes" && registro.idPneuInstalado) {
                    erroValidacao = new Error(
                        "Retire o pneu da posição antes de arquivá-la."
                    );
                    transacao.abort();
                    return;
                }

                if (arquivar && (tabela === "pneus" || tabela === "equipamentos")) {
                    const requisicaoPosicoes = transacao
                        .objectStore("posicoes")
                        .getAll();
                    requisicaoPosicoes.onerror = () => {
                        erroValidacao = requisicaoPosicoes.error;
                        transacao.abort();
                    };
                    requisicaoPosicoes.onsuccess = () => {
                        const ocupada = requisicaoPosicoes.result.some(posicao =>
                            !posicao.arquivadoEm && posicao.idPneuInstalado &&
                            (tabela === "pneus"
                                ? posicao.idPneuInstalado === id
                                : posicao.idEquipamento === id)
                        );
                        if (ocupada) {
                            erroValidacao = new Error(
                                tabela === "pneus"
                                    ? "Retire o pneu do equipamento antes de arquivá-lo."
                                    : "Retire os pneus do equipamento antes de arquivá-lo."
                            );
                            transacao.abort();
                            return;
                        }
                        registro.arquivadoEm = arquivar
                            ? new Date().toISOString()
                            : null;
                        store.put(registro);
                    };
                    return;
                }

                registro.arquivadoEm = arquivar
                    ? new Date().toISOString()
                    : null;
                store.put(registro);
            }

            requisicao.onsuccess = () => concluirAtualizacao(requisicao.result);
            requisicao.onerror = () => {
                erroValidacao = requisicao.error;
                transacao.abort();
            };
            transacao.oncomplete = () => resolve();
            transacao.onerror = () => reject(erroValidacao || transacao.error);
            transacao.onabort = () => reject(
                erroValidacao || transacao.error || new Error("Operação cancelada.")
            );
        });
    } finally {
        banco.close();
    }
}

function criarBotaoArquivar(tabela, registro, desabilitado = false) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = "Arquivar";
    botao.disabled = desabilitado;
    botao.title = desabilitado
        ? "Retire o pneu antes de arquivar este registro."
        : "Mover para a área de arquivados";
    botao.addEventListener("click", async () => {
        const descricao = registro.tag || registro.id || "este registro";
        if (!window.confirm(`Arquivar ${descricao}? O registro poderá ser restaurado depois.`)) {
            return;
        }
        botao.disabled = true;
        try {
            await alterarArquivamento(tabela, registro.id, true);
        } catch (erro) {
            console.error("Erro ao arquivar registro:", erro);
            window.alert(erro.message || "Não foi possível arquivar o registro.");
            botao.disabled = false;
            return;
        }
        try {
            await atualizarTelaAtualAposArquivamento(tabela);
        } catch (erro) {
            console.error("Registro arquivado, mas a tela não foi atualizada:", erro);
            window.alert(
                "O registro foi arquivado, mas não foi possível atualizar a tela. Atualize a listagem."
            );
        }
    });
    return botao;
}

async function atualizarTelaAtualAposArquivamento(tabela) {
    if (tabela === "pneus") {
        if (!telaListaPneus.hidden) await listarPneus();
        if (!telaDescarte.hidden) await listarPneusDescarte();
        await atualizarIndicadores();
    } else if (tabela === "equipamentos") {
        await atualizarListaEquipamentos();
        await atualizarDashboardOperacional();
    } else if (tabela === "posicoes") {
        if (equipamentoSelecionadoParaInstalacao) {
            posicaoSelecionadaParaInstalacao = null;
            document.getElementById("painelInstalacaoPneu").hidden = true;
            document.getElementById("painelRetiradaPneu").hidden = true;
            await atualizarTabelaPosicoesEquipamento(equipamentoSelecionadoParaInstalacao);
        }
    } else if (tabela === "movimentacoes") {
        if (!telaHistoricoMovimentacoes.hidden) {
            await carregarHistoricoMovimentacoes();
        }
        if (!telaRelatorios.hidden) await consultarRelatorioMovimentacoes();
        await atualizarDashboardOperacional();
    } else if (tabela === "recapagens") {
        await atualizarDashboardOperacional();
        await document.getElementById("btnAtualizarRecapagens").click();
    }
}

function gerarIdInternoPneu() {
    if (crypto.randomUUID) {
        return "PNEU-" + crypto.randomUUID().toUpperCase();
    }

    return "PNEU-" +
        Date.now().toString(36).toUpperCase() +
        "-" +
        Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function salvarPneu(pneu) {
    if (window.maintixApi?.isConfigured) {
        return window.maintixApi.inserir("pneus", pneu);
    }

    const banco = await abrirBancoMAINTIX();

    return new Promise((resolve, reject) => {
        console.log(
            "Tabelas existentes no MAINTIX:",
            Array.from(banco.objectStoreNames)
        );
        const transacao = banco.transaction(
            nomeTabelaPneus,
            "readwrite"
        );

        const tabela = transacao.objectStore(nomeTabelaPneus);
        const requisicao = tabela.add(pneu);

        requisicao.onsuccess = function () {
            resolve(pneu);
        };

        requisicao.onerror = function () {
            reject(requisicao.error);
        };

        transacao.oncomplete = function () {
            banco.close();
        };

        transacao.onerror = function () {
            banco.close();
        };

        transacao.onabort = function () {
            banco.close();
        };
    });
}

/* =====================================
   EVENTO DE SALVAMENTO DO FORMULÁRIO
===================================== */

const formCadastroPneu = document.getElementById("formCadastroPneu");
const mensagemCadastro = document.getElementById("mensagemCadastro");

if (formCadastroPneu) {
    formCadastroPneu.addEventListener("submit", async function (evento) {
        evento.preventDefault();

        const botaoSalvar = document.getElementById("btnSalvarPneu");

        botaoSalvar.disabled = true;
        mensagemCadastro.textContent = "Salvando pneu...";

        const numeroFogo = document.getElementById("numeroFogo").value.trim();
        const dot = document.getElementById("dot").value.trim();
        const marca = document.getElementById("marcaPneu").value.trim();
        const modelo = document.getElementById("modeloPneu").value.trim();
        const medida = document.getElementById("medidaPneu").value.trim();
        const estado = document.getElementById("estadoPneu").value;
        const status = document.getElementById("statusPneu").value;
        const dataEntrada = document.getElementById("dataCompra").value;

        if (!estado || !status || status === STATUS_PNEU.APLICADO) {
            mensagemCadastro.textContent =
                "Selecione um estado e um status válido. O status Aplicado é definido ao instalar o pneu.";
            botaoSalvar.disabled = false;
            return;
        }

        const agora = new Date().toISOString();

        const pneu = {
            id: gerarIdInternoPneu(),
            numeroFogo: numeroFogo,
            dot: dot,
            marca: marca,
            modelo: modelo,
            medida: medida,
            estado: estado,
            dataEntrada: dataEntrada,
            status: status,
            criadoEm: agora,
            atualizadoEm: agora,

            historicoIdentificacoes: numeroFogo
                ? [{
                    tipo: "NUMERO_FOGO",
                    valor: numeroFogo,
                    dataRegistro: agora
                }]
                : []
        };

        registrarEventoHistoricoPneu(pneu, "ESTADO_PNEU", "", estado, agora);
        registrarEventoHistoricoPneu(pneu, "STATUS_PNEU", "", status, agora);

        try {
            await salvarPneu(pneu);

            mensagemCadastro.textContent =
                "Pneu cadastrado com sucesso! ID interno: " + pneu.id;

            formCadastroPneu.reset();

            console.log("Pneu cadastrado:", pneu);
        } catch (erro) {
            console.error("Erro ao salvar pneu:", erro);

            mensagemCadastro.textContent =
                "Não foi possível salvar o pneu. Verifique o navegador e tente novamente.";
        } finally {
            botaoSalvar.disabled = false;
        }
    });
}


/* =====================================
   LISTAGEM DE PNEUS
===================================== */

const telaListaPneus = document.getElementById("telaListaPneus");
const corpoTabelaPneus = document.getElementById("corpoTabelaPneus");
const mensagemListaPneus = document.getElementById("mensagemListaPneus");


async function obterTodosOsPneus() {
    return filtrarRegistrosAtivos(await obterTodosRegistros(nomeTabelaPneus));
}


async function listarPneus() {
    corpoTabelaPneus.replaceChildren();
    mensagemListaPneus.textContent = "Consultando pneus cadastrados...";

    let banco;

    try {
        let pneus;
        if (window.maintixApi?.isConfigured) {
            pneus = await obterTodosOsPneus();
        } else {
            banco = await abrirBancoMAINTIX();
            pneus = await new Promise((resolve, reject) => {
                const transacao = banco.transaction(nomeTabelaPneus, "readonly");
                const tabela = transacao.objectStore(nomeTabelaPneus);
                const requisicao = tabela.getAll();

                requisicao.onsuccess = () => resolve(requisicao.result);
                requisicao.onerror = () => reject(requisicao.error);
            });
        }
        pneus = filtrarRegistrosAtivos(pneus);

        if (pneus.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 9;
            celula.textContent = "Nenhum pneu cadastrado.";

            linha.appendChild(celula);
            corpoTabelaPneus.appendChild(linha);

            mensagemListaPneus.textContent = "";
            return;
        }

        pneus.sort((a, b) =>
            (a.id || "").localeCompare(b.id || "")
        );
        const podeArquivar = await usuarioPodeArquivar();

        pneus.forEach((pneu) => {
            const linha = document.createElement("tr");

            const valores = [
                pneu.id,
                pneu.numeroFogo || "Não informado",
                pneu.dot || "Não informado",
                pneu.marca,
                pneu.modelo,
                pneu.medida,
                ROTULOS_ESTADO_PNEU[pneu.estado] || "Não informado",
                formatarStatusPneu(pneu)
            ];

            valores.forEach((valor) => {
                const celula = document.createElement("td");
                celula.textContent = valor || "—";
                linha.appendChild(celula);
            });

            
            const celulaAcoes = document.createElement("td");


            const botaoEditar = document.createElement("button");
            botaoEditar.type = "button";
            botaoEditar.textContent = "Editar";
            botaoEditar.dataset.idPneu = pneu.id;
            botaoEditar.className = "btn-editar-pneu";

            const botaoHistorico = document.createElement("button");
            botaoHistorico.type = "button";
            botaoHistorico.textContent = "Histórico";
            botaoHistorico.dataset.idPneu = pneu.id;
            botaoHistorico.className = "btn-historico-pneu";

            celulaAcoes.appendChild(botaoEditar);
            celulaAcoes.appendChild(botaoHistorico);
            if (podeArquivar) {
                celulaAcoes.appendChild(
                    criarBotaoArquivar("pneus", pneu, obterStatusPneu(pneu) === STATUS_PNEU.APLICADO)
                );
            }

            linha.appendChild(celulaAcoes);



            corpoTabelaPneus.appendChild(linha);
        });

        mensagemListaPneus.textContent =
            "Total de pneus cadastrados: " + pneus.length;

    } catch (erro) {
        console.error("Erro ao consultar pneus:", erro);
        mensagemListaPneus.textContent =
            "Não foi possível consultar os pneus cadastrados.";
    } finally {
        if (banco) {
            banco.close();
        }
    }
}

/* =====================================
   NAVEGAÇÃO PARA A LISTAGEM
===================================== */

function abrirListaPneus() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = true;
    telaListaPneus.hidden = false;
    telaEditarPneu.hidden = true;
    telaHistoricoPneu.hidden = true;
    telaEquipamentos.hidden = true;
    telaHistoricoMovimentacoes.hidden = true;
    telaRelatorios.hidden = true;

    atualizarMenuAtivo("listaPneus");
    listarPneus();
}

function voltarAoCadastro() {
    telaListaPneus.hidden = true;
    telaCadastro.hidden = false;
}

function voltarAoPainelDaLista() {
    telaListaPneus.hidden = true;
    voltarAoPainel();
}

/* =====================================
   MÓDULO DE DESCARTE
===================================== */

const telaDescarte = document.getElementById("telaDescarte");
const corpoTabelaPneusDescarte =
    document.getElementById("corpoTabelaPneusDescarte");
const mensagemListaDescarte =
    document.getElementById("mensagemListaDescarte");
let origemHistoricoPneu = "listaPneus";

function formatarDataDescarte(valor, incluirHora = false) {
    if (!valor) return "Não registrado";

    const data = /^\d{4}-\d{2}-\d{2}$/.test(valor)
        ? new Date(
            Number(valor.slice(0, 4)),
            Number(valor.slice(5, 7)) - 1,
            Number(valor.slice(8, 10))
        )
        : new Date(valor);

    if (Number.isNaN(data.getTime())) return "Não registrado";

    return incluirHora
        ? data.toLocaleString("pt-BR")
        : data.toLocaleDateString("pt-BR");
}

function obterDataDescarte(pneu) {
    const eventos = Array.isArray(pneu.historicoIdentificacoes)
        ? pneu.historicoIdentificacoes.filter(registro =>
            registro.tipo === "STATUS_PNEU" &&
            String(registro.valor).toUpperCase() === STATUS_PNEU.DESCARTE &&
            registro.dataRegistro
        )
        : [];

    eventos.sort((a, b) =>
        new Date(b.dataRegistro).getTime() - new Date(a.dataRegistro).getTime()
    );

    return eventos[0]?.dataRegistro || "";
}

async function listarPneusDescarte() {
    corpoTabelaPneusDescarte.replaceChildren();
    mensagemListaDescarte.textContent = "Consultando pneus descartados...";

    try {
        const todosOsPneus = await obterTodosOsPneus();
        const pneusDescartados = todosOsPneus
            .filter(pneu => obterStatusPneu(pneu) === STATUS_PNEU.DESCARTE)
            .sort((a, b) =>
                (obterDataDescarte(b) || b.atualizadoEm || "")
                    .localeCompare(obterDataDescarte(a) || a.atualizadoEm || "")
            );

        document.getElementById("totalPneusDescarte").textContent =
            pneusDescartados.length;
        document.getElementById("percentualPneusDescarte").textContent =
            todosOsPneus.length
                ? (pneusDescartados.length / todosOsPneus.length * 100)
                    .toLocaleString("pt-BR", { maximumFractionDigits: 1 }) +
                    "% do inventário"
                : "0% do inventário";
        document.getElementById("descarteEstadoNovo").textContent =
            pneusDescartados.filter(pneu => pneu.estado === "NOVO").length;
        document.getElementById("descarteEstadoRecapado").textContent =
            pneusDescartados.filter(pneu => pneu.estado === "RECAPADO").length;
        document.getElementById("descarteEstadoMeiaVida").textContent =
            pneusDescartados.filter(pneu => pneu.estado === "MEIA_VIDA").length;

        if (!pneusDescartados.length) {
            const linha = corpoTabelaPneusDescarte.insertRow();
            const celula = linha.insertCell();
            celula.colSpan = 11;
            celula.textContent = "Nenhum pneu com status Descarte.";
            mensagemListaDescarte.textContent = "";
            return;
        }

        const podeArquivar = await usuarioPodeArquivar();
        pneusDescartados.forEach(pneu => {
            const linha = corpoTabelaPneusDescarte.insertRow();
            const valores = [
                pneu.id,
                pneu.numeroFogo || "Não informado",
                pneu.dot || "Não informado",
                pneu.marca || "Não informado",
                pneu.modelo || "Não informado",
                pneu.medida || "Não informado",
                ROTULOS_ESTADO_PNEU[pneu.estado] || "Não informado",
                formatarStatusPneu(pneu),
                formatarDataDescarte(pneu.dataEntrada),
                formatarDataDescarte(obterDataDescarte(pneu), true)
            ];

            valores.forEach(valor => {
                linha.insertCell().textContent = valor;
            });

            const celulaAcoes = linha.insertCell();
            const botaoHistorico = document.createElement("button");
            botaoHistorico.type = "button";
            botaoHistorico.textContent = "Histórico";
            botaoHistorico.className = "btn-historico-descarte";
            botaoHistorico.dataset.idPneu = pneu.id;
            celulaAcoes.appendChild(botaoHistorico);
            if (podeArquivar) {
                celulaAcoes.appendChild(criarBotaoArquivar("pneus", pneu));
            }
        });

        mensagemListaDescarte.textContent =
            "Total de pneus descartados: " + pneusDescartados.length;
    } catch (erro) {
        console.error("Erro ao consultar pneus descartados:", erro);
        mensagemListaDescarte.textContent =
            "Não foi possível carregar o inventário de pneus descartados.";
    }
}

function abrirTelaDescarte() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;
    telaDescarte.hidden = false;
    atualizarMenuAtivo("descarte");
    listarPneusDescarte();
}

const btnMenuDescarte = document.querySelector(
    '.sidebar-item[data-tela="descarte"]'
);

if (btnMenuDescarte) {
    btnMenuDescarte.addEventListener("click", abrirTelaDescarte);
}

document.getElementById("btnAtualizarDescarte")
    .addEventListener("click", listarPneusDescarte);

document.getElementById("btnVoltarPainelDescarte")
    .addEventListener("click", voltarAoPainel);

corpoTabelaPneusDescarte.addEventListener("click", evento => {
    const botao = evento.target.closest(".btn-historico-descarte");
    if (!botao) return;

    origemHistoricoPneu = "descarte";
    abrirHistoricoPneu(botao.dataset.idPneu);
});


const btnAtualizarLista = document.getElementById("btnAtualizarLista");
const btnVoltarCadastro = document.getElementById("btnVoltarCadastro");
const btnVoltarPainelLista = document.getElementById("btnVoltarPainelLista");

if (btnAtualizarLista) {
    btnAtualizarLista.addEventListener("click", listarPneus);
}

if (btnVoltarCadastro) {
    btnVoltarCadastro.addEventListener("click", voltarAoCadastro);
}

if (btnVoltarPainelLista) {
    btnVoltarPainelLista.addEventListener("click", voltarAoPainelDaLista);
}



/* =====================================
   ACESSOS À LISTAGEM DE PNEUS
===================================== */

const btnAbrirListaPneus =
    document.getElementById("btnAbrirListaPneus");

const btnVerPneus =
    document.getElementById("btnVerPneus");

const btnMenuListaPneus = document.querySelector(
    '.sidebar-item[data-tela="listaPneus"]'
);

if (btnAbrirListaPneus) {
    btnAbrirListaPneus.addEventListener("click", abrirListaPneus);
}

if (btnVerPneus) {
    btnVerPneus.addEventListener("click", abrirListaPneus);
}

if (btnMenuListaPneus) {
    btnMenuListaPneus.addEventListener("click", abrirListaPneus);
}



/* =====================================
   INDICADORES DO PAINEL
===================================== */

async function atualizarIndicadores() {
    let banco;

    try {
        let pneus;
        if (window.maintixApi?.isConfigured) {
            pneus = await obterTodosOsPneus();
        } else {
            banco = await abrirBancoMAINTIX();
            pneus = await new Promise((resolve, reject) => {
                const transacao = banco.transaction(nomeTabelaPneus, "readonly");
                const tabela = transacao.objectStore(nomeTabelaPneus);
                const requisicao = tabela.getAll();

                requisicao.onsuccess = () => resolve(requisicao.result);
                requisicao.onerror = () => reject(requisicao.error);
            });
        }
        pneus = filtrarRegistrosAtivos(pneus);

        document.getElementById("totalPneus").textContent = pneus.length;

        document.getElementById("pneusEstoque").textContent =
            pneus.filter(p =>
                obterStatusPneu(p) === STATUS_PNEU.RESERVA_PRONTA_UTILIZACAO
            ).length;

        document.getElementById("pneusInstalados").textContent =
            pneus.filter(p =>
                obterStatusPneu(p) === STATUS_PNEU.APLICADO
            ).length;

        document.getElementById("pneusManutencao").textContent =
            pneus.filter(p => [
                STATUS_PNEU.CONSERTO_OFICINA,
                STATUS_PNEU.PARA_RECAPE,
                STATUS_PNEU.EM_RECAPE
            ].includes(obterStatusPneu(p))).length;

        if (typeof atualizarDashboardOperacional === "function") {
            atualizarDashboardOperacional();
        }

    } catch (erro) {
        console.error("Erro ao atualizar indicadores:", erro);
    } finally {
        if (banco) {
            banco.close();
        }
    }
}

async function obterRegistrosDashboard(nomeTabela) {
    return filtrarRegistrosAtivos(await obterTodosRegistros(nomeTabela));
}

function renderizarDashboardSetores(equipamentos) {
    const lista = document.getElementById("dashEquipamentosPorSetor");
    if (!lista) return;
    lista.replaceChildren();
    const contagem = new Map();
    (equipamentos || []).forEach(e => {
        const setor = String(e.setor || "").trim() || "Sem setor informado";
        contagem.set(setor, (contagem.get(setor) || 0) + 1);
    });
    const setores = [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
    if (!setores.length) {
        const vazio = document.createElement("p");
        vazio.className = "dashboard-empty";
        vazio.textContent = "Cadastre equipamentos e informe o setor para visualizar a distribuição.";
        lista.appendChild(vazio);
        return;
    }
    const maximo = Math.max(...setores.map(item => item[1]), 1);
    setores.forEach(([setor, quantidade]) => {
        const linha = document.createElement("div");
        linha.className = "setor-dashboard-item";
        const cabecalho = document.createElement("div");
        cabecalho.className = "setor-dashboard-label";
        const nome = document.createElement("span"); nome.textContent = setor;
        const total = document.createElement("strong"); total.textContent = String(quantidade) + (quantidade === 1 ? " equipamento" : " equipamentos");
        cabecalho.append(nome, total);
        const trilho = document.createElement("div"); trilho.className = "setor-dashboard-track";
        const barra = document.createElement("span"); barra.className = "setor-dashboard-fill";
        barra.style.width = Math.max(4, quantidade / maximo * 100) + "%";
        trilho.appendChild(barra); linha.append(cabecalho, trilho); lista.appendChild(linha);
    });
}

async function atualizarDashboardOperacional() {
    try {
        const [pneus, movimentacoes, recapagens, equipamentos] = await Promise.all([
            obterRegistrosDashboard(nomeTabelaPneus),
            obterRegistrosDashboard("movimentacoes"),
            obterRegistrosDashboard("recapagens"),
            obterRegistrosDashboard("equipamentos")
        ]);
        renderizarDashboardSetores(equipamentos);

        const total = pneus.length;
        const estoque = pneus.filter(p =>
            obterStatusPneu(p) === STATUS_PNEU.RESERVA_PRONTA_UTILIZACAO
        ).length;
        const instalados = pneus.filter(p =>
            obterStatusPneu(p) === STATUS_PNEU.APLICADO
        ).length;
        const manutencao = pneus.filter(p => [
            STATUS_PNEU.CONSERTO_OFICINA,
            STATUS_PNEU.PARA_RECAPE,
            STATUS_PNEU.EM_RECAPE
        ].includes(obterStatusPneu(p))).length;

        const definirTexto = (id, valor) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.textContent = String(valor);
        };
        const definirBarra = (id, quantidade) => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.style.width = (total ? quantidade / total * 100 : 0) + "%";
        };

        definirTexto("dashEstoqueValor", estoque);
        definirTexto("dashInstaladosValor", instalados);
        definirTexto("dashManutencaoValor", manutencao);
        definirBarra("dashEstoqueBar", estoque);
        definirBarra("dashInstaladosBar", instalados);
        definirBarra("dashManutencaoBar", manutencao);
        definirTexto("dashResumoPneus", total ? `${total} pneus cadastrados na base operacional.` : "Nenhum pneu cadastrado ainda.");
        definirTexto("dashBasePneus", total);
        definirTexto("dashPercentualInstalado", (total ? Math.round(instalados / total * 100) : 0) + "%");
        definirTexto("dashPercentualEstoque", (total ? Math.round(estoque / total * 100) : 0) + "%");

        const pendentes = recapagens.filter(r => {
            const status = String(r.status || "").toUpperCase();
            return !r.dataRetorno || status.includes("ANDAMENTO") || status.includes("PENDENTE");
        }).length;
        const custo = recapagens.reduce((soma, r) => soma + (Number(r.custo) || 0), 0);
        definirTexto("dashTotalRecapagens", recapagens.length);
        definirTexto("dashRecapagensPendentes", pendentes);
        definirTexto("dashCustoRecapagens", custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
        definirTexto("dashResumoRecapagens", recapagens.length ? `${recapagens.length} registro(s) de recapagem no histórico.` : "Nenhuma recapagem registrada até o momento.");

        const lista = document.getElementById("dashMovimentacoesRecentes");
        if (lista) {
            lista.replaceChildren();
            movimentacoes.sort((a, b) => new Date(b.dataMovimentacao || b.criadoEm || 0) - new Date(a.dataMovimentacao || a.criadoEm || 0));
            const recentes = movimentacoes.slice(0, 4);
            if (!recentes.length) {
                const vazio = document.createElement("p");
                vazio.className = "dashboard-empty";
                vazio.textContent = "Ainda não há movimentações registradas.";
                lista.appendChild(vazio);
            } else {
                recentes.forEach(m => {
                    const item = document.createElement("div");
                    item.className = "dashboard-activity-item";
                    const icone = document.createElement("span");
                    icone.className = "activity-icon";
                    icone.textContent = String(m.tipo || m.operacao || "MOV").slice(0, 3).toUpperCase();
                    const principal = document.createElement("div");
                    principal.className = "activity-main";
                    const titulo = document.createElement("strong");
                    titulo.textContent = String(m.tipo || m.operacao || m.motivo || "Movimentação");
                    const detalhe = document.createElement("span");
                    detalhe.textContent = "Pneu: " + String(m.idPneu || "Não informado");
                    principal.append(titulo, detalhe);
                    const data = document.createElement("span");
                    data.className = "activity-date";
                    const valorData = m.dataMovimentacao || m.criadoEm;
                    data.textContent = valorData ? new Date(valorData).toLocaleDateString("pt-BR") : "Data não informada";
                    item.append(icone, principal, data);
                    lista.appendChild(item);
                });
            }
        }
    } catch (erro) {
        console.error("Erro ao atualizar dashboard operacional:", erro);
        const lista = document.getElementById("dashMovimentacoesRecentes");
        if (lista) lista.textContent = "Não foi possível carregar a atividade recente.";
    }
}

if (!window.maintixApi?.isConfigured) {
    atualizarIndicadores();
    atualizarDashboardOperacional();
}


/* =====================================
   EDIÇÃO E HISTÓRICO DE IDENTIFICAÇÕES
===================================== */

const telaEditarPneu = document.getElementById("telaEditarPneu");
const formEditarPneu = document.getElementById("formEditarPneu");
const mensagemEdicaoPneu = document.getElementById("mensagemEdicaoPneu");

let pneuEmEdicao = null;

function abrirTelaEdicao(pneu) {
    pneuEmEdicao = pneu;

    // Ocultar as outras telas
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;
    telaCadastro.hidden = true;
    telaListaPneus.hidden = true;

    // Preencher os campos
    document.getElementById("editarIdPneu").value = pneu.id;
    document.getElementById("editarNumeroFogo").value = pneu.numeroFogo || "";
    document.getElementById("editarDot").value = pneu.dot || "";
    document.getElementById("editarMarca").value = pneu.marca || "";
    document.getElementById("editarModelo").value = pneu.modelo || "";
    document.getElementById("editarMedida").value = pneu.medida || "";
    document.getElementById("editarEstadoPneu").value = pneu.estado || "";

    const seletorStatus = document.getElementById("editarStatusPneu");
    const statusAtual = obterStatusPneu(pneu);
    seletorStatus.value = statusAtual;
    seletorStatus.disabled = statusAtual === STATUS_PNEU.APLICADO;

    mensagemEdicaoPneu.textContent = "";
    telaEditarPneu.hidden = false;
}

async function buscarPneuPorId(id) {
    if (window.maintixApi?.isConfigured) {
        return window.maintixApi.buscar(nomeTabelaPneus, id);
    }

    const banco = await abrirBancoMAINTIX();

    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction(nomeTabelaPneus, "readonly");
            const tabela = transacao.objectStore(nomeTabelaPneus);
            const requisicao = tabela.get(id);

            requisicao.onsuccess = () => resolve(requisicao.result);
            requisicao.onerror = () => reject(requisicao.error);
        });
    } finally {
        banco.close();
    }
}

async function atualizarPneu(pneu) {
    if (window.maintixApi?.isConfigured) {
        await window.maintixApi.atualizar(nomeTabelaPneus, pneu);
        return;
    }

    const banco = await abrirBancoMAINTIX();

    try {
        await new Promise((resolve, reject) => {
            const transacao = banco.transaction(nomeTabelaPneus, "readwrite");
            const tabela = transacao.objectStore(nomeTabelaPneus);

            // put atualiza o registro usando o ID existente.
            // O ID não é gerado novamente.
            tabela.put(pneu);

            transacao.oncomplete = () => resolve();
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error);
        });
    } finally {
        banco.close();
    }
}

/* Abrir a edição ao clicar no botão da tabela */

corpoTabelaPneus.addEventListener("click", async function (evento) {
    const botao = evento.target.closest(".btn-editar-pneu");

    if (!botao) return;

    botao.disabled = true;

    try {
        const pneu = await buscarPneuPorId(botao.dataset.idPneu);

        if (!pneu) {
            mensagemListaPneus.textContent =
                "Pneu não encontrado. Atualize a listagem.";
            return;
        }

        abrirTelaEdicao(pneu);
    } catch (erro) {
        console.error("Erro ao abrir pneu para edição:", erro);
        mensagemListaPneus.textContent =
            "Não foi possível abrir o pneu para edição.";
    } finally {
        botao.disabled = false;
    }
});

/* Salvar alterações */

formEditarPneu.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    if (!pneuEmEdicao) return;

    const botaoSalvar = document.getElementById("btnSalvarEdicaoPneu");
    botaoSalvar.disabled = true;
    mensagemEdicaoPneu.textContent = "Salvando alterações...";

    try {
        // Buscar novamente o registro atual para não sobrescrever
        // silenciosamente alterações feitas desde a abertura da tela.
        const atual = await buscarPneuPorId(pneuEmEdicao.id);

        if (!atual) {
            mensagemEdicaoPneu.textContent =
                "O pneu não foi encontrado no banco de dados.";
            return;
        }

        const numeroFogoNovo =
            document.getElementById("editarNumeroFogo").value.trim();

        const dotNovo =
            document.getElementById("editarDot").value.trim();
        const estadoNovo =
            document.getElementById("editarEstadoPneu").value;
        const statusNovo =
            document.getElementById("editarStatusPneu").value;

        if (estadoNovo && !Object.hasOwn(ROTULOS_ESTADO_PNEU, estadoNovo)) {
            mensagemEdicaoPneu.textContent = "Selecione um estado válido para o pneu.";
            return;
        }

        const agora = new Date().toISOString();

        // Copiar os dados existentes, mantendo o ID e demais informações.
        const pneuAtualizado = { ...atual };

        if (obterStatusPneu(atual) !== STATUS_PNEU.APLICADO) {
            if (
                !Object.hasOwn(ROTULOS_STATUS_PNEU, statusNovo) ||
                statusNovo === STATUS_PNEU.APLICADO
            ) {
                mensagemEdicaoPneu.textContent = "Selecione um status válido para o pneu.";
                return;
            }

            pneuAtualizado.status = statusNovo;
        } else {
            pneuAtualizado.status = STATUS_PNEU.APLICADO;
        }

        if (estadoNovo) {
            pneuAtualizado.estado = estadoNovo;
        }

        pneuAtualizado.historicoIdentificacoes =
            Array.isArray(atual.historicoIdentificacoes)
                ? [...atual.historicoIdentificacoes]
                : [];

        registrarEventoHistoricoPneu(
            pneuAtualizado,
            "ESTADO_PNEU",
            atual.estado || "",
            pneuAtualizado.estado || "",
            agora
        );
        registrarEventoHistoricoPneu(
            pneuAtualizado,
            "STATUS_PNEU",
            obterStatusPneu(atual),
            pneuAtualizado.status,
            agora
        );

        if ((atual.numeroFogo || "") !== numeroFogoNovo) {
            if (atual.numeroFogo) {
                pneuAtualizado.historicoIdentificacoes.push({
                    tipo: "NUMERO_FOGO",
                    valor: atual.numeroFogo,
                    acao: "SUBSTITUIDO",
                    dataRegistro: agora
                });
            }

            if (numeroFogoNovo) {
                pneuAtualizado.historicoIdentificacoes.push({
                    tipo: "NUMERO_FOGO",
                    valor: numeroFogoNovo,
                    acao: "DEFINIDO",
                    dataRegistro: agora
                });
            }

            pneuAtualizado.numeroFogo = numeroFogoNovo;
        }

        if ((atual.dot || "") !== dotNovo) {
            if (atual.dot) {
                pneuAtualizado.historicoIdentificacoes.push({
                    tipo: "DOT",
                    valor: atual.dot,
                    acao: "SUBSTITUIDO",
                    dataRegistro: agora
                });
            }

            if (dotNovo) {
                pneuAtualizado.historicoIdentificacoes.push({
                    tipo: "DOT",
                    valor: dotNovo,
                    acao: "DEFINIDO",
                    dataRegistro: agora
                });
            }

            pneuAtualizado.dot = dotNovo;
        }

        pneuAtualizado.atualizadoEm = agora;

        await atualizarPneu(pneuAtualizado);

        pneuEmEdicao = pneuAtualizado;

        await listarPneus();
        await atualizarIndicadores();

        mensagemEdicaoPneu.textContent =
            "Alterações salvas com sucesso. ID interno mantido: " + pneuAtualizado.id;

        telaEditarPneu.hidden = true;
        telaListaPneus.hidden = false;


    } catch (erro) {
        console.error("Erro ao atualizar pneu:", erro);
        mensagemEdicaoPneu.textContent =
            "Não foi possível salvar as alterações.";
    } finally {
        botaoSalvar.disabled = false;
    }
});

/* Cancelar edição */

document.getElementById("btnCancelarEdicaoPneu")
    .addEventListener("click", function () {
        telaEditarPneu.hidden = true;
        pneuEmEdicao = null;
        abrirListaPneus();
    });


/* =====================================
   CONSULTA DO HISTÓRICO DO PNEU
===================================== */

const telaHistoricoPneu = document.getElementById("telaHistoricoPneu");
const corpoTabelaHistoricoPneu =
    document.getElementById("corpoTabelaHistoricoPneu");

const mensagemHistoricoPneu =
    document.getElementById("mensagemHistoricoPneu");

async function abrirHistoricoPneu(idPneu) {
    try {
        const pneu = await buscarPneuPorId(idPneu);

        if (!pneu) {
            mensagemListaPneus.textContent =
                "Pneu não encontrado para consulta do histórico.";
            return;
        }

        // Ocultar as demais telas
        secaoBoasVindas.hidden = true;
        secaoIndicadores.hidden = true;
        secaoModulos.hidden = true;
        telaCadastro.hidden = true;
        telaListaPneus.hidden = true;
        telaEditarPneu.hidden = true;
        document.getElementById("telaDescarte").hidden = true;

        // Exibir identificação atual
        document.getElementById("historicoIdPneu").value = pneu.id;
        document.getElementById("historicoFogoAtual").value =
            pneu.numeroFogo || "Não informado";

        document.getElementById("historicoDotAtual").value =
            pneu.dot || "Não informado";
        document.getElementById("historicoEstadoAtual").value =
            ROTULOS_ESTADO_PNEU[pneu.estado] || "Não informado";
        document.getElementById("historicoStatusAtual").value =
            formatarStatusPneu(pneu);

        corpoTabelaHistoricoPneu.replaceChildren();

        const historico = Array.isArray(pneu.historicoIdentificacoes)
            ? [...pneu.historicoIdentificacoes]
            : [];

        historico.sort((a, b) =>
            new Date(a.dataRegistro || 0) - new Date(b.dataRegistro || 0)
        );

        if (historico.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 4;
            celula.textContent = "Nenhum evento de histórico registrado.";

            linha.appendChild(celula);
            corpoTabelaHistoricoPneu.appendChild(linha);
        } else {
            historico.forEach((registro) => {
                const linha = document.createElement("tr");

                const data = registro.dataRegistro
                    ? new Date(registro.dataRegistro).toLocaleString("pt-BR")
                    : "Data não disponível";

                const rotulosTipo = {
                    NUMERO_FOGO: "Número de fogo",
                    DOT: "DOT",
                    ESTADO_PNEU: "Estado do pneu",
                    STATUS_PNEU: "Status do pneu"
                };
                const tipo = rotulosTipo[registro.tipo] || registro.tipo || "Não informado";
                const formatarValor = (valorRegistro) => {
                    if (registro.tipo === "ESTADO_PNEU") {
                        return ROTULOS_ESTADO_PNEU[valorRegistro] || valorRegistro;
                    }

                    if (registro.tipo === "STATUS_PNEU") {
                        return ROTULOS_STATUS_PNEU[valorRegistro] ||
                            String(valorRegistro || "").replaceAll("_", " ");
                    }

                    return valorRegistro;
                };
                const valor = registro.valorAnterior
                    ? "De: " + formatarValor(registro.valorAnterior) +
                        " | Para: " + formatarValor(registro.valor)
                    : formatarValor(registro.valor) || "Não informado";

                const evento = registro.acao === "SUBSTITUIDO"
                    ? "Identificação substituída"
                    : registro.acao === "ALTERADO"
                        ? tipo.replace(" do pneu", "") + " alterado"
                        : registro.acao === "DEFINIDO"
                            ? tipo.includes("Identificação")
                                ? "Identificação definida"
                                : tipo.replace(" do pneu", "") + " definido"
                            : "Registro inicial";

                [data, tipo, valor, evento].forEach((valorCelula) => {
                    const celula = document.createElement("td");
                    celula.textContent = valorCelula;
                    linha.appendChild(celula);
                });

                corpoTabelaHistoricoPneu.appendChild(linha);
            });
        }

        mensagemHistoricoPneu.textContent =
            "Eventos registrados: " + historico.length;

        telaHistoricoPneu.hidden = false;
        await carregarMovimentacoesDoPneu(idPneu);

    } catch (erro) {
        console.error("Erro ao consultar histórico:", erro);
        mensagemListaPneus.textContent =
            "Não foi possível consultar o histórico do pneu.";
    }
}

/* Abrir o histórico pelo botão da tabela */

corpoTabelaPneus.addEventListener("click", function (evento) {
    const botao = evento.target.closest(".btn-historico-pneu");

    if (!botao) return;

    origemHistoricoPneu = "listaPneus";
    abrirHistoricoPneu(botao.dataset.idPneu);
});

/* Voltar à listagem */

document.getElementById("btnVoltarListaHistorico")
    .addEventListener("click", function () {
        telaHistoricoPneu.hidden = true;
        if (origemHistoricoPneu === "descarte") {
            abrirTelaDescarte();
        } else {
            abrirListaPneus();
        }
    });

    
/* =====================================
   NAVEGAÇÃO: EQUIPAMENTOS
===================================== */

const telaEquipamentos = document.getElementById("telaEquipamentos");

const btnMenuEquipamentos = document.querySelector(
    '.sidebar-item[data-tela="equipamentos"]'
);

const btnAbrirEquipamentos =
    document.getElementById("btnAbrirEquipamentos");

const btnVoltarPainelEquipamentos =
    document.getElementById("btnVoltarPainelEquipamentos");

function abrirTelaEquipamentos() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = true;
    telaListaPneus.hidden = true;
    telaEditarPneu.hidden = true;
    telaHistoricoPneu.hidden = true;
    telaHistoricoMovimentacoes.hidden = true;
    telaRelatorios.hidden = true;

    telaEquipamentos.hidden = false;
    atualizarMenuAtivo("equipamentos");
}



if (btnAbrirEquipamentos) {
    btnAbrirEquipamentos.addEventListener(
        "click",
        abrirTelaEquipamentos
    );
}

if (btnMenuEquipamentos) {
    btnMenuEquipamentos.addEventListener(
        "click",
        abrirTelaEquipamentos
    );
}

if (btnVoltarPainelEquipamentos) {
    btnVoltarPainelEquipamentos.addEventListener("click", function() {
        telaEquipamentos.hidden = true;
        voltarAoPainel();
    });
}


/* =====================================
   CADASTRO E SALVAMENTO DE EQUIPAMENTOS
===================================== */

const formCadastroEquipamento =
    document.getElementById("formCadastroEquipamento");

const mensagemEquipamento =
    document.getElementById("mensagemEquipamento");
let equipamentoEmEdicaoId = null;

function gerarIdInternoEquipamento() {
    if (crypto.randomUUID) {
        return "EQP-" + crypto.randomUUID().toUpperCase();
    }

    return "EQP-" + Date.now().toString(36).toUpperCase()
        + "-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function salvarEquipamento(equipamento) {
    if (window.maintixApi?.isConfigured) {
        return window.maintixApi.inserir("equipamentos", equipamento);
    }

    const banco = await abrirBancoMAINTIX();

    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction("equipamentos", "readwrite");
            const tabela = transacao.objectStore("equipamentos");

            const requisicao = tabela.add(equipamento);

            requisicao.onerror = () => reject(requisicao.error);
            transacao.oncomplete = () => resolve(equipamento);
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error);
        });
    } finally {
        banco.close();
    }
}

async function listarEquipamentos() {
    return filtrarRegistrosAtivos(await obterTodosRegistros("equipamentos"));
}

formCadastroEquipamento.addEventListener("submit", async function(evento) {
    evento.preventDefault();

    mensagemEquipamento.textContent = "Salvando equipamento...";

    const tipo = document.getElementById("tipoEquipamento").value;
    const tag = document.getElementById("tagEquipamento").value.trim().toUpperCase();
    const placa = document.getElementById("placaEquipamento").value.trim().toUpperCase();
    const marca = document.getElementById("marcaEquipamento").value.trim();
    const modelo = document.getElementById("modeloEquipamento").value.trim();
    const observacoes = document.getElementById("observacoesEquipamento").value.trim();
    const setor = document.getElementById("setorEquipamento").value.trim();
    const responsavel = document.getElementById("responsavelEquipamento").value.trim();
    const layout = document.getElementById("layoutEquipamento").value;


    try {
        const equipamentos = await listarEquipamentos();

        const tagDuplicada = equipamentos.some(
            equipamento => equipamento.tag.toUpperCase() === tag && equipamento.id !== equipamentoEmEdicaoId
        );

        if (tagDuplicada) {
            mensagemEquipamento.textContent =
                "Já existe um equipamento cadastrado com esta TAG.";
            return;
        }

        const agora = new Date().toISOString();


        const equipamento = {
            id: equipamentoEmEdicaoId || gerarIdInternoEquipamento(),
            tipo, layout, tag, placa, marca, modelo, setor, responsavel, observacoes,
            status: equipamentoEmEdicaoId ? (equipamentos.find(e => e.id === equipamentoEmEdicaoId)?.status || "ATIVO") : "ATIVO",
            criadoEm: equipamentoEmEdicaoId ? (equipamentos.find(e => e.id === equipamentoEmEdicaoId)?.criadoEm || agora) : agora,
            atualizadoEm: agora
        };

        if (equipamentoEmEdicaoId) {
            if (window.maintixApi?.isConfigured) {
                await window.maintixApi.atualizar("equipamentos", equipamento);
            } else {
                const banco = await abrirBancoMAINTIX();
                try {
                    await new Promise((resolve, reject) => {
                        const tx = banco.transaction("equipamentos", "readwrite");
                        tx.objectStore("equipamentos").put(equipamento);
                        tx.oncomplete = resolve;
                        tx.onerror = () => reject(tx.error);
                        tx.onabort = () => reject(tx.error);
                    });
                } finally {
                    banco.close();
                }
            }
            mensagemEquipamento.textContent = "Cadastro atualizado. ID interno mantido: " + equipamento.id;
            equipamentoEmEdicaoId = null;
            document.getElementById("btnSalvarEquipamento").textContent = "Salvar equipamento";
            document.getElementById("layoutEquipamento").disabled = false;
        } else {
            await salvarEquipamentoComPosicoes(equipamento);
            mensagemEquipamento.textContent = "Equipamento cadastrado com sucesso. ID interno: " + equipamento.id;
        }
        formCadastroEquipamento.reset();
        await atualizarDashboardOperacional();

    } catch (erro) {
        console.error("Erro ao salvar equipamento:", erro);

        mensagemEquipamento.textContent =
            "Não foi possível salvar o equipamento. Verifique o console.";
    }
});


/* =====================================
   CONSULTA E LISTAGEM DE EQUIPAMENTOS
===================================== */

const telaListaEquipamentos =
    document.getElementById("telaListaEquipamentos");

const corpoTabelaEquipamentos =
    document.getElementById("corpoTabelaEquipamentos");

const mensagemListaEquipamentos =
    document.getElementById("mensagemListaEquipamentos");

const btnAtualizarEquipamentos =
    document.getElementById("btnAtualizarEquipamentos");

const btnNovoEquipamento =
    document.getElementById("btnNovoEquipamento");

const btnVoltarPainelListaEquipamentos =
    document.getElementById("btnVoltarPainelListaEquipamentos");

function formatarDataEquipamento(data) {
    if (!data) return "Não informada";

    const dataValida = new Date(data);

    if (Number.isNaN(dataValida.getTime())) {
        return "Não informada";
    }

    return dataValida.toLocaleDateString("pt-BR");
}

async function atualizarListaEquipamentos() {
    corpoTabelaEquipamentos.replaceChildren();

    mensagemListaEquipamentos.textContent =
        "Consultando equipamentos cadastrados...";

    try {
        const equipamentos = await listarEquipamentos();

        equipamentos.sort((a, b) =>
            (a.tag || "").localeCompare(b.tag || "")
        );
        const podeArquivar = await usuarioPodeArquivar();

        if (equipamentos.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 11;
            celula.textContent = "Nenhum equipamento cadastrado.";

            linha.appendChild(celula);
            corpoTabelaEquipamentos.appendChild(linha);

            mensagemListaEquipamentos.textContent = "";
            return;
        }

        equipamentos.forEach((equipamento) => {
            const linha = document.createElement("tr");

            const valores = [
                equipamento.id,
                equipamento.tipo,
                equipamento.tag,
                equipamento.placa || "Não informada",
                equipamento.marca,
                equipamento.modelo,
                equipamento.setor || "Sem setor",
                equipamento.responsavel || "Não informado",
                equipamento.status,
                formatarDataEquipamento(equipamento.criadoEm)
            ];


            valores.forEach(valor => {
                const celula = document.createElement("td");
                celula.textContent = valor || "—";
                linha.appendChild(celula);
            });

            const celulaAcoes = document.createElement("td");
            const grupoAcoes = document.createElement("div");
            grupoAcoes.className = "acoes-equipamento";
            const botaoPosicoes = document.createElement("button");

            botaoPosicoes.type = "button";
            botaoPosicoes.textContent = "Ver posições";
            botaoPosicoes.className = "btn-ver-posicoes-equipamento";

            botaoPosicoes.addEventListener("click", async function () {

                equipamentoSelecionadoParaInstalacao = equipamento.id;

                secaoBoasVindas.hidden = true;
                secaoIndicadores.hidden = true;
                secaoModulos.hidden = true;
                telaCadastro.hidden = true;
                telaListaPneus.hidden = true;
                telaEditarPneu.hidden = true;
                telaHistoricoPneu.hidden = true;
                telaEquipamentos.hidden = true;
                telaListaEquipamentos.hidden = true;

                document.getElementById(
                    "telaPosicoesEquipamento"
                ).hidden = false;

                document.getElementById(
                    "mensagemPosicoesEquipamento"
                ).textContent = "Equipamento: " + equipamento.tag;

                await atualizarTabelaPosicoesEquipamento(equipamento.id);
            });

            const botaoEditar = document.createElement("button");
            botaoEditar.type = "button";
            botaoEditar.textContent = "Editar equipamento";
            botaoEditar.className = "btn-editar-equipamento";
            botaoEditar.addEventListener("click", function() {
                equipamentoEmEdicaoId = equipamento.id;
                document.getElementById("tipoEquipamento").value = equipamento.tipo || "";
                document.getElementById("layoutEquipamento").value = equipamento.layout || "";
                document.getElementById("layoutEquipamento").disabled = true;
                document.getElementById("tagEquipamento").value = equipamento.tag || "";
                document.getElementById("placaEquipamento").value = equipamento.placa || "";
                document.getElementById("marcaEquipamento").value = equipamento.marca || "";
                document.getElementById("modeloEquipamento").value = equipamento.modelo || "";
                document.getElementById("setorEquipamento").value = equipamento.setor || "";
                document.getElementById("responsavelEquipamento").value = equipamento.responsavel || "";
                document.getElementById("observacoesEquipamento").value = equipamento.observacoes || "";
                document.getElementById("btnSalvarEquipamento").textContent = "Salvar alterações";
                mensagemEquipamento.textContent = "Editando " + equipamento.tag + ". O ID interno e as posições existentes serão mantidos.";
                telaListaEquipamentos.hidden = true;
                abrirTelaEquipamentos();
            });
            grupoAcoes.append(botaoEditar, botaoPosicoes);
            if (podeArquivar) {
                grupoAcoes.appendChild(criarBotaoArquivar("equipamentos", equipamento));
            }
            celulaAcoes.appendChild(grupoAcoes);
            linha.appendChild(celulaAcoes);

            corpoTabelaEquipamentos.appendChild(linha);

        });

        mensagemListaEquipamentos.textContent =
            "Total de equipamentos cadastrados: " + equipamentos.length;

    } catch (erro) {
        console.error("Erro ao listar equipamentos:", erro);

        mensagemListaEquipamentos.textContent =
            "Não foi possível carregar os equipamentos.";
    }
}

function abrirListaEquipamentos() {
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = true;
    telaListaPneus.hidden = true;
    telaEditarPneu.hidden = true;
    telaHistoricoPneu.hidden = true;
    telaEquipamentos.hidden = true;
    document.getElementById("telaPosicoesEquipamento").hidden = true;

    telaListaEquipamentos.hidden = false;

    atualizarMenuAtivo("equipamentos");
    atualizarListaEquipamentos();
}

document.getElementById("btnVoltarListaEquipamentos")
    .addEventListener("click", abrirListaEquipamentos);

function abrirFormularioEquipamento() {
    equipamentoEmEdicaoId = null;
    formCadastroEquipamento.reset();
    document.getElementById("btnSalvarEquipamento").textContent = "Salvar equipamento";
    document.getElementById("layoutEquipamento").disabled = false;
    mensagemEquipamento.textContent = "";
    telaListaEquipamentos.hidden = true;
    abrirTelaEquipamentos();
}

if (btnAtualizarEquipamentos) {
    btnAtualizarEquipamentos.addEventListener(
        "click",
        atualizarListaEquipamentos
    );
}

if (btnNovoEquipamento) {
    btnNovoEquipamento.addEventListener(
        "click",
        abrirFormularioEquipamento
    );
}

if (btnVoltarPainelListaEquipamentos) {
    btnVoltarPainelListaEquipamentos.addEventListener(
        "click",
        function() {
            telaListaEquipamentos.hidden = true;
            voltarAoPainel();
        }
    );
}


const btnAbrirListaEquipamentos =
    document.getElementById("btnAbrirListaEquipamentos");

if (btnAbrirListaEquipamentos) {
    btnAbrirListaEquipamentos.addEventListener(
        "click",
        abrirListaEquipamentos
    );
}


/* =====================================
   LAYOUTS DE POSIÇÕES POR TIPO DE EQUIPAMENTO
   Modelos genéricos configuráveis; validar com a frota real.
===================================== */

function criarPosicoesEixo(eixo, quantidadePorLado, codigoInicial, tipo = "DUPLA") {
    const itens = [];
    let n = codigoInicial;
    ["ESQUERDO", "DIREITO"].forEach(lado => {
        for (let i = 0; i < quantidadePorLado; i++) {
            let posicao;
            if (eixo === 1) posicao = "DIANTEIRO";
            else if (quantidadePorLado === 1) posicao = "SIMPLES";
            else if (tipo === "SIMPLES") posicao = "SIMPLES";
            else posicao = i === 0 ? "EXTERNO" : "INTERNO";
            itens.push({
                codigo: "POS" + String(n++).padStart(3, "0"),
                eixo, lado, posicao
            });
        }
    });
    return itens;
}

function obterConfiguracaoLayout(layoutId) {
    const layouts = {
        CAMINHAO_4X2_6: {
            nome: "Caminhão 4×2", tipo: "CAMINHAO",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3)
            ]
        },
        CAMINHAO_6X2_8: {
            nome: "Caminhão 6×2", tipo: "CAMINHAO",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3),
                ...criarPosicoesEixo(3, 1, 7, "SIMPLES")
            ]
        },
        CAMINHAO_6X4_10: {
            nome: "Caminhão 6×4", tipo: "CAMINHAO",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3),
                ...criarPosicoesEixo(3, 2, 7)
            ]
        },
        CAMINHAO_6X6_12: {
            nome: "Caminhão 6×6", tipo: "CAMINHAO",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES"),
                ...criarPosicoesEixo(3, 2, 5),
                ...criarPosicoesEixo(4, 2, 9)
            ]
        },
        FORA_ESTRADA_6_6: {
            nome: "Caminhão rígido fora de estrada", tipo: "CAMINHAO_FORA_DE_ESTRADA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES"),
                ...criarPosicoesEixo(3, 1, 5, "SIMPLES")
            ]
        },
        CARREGADEIRA_4: {
            nome: "Carregadeira", tipo: "CARREGADEIRA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES")
            ]
        },
        CARREGADEIRA_6: {
            nome: "Carregadeira 6 posições", tipo: "CARREGADEIRA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3)
            ]
        },
        MOTONIVELADORA_6: {
            nome: "Motoniveladora", tipo: "MOTONIVELADORA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES"),
                ...criarPosicoesEixo(3, 2, 5)
            ]
        },
        RETROESCAVADEIRA_4: {
            nome: "Retroescavadeira", tipo: "RETROESCAVADEIRA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES")
            ]
        },
        ESCAVADEIRA_RODAS_4: {
            nome: "Escavadeira de rodas", tipo: "ESCAVADEIRA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES")
            ]
        },
        TRATOR_4: {
            nome: "Trator agrícola", tipo: "TRATOR",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES")
            ]
        },
        TRATOR_6: {
            nome: "Trator agrícola com rodagem dupla", tipo: "TRATOR",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3)
            ]
        },
        EMPILHADEIRA_4: {
            nome: "Empilhadeira", tipo: "EMPILHADEIRA",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 1, 3, "SIMPLES")
            ]
        },
        EMPILHADEIRA_3: {
            nome: "Empilhadeira compacta", tipo: "EMPILHADEIRA",
            posicoes: [
                { codigo: "POS001", eixo: 1, lado: "ESQUERDO", posicao: "DIANTEIRO" },
                { codigo: "POS002", eixo: 1, lado: "DIREITO", posicao: "DIANTEIRO" },
                { codigo: "POS003", eixo: 2, lado: "CENTRAL", posicao: "TRASEIRO" }
            ]
        }
    };
    return layouts[layoutId] || null;
}

function obterConfiguracaoLayoutParaPosicoes(layoutId, quantidadeSalva) {
    if (layoutId === "CAMINHAO_6X6_12" && quantidadeSalva === 10) {
        return {
            nome: "Caminhão 6×6 — layout legado de 10 posições",
            tipo: "CAMINHAO",
            posicoes: [
                ...criarPosicoesEixo(1, 1, 1, "SIMPLES"),
                ...criarPosicoesEixo(2, 2, 3),
                ...criarPosicoesEixo(3, 2, 7)
            ]
        };
    }
    return obterConfiguracaoLayout(layoutId);
}

function obterLayoutCaminhao6x4() {
    return obterConfiguracaoLayout("CAMINHAO_6X4_10").posicoes;
}

function renderizarMapaPosicoes(layoutId, posicoes = [], quantidadeSalva = posicoes.length) {
    const mapa = document.getElementById("mapaPosicoes");
    if (!mapa) return;
    mapa.replaceChildren();
    const configuracao = obterConfiguracaoLayoutParaPosicoes(
        layoutId,
        quantidadeSalva
    );
    if (!configuracao) {
        const aviso = document.createElement("p");
        aviso.className = "mapa-placeholder";
        aviso.textContent = "Layout não reconhecido. Revise o cadastro do equipamento.";
        mapa.appendChild(aviso);
        return;
    }

    const titulo = document.createElement("div");
    titulo.className = "mapa-layout-titulo";
    const nomeLayout = document.createElement("span");
    nomeLayout.className = "mapa-layout-nome";
    nomeLayout.textContent = configuracao.nome;
    const quantidadePosicoes = document.createElement("span");
    quantidadePosicoes.className = "mapa-layout-quantidade";
    quantidadePosicoes.textContent = configuracao.posicoes.length + " posições";
    titulo.append(nomeLayout, quantidadePosicoes);
    mapa.appendChild(titulo);

    const chassi = document.createElement("div");
    chassi.className = "mapa-chassi-corpo";
    const frente = document.createElement("div");
    frente.className = "mapa-extremidade mapa-frente";
    const rotuloFrente = document.createElement("span");
    rotuloFrente.textContent = "FRENTE DO EQUIPAMENTO";
    const cabine = document.createElement("span");
    cabine.className = "mapa-cabine";
    cabine.setAttribute("aria-hidden", "true");
    frente.append(rotuloFrente, cabine);
    chassi.appendChild(frente);

    const porEixo = new Map();
    configuracao.posicoes.forEach(p => {
        if (!porEixo.has(p.eixo)) porEixo.set(p.eixo, []);
        porEixo.get(p.eixo).push(p);
    });

    Array.from(porEixo.entries()).sort((a,b) => a[0]-b[0]).forEach(([eixo, itens]) => {
        const linha = document.createElement("div");
        linha.className = "mapa-eixo mapa-eixo-dinamico";
        const esquerda = document.createElement("div");
        esquerda.className = "grupo-rodagem lado-esquerdo";
        const areaCentral = document.createElement("div");
        areaCentral.className = "mapa-eixo-central-area";
        const centro = document.createElement("div");
        centro.className = "mapa-eixo-central";
        centro.textContent = "EIXO " + eixo;
        areaCentral.appendChild(centro);
        const direita = document.createElement("div");
        direita.className = "grupo-rodagem lado-direito";
        itens.forEach(p => {
            const botao = document.createElement("button");
            botao.type = "button";
            botao.className = "posicao-pneu";
            botao.dataset.posicao = p.codigo;
            botao.setAttribute("aria-pressed", "false");
            botao.setAttribute(
                "aria-label",
                p.codigo + ", eixo " + p.eixo + ", " + p.lado + ", " + p.posicao
            );
            const indicador = document.createElement("span");
            indicador.className = "posicao-status-visual";
            indicador.setAttribute("aria-hidden", "true");
            const codigo = document.createElement("span");
            codigo.className = "posicao-codigo";
            codigo.textContent = p.codigo;
            const identificacao = document.createElement("span");
            identificacao.className = "posicao-identificacao";
            identificacao.textContent = p.posicao;
            botao.append(indicador, codigo, identificacao);
            if (p.lado === "ESQUERDO") esquerda.appendChild(botao);
            else if (p.lado === "DIREITO") direita.appendChild(botao);
            else areaCentral.appendChild(botao);
        });
        if (!esquerda.childElementCount) esquerda.textContent = "—";
        if (!direita.childElementCount) direita.textContent = "—";
        linha.append(esquerda, areaCentral, direita);
        chassi.appendChild(linha);
    });

    const traseira = document.createElement("div");
    traseira.className = "mapa-extremidade mapa-traseira";
    traseira.textContent = "TRASEIRA DO EQUIPAMENTO";
    chassi.appendChild(traseira);
    mapa.appendChild(chassi);

    const nota = document.createElement("p");
    nota.className = "mapa-nota-tecnica";
    nota.textContent = "Modelo genérico de posições. Confirme a configuração física e a quantidade de pneus no equipamento real antes de operar.";
    mapa.appendChild(nota);
}

async function gerarPosicoesEquipamento(equipamento) {
    const configuracao = obterConfiguracaoLayout(equipamento.layout);
    if (!configuracao) throw new Error("Layout ainda não possui posições configuradas.");
    if (window.maintixApi?.isConfigured) {
        const existentes = await window.maintixApi.listar("posicoes");
        if (existentes.some(posicao =>
            posicao.idEquipamento === equipamento.id
        )) {
            throw new Error("As posições deste equipamento já foram geradas.");
        }

        const agora = new Date().toISOString();
        const posicoes = configuracao.posicoes.map(item => ({
            id: equipamento.id + "-" + item.codigo,
            idEquipamento: equipamento.id,
            codigo: item.codigo,
            eixo: item.eixo,
            lado: item.lado,
            posicao: item.posicao,
            status: "ATIVA",
            idPneuInstalado: null,
            criadoEm: agora
        }));
        await window.maintixApi.inserirVarios("posicoes", posicoes);
        return true;
    }

    const banco = await abrirBancoMAINTIX();
    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction("posicoes", "readwrite");
            const tabela = transacao.objectStore("posicoes");
            const requisicao = tabela.getAll();
            requisicao.onerror = () => reject(requisicao.error);
            requisicao.onsuccess = function() {
                const existentes = requisicao.result;
                if (existentes.some(p => p.idEquipamento === equipamento.id)) {
                    reject(new Error("As posições deste equipamento já foram geradas."));
                    return;
                }
                const agora = new Date().toISOString();
                configuracao.posicoes.forEach(item => tabela.add({
                    id: equipamento.id + "-" + item.codigo,
                    idEquipamento: equipamento.id,
                    codigo: item.codigo,
                    eixo: item.eixo,
                    lado: item.lado,
                    posicao: item.posicao,
                    status: "ATIVA",
                    idPneuInstalado: null,
                    criadoEm: agora
                }));
            };
            transacao.oncomplete = () => resolve(true);
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error);
        });
    } finally { banco.close(); }
}

async function salvarEquipamentoComPosicoes(equipamento) {
    const configuracao = obterConfiguracaoLayout(equipamento.layout);
    if (!configuracao) throw new Error("Layout de rodagem não configurado.");
    if (window.maintixApi?.isConfigured) {
        const agora = new Date().toISOString();
        const posicoes = configuracao.posicoes.map(item => ({
            id: equipamento.id + "-" + item.codigo,
            idEquipamento: equipamento.id,
            codigo: item.codigo,
            eixo: item.eixo,
            lado: item.lado,
            posicao: item.posicao,
            status: "ATIVA",
            idPneuInstalado: null,
            criadoEm: agora
        }));
        await window.maintixApi.criarEquipamentoComPosicoes(
            equipamento,
            posicoes
        );
        return equipamento;
    }

    const banco = await abrirBancoMAINTIX();
    try {
        return await new Promise((resolve, reject) => {
            const transacao = banco.transaction(["equipamentos", "posicoes"], "readwrite");
            const tabelaEquipamentos = transacao.objectStore("equipamentos");
            const tabelaPosicoes = transacao.objectStore("posicoes");
            tabelaEquipamentos.add(equipamento);
            const agora = new Date().toISOString();
            configuracao.posicoes.forEach(item => tabelaPosicoes.add({
                id: equipamento.id + "-" + item.codigo,
                idEquipamento: equipamento.id,
                codigo: item.codigo,
                eixo: item.eixo,
                lado: item.lado,
                posicao: item.posicao,
                status: "ATIVA",
                idPneuInstalado: null,
                criadoEm: agora
            }));
            transacao.oncomplete = () => resolve(equipamento);
            transacao.onerror = () => reject(transacao.error);
            transacao.onabort = () => reject(transacao.error || new Error("A transação foi cancelada."));
        });
    } finally { banco.close(); }
}

async function listarPosicoesEquipamento(idEquipamento, incluirArquivadas = false) {
    const todasPosicoes = await obterTodosRegistros("posicoes");
    const posicoes = incluirArquivadas
        ? todasPosicoes
        : filtrarRegistrosAtivos(todasPosicoes);
    return posicoes
        .filter(posicao => posicao.idEquipamento === idEquipamento)
        .sort((a, b) => a.codigo.localeCompare(b.codigo));
}


let equipamentoSelecionadoParaInstalacao = null;
let posicaoSelecionadaParaInstalacao = null;


async function atualizarTabelaPosicoesEquipamento(idEquipamento) {
    const corpoTabela = document.getElementById(
        "corpoTabelaPosicoesEquipamento"
    );

    const mensagem = document.getElementById(
        "mensagemPosicoesEquipamento"
    );

    const mapa = document.getElementById("mapaPosicoes");
    const detalhesMapa = document.getElementById(
        "detalhesPosicaoMapa"
    );

    corpoTabela.replaceChildren();
    mensagem.textContent = "Consultando posições...";
    [
        "contagemPosicoesLivres",
        "contagemPosicoesOcupadas",
        "contagemPneusAplicados",
        "contagemPneusNovos",
        "contagemPneusRecapados",
        "contagemPneusMeiaVida"
    ].forEach(id => {
        document.getElementById(id).textContent = "0";
    });

    try {
        const [posicoes, todasPosicoes, equipamentos, pneus] = await Promise.all([
            listarPosicoesEquipamento(idEquipamento),
            listarPosicoesEquipamento(idEquipamento, true),
            listarEquipamentos(),
            obterTodosOsPneus()
        ]);
        const pneusPorId = new Map(
            pneus.map(pneu => [String(pneu.id), pneu])
        );
        const posicoesOcupadas = posicoes.filter(posicao => posicao.idPneuInstalado);
        const pneusAplicados = posicoesOcupadas
            .map(posicao => pneusPorId.get(String(posicao.idPneuInstalado)))
            .filter(Boolean);

        document.getElementById("contagemPosicoesLivres").textContent =
            posicoes.length - posicoesOcupadas.length;
        document.getElementById("contagemPosicoesOcupadas").textContent =
            posicoesOcupadas.length;
        document.getElementById("contagemPneusAplicados").textContent =
            pneusAplicados.length;
        document.getElementById("contagemPneusNovos").textContent =
            pneusAplicados.filter(pneu => pneu.estado === "NOVO").length;
        document.getElementById("contagemPneusRecapados").textContent =
            pneusAplicados.filter(pneu => pneu.estado === "RECAPADO").length;
        document.getElementById("contagemPneusMeiaVida").textContent =
            pneusAplicados.filter(pneu => pneu.estado === "MEIA_VIDA").length;
        const equipamentoAtual = equipamentos.find(e => e.id === idEquipamento);
        if (equipamentoAtual) {
            renderizarMapaPosicoes(
                equipamentoAtual.layout,
                posicoes,
                todasPosicoes.length
            );
        }

        if (mapa) {
            const codigosAtivos = new Set(posicoes.map(posicao => posicao.codigo));
            mapa.querySelectorAll(".posicao-pneu").forEach(botao => {
                botao.classList.remove("ocupada", "selecionada");
                botao.setAttribute("aria-pressed", "false");
                botao.title = "";
                botao.disabled = !codigosAtivos.has(botao.dataset.posicao);
                if (botao.disabled) botao.title = "Posição arquivada";
            });
        }

        if (posicoes.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 9;
            celula.textContent =
                "Nenhuma posição encontrada para este equipamento.";

            linha.appendChild(celula);
            corpoTabela.appendChild(linha);

            mensagem.textContent =
                "Verifique se as posições foram geradas no cadastro.";

            if (detalhesMapa) {
                detalhesMapa.textContent =
                    "Este equipamento ainda não possui posições cadastradas.";
            }

            return;
        }

        const podeArquivarPosicoes = await usuarioPodeArquivar();
        posicoes.forEach(posicao => {
            const linha = document.createElement("tr");

            const pneuInstalado = posicao.idPneuInstalado
                ? pneusPorId.get(String(posicao.idPneuInstalado))
                : null;

            const status = pneuInstalado ? "OCUPADA" : "LIVRE";

            const valores = [
                posicao.codigo,
                "Eixo " + posicao.eixo,
                posicao.lado,
                posicao.posicao,
                pneuInstalado?.id || posicao.idPneuInstalado || "Nenhum",
                pneuInstalado?.numeroFogo || "Não informado",
                pneuInstalado?.dot || "Não informado",
                status
            ];

            valores.forEach(valor => {
                const celula = document.createElement("td");
                celula.textContent = valor;
                linha.appendChild(celula);
            });

            const celulaAcoes = linha.insertCell();
            if (podeArquivarPosicoes) {
                celulaAcoes.appendChild(
                    criarBotaoArquivar(
                        "posicoes",
                        posicao,
                        Boolean(posicao.idPneuInstalado)
                    )
                );
            }
            corpoTabela.appendChild(linha);

            if (mapa) {
                const botao = mapa.querySelector(
                    '[data-posicao="' + posicao.codigo + '"]'
                );

                if (botao) {
                    botao.classList.toggle(
                        "ocupada",
                        Boolean(posicao.idPneuInstalado)
                    );

                    botao.title = [
                        posicao.codigo,
                        posicao.posicao,
                        status,
                        pneuInstalado
                            ? "ID: " + pneuInstalado.id +
                                " | Fogo: " + (pneuInstalado.numeroFogo || "Não informado") +
                                " | DOT: " + (pneuInstalado.dot || "Não informado")
                            : ""
                    ].filter(Boolean).join(" - ");


                    botao.onclick = function () {
                        mapa.querySelectorAll(".posicao-pneu").forEach(item => {
                            item.classList.remove("selecionada");
                            item.setAttribute("aria-pressed", "false");
                        });

                        botao.classList.add("selecionada");
                        botao.setAttribute("aria-pressed", "true");
                        posicaoSelecionadaParaInstalacao = posicao;
                        if (detalhesMapa) {
                            detalhesMapa.textContent =
                                posicao.codigo +
                                " | Eixo " + posicao.eixo +
                                " | Lado: " + posicao.lado +
                                " | Posição: " + posicao.posicao +
                                " | Status: " +
                                (posicao.idPneuInstalado ? "OCUPADA" : "LIVRE") +
                                " | Pneu: " +
                                (pneuInstalado
                                    ? "ID " + pneuInstalado.id +
                                        " | Número de fogo: " +
                                        (pneuInstalado.numeroFogo || "Não informado") +
                                        " | DOT: " + (pneuInstalado.dot || "Não informado") +
                                        " | Estado: " +
                                        (ROTULOS_ESTADO_PNEU[pneuInstalado.estado] || "Não informado") +
                                        " | Status: " + formatarStatusPneu(pneuInstalado)
                                    : posicao.idPneuInstalado
                                        ? "ID " + posicao.idPneuInstalado +
                                            " | dados do pneu não encontrados"
                                        : "Nenhum");
                        }

                        const painel = document.getElementById("painelInstalacaoPneu");
                        const resumo = document.getElementById("resumoInstalacaoPneu");
                        const campoData = document.getElementById("dataInstalacaoPneu");
                        const campoPneu = document.getElementById("idPneuInstalacao");
                        const mensagemInstalacao = document.getElementById(
                            "mensagemInstalacaoPneu"
                        );

                        const botaoConfirmar = document.getElementById(
                            "btnConfirmarInstalacaoPneu"
                        );


                        const painelRetirada = document.getElementById("painelRetiradaPneu");
                        const resumoRetirada = document.getElementById("resumoRetiradaPneu");
                        const campoDataRetirada = document.getElementById("dataRetiradaPneu");
                        const campoStatusAposRetirada = document.getElementById("statusAposRetiradaPneu");
                        const campoMotivoRetirada = document.getElementById("motivoRetiradaPneu");
                        const mensagemRetirada = document.getElementById("mensagemRetiradaPneu");

                        if (posicao.idPneuInstalado) {
                            painel.hidden = true;
                            painelRetirada.hidden = false;

                            resumoRetirada.textContent =
                                "Posição: " + posicao.codigo +
                                " | Pneu instalado: " +
                                (pneuInstalado
                                    ? "ID " + pneuInstalado.id +
                                        " | Fogo: " + (pneuInstalado.numeroFogo || "Não informado") +
                                        " | DOT: " + (pneuInstalado.dot || "Não informado")
                                    : posicao.idPneuInstalado);

                            campoDataRetirada.value = new Date().toLocaleDateString("en-CA");
                            campoStatusAposRetirada.value = "";
                            campoMotivoRetirada.value = "";
                            mensagemRetirada.textContent =
                                "Confira a posição e informe o motivo e o status após a retirada.";

                            return;
                        }

                        painelRetirada.hidden = true;
                        painel.hidden = false;


                        painel.hidden = false;
                        resumo.textContent =
                            "Posição selecionada: " + posicao.codigo +
                            " | Eixo " + posicao.eixo +
                            " | " + posicao.lado +
                            " | " + posicao.posicao;

                        campoData.value = new Date().toLocaleDateString("en-CA");
                        campoPneu.value = "";
                        mensagemInstalacao.textContent =
                            "Selecione um pneu cadastrado. A confirmação permanece desabilitada.";

                        botaoConfirmar.disabled = true;

                        carregarPneusParaInstalacao();
                    };

                }
            }
        });

        mensagem.textContent =
            "Total de posições: " + posicoes.length;

        if (detalhesMapa) {
            detalhesMapa.textContent =
                "Selecione uma posição no mapa para consultar seus detalhes.";
        }

    } catch (erro) {
        console.error("Erro ao consultar posições:", erro);

        mensagem.textContent =
            "Não foi possível carregar as posições do equipamento.";
    }
}

function escaparHTMLFicha(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function gerarDiagramaFicha(posicoes) {
    const eixos = [...new Set(posicoes.map(posicao => Number(posicao.eixo)))]
        .sort((a, b) => a - b);
    const altura = Math.max(150, 48 + eixos.length * 52);

    const rodas = posicoes.map(posicao => {
        const indiceEixo = eixos.indexOf(Number(posicao.eixo));
        const y = 44 + indiceEixo * 52;
        const posicaoFisica = String(posicao.posicao || "").toUpperCase();
        let x;
        if (posicao.lado === "ESQUERDO") {
            x = posicaoFisica === "EXTERNO" ? 65 : 91;
        } else if (posicao.lado === "DIREITO") {
            x = posicaoFisica === "EXTERNO" ? 215 : 189;
        } else {
            x = 140;
        }

        const codigoCurto = String(posicao.codigo || "")
            .replace(/^POS/i, "")
            .slice(-3);
        const ocupado = Boolean(posicao.idPneuInstalado);

        return `
            <g>
                <rect x="${x - 11}" y="${y - 14}" width="22" height="28"
                    rx="4" fill="${ocupado ? "#86a593" : "#d9dee2"}"
                    stroke="#30383b" stroke-width="1.5"/>
                <text x="${x}" y="${y + 3}" text-anchor="middle"
                    font-size="7" font-weight="700" fill="#17211b">${escaparHTMLFicha(codigoCurto)}</text>
            </g>
        `;
    }).join("");

    const eixosSvg = eixos.map((eixo, indice) => {
        const y = 44 + indice * 52;
        return `
            <line x1="52" y1="${y}" x2="228" y2="${y}"
                stroke="#606b70" stroke-width="3"/>
            <text x="140" y="${y + 3}" text-anchor="middle"
                font-size="7" font-weight="700" fill="#fff">E${eixo}</text>
        `;
    }).join("");

    return `
        <svg class="diagrama" viewBox="0 0 280 ${altura}"
            role="img" aria-label="Diagrama das posições de pneus do equipamento">
            <text x="140" y="12" text-anchor="middle"
                font-size="8" font-weight="700" fill="#25302a">FRENTE</text>
            <path d="M140 16 L135 23 L145 23 Z" fill="#25302a"/>
            <rect x="124" y="31" width="32" height="${altura - 48}"
                rx="8" fill="#30383b"/>
            <rect x="129" y="35" width="22" height="18"
                rx="4" fill="#566267"/>
            ${eixosSvg}
            ${posicoes.length ? rodas : ""}
            <text x="140" y="${altura - 5}" text-anchor="middle"
                font-size="8" font-weight="700" fill="#25302a">TRASEIRA</text>
        </svg>
    `;
}

function linhasTabelaFicha(quantidade, colunas) {
    const linhas = Math.max(6, quantidade);
    return Array.from({ length: linhas }, () =>
        `<tr>${colunas.map(() => "<td>&nbsp;</td>").join("")}</tr>`
    ).join("");
}

async function gerarFichaPosicoesPDF() {
    const idEquipamento = equipamentoSelecionadoParaInstalacao;
    if (!idEquipamento) {
        alert("Selecione um equipamento antes de gerar a ficha.");
        return;
    }

    const janela = window.open("", "_blank");
    if (!janela) {
        alert("O navegador bloqueou a ficha. Permita pop-ups para gerar o PDF.");
        return;
    }

    janela.document.write(
        "<!doctype html><html lang='pt-BR'><title>Preparando ficha</title>" +
        "<body style='font:16px Arial,sans-serif;padding:24px'>Preparando ficha do equipamento...</body></html>"
    );
    janela.document.close();

    try {
        const [equipamentos, posicoesSalvas, todasPosicoes, pneus] = await Promise.all([
            listarEquipamentos(),
            listarPosicoesEquipamento(idEquipamento),
            listarPosicoesEquipamento(idEquipamento, true),
            obterTodosOsPneus()
        ]);
        const equipamento = equipamentos.find(
            item => String(item.id) === String(idEquipamento)
        );
        if (!equipamento) {
            throw new Error("Não foi possível localizar os dados do equipamento.");
        }
        const layout = obterConfiguracaoLayoutParaPosicoes(
            equipamento.layout,
            todasPosicoes.length
        );
        const usaLayoutSemPosicoes = todasPosicoes.length === 0;
        if (!usaLayoutSemPosicoes && !posicoesSalvas.length) {
            throw new Error(
                "Todas as posições deste equipamento estão arquivadas. Restaure-as antes de gerar a ficha."
            );
        }
        const posicoes = usaLayoutSemPosicoes
            ? (layout?.posicoes || []).map(posicao => ({
                ...posicao,
                id: equipamento.id + "-" + posicao.codigo,
                idEquipamento: equipamento.id,
                idPneuInstalado: null,
                status: "ATIVA"
            }))
            : posicoesSalvas;
        if (!posicoes.length) {
            throw new Error(
                "Não foi possível gerar posições para o layout deste equipamento."
            );
        }

        const configurarValor = escaparHTMLFicha;
        const pneusPorId = new Map(
            pneus.map(pneu => [String(pneu.id), pneu])
        );
        const agora = new Date();
        const dataFicha = [
            agora.getFullYear(),
            String(agora.getMonth() + 1).padStart(2, "0"),
            String(agora.getDate()).padStart(2, "0")
        ].join("");
        const horaFicha = [
            String(agora.getHours()).padStart(2, "0"),
            String(agora.getMinutes()).padStart(2, "0")
        ].join("");
        const codigoFicha = "FP-" +
            String(equipamento.tag || equipamento.id)
                .replace(/[^a-zA-Z0-9-]/g, "")
                .toUpperCase() +
            "-" + dataFicha + "-" + horaFicha;
        const emitidaEm = agora.toLocaleString("pt-BR");
        const posicoesOrdenadas = [...posicoes].sort((a, b) =>
            Number(String(a.codigo || "").match(/\d+$/)?.[0] || 0) -
                Number(String(b.codigo || "").match(/\d+$/)?.[0] || 0) ||
            Number(a.eixo) - Number(b.eixo)
        );

        const linhasPneusAtuais = posicoesOrdenadas.map(posicao => {
            const pneu = posicao.idPneuInstalado
                ? pneusPorId.get(String(posicao.idPneuInstalado))
                : null;
            const valores = [
                posicao.codigo,
                pneu?.numeroFogo || "—",
                pneu?.marca || "—",
                pneu?.dot || "—",
                pneu?.modelo || pneu?.medida || "—",
                pneu
                    ? ROTULOS_ESTADO_PNEU[pneu.estado] || pneu.estado || "—"
                    : "LIVRE"
            ];
            return `<tr>${valores.map(valor =>
                `<td>${configurarValor(valor)}</td>`
            ).join("")}</tr>`;
        }).join("");

        const quantidadeLinhas = Math.max(posicoes.length, 6);
        const colunasRetirada = [
            "Posição", "Nº de fogo", "Fabricante", "DOT",
            "Motivo da retirada", "Destinação", "Medida", "Tipo/estado"
        ];
        const colunasAplicacao = [
            "Posição", "Nº de fogo", "Fabricante", "DOT",
            "Medida", "Tipo/estado", "Sulco"
        ];
        const desenharCabecalho = colunas =>
            `<thead><tr>${colunas.map(coluna =>
                `<th>${configurarValor(coluna)}</th>`
            ).join("")}</tr></thead>`;

        janela.document.open();
        janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${configurarValor(codigoFicha)} | Ficha de posição de pneus</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; color: #202725; font: 9px Arial, sans-serif; }
        .pagina { padding: 6mm; }
        .faixa { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; background: #252b29; color: #fff; font-weight: 700; font-size: 11px; }
        .codigo { padding: 4px 7px; background: #fff; color: #202725; white-space: nowrap; }
        .resumo { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #737b78; border-top: 0; }
        .campo { min-height: 31px; padding: 5px 7px; border-right: 1px solid #c3c8c5; border-bottom: 1px solid #c3c8c5; }
        .campo:nth-child(4n) { border-right: 0; }
        .rotulo { display: block; margin-bottom: 3px; color: #59615d; font-size: 7px; font-weight: 700; text-transform: uppercase; }
        .valor { font-size: 9px; font-weight: 700; }
        .inspecao { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 5px 0; }
        .linha-assinatura { min-height: 25px; padding: 4px; border: 1px solid #c3c8c5; }
        .linha-assinatura span { display: block; margin-top: 9px; border-top: 1px solid #8e9692; }
        .nota { margin: 4px 0; padding: 4px 6px; border: 1px solid #d5dad7; color: #48514d; font-style: italic; }
        .mapa-conteudo { display: grid; grid-template-columns: 31% 1fr; gap: 8px; align-items: start; }
        .diagrama-bloco { border: 1px solid #c3c8c5; padding: 5px; text-align: center; }
        .diagrama { display: block; width: 100%; max-height: 112mm; }
        .legenda { display: flex; justify-content: center; gap: 10px; margin-top: 4px; font-size: 7px; }
        .ponto { display: inline-block; width: 8px; height: 8px; margin-right: 3px; border: 1px solid #59615d; vertical-align: middle; }
        .ponto.ocupado { background: #86a593; } .ponto.livre { background: #d9dee2; }
        h2 { margin: 0 0 5px; padding: 5px 7px; background: #343a38; color: white; font-size: 9px; text-transform: uppercase; }
        h3 { margin: 5px 0; font-size: 9px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7px; }
        th, td { height: 14px; padding: 2px 3px; border: 1px solid #c2c7c4; text-align: left; overflow-wrap: anywhere; }
        th { background: #e7eae8; font-size: 6.5px; }
        tbody tr:nth-child(even) { background: #f5f6f5; }
        .observacoes { min-height: 24px; margin-top: 4px; padding: 4px; border: 1px solid #c3c8c5; }
        .rodape { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 5px; }
        .rodape .linha-assinatura { min-height: 30px; }
        .rodape .linha-assinatura span { margin-top: 13px; }
        .rodape-ficha { display: flex; justify-content: space-between; margin-top: 5px; padding-top: 3px; border-top: 1px solid #aeb5b1; color: #59615d; font-size: 7px; }
        .secao-movimentacao { margin-top: 5mm; }
        .tabela-movimentacao { margin-top: 4px; }
        .tabela-movimentacao th { height: 16px; }
        .tabela-movimentacao td { height: 14px; }
        .orientacao { margin: 3px 0; color: #515a56; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .pagina { padding: 5mm 6mm; }
            .diagrama { max-height: 96mm; }
            .secao-movimentacao { margin-top: 3mm; }
            .tabela-movimentacao { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen { body { max-width: 210mm; margin: 16px auto; box-shadow: 0 2px 18px #999; } }
    </style>
</head>
<body>
    <section class="pagina">
        <header class="faixa">
            <span>FICHA DE POSIÇÃO DE PNEUS — ${configurarValor(equipamento.tag || "SEM TAG")} — ${configurarValor(equipamento.modelo || "EQUIPAMENTO")}</span>
            <span class="codigo">${configurarValor(codigoFicha)}</span>
        </header>
        <div class="resumo">
            <div class="campo"><span class="rotulo">Código / patrimônio</span><span class="valor">${configurarValor(equipamento.tag || equipamento.id)}</span></div>
            <div class="campo"><span class="rotulo">Tipo</span><span class="valor">${configurarValor(equipamento.tipo || "—")}</span></div>
            <div class="campo"><span class="rotulo">Marca / modelo</span><span class="valor">${configurarValor([equipamento.marca, equipamento.modelo].filter(Boolean).join(" ") || "—")}</span></div>
            <div class="campo"><span class="rotulo">Data de emissão</span><span class="valor">${configurarValor(emitidaEm)}</span></div>
            <div class="campo"><span class="rotulo">Setor / localização</span><span class="valor">${configurarValor(equipamento.setor || "—")}</span></div>
            <div class="campo"><span class="rotulo">Placa / identificação</span><span class="valor">${configurarValor(equipamento.placa || "—")}</span></div>
            <div class="campo"><span class="rotulo">Layout</span><span class="valor">${configurarValor(layout?.nome || equipamento.layout || "—")}</span></div>
            <div class="campo"><span class="rotulo">Pneus aplicados</span><span class="valor">${posicoes.filter(posicao => posicao.idPneuInstalado).length} / ${posicoes.length} posições</span></div>
        </div>
        <div class="inspecao">
            <div class="linha-assinatura">Responsável / borracheiro<span></span></div>
            <div class="linha-assinatura">Assinatura<span></span></div>
            <div class="linha-assinatura">Data da inspeção<span></span></div>
            <div class="linha-assinatura">Horímetro / km<span></span></div>
            <div class="linha-assinatura">Local da inspeção<span></span></div>
            <div class="linha-assinatura">Observações gerais<span></span></div>
        </div>
        <p class="nota">${usaLayoutSemPosicoes
            ? "As posições foram exibidas a partir do layout cadastrado; ainda não há posições vinculadas a este equipamento no sistema. O mapa indica em cinza as posições livres."
            : "Confira as identificações e condições dos pneus antes da movimentação. O mapa indica em verde as posições ocupadas e em cinza as posições livres."}</p>
        <div class="mapa-conteudo">
            <div class="diagrama-bloco">
                <h3>Diagrama das posições</h3>
                ${gerarDiagramaFicha(posicoesOrdenadas)}
                <div class="legenda"><span><i class="ponto ocupado"></i>Aplicado</span><span><i class="ponto livre"></i>Livre</span></div>
            </div>
            <div>
                <h2>Pneus e posições do equipamento</h2>
                <table>
                    <thead><tr><th>Posição</th><th>Nº fogo</th><th>Fabricante</th><th>DOT</th><th>Modelo / medida</th><th>Estado</th></tr></thead>
                    <tbody>${linhasPneusAtuais}</tbody>
                </table>
            </div>
        </div>
        <div class="observacoes"><strong>Observações:</strong></div>
        <div class="rodape-ficha"><span>MAINTIX — Gestão de Pneus</span><span>Ficha ${configurarValor(codigoFicha)}</span><span>Equipamento ${configurarValor(equipamento.tag || equipamento.id)}</span></div>
    </section>
    <section class="pagina secao-movimentacao">
        <header class="faixa">
            <span>REGISTRO DE MOVIMENTAÇÃO DE PNEUS — ${configurarValor(equipamento.tag || "SEM TAG")}</span>
            <span class="codigo">${configurarValor(codigoFicha)}</span>
        </header>
        <p class="orientacao">Preencha as informações de cada pneu retirado e aplicado. Use o código da posição indicado no diagrama da ficha.</p>
        <div class="tabela-movimentacao">
            <h2>Destinação dos pneus retirados</h2>
            <table>${desenharCabecalho(colunasRetirada)}<tbody>${linhasTabelaFicha(quantidadeLinhas, colunasRetirada)}</tbody></table>
        </div>
        <div class="tabela-movimentacao">
            <h2>Identificação dos pneus aplicados</h2>
            <table>${desenharCabecalho(colunasAplicacao)}<tbody>${linhasTabelaFicha(quantidadeLinhas, colunasAplicacao)}</tbody></table>
        </div>
        <div class="rodape">
            <div class="linha-assinatura">Responsável pela inspeção<span></span></div>
            <div class="linha-assinatura">Supervisor / aprovação<span></span></div>
            <div class="linha-assinatura">Motorista / operador<span></span></div>
        </div>
        <div class="rodape-ficha"><span>MAINTIX — Gestão de Pneus</span><span>Emitida em ${configurarValor(emitidaEm)}</span><span>Ficha ${configurarValor(codigoFicha)}</span></div>
    </section>
    <script>
        window.addEventListener("load", function () {
            window.focus();
            window.print();
        });
    <\/script>
</body>
</html>`);
        janela.document.close();
    } catch (erro) {
        console.error("Erro ao gerar ficha de posições:", erro);
        janela.close();
        alert(erro.message || "Não foi possível gerar a ficha do equipamento.");
    }
}

document.getElementById("btnGerarFichaPosicoes")
    ?.addEventListener("click", gerarFichaPosicoesPDF);



async function carregarPneusParaInstalacao() {
    const seletor = document.getElementById("idPneuInstalacao");
    const mensagem = document.getElementById("mensagemInstalacaoPneu");

    seletor.replaceChildren();

    const opcaoInicial = document.createElement("option");
    opcaoInicial.value = "";
    opcaoInicial.textContent = "Selecione um pneu";
    seletor.appendChild(opcaoInicial);

    try {
        const pneus = await obterTodosOsPneus();
        let posicoes;
        if (window.maintixApi?.isConfigured) {
            posicoes = await window.maintixApi.listar("posicoes");
        } else {
            const banco = await abrirBancoMAINTIX();
            try {
            posicoes = await new Promise((resolve, reject) => {
                const transacao = banco.transaction(
                    "posicoes",
                    "readonly"
                );

                const requisicao = transacao
                    .objectStore("posicoes")
                    .getAll();

                requisicao.onsuccess = () => resolve(requisicao.result);
                requisicao.onerror = () => reject(requisicao.error);
            });
            } finally {
                banco.close();
            }
        }

        const idsPneusInstalados = new Set(
            posicoes
                .filter(posicao => posicao.idPneuInstalado)
                .map(posicao => String(posicao.idPneuInstalado))
        );

        const pneusDisponiveis = pneus.filter(pneu =>
            obterStatusPneu(pneu) === STATUS_PNEU.RESERVA_PRONTA_UTILIZACAO &&
            !idsPneusInstalados.has(String(pneu.id))
        );

        pneusDisponiveis.sort((a, b) =>
            String(a.id).localeCompare(String(b.id))
        );

        pneusDisponiveis.forEach(pneu => {
            const opcao = document.createElement("option");

            opcao.value = pneu.id;

            const fogo = pneu.numeroFogo || "Sem número de fogo";
            const dot = pneu.dot || "DOT não informado";

            opcao.textContent =
                String(pneu.id) + " | " + fogo + " | " + dot;

            seletor.appendChild(opcao);
        });

        mensagem.textContent = pneusDisponiveis.length > 0
            ? "Pneus disponíveis carregados para seleção."
            : "Não há pneus disponíveis para instalação.";

    } catch (erro) {
        console.error("Erro ao carregar pneus para instalação:", erro);
        mensagem.textContent = "Não foi possível carregar os pneus.";
    }
}


function atualizarBotaoConfirmarInstalacao() {
    const campoPneu = document.getElementById("idPneuInstalacao");
    const campoData = document.getElementById("dataInstalacaoPneu");
    const botaoConfirmar = document.getElementById(
        "btnConfirmarInstalacaoPneu"
    );

    const dadosValidos =
        Boolean(equipamentoSelecionadoParaInstalacao) &&
        Boolean(posicaoSelecionadaParaInstalacao) &&
        !posicaoSelecionadaParaInstalacao.idPneuInstalado &&
        Boolean(campoPneu.value) &&
        Boolean(campoData.value);

    botaoConfirmar.disabled = !dadosValidos;
}

document.getElementById("idPneuInstalacao").addEventListener(
    "change",
    atualizarBotaoConfirmarInstalacao
);

document.getElementById("dataInstalacaoPneu").addEventListener(
    "change",
    atualizarBotaoConfirmarInstalacao
);


const formInstalacaoPneu = document.getElementById("formInstalacaoPneu");

formInstalacaoPneu.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const campoPneu = document.getElementById("idPneuInstalacao");
    const campoData = document.getElementById("dataInstalacaoPneu");
    const mensagem = document.getElementById("mensagemInstalacaoPneu");
    const botaoConfirmar = document.getElementById("btnConfirmarInstalacaoPneu");

    const idPneu = campoPneu.value;
    const dataInstalacao = campoData.value;
    const idEquipamento = equipamentoSelecionadoParaInstalacao;
    const posicaoSelecionada = posicaoSelecionadaParaInstalacao;

    if (!idPneu || !dataInstalacao || !idEquipamento || !posicaoSelecionada) {
        mensagem.textContent = "Selecione o pneu, a data e uma posição livre.";
        return;
    }

    if (posicaoSelecionada.idPneuInstalado) {
        mensagem.textContent = "Esta posição já está ocupada.";
        return;
    }

    botaoConfirmar.disabled = true;
    mensagem.textContent = "Registrando instalação...";

    let banco;

    try {
        if (window.maintixApi?.isConfigured) {
            await window.maintixApi.instalarPneu({
                idPneu,
                idEquipamento,
                idPosicao: posicaoSelecionada.id,
                idMovimentacao: "MOV-" + crypto.randomUUID().toUpperCase(),
                data: dataInstalacao
            });
        } else {
            banco = await abrirBancoMAINTIX();

            await new Promise((resolve, reject) => {
            const transacao = banco.transaction(
                ["pneus", "equipamentos", "posicoes", "movimentacoes"],
                "readwrite"
            );

            const tabelaPneus = transacao.objectStore("pneus");
            const tabelaEquipamentos = transacao.objectStore("equipamentos");
            const tabelaPosicoes = transacao.objectStore("posicoes");
            const tabelaMovimentacoes = transacao.objectStore("movimentacoes");

            const requisicaoPneu = tabelaPneus.get(idPneu);
            const requisicaoEquipamento = tabelaEquipamentos.get(idEquipamento);
            const requisicaoPosicao = tabelaPosicoes.get(posicaoSelecionada.id);
            const requisicaoTodasPosicoes = tabelaPosicoes.getAll();

            let pneu;
            let equipamento;
            let posicao;
            let todasPosicoes;
            let leiturasConcluidas = 0;
            let erroValidacao = null;
            let gravacaoIniciada = false;

            function validarEGravar() {
                if (gravacaoIniciada || erroValidacao || leiturasConcluidas !== 4) {
                    return;
                }

                gravacaoIniciada = true;

                if (!pneu) {
                    erroValidacao = new Error("Pneu não encontrado.");
                    transacao.abort();
                    return;
                }
                if (pneu.arquivadoEm) {
                    erroValidacao = new Error("O pneu está arquivado.");
                    transacao.abort();
                    return;
                }

                if (!equipamento || equipamento.arquivadoEm) {
                    erroValidacao = new Error("O equipamento está arquivado ou não foi encontrado.");
                    transacao.abort();
                    return;
                }

                if (obterStatusPneu(pneu) !== STATUS_PNEU.RESERVA_PRONTA_UTILIZACAO) {
                    erroValidacao = new Error(
                        "O pneu selecionado não está com status Reserva pronta utilização."
                    );
                    transacao.abort();
                    return;
                }

                if (!posicao || posicao.idEquipamento !== idEquipamento) {
                    erroValidacao = new Error(
                        "A posição selecionada não pertence a este equipamento."
                    );
                    transacao.abort();
                    return;
                }
                if (posicao.arquivadoEm) {
                    erroValidacao = new Error("A posição está arquivada.");
                    transacao.abort();
                    return;
                }

                if (posicao.idPneuInstalado) {
                    erroValidacao = new Error("Esta posição já está ocupada.");
                    transacao.abort();
                    return;
                }

                const jaInstalado = todasPosicoes.some(
                    item => item.idPneuInstalado === pneu.id
                );

                if (jaInstalado) {
                    erroValidacao = new Error(
                        "Este pneu já está instalado em outra posição."
                    );
                    transacao.abort();
                    return;
                }

                const agora = new Date().toISOString();

                registrarEventoHistoricoPneu(
                    pneu,
                    "STATUS_PNEU",
                    obterStatusPneu(pneu),
                    STATUS_PNEU.APLICADO,
                    agora
                );
                pneu.status = STATUS_PNEU.APLICADO;
                pneu.atualizadoEm = agora;

                posicao.idPneuInstalado = pneu.id;
                posicao.atualizadoEm = agora;

                tabelaPneus.put(pneu);
                tabelaPosicoes.put(posicao);

                tabelaMovimentacoes.add({
                    id: "MOV-" + crypto.randomUUID().toUpperCase(),
                    tipo: "INSTALACAO",
                    idPneu: pneu.id,
                    idEquipamento: idEquipamento,
                    idPosicao: posicao.id,
                    codigoPosicao: posicao.codigo,
                    dataMovimentacao: dataInstalacao,
                    criadoEm: agora
                    });
            }

            requisicaoPneu.onsuccess = function () {
                pneu = requisicaoPneu.result;
                leiturasConcluidas++;
                validarEGravar();
            };

            requisicaoEquipamento.onsuccess = function () {
                equipamento = requisicaoEquipamento.result;
                leiturasConcluidas++;
                validarEGravar();
            };

            requisicaoPosicao.onsuccess = function () {
                posicao = requisicaoPosicao.result;
                leiturasConcluidas++;
                validarEGravar();
            };

            requisicaoTodasPosicoes.onsuccess = function () {
                todasPosicoes = requisicaoTodasPosicoes.result;
                leiturasConcluidas++;
                validarEGravar();
            };

            requisicaoPneu.onerror = () => {
                erroValidacao = requisicaoPneu.error;
                transacao.abort();
            };

            requisicaoEquipamento.onerror = () => {
                erroValidacao = requisicaoEquipamento.error;
                transacao.abort();
            };

            requisicaoPosicao.onerror = () => {
                erroValidacao = requisicaoPosicao.error;
                transacao.abort();
            };

            requisicaoTodasPosicoes.onerror = () => {
                erroValidacao = requisicaoTodasPosicoes.error;
                transacao.abort();
            };

            transacao.oncomplete = () => resolve();

            transacao.onerror = () => {
                reject(erroValidacao || transacao.error);
            };

            transacao.onabort = () => {
                reject(
                    erroValidacao ||
                    transacao.error ||
                    new Error("A instalação foi cancelada.")
                );
            };
            });
        }

        mensagem.textContent = "Instalação registrada com sucesso.";

        document.getElementById("painelInstalacaoPneu").hidden = true;

        posicaoSelecionadaParaInstalacao = null;

        await atualizarTabelaPosicoesEquipamento(idEquipamento);
        await atualizarIndicadores();

        if (typeof listarPneus === "function") {
            await listarPneus();
        }

    } catch (erro) {
        console.error("Erro ao registrar instalação:", erro);

        mensagem.textContent = erro.message ||
            "Não foi possível registrar a instalação.";

        botaoConfirmar.disabled = false;

    } finally {
        if (banco) {
            banco.close();
        }
    }
});

async function verificarTabelasMAINTIX() {
    if (window.maintixApi?.isConfigured) return;

    let banco;

    try {
        banco = await abrirBancoMAINTIX();

        console.log(
            "Tabelas existentes no MAINTIX:",
            Array.from(banco.objectStoreNames)
        );

        console.log(
            "Versão atual do banco:",
            banco.version
        );
    } catch (erro) {
        console.error("Erro ao verificar o banco:", erro);
    } finally {
        if (banco) {
            banco.close();
        }
    }
}

verificarTabelasMAINTIX();


const formRetiradaPneu = document.getElementById("formRetiradaPneu");

formRetiradaPneu.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    const campoData = document.getElementById("dataRetiradaPneu");
    const campoMotivo = document.getElementById("motivoRetiradaPneu");
    const campoStatusAposRetirada = document.getElementById("statusAposRetiradaPneu");
    const mensagem = document.getElementById("mensagemRetiradaPneu");
    const botaoConfirmar = document.getElementById("btnConfirmarRetiradaPneu");

    const dataRetirada = campoData.value;
    const motivoRetirada = campoMotivo.value;
    const statusAposRetirada = campoStatusAposRetirada.value;
    const idEquipamento = equipamentoSelecionadoParaInstalacao;
    const posicaoSelecionada = posicaoSelecionadaParaInstalacao;

    if (
        !dataRetirada ||
        !motivoRetirada ||
        !statusAposRetirada ||
        !idEquipamento ||
        !posicaoSelecionada ||
        !posicaoSelecionada.idPneuInstalado
    ) {
        mensagem.textContent =
            "Selecione uma posição ocupada, a data e o motivo da retirada.";
        return;
    }

    botaoConfirmar.disabled = true;
    mensagem.textContent = "Registrando retirada...";

    let banco;

    try {
        if (window.maintixApi?.isConfigured) {
            await window.maintixApi.retirarPneu({
                idEquipamento,
                idPosicao: posicaoSelecionada.id,
                idMovimentacao: "MOV-" + crypto.randomUUID().toUpperCase(),
                data: dataRetirada,
                motivo: motivoRetirada,
                statusAposRetirada
            });
        } else {
            banco = await abrirBancoMAINTIX();

            await new Promise((resolve, reject) => {
            const transacao = banco.transaction(
                ["pneus", "posicoes", "movimentacoes"],
                "readwrite"
            );

            const tabelaPneus = transacao.objectStore("pneus");
            const tabelaPosicoes = transacao.objectStore("posicoes");
            const tabelaMovimentacoes =
                transacao.objectStore("movimentacoes");

            const requisicaoPosicao =
                tabelaPosicoes.get(posicaoSelecionada.id);

            let erroValidacao = null;
            let gravacaoIniciada = false;

            requisicaoPosicao.onsuccess = function () {
                if (gravacaoIniciada) return;
                gravacaoIniciada = true;

                const posicao = requisicaoPosicao.result;

                if (
                    !posicao ||
                    posicao.idEquipamento !== idEquipamento ||
                    !posicao.idPneuInstalado
                ) {
                    erroValidacao = new Error(
                        "A posição não está ocupada ou não pertence ao equipamento selecionado."
                    );
                    transacao.abort();
                    return;
                }

                const idPneu = posicao.idPneuInstalado;
                const requisicaoPneu = tabelaPneus.get(idPneu);

                requisicaoPneu.onsuccess = function () {
                    const pneu = requisicaoPneu.result;

                    if (!pneu || obterStatusPneu(pneu) !== STATUS_PNEU.APLICADO) {
                        erroValidacao = new Error(
                            "O pneu não foi encontrado ou não está com status Aplicado."
                        );
                        transacao.abort();
                        return;
                    }

                    const agora = new Date().toISOString();

                    registrarEventoHistoricoPneu(
                        pneu,
                        "STATUS_PNEU",
                        obterStatusPneu(pneu),
                        statusAposRetirada,
                        agora
                    );
                    pneu.status = statusAposRetirada;
                    pneu.atualizadoEm = agora;

                    posicao.idPneuInstalado = null;
                    posicao.atualizadoEm = agora;

                    tabelaPneus.put(pneu);
                    tabelaPosicoes.put(posicao);

                    tabelaMovimentacoes.add({
                        id: "MOV-" + crypto.randomUUID().toUpperCase(),
                        tipo: "RETIRADA",
                        idPneu: pneu.id,
                        idEquipamento: idEquipamento,
                        idPosicao: posicao.id,
                        codigoPosicao: posicao.codigo,
                        dataMovimentacao: dataRetirada,
                        motivo: motivoRetirada,
                        statusPneuAposRetirada: statusAposRetirada,
                        criadoEm: agora
                        });
                    }

                requisicaoPneu.onerror = function () {
                    erroValidacao = requisicaoPneu.error;
                    transacao.abort();
                };
            };

            requisicaoPosicao.onerror = function () {
                erroValidacao = requisicaoPosicao.error;
                transacao.abort();
            };

            transacao.oncomplete = () => resolve();

            transacao.onerror = () => {
                reject(erroValidacao || transacao.error);
            };

            transacao.onabort = () => {
                reject(
                    erroValidacao ||
                    transacao.error ||
                    new Error("A retirada foi cancelada.")
                );
            };
            });
        }

        mensagem.textContent =
            "Retirada registrada. Status atualizado para: " +
            ROTULOS_STATUS_PNEU[statusAposRetirada] + ".";

        document.getElementById("painelRetiradaPneu").hidden = true;

        posicaoSelecionadaParaInstalacao = null;

        await atualizarTabelaPosicoesEquipamento(idEquipamento);
        await atualizarIndicadores();

        if (typeof listarPneus === "function") {
            await listarPneus();
        }

    } catch (erro) {
        console.error("Erro ao registrar retirada:", erro);

        mensagem.textContent =
            erro.message || "Não foi possível registrar a retirada.";

        botaoConfirmar.disabled = false;

    } finally {
        if (banco) {
            banco.close();
        }
    }
});


/* =====================================
   NAVEGAÇÃO: HISTÓRICO DE MOVIMENTAÇÕES
===================================== */

const btnAbrirHistoricoMovimentacoes =
    document.getElementById("btnAbrirHistoricoMovimentacoes");

const telaHistoricoMovimentacoes =
    document.getElementById("telaHistoricoMovimentacoes");

const btnVoltarHistoricoMovimentacoes =
    document.getElementById("btnVoltarHistoricoMovimentacoes");

const btnMenuMovimentacoes = document.querySelector(
    '.sidebar-item[data-tela="movimentacoes"]'
);

function abrirTelaHistoricoMovimentacoes() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = true;
    telaListaPneus.hidden = true;
    telaEditarPneu.hidden = true;
    telaHistoricoPneu.hidden = true;
    telaEquipamentos.hidden = true;
    telaRelatorios.hidden = true;

    telaHistoricoMovimentacoes.hidden = false;
    atualizarMenuAtivo("movimentacoes");
    carregarHistoricoMovimentacoes();
}

if (btnAbrirHistoricoMovimentacoes) {
    btnAbrirHistoricoMovimentacoes.addEventListener(
        "click",
        abrirTelaHistoricoMovimentacoes
    );
}

if (btnMenuMovimentacoes) {
    btnMenuMovimentacoes.addEventListener(
        "click",
        abrirTelaHistoricoMovimentacoes
    );
}

if (btnVoltarHistoricoMovimentacoes) {
    btnVoltarHistoricoMovimentacoes.addEventListener("click", function () {
        telaHistoricoMovimentacoes.hidden = true;
        voltarAoPainel();
    });
}


/* =====================================
   HISTÓRICO DE MOVIMENTAÇÕES
===================================== */

async function listarMovimentacoes() {
    return filtrarRegistrosAtivos(await obterTodosRegistros("movimentacoes"));
}


async function carregarMovimentacoesDoPneu(idPneu) {
    const corpoTabela = document.getElementById(
        "corpoTabelaMovimentacoesPneu"
    );

    const mensagem = document.getElementById(
        "mensagemMovimentacoesPneu"
    );

    if (!corpoTabela || !mensagem) {
        console.error(
            "Elementos do histórico de movimentações do pneu não encontrados."
        );
        return;
    }

    corpoTabela.replaceChildren();
    mensagem.textContent = "Carregando movimentações...";

    try {
        const [movimentacoes, equipamentos] = await Promise.all([
            listarMovimentacoes(),
            listarEquipamentos()
        ]);

        const movimentacoesPneu = movimentacoes
            .filter(movimentacao =>
                String(movimentacao.idPneu) === String(idPneu)
            )
            .sort((a, b) => {
                const dataA = new Date(
                    a.dataMovimentacao || a.criadoEm || 0
                ).getTime();

                const dataB = new Date(
                    b.dataMovimentacao || b.criadoEm || 0
                ).getTime();

                return dataA - dataB;
            });

        const mapaEquipamentos = new Map(
            equipamentos.map(equipamento => [
                String(equipamento.id),
                equipamento
            ])
        );

        if (movimentacoesPneu.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 5;
            celula.textContent = "Nenhuma movimentação registrada para este pneu.";

            linha.appendChild(celula);
            corpoTabela.appendChild(linha);

            mensagem.textContent = "Total de movimentações: 0";
            return;
        }

        movimentacoesPneu.forEach(movimentacao => {
            const linha = document.createElement("tr");

            const dataOriginal =
                movimentacao.dataMovimentacao ||
                movimentacao.criadoEm;

            let dataFormatada = "Não informada";

            if (dataOriginal) {
                const data = new Date(dataOriginal);

                if (!Number.isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString("pt-BR");
                }
            }

            let tipoFormatado = movimentacao.tipo || "Não informado";

            if (tipoFormatado === "INSTALACAO") {
                tipoFormatado = "Instalação";
            } else if (tipoFormatado === "RETIRADA") {
                tipoFormatado = "Retirada";
            }

            const equipamento = mapaEquipamentos.get(
                String(movimentacao.idEquipamento)
            );

            let nomeEquipamento = "Não identificado";

            if (equipamento) {
                nomeEquipamento = [
                    equipamento.tag,
                    equipamento.placa,
                    equipamento.modelo
                ]
                    .filter(Boolean)
                    .join(" - ");

                if (!nomeEquipamento) {
                    nomeEquipamento = equipamento.id;
                }
            }

            const posicao =
                movimentacao.codigoPosicao ||
                movimentacao.idPosicao ||
                "Não informada";

            const motivo =
                movimentacao.motivo
                    ? String(movimentacao.motivo).replaceAll("_", " ")
                    : "—";

            [
                dataFormatada,
                tipoFormatado,
                nomeEquipamento,
                posicao,
                motivo
            ].forEach(valor => {
                const celula = document.createElement("td");
                celula.textContent = String(valor);
                linha.appendChild(celula);
            });

            corpoTabela.appendChild(linha);
        });

        mensagem.textContent =
            "Total de movimentações: " + movimentacoesPneu.length;

    } catch (erro) {
        console.error(
            "Erro ao carregar movimentações do pneu:",
            erro
        );

        corpoTabela.replaceChildren();

        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 5;
        celula.textContent = "Erro ao carregar as movimentações.";

        linha.appendChild(celula);
        corpoTabela.appendChild(linha);

        mensagem.textContent =
            "Não foi possível carregar o histórico de movimentações.";
    }
}


async function carregarHistoricoMovimentacoes() {
    const corpo = document.getElementById(
        "corpoTabelaHistoricoMovimentacoes"
    );

    const mensagem = document.getElementById(
        "mensagemHistoricoMovimentacoes"
    );

    corpo.replaceChildren();
    mensagem.textContent = "Consultando movimentações...";

    try {
        const [movimentacoes, pneus, equipamentos] =
            await Promise.all([
                listarMovimentacoes(),
                obterTodosOsPneus(),
                listarEquipamentos()
            ]);

        const pneusPorId = new Map(
            pneus.map(pneu => [String(pneu.id), pneu])
        );

        const equipamentosPorId = new Map(
            equipamentos.map(equipamento => [
                String(equipamento.id),
                equipamento
            ])
        );


        // Campos dos filtros
        const filtroIdPneu = document.getElementById(
            "filtroIdPneuMovimentacao"
        );

        const filtroEquipamento = document.getElementById(
            "filtroEquipamentoMovimentacao"
        );

        const filtroTipo = document.getElementById(
            "filtroTipoMovimentacao"
        );

        const filtroNumeroFogo = document.getElementById(
            "filtroNumeroFogoMovimentacao"
        );

        // Preenche a lista de equipamentos sem perder a seleção
        const equipamentoSelecionado = filtroEquipamento.value;

        filtroEquipamento.replaceChildren();

        const opcaoTodos = document.createElement("option");
        opcaoTodos.value = "";
        opcaoTodos.textContent = "Todos os equipamentos";
        filtroEquipamento.appendChild(opcaoTodos);

        equipamentos.forEach(equipamento => {
            const opcao = document.createElement("option");
            opcao.value = String(equipamento.id);

            opcao.textContent = [
                equipamento.tag,
                equipamento.modelo,
                equipamento.id
            ].filter(Boolean).join(" - ");

            filtroEquipamento.appendChild(opcao);
        });

        filtroEquipamento.value = equipamentoSelecionado;

        // Aplica os filtros selecionados
        const idPesquisado = filtroIdPneu.value.trim().toLowerCase();
        const idEquipamentoPesquisado = filtroEquipamento.value;
        const tipoPesquisado = filtroTipo.value;
        const fogoPesquisado = filtroNumeroFogo.value
            .trim()
            .toLowerCase();

        const movimentacoesFiltradas = movimentacoes.filter(
            movimentacao => {
                const pneu = pneusPorId.get(
                    String(movimentacao.idPneu)
                );

                const idPneu = String(
                    movimentacao.idPneu || ""
                ).toLowerCase();

                const numeroFogo = String(
                    pneu?.numeroFogo || ""
                ).toLowerCase();

                const correspondeId =
                    !idPesquisado || idPneu.includes(idPesquisado);

                const correspondeEquipamento =
                    !idEquipamentoPesquisado ||
                    String(movimentacao.idEquipamento) ===
                        idEquipamentoPesquisado;

                const correspondeTipo =
                    !tipoPesquisado ||
                    movimentacao.tipo === tipoPesquisado;

                const correspondeFogo =
                    !fogoPesquisado ||
                    numeroFogo.includes(fogoPesquisado);

                return (
                    correspondeId &&
                    correspondeEquipamento &&
                    correspondeTipo &&
                    correspondeFogo
                );
            }
        );


        movimentacoesFiltradas.sort((a, b) =>
            new Date(b.dataMovimentacao || b.criadoEm || 0) -
            new Date(a.dataMovimentacao || a.criadoEm || 0)
        );

        if (movimentacoesFiltradas.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 8;
            celula.textContent = "Nenhuma movimentação encontrada para os filtros informados.";
            linha.appendChild(celula);
            corpo.appendChild(linha);

            mensagem.textContent = "Total de movimentações: 0";
            return;
        }

        const podeArquivarMovimentacoes = await usuarioPodeArquivar();
        movimentacoesFiltradas.forEach(movimentacao => {
            const linha = document.createElement("tr");

            const pneu = pneusPorId.get(
                String(movimentacao.idPneu)
            );

            const equipamento = equipamentosPorId.get(
                String(movimentacao.idEquipamento)
            );

            const dataOriginal =
                movimentacao.dataMovimentacao || movimentacao.criadoEm;

            let dataFormatada = "Não informada";

            if (dataOriginal) {
                const data = new Date(dataOriginal);

                if (!Number.isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString("pt-BR");
                } else {
                    dataFormatada = String(dataOriginal);
                }
            }

            const tipo = movimentacao.tipo === "INSTALACAO"
                ? "Instalação"
                : movimentacao.tipo === "RETIRADA"
                    ? "Retirada"
                    : movimentacao.tipo || "Não informado";

            const numeroFogo = pneu?.numeroFogo || "Não informado";

            const nomeEquipamento = equipamento
                ? [
                    equipamento.tag,
                    equipamento.modelo
                ].filter(Boolean).join(" - ")
                : movimentacao.idEquipamento || "Não informado";

            const posicao =
                movimentacao.codigoPosicao || "Não informada";

            const motivo = movimentacao.motivo
                ? movimentacao.motivo.replaceAll("_", " ")
                : "—";

            const valores = [
                dataFormatada,
                tipo,
                movimentacao.idPneu || "Não informado",
                numeroFogo,
                nomeEquipamento,
                posicao,
                motivo
            ];

            valores.forEach(valor => {
                const celula = document.createElement("td");
                celula.textContent = String(valor);
                linha.appendChild(celula);
            });
            const celulaAcoes = linha.insertCell();
            if (podeArquivarMovimentacoes) {
                celulaAcoes.appendChild(
                    criarBotaoArquivar("movimentacoes", movimentacao)
                );
            }

            corpo.appendChild(linha);
        });

        mensagem.textContent =
            "Movimentações encontradas: " + movimentacoesFiltradas.length;

    } catch (erro) {
        console.error(
            "Erro ao carregar histórico de movimentações:",
            erro
        );

        mensagem.textContent =
            "Não foi possível carregar as movimentações. Consulte o console.";
    }
}


/* =====================================
   EVENTOS DOS FILTROS DE MOVIMENTAÇÃO
===================================== */

[
    "filtroIdPneuMovimentacao",
    "filtroEquipamentoMovimentacao",
    "filtroTipoMovimentacao",
    "filtroNumeroFogoMovimentacao"
].forEach(id => {
    const campo = document.getElementById(id);

    if (campo) {
        campo.addEventListener("input", carregarHistoricoMovimentacoes);
        campo.addEventListener("change", carregarHistoricoMovimentacoes);
    }
});

const btnLimparFiltrosMovimentacao = document.getElementById(
    "btnLimparFiltrosMovimentacao"
);

if (btnLimparFiltrosMovimentacao) {
    btnLimparFiltrosMovimentacao.addEventListener("click", () => {
        document.getElementById("filtroIdPneuMovimentacao").value = "";
        document.getElementById("filtroEquipamentoMovimentacao").value = "";
        document.getElementById("filtroTipoMovimentacao").value = "";
        document.getElementById("filtroNumeroFogoMovimentacao").value = "";

        carregarHistoricoMovimentacoes();
    });
}


/* =====================================
   NAVEGAÇÃO: RELATÓRIOS
===================================== */

const btnAbrirRelatorios = document.getElementById(
    "btnAbrirRelatorios"
);

const telaRelatorios = document.getElementById(
    "telaRelatorios"
);

const btnVoltarRelatorios = document.getElementById(
    "btnVoltarRelatorios"
);

const btnMenuRelatorios = document.querySelector(
    '.sidebar-item[data-tela="relatorios"]'
);

function abrirTelaRelatorios() {
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;

    telaCadastro.hidden = true;
    telaListaPneus.hidden = true;
    telaEditarPneu.hidden = true;
    telaHistoricoPneu.hidden = true;
    telaEquipamentos.hidden = true;
    telaHistoricoMovimentacoes.hidden = true;

    telaRelatorios.hidden = false;
    atualizarMenuAtivo("relatorios");
}

if (btnAbrirRelatorios) {
    btnAbrirRelatorios.addEventListener(
        "click",
        abrirTelaRelatorios
    );
}

if (btnMenuRelatorios) {
    btnMenuRelatorios.addEventListener(
        "click",
        abrirTelaRelatorios
    );
}

if (btnVoltarRelatorios) {
    btnVoltarRelatorios.addEventListener("click", function () {
        telaRelatorios.hidden = true;
        voltarAoPainel();
    });
}


/* =====================================
   CONSULTA DO RELATÓRIO DE MOVIMENTAÇÕES
===================================== */

let dadosRelatorioMovimentacoes = [];

async function consultarRelatorioMovimentacoes() {
    const corpo = document.getElementById(
        "corpoTabelaRelatorioMovimentacoes"
    );

    const resumo = document.getElementById(
        "resumoRelatorioMovimentacoes"
    );

    const mensagem = document.getElementById(
        "mensagemRelatorioMovimentacoes"
    );

    const dataInicial = document.getElementById(
        "relatorioDataInicial"
    ).value;

    const dataFinal = document.getElementById(
        "relatorioDataFinal"
    ).value;

    const tipoSelecionado = document.getElementById(
        "relatorioTipoMovimentacao"
    ).value;

    const btnPDF = document.getElementById("btnExportarPDF");
    const btnCSV = document.getElementById("btnExportarCSV");

    if (dataInicial && dataFinal && dataInicial > dataFinal) {
        mensagem.textContent =
            "A data inicial não pode ser posterior à data final.";
        return;
    }

    corpo.replaceChildren();
    resumo.replaceChildren();

    mensagem.textContent = "Consultando movimentações...";

    btnPDF.disabled = true;
    btnCSV.disabled = true;

    try {
        const [movimentacoes, pneus, equipamentos] =
            await Promise.all([
                listarMovimentacoes(),
                obterTodosOsPneus(),
                listarEquipamentos()
            ]);

        const pneusPorId = new Map(
            pneus.map(pneu => [String(pneu.id), pneu])
        );

        const equipamentosPorId = new Map(
            equipamentos.map(equipamento => [
                String(equipamento.id),
                equipamento
            ])
        );

        const resultados = movimentacoes.filter(movimentacao => {
            const dataOriginal =
                movimentacao.dataMovimentacao ||
                movimentacao.criadoEm;

            let dataISO = "";

            if (dataOriginal) {
                const data = new Date(dataOriginal);

                if (!Number.isNaN(data.getTime())) {
                    dataISO = [
                        data.getFullYear(),
                        String(data.getMonth() + 1).padStart(2, "0"),
                        String(data.getDate()).padStart(2, "0")
                    ].join("-");
                } else {
                    dataISO = String(dataOriginal).slice(0, 10);
                }
            }

            const correspondeDataInicial =
                !dataInicial || (dataISO && dataISO >= dataInicial);

            const correspondeDataFinal =
                !dataFinal || (dataISO && dataISO <= dataFinal);

            const correspondeTipo =
                !tipoSelecionado ||
                movimentacao.tipo === tipoSelecionado;

            return (
                correspondeDataInicial &&
                correspondeDataFinal &&
                correspondeTipo
            );
        });

        resultados.sort((a, b) => {
            const dataA = new Date(
                a.dataMovimentacao || a.criadoEm || 0
            );

            const dataB = new Date(
                b.dataMovimentacao || b.criadoEm || 0
            );

            return dataB - dataA;
        });

        dadosRelatorioMovimentacoes = resultados.map(movimentacao => {
            const pneu = pneusPorId.get(
                String(movimentacao.idPneu)
            );

            const equipamento = equipamentosPorId.get(
                String(movimentacao.idEquipamento)
            );

            const dataOriginal =
                movimentacao.dataMovimentacao ||
                movimentacao.criadoEm;

            let dataFormatada = "Não informada";

            if (dataOriginal) {
                const data = new Date(dataOriginal);

                if (!Number.isNaN(data.getTime())) {
                    dataFormatada = data.toLocaleDateString("pt-BR");
                } else {
                    dataFormatada = String(dataOriginal);
                }
            }

            return {
                id: movimentacao.id,
                data: dataFormatada,
                tipo: movimentacao.tipo === "INSTALACAO"
                    ? "Instalação"
                    : movimentacao.tipo === "RETIRADA"
                        ? "Retirada"
                        : movimentacao.tipo || "Não informado",
                idPneu: movimentacao.idPneu || "Não informado",
                numeroFogo: pneu?.numeroFogo || "Não informado",
                equipamento: equipamento
                    ? [
                        equipamento.tag,
                        equipamento.modelo
                    ].filter(Boolean).join(" - ")
                    : movimentacao.idEquipamento || "Não informado",
                posicao: movimentacao.codigoPosicao || "Não informada",
                motivo: movimentacao.motivo
                    ? movimentacao.motivo.replaceAll("_", " ")
                    : "—"
            };
        });

        if (dadosRelatorioMovimentacoes.length === 0) {
            const linha = document.createElement("tr");
            const celula = document.createElement("td");

            celula.colSpan = 8;
            celula.textContent =
                "Nenhuma movimentação encontrada para os filtros informados.";

            linha.appendChild(celula);
            corpo.appendChild(linha);

            resumo.textContent = "Nenhum registro encontrado.";
            mensagem.textContent = "Consulta concluída: 0 movimentações.";

            return;
        }

        let totalInstalacoes = 0;
        let totalRetiradas = 0;
        const podeArquivarRelatorio = await usuarioPodeArquivar();

        dadosRelatorioMovimentacoes.forEach(registro => {
            if (registro.tipo === "Instalação") {
                totalInstalacoes++;
            }

            if (registro.tipo === "Retirada") {
                totalRetiradas++;
            }

            const linha = document.createElement("tr");

            [
                registro.data,
                registro.tipo,
                registro.idPneu,
                registro.numeroFogo,
                registro.equipamento,
                registro.posicao,
                registro.motivo
            ].forEach(valor => {
                const celula = document.createElement("td");
                celula.textContent = String(valor);
                linha.appendChild(celula);
            });
            const celulaAcoes = linha.insertCell();
            if (podeArquivarRelatorio) {
                if (registro.id) {
                    celulaAcoes.appendChild(
                        criarBotaoArquivar("movimentacoes", registro)
                    );
                }
            }

            corpo.appendChild(linha);
        });

        const paragrafoResumo = document.createElement("p");

        paragrafoResumo.textContent =
            "Total: " + dadosRelatorioMovimentacoes.length +
            " | Instalações: " + totalInstalacoes +
            " | Retiradas: " + totalRetiradas;

        resumo.appendChild(paragrafoResumo);

        mensagem.textContent = "Relatório consultado com sucesso.";

        btnPDF.disabled = false;
        btnCSV.disabled = false;

    } catch (erro) {
        console.error("Erro ao consultar relatório:", erro);

        mensagem.textContent =
            "Erro ao consultar o relatório. Verifique o console.";

        dadosRelatorioMovimentacoes = [];
    }
}

const btnConsultarRelatorio = document.getElementById(
    "btnConsultarRelatorio"
);

if (btnConsultarRelatorio) {
    btnConsultarRelatorio.addEventListener(
        "click",
        consultarRelatorioMovimentacoes
    );
}


/* =====================================
   EXPORTAÇÃO DO RELATÓRIO PARA PDF
===================================== */

function gerarPDFRelatorioMovimentacoes() {
    if (!dadosRelatorioMovimentacoes.length) {
        alert("Consulte um relatório com registros antes de gerar o PDF.");
        return;
    }

    const dataInicial = document.getElementById(
        "relatorioDataInicial"
    ).value;

    const dataFinal = document.getElementById(
        "relatorioDataFinal"
    ).value;

    const tipoSelecionado = document.getElementById(
        "relatorioTipoMovimentacao"
    ).value;

    const formatarData = valor => {
        if (!valor) return "Não informada";

        const partes = valor.split("-");

        if (partes.length !== 3) return valor;

        return partes[2] + "/" + partes[1] + "/" + partes[0];
    };

    const escapeHTML = valor =>
        String(valor ?? "").replace(/[&<>"']/g, caractere => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caractere]);

    const totalInstalacoes = dadosRelatorioMovimentacoes.filter(
        registro => registro.tipo === "Instalação"
    ).length;

    const totalRetiradas = dadosRelatorioMovimentacoes.filter(
        registro => registro.tipo === "Retirada"
    ).length;

    const linhas = dadosRelatorioMovimentacoes.map(registro => `
        <tr>
            <td>${escapeHTML(registro.data)}</td>
            <td>${escapeHTML(registro.tipo)}</td>
            <td>${escapeHTML(registro.idPneu)}</td>
            <td>${escapeHTML(registro.numeroFogo)}</td>
            <td>${escapeHTML(registro.equipamento)}</td>
            <td>${escapeHTML(registro.posicao)}</td>
            <td>${escapeHTML(registro.motivo)}</td>
        </tr>
    `).join("");

    const janela = window.open("", "_blank");

    if (!janela) {
        alert("O navegador bloqueou a janela de impressão. Permita pop-ups para o MAINTIX e tente novamente.");
        return;
    }

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>MAINTIX - Relatório de Movimentações</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    color: #222;
                    margin: 20px;
                }

                h1 {
                    margin-bottom: 4px;
                    color: #14243A;
                }

                .subtitulo {
                    margin-top: 0;
                    color: #555;
                }

                .resumo {
                    margin: 20px 0;
                    padding: 12px;
                    border: 1px solid #ccc;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                th, td {
                    border: 1px solid #bbb;
                    padding: 6px;
                    text-align: left;
                    overflow-wrap: anywhere;
                }

                th {
                    background: #e8edf3;
                }

                thead {
                    display: table-header-group;
                }

                tr {
                    break-inside: avoid;
                }

                @page {
                    size: landscape;
                    margin: 12mm;
                }

                @media print {
                    body {
                        margin: 0;
                    }
                }
            </style>
        </head>
        <body>
            <h1>MAINTIX | Gestão de Pneus</h1>
            <p class="subtitulo">Relatório de movimentações</p>

            <p>
                <strong>Período:</strong>
                ${escapeHTML(formatarData(dataInicial))}
                até
                ${escapeHTML(formatarData(dataFinal))}
            </p>

            <p>
                <strong>Tipo:</strong>
                ${escapeHTML(
                    tipoSelecionado === "INSTALACAO"
                        ? "Instalação"
                        : tipoSelecionado === "RETIRADA"
                            ? "Retirada"
                            : "Todos os tipos"
                )}
            </p>

            <div class="resumo">
                <strong>Total de movimentações:</strong>
                ${dadosRelatorioMovimentacoes.length}
                &nbsp; | &nbsp;
                <strong>Instalações:</strong> ${totalInstalacoes}
                &nbsp; | &nbsp;
                <strong>Retiradas:</strong> ${totalRetiradas}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Tipo</th>
                        <th>ID do pneu</th>
                        <th>Número de fogo</th>
                        <th>Equipamento</th>
                        <th>Posição</th>
                        <th>Motivo</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>

            <p>
                <small>Emitido em ${escapeHTML(
                    new Date().toLocaleString("pt-BR")
                )}</small>
            </p>

            <script>
                window.onload = function () {
                    window.focus();
                    window.print();
                };
            <\/script>
        </body>
        </html>
    `);

    janela.document.close();
}

const btnExportarPDF = document.getElementById("btnExportarPDF");

if (btnExportarPDF) {
    btnExportarPDF.addEventListener(
        "click",
        gerarPDFRelatorioMovimentacoes
    );
}


/* =====================================
   EXPORTAÇÃO CSV PARA EXCEL
===================================== */

function exportarRelatorioCSV() {
    if (!dadosRelatorioMovimentacoes.length) {
        alert("Consulte um relatório com registros antes de exportar.");
        return;
    }

    const cabecalho = [
        "Data",
        "Tipo de movimentação",
        "ID do pneu",
        "Número de fogo",
        "Equipamento",
        "Posição",
        "Motivo"
    ];

    const linhas = dadosRelatorioMovimentacoes.map(registro => [
        registro.data,
        registro.tipo,
        registro.idPneu,
        registro.numeroFogo,
        registro.equipamento,
        registro.posicao,
        registro.motivo
    ]);

    function escaparCSV(valor) {
        let texto = String(valor ?? "");

        // Evita que textos iniciados por fórmulas sejam executados no Excel.
        if (/^[\s]*[=+\-@]/.test(texto)) {
            texto = "'" + texto;
        }

        return '"' + texto.replace(/"/g, '""') + '"';
    }

    const conteudo = [
        cabecalho,
        ...linhas
    ]
        .map(linha => linha.map(escaparCSV).join(";"))
        .join("\r\n");

    // BOM UTF-8 para preservar acentos no Excel.
    const arquivo = new Blob(
        ["\uFEFF" + conteudo],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");

    const dataHoje = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = "MAINTIX_Relatorio_Movimentacoes_" +
        dataHoje + ".csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    document.getElementById(
        "mensagemRelatorioMovimentacoes"
    ).textContent = "Arquivo CSV exportado com sucesso.";
}

const btnExportarCSV = document.getElementById("btnExportarCSV");

if (btnExportarCSV) {
    btnExportarCSV.addEventListener(
        "click",
        exportarRelatorioCSV
    );
}


/* =========================================
   MAINTIX - MENU LATERAL RECOLHÍVEL
   Etapa 2.3
========================================= */

(function configurarMenuLateral() {
    const menu = document.getElementById("menuLateral");
    const botao = document.getElementById("btnAlternarMenu");

    if (!menu || !botao) {
        console.warn(
            "MAINTIX: menu lateral ou botão de navegação não encontrado."
        );
        return;
    }

    // Estado inicial: menu aberto no computador
    document.body.classList.add("menu-aberto");
    document.body.classList.remove("menu-recolhido");

    botao.setAttribute("aria-expanded", "true");
    botao.setAttribute("aria-label", "Recolher menu");

    botao.addEventListener("click", function () {
        const estaAberto =
            document.body.classList.contains("menu-aberto");

        if (estaAberto) {
            document.body.classList.remove("menu-aberto");
            document.body.classList.add("menu-recolhido");

            botao.setAttribute("aria-expanded", "false");
            botao.setAttribute("aria-label", "Abrir menu");
        } else {
            document.body.classList.remove("menu-recolhido");
            document.body.classList.add("menu-aberto");

            botao.setAttribute("aria-expanded", "true");
            botao.setAttribute("aria-label", "Recolher menu");
        }
    });
})();


/* =====================================
   MAINTIX - CONTROLE DE RECAPAGENS
===================================== */
(function configurarRecapagens() {
    const tela = document.getElementById("telaRecapagens");
    const menu = document.querySelector('.sidebar-item[data-tela="recapagens"]');
    const formulario = document.getElementById("formRecapagem");
    const seletorPneu = document.getElementById("recapagemIdPneu");
    const mensagem = document.getElementById("mensagemRecapagem");
    const corpoTabela = document.getElementById("corpoTabelaRecapagens");
    const mensagemLista = document.getElementById("mensagemListaRecapagens");
    const btnLimpar = document.getElementById("btnLimparRecapagem");
    const btnAtualizar = document.getElementById("btnAtualizarRecapagens");
    const btnVoltar = document.getElementById("btnVoltarPainelRecapagens");

    if (!tela || !formulario || !seletorPneu || !corpoTabela) return;

    function valor(id) {
        return document.getElementById(id).value.trim();
    }

    function numeroOpcional(id) {
        const v = valor(id);
        return v === "" ? null : Number(v);
    }

    async function obterTodos(nomeStore) {
        return filtrarRegistrosAtivos(await obterTodosRegistros(nomeStore));
    }

    async function carregarPneus() {
        const selecionado = seletorPneu.value;
        const pneus = await obterTodos(nomeTabelaPneus);
        seletorPneu.replaceChildren(new Option("Selecione um pneu", ""));
        pneus.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
        pneus.forEach(pneu => {
            const identificacao = [pneu.id, pneu.numeroFogo ? "Fogo: " + pneu.numeroFogo : "", pneu.marca || "", pneu.modelo || "", pneu.medida || ""]
                .filter(Boolean).join(" — ");
            seletorPneu.add(new Option(identificacao, pneu.id));
        });
        if (pneus.some(p => p.id === selecionado)) seletorPneu.value = selecionado;
        if (!pneus.length) mensagem.textContent = "Cadastre um pneu antes de registrar uma recapagem.";
    }

    async function listarRecapagens() {
        corpoTabela.replaceChildren();
        try {
            const [registros, pneus] = await Promise.all([
                obterTodos("recapagens"), obterTodos(nomeTabelaPneus)
            ]);
            const podeArquivar = await usuarioPodeArquivar();
            const porId = new Map(pneus.map(p => [p.id, p]));
            registros.sort((a, b) => (b.dataEnvio || "").localeCompare(a.dataEnvio || ""));
            if (!registros.length) {
                const tr = corpoTabela.insertRow();
                const td = tr.insertCell(); td.colSpan = 9; td.textContent = "Nenhuma recapagem registrada.";
                mensagemLista.textContent = "";
                return;
            }
            registros.forEach(r => {
                const tr = corpoTabela.insertRow();
                const leituras = [];
                if (r.kmEnvio !== null || r.kmRetorno !== null) leituras.push("KM: " + (r.kmEnvio ?? "—") + " → " + (r.kmRetorno ?? "—"));
                if (r.horimetroEnvio !== null || r.horimetroRetorno !== null) leituras.push("Horímetro: " + (r.horimetroEnvio ?? "—") + " → " + (r.horimetroRetorno ?? "—"));
                const pneu = porId.get(r.idPneu);
                const dados = [r.dataEnvio || "—", r.idPneu + (pneu && pneu.numeroFogo ? " / Fogo " + pneu.numeroFogo : ""), r.empresa || "—", r.dataRetorno || "Pendente", Number(r.custo || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"}), leituras.join(" | ") || "Não informado", r.status || "—", r.observacoes || "—"];
                dados.forEach(d => { const td = tr.insertCell(); td.textContent = String(d); });
                const celulaAcoes = tr.insertCell();
                if (podeArquivar) {
                    celulaAcoes.appendChild(criarBotaoArquivar("recapagens", r));
                }
            });
            mensagemLista.textContent = "Total de registros de recapagem: " + registros.length;
        } catch (erro) {
            console.error("Erro ao listar recapagens:", erro);
            mensagemLista.textContent = "Não foi possível carregar o histórico de recapagens.";
        }
    }

    async function abrirTela() {
        if (typeof ocultarTelasInternas === "function") ocultarTelasInternas();
        ["telaCadastro", "telaListaPneus", "telaEditarPneu", "telaHistoricoPneu", "telaEquipamentos", "telaHistoricoMovimentacoes", "telaRelatorios", "telaPosicoesEquipamento", "telaListaEquipamentos"].forEach(id => {
            const el = document.getElementById(id); if (el) el.hidden = true;
        });
        const welcome = document.querySelector(".welcome");
        const metrics = document.querySelector(".metrics");
        const modules = document.querySelector(".module-section:not([id])");
        if (welcome) welcome.hidden = true;
        if (metrics) metrics.hidden = true;
        if (modules) modules.hidden = true;
        tela.hidden = false;
        atualizarMenuAtivo("recapagens");
        mensagem.textContent = "";
        await carregarPneus();
        await listarRecapagens();
    }

    if (menu) menu.addEventListener("click", abrirTela);

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        const idPneu = seletorPneu.value;
        const dataEnvio = valor("recapagemDataEnvio");
        const dataRetorno = valor("recapagemDataRetorno");
        const custo = Number(valor("recapagemCusto"));
        const kmEnvio = numeroOpcional("recapagemKmEnvio");
        const kmRetorno = numeroOpcional("recapagemKmRetorno");
        const horimetroEnvio = numeroOpcional("recapagemHorimetroEnvio");
        const horimetroRetorno = numeroOpcional("recapagemHorimetroRetorno");
        if (!idPneu) { mensagem.textContent = "Selecione o pneu."; return; }
        if (dataRetorno && dataRetorno < dataEnvio) { mensagem.textContent = "A data de retorno não pode ser anterior à data de envio."; return; }
        if (kmEnvio !== null && kmRetorno !== null && kmRetorno < kmEnvio) { mensagem.textContent = "A quilometragem de retorno não pode ser menor que a de saída."; return; }
        if (horimetroEnvio !== null && horimetroRetorno !== null && horimetroRetorno < horimetroEnvio) { mensagem.textContent = "O horímetro de retorno não pode ser menor que o da saída."; return; }
        const registro = {
            id: "REC-" + (crypto.randomUUID ? crypto.randomUUID().toUpperCase() : Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase()),
            idPneu, empresa: valor("recapagemEmpresa"), dataEnvio, dataRetorno: dataRetorno || "",
            custo, kmEnvio, kmRetorno, horimetroEnvio, horimetroRetorno,
            status: valor("recapagemStatus"), observacoes: valor("recapagemObservacoes"),
            criadoEm: new Date().toISOString()
        };
        try {
            if (window.maintixApi?.isConfigured) {
                await window.maintixApi.inserir("recapagens", registro);
            } else {
                const banco = await abrirBancoMAINTIX();
                try {
                    await new Promise((resolve, reject) => {
                        const tx = banco.transaction("recapagens", "readwrite");
                        tx.objectStore("recapagens").add(registro);
                        tx.oncomplete = resolve;
                        tx.onerror = () => reject(tx.error);
                        tx.onabort = () => reject(tx.error);
                    });
                } finally {
                    banco.close();
                }
            }
            mensagem.textContent = "Recapagem registrada. Código: " + registro.id;
            formulario.reset();
            document.getElementById("recapagemDataEnvio").value = new Date().toISOString().slice(0, 10);
            await carregarPneus();
            await listarRecapagens();
        } catch (erro) {
            console.error("Erro ao registrar recapagem:", erro);
            mensagem.textContent = "Não foi possível registrar a recapagem. Consulte o Console.";
        }
    });

    if (btnLimpar) btnLimpar.addEventListener("click", () => {
        formulario.reset();
        document.getElementById("recapagemDataEnvio").value = new Date().toISOString().slice(0, 10);
        mensagem.textContent = "Formulário limpo.";
    });
    if (btnAtualizar) btnAtualizar.addEventListener("click", listarRecapagens);
    if (btnVoltar) btnVoltar.addEventListener("click", () => {
        tela.hidden = true;
        if (typeof voltarAoPainel === "function") voltarAoPainel();
    });
    document.getElementById("recapagemDataEnvio").value = new Date().toISOString().slice(0, 10);
})();

async function listarRegistrosArquivados() {
    const corpo = document.getElementById("corpoTabelaArquivados");
    const mensagem = document.getElementById("mensagemArquivados");
    const tipoSelecionado = document.getElementById("filtroTipoArquivado").value;
    corpo.replaceChildren();
    mensagem.textContent = "Consultando registros arquivados...";

    try {
        const tabelas = tipoSelecionado
            ? TABELAS_ARQUIVAVEIS.filter(([tabela]) => tabela === tipoSelecionado)
            : TABELAS_ARQUIVAVEIS;
        const grupos = await Promise.all(tabelas.map(async ([tabela, rotulo]) => ({
            tabela,
            rotulo,
            registros: (await obterTodosRegistros(tabela))
                .filter(registro => registro.arquivadoEm)
        })));
        const registros = grupos.flatMap(grupo =>
            grupo.registros.map(registro => ({
                ...registro,
                tabela: grupo.tabela,
                rotulo: grupo.rotulo
            }))
        ).sort((a, b) =>
            String(b.arquivadoEm).localeCompare(String(a.arquivadoEm))
        );

        if (!registros.length) {
            const linha = corpo.insertRow();
            const celula = linha.insertCell();
            celula.colSpan = 5;
            celula.textContent = "Nenhum registro arquivado.";
            mensagem.textContent = "";
            return;
        }

        registros.forEach(registro => {
            const linha = corpo.insertRow();
            const identificacao = {
                pneus: [
                    registro.numeroFogo,
                    registro.marca,
                    registro.modelo,
                    registro.medida
                ].filter(Boolean).join(" · "),
                equipamentos: [
                    registro.tag,
                    registro.placa,
                    registro.modelo
                ].filter(Boolean).join(" · "),
                posicoes: [
                    registro.idEquipamento,
                    registro.codigo,
                    `Eixo ${registro.eixo}`,
                    registro.lado
                ].filter(Boolean).join(" · "),
                movimentacoes: [
                    registro.tipo,
                    registro.idPneu,
                    registro.dataMovimentacao,
                    registro.codigoPosicao
                ].filter(Boolean).join(" · "),
                recapagens: [
                    registro.idPneu,
                    registro.empresa,
                    registro.dataEnvio
                ].filter(Boolean).join(" · ")
            }[registro.tabela];
            [
                registro.rotulo,
                registro.id,
                identificacao || "Sem detalhes adicionais",
                new Date(registro.arquivadoEm).toLocaleString("pt-BR")
            ].forEach(valor => {
                linha.insertCell().textContent = String(valor);
            });

            const celulaAcoes = linha.insertCell();
            const botaoRestaurar = document.createElement("button");
            botaoRestaurar.type = "button";
            botaoRestaurar.textContent = "Restaurar";
            botaoRestaurar.addEventListener("click", async () => {
                if (!window.confirm(`Restaurar ${registro.rotulo.toLowerCase()} ${registro.id}?`)) {
                    return;
                }
                botaoRestaurar.disabled = true;
                try {
                    await alterarArquivamento(registro.tabela, registro.id, false);
                    await listarRegistrosArquivados();
                } catch (erro) {
                    console.error("Erro ao restaurar registro:", erro);
                    window.alert(erro.message || "Não foi possível restaurar o registro.");
                    botaoRestaurar.disabled = false;
                }
            });
            celulaAcoes.appendChild(botaoRestaurar);
        });
        mensagem.textContent = `Registros arquivados: ${registros.length}`;
    } catch (erro) {
        console.error("Erro ao consultar registros arquivados:", erro);
        mensagem.textContent =
            erro.message || "Não foi possível carregar os registros arquivados.";
    }
}

async function abrirTelaArquivados() {
    try {
        if (!await usuarioPodeArquivar()) {
            window.alert("Somente administradores podem consultar os registros arquivados.");
            return;
        }
    } catch (erro) {
        console.error("Erro ao validar acesso aos registros arquivados:", erro);
        window.alert("Não foi possível validar sua permissão para acessar os registros arquivados.");
        return;
    }
    ocultarTelasInternas();
    secaoBoasVindas.hidden = true;
    secaoIndicadores.hidden = true;
    secaoModulos.hidden = true;
    const tela = document.getElementById("telaArquivados");
    tela.hidden = false;
    atualizarMenuAtivo("arquivados");
    await listarRegistrosArquivados();
}

document.getElementById("btnMenuArquivados")
    .addEventListener("click", abrirTelaArquivados);
document.getElementById("filtroTipoArquivado")
    .addEventListener("change", listarRegistrosArquivados);
