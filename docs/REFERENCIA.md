# Vigia — Referência técnica

> Documento de contexto para retomar o desenvolvimento em outra sessão de IA.
> Descreve **o que existe**, **onde está** e **o que não pode ser quebrado**.
>
> Última atualização: agosto/2026 · `schemaVersion: 8` · versão `1.0.0-beta` · service worker `vigia-v23`

---

## 1. O que é

Duas peças que compartilham o mesmo Firestore:

| Peça | Repositório | Branch | Onde roda |
|---|---|---|---|
| **Vigia** — PWA de finanças pessoais | `mpteixeirarj-glit/vigia` | `main` | GitHub Pages |
| **Vigia Bot** — bot de WhatsApp | `mpteixeirarj-glit/vigia-bot` | `claude/vigia-whatsapp-bot-firebase-b7waop` | Railway |

Projeto Firebase: **`vigia-56137`**.

### Estrutura de arquivos

```
vigia/
├── index.html          o app INTEIRO (~4.100 linhas: HTML + CSS + JS)
├── sw.js               service worker (cache-first)
├── manifest.json       manifesto do PWA
├── firestore.rules     regras de segurança (publicadas à mão no console)
├── cartoes/            10 PNGs base dos cartões
├── screenshots/        37 telas usadas na landing
├── logo-animado.mp4    vídeo do hero da landing
├── icon-192.png, icon-512.png, olho-*.png
└── docs/               esta referência e o guia do usuário

vigia-bot/
├── index.js            servidor HTTP + conexão WhatsApp + fluxo de conversa
├── firebase.js         inicialização do Firebase Admin
├── vigia.js            operações no Firestore
├── parser.js           interpreta "gastei 25 no mercado"
├── calculos.js         fórmulas do app portadas (fatura, parcela, cofrinho)
├── alertas.js          monta o texto dos avisos — puro, sem rede
├── agenda.js           cron e a leva de envio
└── alertas.test.js     39 testes (rodar: node alertas.test.js)
```

### Stack

- **PWA:** HTML/CSS/JS puro em arquivo único, sem build, sem framework. Firebase JS SDK 10.12.0 via CDN (`type="module"`), exposto em `window.Vigia`.
- **Bot:** Node ≥20, Baileys 6.7.x, firebase-admin, express, node-cron.

---

## 2. Regras da casa

Quebrar qualquer uma destas causa bug silencioso ou vazamento. Leia antes de mexer.

### 2.1 `dados/principal` é gravado INTEIRO

```js
await setDoc(docPrincipal(uid), dados, {merge:false});
```

Todo campo que não estiver no objeto local do navegador **é apagado** no próximo salvamento. Nunca guarde ali nada que o bot escreva — a preferência sobreviveria poucas horas e sumiria sozinha, sem erro nenhum no log.

Dados escritos pelo bot vão para documentos separados: `usuarios/{uid}/config/notificacoes` e `usuarios/{uid}/alertas/{id}`.

### 2.2 `assinaturas/{uid}` nunca é gravável pelo cliente

Como o app grava `dados/principal` inteiro pelo navegador, um campo de plano ali seria editável por qualquer um pelo console. Quem grava assinatura é o bot (Admin SDK) ou o webhook do pagamento.

### 2.3 `vinculos_pendentes` nunca é LEGÍVEL pelo cliente

Quem lê um código pendente vincula o **próprio** número à conta alheia. O app só faz `create` — códigos repetidos são recusados pelas regras e o app tenta outro. Não existe "verificar se já existe".

### 2.4 O bot falha fechado

Erro de leitura de assinatura, de config ou de registro de alertas **nega**, nunca libera.

### 2.5 O bot não responde em conversa de terceiro

`msg.key.fromMe` é verdadeiro em **toda** mensagem enviada pela conta conectada, inclusive nas conversas do dono com outras pessoas. Autorizar por remetente faria o bot responder dentro do chat dos amigos do dono. A conversa também precisa ser o self-chat.

