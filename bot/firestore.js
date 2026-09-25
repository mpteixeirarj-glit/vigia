'use strict';

const admin = require('firebase-admin');
const { sanitizarTexto, verificarLimite, LIMITES } = require('./sanitizer');

let db;

function inicializar() {
  if (!admin.apps.length) {
    // Railway: SERVICE_ACCOUNT_JSON contém o JSON inteiro da service account.
    // Local: GOOGLE_APPLICATION_CREDENTIALS aponta para o arquivo .json.
    const credential = process.env.SERVICE_ACCOUNT_JSON
      ? admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_JSON))
      : admin.credential.applicationDefault();

    admin.initializeApp({ credential });
  }
  db = admin.firestore();
}

/**
 * Busca o documento de dados do usuário (uid) no Firestore.
 * Retorna null quando o usuário não existe.
 */
async function buscarDados(uid) {
  const snap = await db.collection('usuarios').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Resolve o uid de um usuário a partir do número de WhatsApp.
 * Lê a coleção `vinculos` (nunca `vinculos_pendentes` — segurança).
 */
async function resolverUid(numero) {
  const snap = await db.collection('vinculos')
    .where('whatsapp', '==', numero)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data().uid;
}

/**
 * Salva um lançamento financeiro no documento do usuário.
 * Todos os campos de texto passam por sanitizarTexto antes de ir ao banco.
 */
async function salvarLancamento(uid, lancamento) {
  const dados = await buscarDados(uid);
  if (!dados) throw new Error('Usuário não encontrado: ' + uid);

  const mes    = new Date().getMonth() + 1;
  const ano    = new Date().getFullYear();
  const chave  = `${ano}-${String(mes).padStart(2, '0')}`;

  const mesAtual = (dados.meses || {})[chave] || { consumo: [], receitas: [] };

  const item = {
    id:    lancamento.id,
    nome:  sanitizarTexto(lancamento.nome,  LIMITES.descricao),
    valor: Number(lancamento.valor) || 0,
    cat:   sanitizarTexto(lancamento.cat,   LIMITES.categoria),
    dia:   Number(lancamento.dia) || new Date().getDate(),
    fonte: 'whatsapp',
  };

  if (lancamento.tipo === 'receita') {
    mesAtual.receitas = [...(mesAtual.receitas || []), item];
  } else {
    mesAtual.consumo = [...(mesAtual.consumo || []), item];
  }

  await db.collection('usuarios').doc(uid).update({
    [`meses.${chave}`]: mesAtual,
  });

  return item;
}

/**
 * Salva dados de cartão. Campos nome e titular são sanitizados.
 */
async function salvarCartao(uid, cartao) {
  const dados = await buscarDados(uid);
  if (!dados) throw new Error('Usuário não encontrado: ' + uid);

  const cartaoSanitizado = {
    ...cartao,
    nome:     sanitizarTexto(cartao.nome,     LIMITES.nomeCartao),
    titular:  sanitizarTexto(cartao.titular,  LIMITES.nomeTitular),
    banco:    sanitizarTexto(cartao.banco,    LIMITES.banco),
  };

  const cartoes = [...(dados.cartoes || []), cartaoSanitizado];
  await db.collection('usuarios').doc(uid).update({ cartoes });
  return cartaoSanitizado;
}

module.exports = { inicializar, buscarDados, resolverUid, salvarLancamento, salvarCartao };
