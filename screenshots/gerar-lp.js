/* Gera as capturas usadas na landing (screenshots/lp/) dirigindo o app de
   verdade — nada de montagem à mão, então elas nunca ficam desatualizadas em
   relação à interface.
 *
 * Rodar:
 *   npm i playwright-core
 *   node screenshots/gerar-lp.js
 *
 * Ajuste EXE para o caminho do seu Chromium. Refaça as capturas sempre que a
 * interface mudar de cara.
 *
 * Um conjunto de dados só, coerente, para que todas as telas contem a mesma
 * história: mesma pessoa, mesmo mês, mesmos números. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
const OUT = require('path').resolve(__dirname, 'lp');

const H = new Date(), M = H.getMonth(), A = H.getFullYear();
const KM = A + '-' + String(M + 1).padStart(2, '0');
const mesAtras = n => { const d = new Date(A, M - n, 1); return { m: d.getMonth(), a: d.getFullYear() }; };

const p2 = mesAtras(2), p4 = mesAtras(4), p5 = mesAtras(5), p3 = mesAtras(3);

const BASE = {
  schemaVersion: 8, nome: 'Marcos Paulo', perfil: 'clt', subPerfil: null,
  metaRendaMensal: 0,
  receitasFixas: [{ id: 'rf1', dia: 5, nome: 'Salário', valor: 5200 }],
  despesasFixas: [
    { id: 'df1', dia: 10, nome: 'Aluguel', valor: 1450 },
    { id: 'df2', dia: 15, nome: 'Internet', valor: 129.9 },
    { id: 'df3', dia: 20, nome: 'Conta de luz', valor: 187.4 },
    { id: 'df4', dia: 30, nome: 'Plano de saúde', valor: 340, descontadoNaFonte: true },
  ],
  parcelamentos: [
    { id: 'pc1', nome: 'Notebook Dell', valor: 458.9, total: 10, mesIni: p2.m, anoIni: p2.a, cartao: 'santander', dia: 20 },
    { id: 'pc2', nome: 'Geladeira', valor: 312.5, total: 12, mesIni: p5.m, anoIni: p5.a, cartao: 'santander', dia: 20 },
  ],
  cofrinhos: [
    { id: 'cf1', nome: 'Viagem', teto: 12000, valorMensal: 800, dia: 5, mesIni: p3.m, anoIni: p3.a },
    { id: 'cf2', nome: 'Reserva de emergência', teto: 3000, valorMensal: 600, dia: 5, mesIni: p4.m, anoIni: p4.a },
  ],
  investimentos: [
    { id: 'iv1', nome: 'Tesouro Selic 2029', tipo: 'Tesouro Direto', cotas: 42, precoCota: 105.3, metaPercentual: 40 },
    { id: 'iv2', nome: 'Ações PETR4', tipo: 'Ações', cotas: 120, precoCota: 38.4, metaPercentual: 30 },
    { id: 'iv3', nome: 'FII MXRF11', tipo: 'Fundos Imobiliários', cotas: 90, precoCota: 10.2, metaPercentual: 30 },
  ],
  cartoes: [
    { id: 'santander', nome: 'Santander', titular: 'MARCOS P TEIXEIRA', bandeira: 'mastercard', corBase: 'vermelho', teto: 1200, diaVencimento: 20 },
    { id: 'nubank', nome: 'Nubank', titular: 'MARCOS P TEIXEIRA', bandeira: 'mastercard', corBase: 'roxo', teto: 900, diaVencimento: 8 },
  ],
  receitasParceladas: [], avisosSilenciados: {},
  meses: {
    [KM]: {
      receitas: [], reserva: [], cofres: [], vendas: [],
      consumo: [
        { id: 'c1', nome: 'Mercado do mês', valor: 387.2, dia: 3, cat: 'Mercado' },
        { id: 'c2', nome: 'Farmácia', valor: 96.5, dia: 7, cat: 'Saúde' },
        { id: 'c3', nome: 'Gasolina', valor: 220, dia: 9, cat: 'Transporte', cartao: 'santander' },
        { id: 'c4', nome: 'Restaurante', valor: 78, dia: 11, cat: 'Alimentação', cartao: 'santander' },
        { id: 'c5', nome: 'Streaming', valor: 55.9, dia: 12, cat: 'Lazer', cartao: 'nubank' },
      ],
      confirmacoes: {
        rf1: { confirmado: true, valor: 5200 },
        df1: { confirmado: true, valor: 1450 },
      },
    },
  },
  historico: [
    { id: 'h1', mes: 'Jun', ano: A, receitas: 5200, despesas: 4180, saldo: 1020 },
    { id: 'h2', mes: 'Jul', ano: A, receitas: 5480, despesas: 4720, saldo: 760 },
  ],
  ultimoMesReal: KM,
};

const AUTONOMO = JSON.parse(JSON.stringify(BASE));
AUTONOMO.perfil = 'autonomo';
AUTONOMO.metaRendaMensal = 7000;
AUTONOMO.receitasFixas = [];
AUTONOMO.meses[KM].receitas = [
  { id: 'r1', nome: 'Consulta Ana', valor: 350, dia: 4, cat: 'Consulta' },
  { id: 'r2', nome: 'Projeto site institucional', valor: 2400, dia: 8, cat: 'Freelance' },
  { id: 'r3', nome: 'Manutenção mensal — Cliente B', valor: 900, dia: 12, cat: 'Serviço' },
];
AUTONOMO.receitasParceladas = [
  { id: 'rp1', descricao: 'Reforma do escritório', valorParcela: 1250, total: 6,
    mesInicio: p2.m, anoInicio: p2.a, diaRecebimento: 15, forma: 'parcelado', ativo: true },
];

const VENDEDOR = JSON.parse(JSON.stringify(BASE));
VENDEDOR.perfil = 'vendedor';
VENDEDOR.subPerfil = 'misto_vendedor';
VENDEDOR.receitasFixas = [];
VENDEDOR.cofrinhos = [VENDEDOR.cofrinhos[1]];   // estoque come o caixa do mês
VENDEDOR.meses[KM].vendas = [
  { id: 'vd1', desc: 'Tênis casual branco', valor: 399, custo: 210, taxa: 47.88, taxaPct: 12, qtd: 1, dia: 12, canal: 'ml', forma: 'plataforma' },
  { id: 'vd2', desc: 'Kit skincare completo', valor: 289.9, custo: 120, taxa: 34.79, taxaPct: 12, qtd: 3, dia: 11, canal: 'shopee', forma: 'plataforma' },
  { id: 'vd3', desc: 'Mochila executiva', valor: 329.9, custo: 140, taxa: 0, taxaPct: 0, qtd: 2, dia: 9, canal: 'instagram', forma: 'pix' },
  { id: 'vd4', desc: 'Combo 3 camisetas', valor: 249.9, custo: 96, taxa: 0, taxaPct: 0, qtd: 4, dia: 7, canal: 'whatsapp', forma: 'pix' },
  { id: 'vd5', desc: 'Fone bluetooth', valor: 189.9, custo: 78, taxa: 22.79, taxaPct: 12, qtd: 2, dia: 4, canal: 'ml', forma: 'plataforma' },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXE });
  const feitos = [];

  async function app(dados, uid) {
    const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
    page.on('pageerror', e => console.log('  ⚠', String(e).slice(0, 90)));
    await page.goto(URL);
    await page.evaluate(([d, u]) => {
      localStorage.setItem('vigia_ultimo_uid', u);
      localStorage.setItem('vigia_v3_' + u, JSON.stringify(d));
      localStorage.setItem('vigia_fonte', 'g');
    }, [dados, uid]);
    await page.goto(URL);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      entrarOffline();
      /* o painel de avisos abre sozinho 900ms depois quando algo estourou;
         marcar como já aberto evita que ele cubra as capturas */
      avisosJaAbertos = true;
      fechar('ovAvisos');
      ['splash', 'bootSplash', 'intro', 'login'].forEach(i => {
        const e = document.getElementById(i); if (e) e.remove();
      });
    });
    await page.waitForTimeout(900);
    await page.evaluate(() => fechar('ovAvisos'));
    await page.waitForTimeout(200);
    return page;
  }

  /* Sempre a tela inteira, no formato do celular. Recortar um trecho daria
     imagens de proporções diferentes, e na landing elas ficam lado a lado —
     com alturas iguais o CSS cortaria as laterais das mais largas. Quando um
     seletor é passado, a seção é rolada para o topo antes da foto. */
  async function tira(page, nome, rolarAte) {
    if (rolarAte) {
      const achou = await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const topo = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, Math.max(0, topo - 70));   // 70 = altura do topo fixo
        return true;
      }, rolarAte);
      if (!achou) { console.log('❌ sem elemento', rolarAte, 'para', nome); return; }
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: `${OUT}/${nome}.jpg`, type: 'jpeg', quality: 82 });
    if (rolarAte) { await page.evaluate(() => window.scrollTo(0, 0)); }
    feitos.push(nome);
    console.log('📸', nome);
  }

  /* Abre SÓ a seção pedida. Com várias abertas ao mesmo tempo a seção alvo
     desce demais e a foto começa no meio de outra coisa. */
  const TODAS = ['sPrestacoes','sReceitas','sReceitasParc','sFixas','sConsumo',
                 'sCarteira','sCofres','sAlertas'];
  async function soA(page, ids) {
    await page.evaluate(([todas, abrir]) => {
      todas.forEach(i => { secFechadas[i] = true; });
      abrir.forEach(i => abrirSec(i));
      renderTudo();
      aplicarFechadas();
    }, [TODAS, [].concat(ids)]);
    await page.waitForTimeout(400);
  }

  // ── CLT ────────────────────────────────────────────────────────────
  let page = await app(BASE, 'shot1');

  await tira(page, 'inicio-visao-geral');

  await soA(page, 'sFixas');
  await tira(page, 'confirmar-conta', '#sFixas');

  await soA(page, 'sPrestacoes');
  await tira(page, 'parcelamentos', '#sPrestacoes');

  await soA(page, 'sCofres');
  await tira(page, 'cofrinhos', '#sCofres');

  await soA(page, 'sCarteira');
  await tira(page, 'carteira', '#sCarteira');

  await soA(page, 'sAlertas');
  await tira(page, 'analise', '#sAlertas');

  /* lançamento de gasto, preenchido */
  await page.evaluate(() => {
    fechar('ovAvisos'); abrirLanc(); setTipo('despesa'); setSubtipoDespesa('gasto');
    document.getElementById('dDesc').value = 'Mercado do mês';
    setValorInput('dVal', 387.2);
    document.getElementById('dDia').value = 3;
    const cat = [...document.querySelectorAll('#catChips .chip')].find(c => c.textContent.includes('Mercado'));
    if (cat) pickCat(cat, 'mercado');
    const f = [...document.querySelectorAll('#dp1 .chip')].find(c => c.textContent.includes('Pix'));
    if (f) pick(f, 'forma', 'pix');
  });
  await page.waitForTimeout(500);
  await tira(page, 'lancar-gasto');

  /* conta fixa */
  await page.evaluate(() => {
    fechar('ovL'); abrirLanc(); setTipo('despesa'); setSubtipoDespesa('fixa');
    document.getElementById('dfNome').value = 'Aluguel';
    setValorInput('dfVal', 1450);
    document.getElementById('dfDia').value = 10;
  });
  await page.waitForTimeout(500);
  await tira(page, 'cadastrar-fixa');
  await page.evaluate(() => fechar('ovL'));

  /* avisos */
  await page.evaluate(() => abrirAvisos());
  await page.waitForTimeout(600);
  await tira(page, 'avisos');
  await page.evaluate(() => fechar('ovAvisos'));

  /* seleção de perfil */
  await page.evaluate(() => mostrarSelecaoPerfil());
  await page.waitForTimeout(500);
  await tira(page, 'perfis');
  await page.evaluate(() => fecharSelecaoPerfil());

  /* agenda */
  await page.evaluate(() => ir('agenda', document.querySelector('.bn')));
  await page.waitForTimeout(700);
  await tira(page, 'agenda');

  /* cartões */
  await page.evaluate(() => {
    const bs = document.querySelectorAll('.bn');
    ir('cartoes', bs[2]);
  });
  await page.waitForTimeout(800);
  await tira(page, 'cartao-teto');

  /* histórico */
  await page.evaluate(() => { const bs = document.querySelectorAll('.bn'); ir('historico', bs[3]); });
  await page.waitForTimeout(700);
  await tira(page, 'historico');

  /* valores ocultos */
  await page.evaluate(() => {
    const bs = document.querySelectorAll('.bn'); ir('inicio', bs[0]);
    toggleValores();
  });
  await page.waitForTimeout(600);
  await tira(page, 'valores-ocultos');
  await page.evaluate(() => toggleValores());

  /* configurações: WhatsApp e avisos */
  await page.evaluate(() => {
    abrirConfig();
    document.getElementById('waStatus').className = 'wa-status on';
    document.getElementById('waStatus').textContent = '✅ WhatsApp vinculado: +5521999998888';
    document.getElementById('notifSec').style.display = 'block';
    document.getElementById('notifDetalhe').style.display = 'block';
    const b = document.getElementById('notifToggle');
    b.textContent = '🔔 Avisos ligados · tocar para desligar'; b.className = 'ba';
    ['manha'].forEach(h => document.getElementById('not-h-' + h).classList.add('on'));
    ['contasHoje', 'contasAmanha', 'teto', 'meta', 'cofrinho']
      .forEach(t => document.getElementById('not-t-' + t).classList.add('on'));
  });
  await page.waitForTimeout(600);
  await tira(page, 'whatsapp-avisos');
  await page.close();

  // ── autônomo ───────────────────────────────────────────────────────
  page = await app(AUTONOMO, 'shot2');
  await soA(page, 'sReceitas');
  await tira(page, 'perfil-autonomo', '#sReceitas');
  await soA(page, 'sReceitasParc');
  await tira(page, 'receitas-parceladas', '#sReceitasParc');
  await page.evaluate(() => { fechar('ovAvisos'); abrirRecebimento(); });
  await page.waitForTimeout(500);
  await tira(page, 'recebi-hoje');
  await page.close();

  // ── vendedor ───────────────────────────────────────────────────────
  page = await app(VENDEDOR, 'shot3');
  await soA(page, 'sReceitas');
  await tira(page, 'perfil-vendedor', '#sReceitas');
  await page.evaluate(() => { fechar('ovAvisos'); abrirVenda(); });
  await page.waitForTimeout(500);
  await tira(page, 'registrar-venda');
  await page.close();

  await browser.close();
  console.log('\n' + feitos.length + ' capturas em ' + OUT);
})();
