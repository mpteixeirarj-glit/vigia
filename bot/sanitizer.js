'use strict';

const LIMITES = {
  descricao:   60,  // nome de despesa, receita, gasto, cofrinho
  nomeCartao:  60,  // nome do cartão
  nomeTitular: 60,  // titular do cartão
  categoria:   40,  // categoria de gasto
  banco:       40,  // nome do banco/cartão no parcelamento
  mensagem:   300,  // mensagem livre do usuário para o bot
};

function sanitizarTexto(texto, limite) {
  if (!texto || typeof texto !== 'string') return '';
  const limpo = texto
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // caracteres de controle
    .replace(/\n{3,}/g, '\n\n')                          // máximo 2 quebras seguidas
    .trim();
  return limpo.slice(0, limite);
}

function verificarLimite(texto, limite, campo) {
  if (!texto) return { valido: true, texto: '' };
  const sanitizado = sanitizarTexto(texto, limite);
  if (texto.trim().length > limite) {
    return {
      valido: false,
      texto: sanitizado,
      aviso: `⚠️ O ${campo} foi reduzido para ${limite} caracteres.`,
    };
  }
  return { valido: true, texto: sanitizado };
}

module.exports = { sanitizarTexto, verificarLimite, LIMITES };