### 2.6 O WhatsApp usa LID

A conversa chega como `<lid>@lid` e o número real vai em `key.senderPn` / `key.participantPn`. Por isso `processarMensagem` recebe a `key` inteira, não só o `remoteJid`.

### 2.7 Bump do service worker a cada deploy

`sw.js` é cache-first. Sem trocar `const CACHE = 'vigia-vNN'`, o usuário continua com a versão velha. **Está em `vigia-v23`.**

### 2.8 Migração encadeada

Toda mudança de formato precisa de `migrarVNparaVN+1` chamada em sequência dentro de `getD()`, e o `schemaVersion` de `INIT` e de `onbConfirmar()` sobe junto. Campos novos ganham default defensivo no fim de `getD()` — dado que veio da nuvem pode ser mais velho que a migração.

### 2.9 Campo de dinheiro nunca é lido com `parseFloat(.value)`

Os 23 campos de `MOEDA_INPUTS` formatam enquanto a pessoa digita: "7785" vira
"77,85". Depois disso `parseFloat("1.111.111,11")` devolve **1.111**. Toda
leitura passa por `obterValorInput()`, toda escrita por `setValorInput()` e
toda limpeza por `limparValorInput()`/`limparCampos()` — limpar só o `.value`
deixa o `dataset.valor` antigo e o campo grava o valor do lançamento anterior.

### 2.10 Verifique `git status -sb` antes de commitar

O clone local desta máquina já perdeu commits duas vezes. Sempre `git fetch` e compare com o remoto antes.

### 2.11 O perfil decide o que é OFERECIDO, não o que é ocultado

Trocar de perfil nunca esconde nem apaga dado já cadastrado. Quem tem receita fixa continua vendo no perfil autônomo.

---

## 3. Modelo de dados

### 3.1 `usuarios/{uid}/dados/principal` — schemaVersion 8

```js
{
  schemaVersion: 8,
  nome: "Marcos Paulo",
  perfil: null | "clt" | "autonomo" | "misto" | "vendedor",
  subPerfil: null | "marketplace" | "direto" | "misto_vendedor",  // só vendedor
  metaRendaMensal: 0,

  receitasFixas:   [{ id, dia, nome, valor }],
  despesasFixas:   [{ id, dia, nome, valor, descontadoNaFonte }],
  parcelamentos:   [{ id, nome, valor, total, mesIni, anoIni, cartao, dia }],
  cofrinhos:       [{ id, nome, teto, valorMensal, dia, mesIni, anoIni }],
  investimentos:   [{ id, nome, tipo, cotas, precoCota, metaPercentual }],
  cartoes:         [{ id, nome, titular, bandeira, corBase, teto, diaVencimento }],

  receitasParceladas: [{
    id, descricao, valorParcela, total,
    mesInicio, anoInicio, diaRecebimento, forma: "parcelado",
    ativo: true|false, mesEncerrado, anoEncerrado
  }],

  avisosSilenciados: { "<chave>": <timestampAte> },

  meses: {
    "2026-08": {
      receitas:  [{ id, nome, valor, dia, cat, tipo }],
      consumo:   [{ id, nome, valor, dia, cat, cartao, fonte }],
      reserva:   [{ id, nome, valor, dia }],
      vendas:    [{ id, desc, valor, custo, taxa, taxaPct, qtd, dia, canal, forma }],
      cofres:    [{ id, nome, valor, dia, cofrinhoId }],
      confirmacoes: { "<idDoItemFixo>": { confirmado: true, valor: 1850 } }
    }
  },
  historico: [], ultimoMesReal: null
}
```

**Atenção aos nomes:** parcelamento usa `mesIni`/`anoIni`; receita parcelada usa `mesInicio`/`anoInicio`. São campos diferentes de coisas diferentes.

### 3.2 Outras coleções

