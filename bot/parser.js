'use strict';

const { sanitizarTexto, LIMITES } = require('./sanitizer');

// Padrões para extrair valor monetário: "R$ 87,50", "87.50", "87,50"
const RE_VALOR = /R?\$?\s*([\d]+(?:[.,]\d{1,2})?)/i;

// Categorias reconhecidas pelo bot (espelha o app)
const CATEGORIAS = [
  'alimentacao', 'transporte', 'saude', 'lazer', 'moradia',
  'educacao', 'vestuario', 'servicos', 'outros',
];

const PALAVRAS_RECEITA = ['recebi', 'ganhei', 'entrou', 'salário', 'salario', 'renda'];
const PALAVRAS_DESPESA = ['gastei', 'paguei', 'comprei', 'saiu', 'despesa'];

function extrairValor(texto) {
  const m = texto.match(RE_VALOR);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

function detectarCategoria(texto) {
  const t = texto.toLowerCase();
  if (/alimenta|comida|feira|mercado|restaurante|lanche/.test(t)) return 'alimentacao';
  if (/transport|ônibus|onibus|uber|metro|gasolina|combustiv/.test(t)) return 'transporte';
  if (/saúde|saude|médic|medic|farmácia|farmacia|plano/.test(t)) return 'saude';
  if (/lazer|diversão|diversao|cinema|show|bar/.test(t)) return 'lazer';
  if (/aluguel|condom|água|agua|luz|energia|internet|gás|gas/.test(t)) return 'moradia';
  if (/escola|facul|curso|livro|educa/.test(t)) return 'educacao';
  if (/roupa|calçado|calcado|vest/.test(t)) return 'vestuario';
  if (/assina|streaming|netflix|spotify/.test(t)) return 'servicos';
  return 'outros';
}

function detectarTipo(texto) {
  const t = texto.toLowerCase();
  if (PALAVRAS_RECEITA.some(p => t.includes(p))) return 'receita';
  if (PALAVRAS_DESPESA.some(p => t.includes(p))) return 'despesa';
  return 'despesa'; // padrão
}

function extrairDescricao(texto) {
  // Remove valor monetário e palavras-chave comuns para isolar a descrição
  let desc = texto
    .replace(RE_VALOR, '')
    .replace(/R\$|gastei|paguei|comprei|recebi|ganhei|entrou/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Capitaliza a primeira letra
  if (desc) desc = desc[0].toUpperCase() + desc.slice(1);
  return sanitizarTexto(desc || 'Lançamento via WhatsApp', LIMITES.descricao);
}

/**
 * Interpreta uma mensagem de texto livre e retorna um objeto de lançamento
 * pronto para salvar no Firestore.
 *
 * Retorna null quando não consegue extrair um valor monetário.
 */
function parsearMensagem(texto) {
  if (!texto || typeof texto !== 'string') return null;

  const valor = extrairValor(texto);
  if (!valor || valor <= 0) return null;

  const tipo      = detectarTipo(texto);
  const categoria = sanitizarTexto(detectarCategoria(texto), LIMITES.categoria);
  const descricao = extrairDescricao(texto);
  const dia       = new Date().getDate();

  return {
    id:       'bot_' + Date.now(),
    nome:     descricao,
    valor,
    cat:      categoria,
    dia,
    tipo,
    fonte:    'whatsapp',
  };
}

module.exports = { parsearMensagem, sanitizarTexto, LIMITES };
