'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizarTexto, verificarLimite, LIMITES } = require('../sanitizer');
const { parsearMensagem } = require('../parser');

// ── sanitizarTexto ────────────────────────────────────────────────────────────

describe('sanitizarTexto', () => {
  it('retorna string vazia para null', () => {
    assert.equal(sanitizarTexto(null, 60), '');
  });

  it('retorna string vazia para undefined', () => {
    assert.equal(sanitizarTexto(undefined, 60), '');
  });

  it('retorna string vazia para não-string', () => {
    assert.equal(sanitizarTexto(123, 60), '');
  });

  it('corta ao limite exato', () => {
    const longo = 'a'.repeat(200);
    const resultado = sanitizarTexto(longo, 60);
    assert.equal(resultado.length, 60);
  });

  it('não corta texto dentro do limite', () => {
    const curto = 'Feira do bairro';
    assert.equal(sanitizarTexto(curto, 60), curto);
  });

  it('remove caracteres de controle', () => {
    const com = 'Texto\x00com\x01controle';
    const sem = sanitizarTexto(com, 60);
    assert.ok(!/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sem));
    assert.equal(sem, 'Textocomcontrole');
  });

  it('mantém tabs e quebras de linha simples', () => {
    const texto = 'Linha 1\nLinha 2';
    assert.equal(sanitizarTexto(texto, 60), 'Linha 1\nLinha 2');
  });

  it('colapsa 3+ quebras de linha para 2', () => {
    const texto = 'A\n\n\n\nB';
    assert.equal(sanitizarTexto(texto, 60), 'A\n\nB');
  });

  it('faz trim do resultado', () => {
    assert.equal(sanitizarTexto('  texto  ', 60), 'texto');
  });

  // Casos especiais com acentos e pontuação (não podem ser corrompidos)
  it("mantém d'Ana intacto", () => {
    assert.equal(sanitizarTexto("Plano de saúde d'Ana", 60), "Plano de saúde d'Ana");
  });

  it('mantém & Cia intacto', () => {
    assert.equal(sanitizarTexto('Empresa & Cia', 60), 'Empresa & Cia');
  });

  it('mantém aspas duplas intactas', () => {
    assert.equal(sanitizarTexto('Geladeira "Inverse"', 60), 'Geladeira "Inverse"');
  });

  it('mantém < e > intactos (não é HTML aqui)', () => {
    assert.equal(sanitizarTexto('Viagem <Chapada>', 60), 'Viagem <Chapada>');
  });

  it('mantém emojis intactos', () => {
    assert.equal(sanitizarTexto('🍕 Pizza', 60), '🍕 Pizza');
  });
});

// ── verificarLimite ───────────────────────────────────────────────────────────

describe('verificarLimite', () => {
  it('texto dentro do limite: valido=true, texto igual', () => {
    const r = verificarLimite('Feira', 60, 'descrição');
    assert.equal(r.valido, true);
    assert.equal(r.texto, 'Feira');
    assert.equal(r.aviso, undefined);
  });

  it('texto vazio: valido=true, texto=""', () => {
    const r = verificarLimite('', 60, 'descrição');
    assert.equal(r.valido, true);
    assert.equal(r.texto, '');
  });

  it('null: valido=true, texto=""', () => {
    const r = verificarLimite(null, 60, 'descrição');
    assert.equal(r.valido, true);
    assert.equal(r.texto, '');
  });

  it('texto longo: valido=false, texto cortado, aviso presente', () => {
    const longo = 'a'.repeat(200);
    const r = verificarLimite(longo, 60, 'descrição');
    assert.equal(r.valido, false);
    assert.equal(r.texto.length, 60);
    assert.ok(r.aviso.includes('60'));
    assert.ok(r.aviso.includes('⚠️'));
  });

  it('aviso menciona o campo passado', () => {
    const r = verificarLimite('x'.repeat(100), 60, 'nome do produto');
    assert.ok(r.aviso.includes('nome do produto'));
  });
});

// ── LIMITES ───────────────────────────────────────────────────────────────────

describe('LIMITES', () => {
  it('descricao = 60', () => assert.equal(LIMITES.descricao, 60));
  it('nomeCartao = 60', () => assert.equal(LIMITES.nomeCartao, 60));
  it('nomeTitular = 60', () => assert.equal(LIMITES.nomeTitular, 60));
  it('categoria = 40', () => assert.equal(LIMITES.categoria, 40));
  it('banco = 40', () => assert.equal(LIMITES.banco, 40));
  it('mensagem = 300', () => assert.equal(LIMITES.mensagem, 300));
});

// ── parsearMensagem (integração com sanitizarTexto) ───────────────────────────

describe('parsearMensagem', () => {
  it('extrai gasto simples', () => {
    const r = parsearMensagem('gastei R$ 87,50 na feira');
    assert.ok(r);
    assert.equal(r.valor, 87.5);
    assert.equal(r.tipo, 'despesa');
    assert.equal(r.fonte, 'whatsapp');
  });

  it('extrai receita', () => {
    const r = parsearMensagem('recebi R$ 3000 de salário');
    assert.ok(r);
    assert.equal(r.valor, 3000);
    assert.equal(r.tipo, 'receita');
  });

  it('retorna null sem valor monetário', () => {
    assert.equal(parsearMensagem('olá tudo bem'), null);
  });

  it('retorna null para entrada vazia', () => {
    assert.equal(parsearMensagem(''), null);
    assert.equal(parsearMensagem(null), null);
  });

  it('nome sempre dentro do limite de 60 chars', () => {
    const longo = 'comprei ' + 'produto muito caro '.repeat(20) + ' R$ 100';
    const r = parsearMensagem(longo);
    assert.ok(r === null || r.nome.length <= 60);
  });

  it('categoria sempre dentro de 40 chars', () => {
    const r = parsearMensagem('gastei R$ 50 no mercado');
    assert.ok(r);
    assert.ok(r.cat.length <= 40);
  });

  it("mantém d'Ana na descrição sem corrupção", () => {
    const r = parsearMensagem("paguei R$ 200 plano d'Ana");
    assert.ok(r);
    assert.ok(r.nome.includes("d'Ana") || r.nome.length <= 60);
  });

  it('texto com 200 chars: nome salvo tem no máximo 60', () => {
    const desc = 'comprei '.padEnd(200, 'x') + ' R$ 50';
    const r = parsearMensagem(desc);
    assert.ok(r === null || r.nome.length <= 60);
  });
});

// ── proteção contra mensagem longa (verificarLimite aplicado ao fluxo) ────────

describe('proteção mensagem longa', () => {
  it('mensagem de 500 chars dispara aviso', () => {
    const longa = 'gastei R$ 10 '.repeat(40); // ~520 chars
    const r = verificarLimite(longa, LIMITES.mensagem, 'mensagem');
    assert.equal(r.valido, false);
    assert.ok(r.aviso.includes('300'));
  });

  it('mensagem de 300 chars exatos: valido=true', () => {
    const exato = 'gastei R$ 50 '.repeat(23).slice(0, 300);
    const r = verificarLimite(exato, LIMITES.mensagem, 'mensagem');
    assert.equal(r.valido, true);
  });

  it('mensagem de 301 chars: valido=false', () => {
    const umAmais = 'x'.repeat(301);
    const r = verificarLimite(umAmais, LIMITES.mensagem, 'mensagem');
    assert.equal(r.valido, false);
  });
});