| Caminho | Quem escreve | Conteúdo |
|---|---|---|
| `usuarios/{uid}/config/notificacoes` | app e bot | `{ ativo, horario, tipos:{...}, atualizadoEm }` |
| `usuarios/{uid}/alertas/{YYYY-MM-DD}` | bot | `{ contas: [refs] }` — avisos de data já enviados hoje |
| `usuarios/{uid}/alertas/mes-{YYYY-MM}` | bot | `{ tetos, metas, cofrinhos }` — faixas já avisadas no mês |
| `assinaturas/{uid}` | **só** backend | `{ status, validoAte, origem, atualizadoEm }` |
| `whatsapp_usuarios/{numero}` | **só** bot | `{ uid, numero, nome, vinculadoEm }` |
| `vinculos_pendentes/{codigo}` | app cria, bot consome | `{ uid, nome, expiraEm }` |

`status` da assinatura: `ativa` e `teste` liberam; `expirada` e `cancelada` não. `validoAte` no passado invalida qualquer um.

### 3.3 localStorage

| Chave | Conteúdo |
|---|---|
| `vigia_v3_{uid}` | cópia local dos dados (`chaveLocal()`) |
| `vigia_ultimo_uid` | última conta logada, para o modo offline |
| `vigia_onboarding_visto` | intro de 3 slides já vista |
| `vigia_fonte` | escala do texto: `n`, `g` ou `gg` |

E em `sessionStorage` (morre ao fechar o app): `vigia_saiu_em`, hora em que o app
foi para segundo plano, usada para conferir o tempo real de inatividade na volta.

---

## 4. Telas e navegação

### Entrada no app

```
bootSplash → onVigiaAuthChange
   ├─ sem usuário + nunca entrou neste aparelho → #landing
   ├─ sem usuário + já entrou                   → #login
   └─ com usuário → splash → app
```

`.logado` no `<body>` é o que liga o layout de computador: acima de 768px troca
a navegação de baixo (`.botnav`) pelo menu lateral (`.sidebar`) e limita o
conteúdo a 920px. A landing e o login nunca têm essa classe.

`VERSAO` (`1.0.0-beta`) aparece em três lugares: rodapé da landing, menu
lateral e ⚙ Configurações → Aplicativo.

| Tela | id | Renderizador |
|---|---|---|
| Início | `t-inicio` | `renderInicio()` |
| Agenda | `t-agenda` | `renderAgenda()` |
| Cartões | `t-cartoes` | `renderCartoes()` |
| Histórico | `t-historico` | `renderHist()` |

Sobreposições fora do fluxo: `#bootSplash`, `#splash`, `#intro`, `#login`, `#telaPerfil`.

`ir(t, btn)` troca de tela e chama `renderTudo()`, que sempre roda `renderPerfilUI()` e `renderAvisos()` antes do renderizador da tela atual.

**Modais** (`.ov`, abrem com `.on`): `ovL` lançamento · `ovC` confirmação de fixa · `ovE` editar · `ovP` editar parcelamento · `ovCofre` · `ovInvest` · `ovParabens` · `ovRecebimento` · `ovMeta` · `ovAvisos` · `ovConfig` · `ovCartao` · `ovD` dia da agenda · `ovOnb` onboarding · `ovConfirm` · `ovAlerta`.

Abre com `document.getElementById(id).classList.add('on')`, fecha com `fechar(id)`. `fecharFora(e,id)` fecha ao tocar no fundo. **Nunca** use `style="display:none"` inline nesses modais: vence a classe `.on` e o modal não abre nunca mais.

---

## 5. Funções do app (`index.html`)

### 5.1 Ponte com o Firebase — `window.Vigia`

Módulo ES separado no topo do arquivo. O resto do app é script clássico e só acessa o Firebase por aqui.

| Função | O que faz |
|---|---|
| `loginGoogle()` | popup, com fallback para redirect |
| `loginEmail(email,senha)` / `criarConta(email,senha)` | autenticação por e-mail |
| `sair()` | encerra sessão e cancela o snapshot |
| `carregarNuvem(uid)` | dados, `null` (sem doc) ou `undefined` (falha) — os três casos importam |
| `salvarNuvem(uid,dados)` | `setDoc` com `merge:false` — ver §2.1 |
| `assinarNuvem(uid,cb)` / `pararAssinatura()` | onSnapshot em tempo real |
| `vinculoDoUsuario(uid)` | busca em `whatsapp_usuarios` por uid |
| `criarVinculoPendente(codigo,dados)` | só `create` — ver §2.3 |
| `cancelarVinculoPendente(codigo)` / `removerVinculo(numero)` | limpeza |
| `assinatura(uid)` | lê `assinaturas/{uid}` |
| `configNotificacoes(uid)` / `salvarConfigNotificacoes(uid,cfg)` | preferências de aviso |

### 5.2 Dados, migração e persistência

| Função | O que faz |
|---|---|
| `getD()` | **ponto de entrada de tudo.** Lê o localStorage, roda as migrações em cadeia e aplica defaults defensivos |
| `salvar(d)` | grava local **e** na nuvem |
| `salvarLocal(d)` | só local |
| `chaveLocal(uid)` | `vigia_v3_{uid}` |
| `migrarV2paraV3` … `migrarV6paraV7` | migrações encadeadas (v7 estreia `avisosSilenciados`) |
| `getMes(d,m,a)` / `chaveM(m,a)` | acessa/cria o bloco do mês |
| `verificarResetMensal()` | detecta virada de mês |

### 5.3 Cálculo

| Função | O que faz |
|---|---|
| `calcMes(m,a)` | **o coração.** Devolve receitas, despesas, saldo, cofres, parcelamentos ativos, `recExt`, `recParc`, `receitasParcAtivas`, `despesasConfirmaveis` etc. |
| `valorConfirmado(conf,item)` | fixa só conta depois de confirmada no mês |
| `parcelaNoMes(p,m,a)` | qual parcela cai neste mês |
| `calcParcelaReceitaNoMes(rp,m,a)` | idem para receita parcelada; respeita `mesEncerrado` |
| `calcTermino(atual,total)` | mês/ano da última parcela |
| `cofrinhoNoMes(cf,m,a)` / `acumuladoExtraCofrinho(d,id)` | acumulação do cofrinho |
| `faturaMes(cartao,m,a)` | parcelamentos ativos + compras avulsas do cartão |
| `carteiraCalc(d)` | total e percentual de cada investimento |
| `difMeses(m1,a1,m2,a2)` | meses entre duas datas |

### 5.4 Formatação

`fmt(v)` moeda (mascara com o olho fechado) · `fmtPct(v,casas)` percentual (idem) · `fmtK(v)` abreviado para gráfico · `mascarar(valor)` · `cap(s)` · `idNovo(p)`.

### 5.5 Tela Início

`renderInicio()` monta tudo. Auxiliares: `renderSecaoReceitas(c,d,mm,conf)` (muda com o perfil), `itensReceitasFixas`, `itensRecebimentos`, `botaoRecebiHoje`, `renderMetaRenda(d,recebido)`, `renderReceitasParceladas(c)`, `itemTipo2(kind,item,cor,conf)`, `getSaudacao()`.

Seções colapsáveis: `toggleSec(id,head)`, `abrirSec(id)`, `aplicarFechadas()`, objeto `secFechadas`. **Todas nascem fechadas.**

### 5.6 Perfis financeiros

| Função | O que faz |
|---|---|
| `mostrarSelecaoPerfil()` / `fecharSelecaoPerfil()` | tela `#telaPerfil` |
| `selecionarPerfil(tipo)` | grava, **abre a seção Receitas** e volta para o Início |
| `renderPerfilUI()` | banner, etiqueta no hero, status em Configurações, botão de meta |
| `abrirMetaRenda()` / `salvarMetaRenda()` | meta de renda mensal |

Constantes: `PERFIS`, `PERFIL_ICONE`, `TIPOS_REC` (por perfil), `PLACEHOLDER_REC`, `tiposReceita(perfil)`.

### 5.7 Recebimento (autônomo e misto)

Modal `#ovRecebimento` em 3 passos. `abrirRecebimento()`, `pickRv(el,campo,val)`, `goStepRv(id)`, `rv1ok()`, `rv2ok()`, `confirmarRecebimento()`, `excluirReceitaParc(id)`, `irParaParcelado()` (ponte vinda do modal `+`).

**Encerrar não apaga:** grava `ativo:false` + `mesEncerrado`/`anoEncerrado`. Os meses anteriores continuam valendo.

### 5.8 Avisos de teto e meta

| Função | O que faz |
|---|---|
| `calcularAvisos(c,d,m,a)` | gera os avisos do mês — não são gravados, são recalculados |
| `avisosVisiveis(c,d,m,a)` | filtra os silenciados |
| `renderAvisos()` | badge do sino + lista do painel |
| `abrirAvisos()` | abre `#ovAvisos` |
| `adiarAviso(chave)` | silencia por 7 dias (`AVISO_ADIAR_DIAS`) |
| `adiarAvisoAteProximoMes(chave)` | silencia até o dia 1º |
| `silenciarAviso(chave,ate)` | grava e varre as chaves vencidas |
| `avisarSeEstourou()` | abre o painel 1× por sessão se houver estouro |
| `chaveMesAviso(m,a)` / `diaDoMesJaPassou(m,a,f)` | auxiliares |

**Chaves** (as mesmas que o bot respeita):
`teto-cartao:<id>:YYYY-MM` · `meta-cofrinho:<id>:YYYY-MM` · `meta-renda:mes:YYYY-MM` · `meta-investimento:<id>:YYYY-MM` · `teto-renda:mes:YYYY-MM`

Níveis: `estouro` (vermelho) · `atencao` (amarelo) · `meta` (verde). Só `estouro` abre o painel sozinho.

### 5.9 Agenda

`eventosMes(m,a)` monta o mapa dia→eventos (fixas, avulsos, parcelamentos, receitas parceladas, faturas, cofrinhos). `renderAgenda()` desenha o calendário; `abrirDia(dd)` abre `#ovD`. Cores em `COR`/`CLS`/`LBL`.

### 5.10 Cartões

`renderCartoes()`, `renderCardVisual(cartao)` (PNG base + texto sobreposto por CSS), `aplicarTextoCartao`, `corDestaqueCartao`, `renderAbasCartoes()`, `setTab(t)`, `abrirModalCartao(id)`, `salvarCartao()`, `menuCartao(id)`, `excluirCartao(id)`, `renderBandChips()`, `selecionarBandeira`, `renderCoresGrid()`, `selecionarCor(k)`, `atualizarPreviewCartao()`, `cartaoPorId(d,id)`. Constantes `CORES_CARTAO`, `BANDEIRAS`, `corCartao(k)`, `arquivoCor(k)`.

### 5.11 Lançamento (botão `+`)

`abrirLanc()` monta os chips **conforme o perfil**. Fluxo: `setTipo(t)` → `setSubtipoDespesa(tipo)` → `stp(id)` (navega os passos) → `dp1ok()`/`dp2ok()`/`dfOk()`/`pcOk()`/`cofreOk()`/`rc1ok()` → `confirmar()` grava. Seleção: `pick(el,campo,val)`, `pickCat(el,id)`, `setCartaoParc`, `setNomeCofre`. Estado no objeto `L`.

### 5.12 Edição e confirmação

`edit`/`editM`/`salvarEdit`/`del`/`delM` (listas fixas e do mês) · `abrirConfirmacao(kind,id)`/`salvarConfirmacao()`/`desfazerConfirmacao(id)` · `editParc`/`salvarParc`/`delParc` · `editCofre`/`salvarCofre`/`delCofre` · `abrirInvest`/`editInvest`/`salvarInvest`/`delInvest`/`setTipoInvest`.

### 5.13 Histórico

`renderHist()`, `registrarMes()`, `delHist(id)`, `navAno(d)`.

### 5.14 Entrada no app

`mostrarSplash()` → `verificarPrimeiroAcesso()` → intro (`irParaSlide`, `proximoSlide`, `finalizarIntro`) → login → `onVigiaAuthChange(user)` → `iniciarComNuvem(user)` → `abrirOnboarding(user)` (conta nova) ou `finalizarEntrada(user)` → `iniciarApp()`.

`entrarOffline()` é a saída quando o Firebase não responde em 6s, e só para o último uid que logou neste aparelho.

Onboarding: `onbIr`, `onbSalvarNome`, `onbSalvarRendaPrincipal`, `onbRenderLista`, `onbRemover`, `onbAdicionarRenda`, `onbAdicionarDespesa`, `onbAdicionarParcela`, `onbMontarResumo`, `onbConfirmar`, `onbPular`.

### 5.15 Configurações

`abrirConfig()` chama `renderFonteUI()` e `carregarStatusWhatsApp()`.

- **Fonte:** `aplicarFonte(f)`, `fonteAtual()`, `renderFonteUI()`. Escalas `n`=16px, `g`=18px (padrão), `gg`=20px, aplicadas em `html[data-fonte]` **antes do primeiro paint**.
- **Vínculo:** `gerarCodigoWhatsApp()`, `mostrarCodigo(codigo,expiraEm)`, `esconderCodigo()`, `desvincularWhatsApp()`, `novoCodigo()`. Código de 6 dígitos, uso único, 10 min.
- **Plano:** `assinaturaAtiva(a)`, `textoPlano(a)`.
- **Avisos no WhatsApp:** `carregarNotificacoes()`, `renderNotificacoes(offline)`, `gravarNotificacoes()`, `alternarNotificacoes()`, `definirHorarioNotif(h)`, `alternarTipoNotif(t)`, `notifPadrao()`. Constante `TIPOS_NOTIF`.

### 5.16 Interface geral

`ir(t,btn)` · `navMes(d)` · `voltarHoje()` · `renderTudo()` · `atualizarDataAtual()` · `fechar(id)` · `fecharFora(e,id)` · `toggleValores()` (olho) · `vAlert(msg)` / `vConfirm(msg,titulo,cor,labelOk,labelCancel)` (substituem `alert`/`confirm` nativos, retornam Promise) · `instalarApp()` · `spAcao(a)` · `mostrarParabensCofrinho(...)`.

---

## 6. Funções do bot

### `index.js`

Segurança: `extrairNumero(jid)` · `identificadoresProprios(sock)` · `numerosDaMensagem(chave)` · `numeroRemetente(chave,ehSelfChat)` · `ehAdmin(numero,numerosMsg)` · `registrarTentativa`/`excedeuTentativas`/`limparTentativas` (5 erros travam 15 min).

Fluxo: `processarMensagem(sock,chave,texto)` — ordem fixa: grupo → self-chat → lista permitida → **comandos de admin** → vínculo → **`parar`** → plano → demais comandos.

Conexão: `conectarWhatsApp()` · `resetarSessaoSeSolicitado()` (roda 1× por processo).

Admin: `comandoAdmin(textoNorm,responder)` — `admin`, `liberar <numero> [dias]`, `bloquear <numero>`, `acessos`. Aceita número mascarado.

Rotas HTTP: `/` · `/health` · `/qr` · `POST /alertas/disparar` (protegida por `CHAVE_ALERTAS`).

### `vigia.js`

`buscarUidPorNumero` · `gravarLancamento` · `obterResumoMes` · `resgatarCodigo` (transação, uso único) · `assinaturaAtiva` · `definirAssinatura` · `listarAcessos` · `buscarVinculoPorNumero` · `listarVinculos` · `lerDados` · `lerConfigNotificacoes` · `definirConfigNotificacoes` · `lerRegistroAlertas` · `gravarRegistroAlertas`.

### `calculos.js` — porte das fórmulas do app

`hojeSaoPaulo()` (data no fuso certo, não em UTC) · `chaveMes` · `difMeses` · `getMes` · `valorConfirmado` · `estaConfirmado` · `parcelaNoMes` · `parcelaReceitaNoMes` · `cofrinhoNoMes` · `acumuladoCofrinho` · `faturaMes` · `recebidoNoMes` · `formatarMoeda`.

**Duplicação proposital.** Se uma fórmula mudar no app, muda aqui. `alertas.test.js` existe para travar esse contrato.

### `alertas.js` — puro, sem rede

`montarMensagem(dados,config,jaDia,jaMes,periodo,hoje,agoraMs)` → `null` ou `{texto,novoDia,novoMes}`. Auxiliares: `contasDoDia`, `recebimentosDoDia`, `tiposDe`, `recebeNoPeriodo`. Constantes `TIPOS_PADRAO`, `HORARIOS`, `HORARIO_PADRAO`.

### `agenda.js`

`agendar(deps)` (cron 9h/12h/20h, fuso São Paulo) · `dispararAlertas(periodo,deps)`.

`deps = { enviar(numero,texto), conectado(), ehAdmin(numero) }`.

### Comandos do WhatsApp

`oi`/`menu` · `saldo` · `resumo` · `avisos` · `ativar` · `parar` · `ajuda` · `cancelar` · código de 6 dígitos · texto livre de gasto. `parar` funciona **mesmo sem plano ativo**.

### Variáveis de ambiente

`FIREBASE_SERVICE_ACCOUNT` (obrigatória) · `NUMERO_ADMIN` · `NUMERO_AUTORIZADO` (vazia = multiusuário) · `LID_AUTORIZADO` · `RESET_SESSAO` · `CHAVE_ALERTAS` · `PORT`.

---

## 7. Avisos: as duas metades

O app avisa **na tela** (sino 🔔) e o bot avisa **no WhatsApp**. Compartilham as chaves de `avisosSilenciados`: adiar num lugar cala nos dois.

| | App (sino) | Bot (WhatsApp) |
|---|---|---|
| Teto do cartão | ≥80% e estourado | ≥80% e ≥95% |
| Cofrinho | ≥80% e meta batida | meta batida |
| Meta de renda | batida / atrasada | batida / atrasada |
| Investimento fora da meta | sim | não |
| Despesa acima da renda | sim | não |
| Conta vencendo | não (está na Agenda) | hoje e amanhã |
| Parcela a receber | não | hoje |

Repetição no bot: aviso de **data** dedupe por dia; aviso de **estado** dedupe por mês, cada faixa uma vez. O registro só é gravado **depois** do envio dar certo.

---

## 8. Testes

| Onde | Comando | Cobre |
|---|---|---|
| Bot | `node alertas.test.js` | 39 casos: conteúdo dos avisos, dedupe, janelas de horário, fuso |
| App | Playwright (fora do repo) | perfis (58), fonte (13), avisos (24), notificações (20) |

O app não tem suíte versionada. Os testes foram escritos em `playwright-core` apontando para o `index.html` local, injetando dados no `localStorage` e chamando `entrarOffline()` para pular o login.

---

## 9. Pendências conhecidas

- `NUMERO_AUTORIZADO` ainda preenchida no Railway — enquanto estiver, o bot fica restrito e o modo multiusuário não vale.
- ~~O cron do bot nunca rodou em produção.~~ **Validado em 06/08/2026:** a leva das 9h saiu no horário de Brasília, agrupada numa mensagem só, com teto de cartão a 101% e cofrinho na meta.
- `firestore.rules` é publicado à mão no console do Firebase, não por deploy.
- `usuarios/{uid}/alertas/**` é gravável pelo cliente (a regra `{documento=**}` cobre). O prejuízo possível é a própria pessoa silenciar os próprios avisos.
- A barra de progresso não é mascarada pelo olho — só o número.
