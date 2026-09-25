'use strict';

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino   = require('pino');
const { inicializar, resolverUid, salvarLancamento } = require('./firestore');
const { parsearMensagem }                             = require('./parser');
const { verificarLimite, LIMITES }                    = require('./sanitizer');

const NUMERO_AUTORIZADO = process.env.NUMERO_AUTORIZADO || null;

async function enviarWhatsApp(sock, jid, texto) {
  await sock.sendMessage(jid, { text: texto });
}

async function processarMensagem(sock, msg) {
  const jid    = msg.key.remoteJid;
  const numero = jid.replace('@s.whatsapp.net', '');

  // Não responder em grupos
  if (jid.endsWith('@g.us')) return;

  // Modo single-user: ignorar se não for o número autorizado
  if (NUMERO_AUTORIZADO && numero !== NUMERO_AUTORIZADO) return;

  const texto = msg.message?.conversation
    || msg.message?.extendedTextMessage?.text
    || '';

  if (!texto) return;

  // Proteção contra mensagens excessivamente longas (spam / ataque)
  if (texto.length > LIMITES.mensagem) {
    console.log(`⚠️ Mensagem muito longa ignorada: ${texto.length} chars de ${numero}`);
    await enviarWhatsApp(sock, jid, '⚠️ Mensagem muito longa. Por favor, seja mais conciso.');
    return;
  }

  // Verificar tamanho da mensagem e avisar se necessário
  const checagem = verificarLimite(texto, LIMITES.mensagem, 'mensagem');
  if (!checagem.valido) {
    await enviarWhatsApp(sock, jid, checagem.aviso);
  }

  // Resolver a conta Vigia do número
  const uid = await resolverUid(numero).catch(err => {
    console.error('Erro ao resolver uid:', err);
    return null;
  });

  if (!uid) {
    await enviarWhatsApp(sock, jid,
      '❌ Número não vinculado ao Vigia. Abra o app e vincule seu WhatsApp nas configurações.');
    return;
  }

  // Tentar interpretar como lançamento financeiro
  const lancamento = parsearMensagem(texto);
  if (!lancamento) {
    await enviarWhatsApp(sock, jid,
      '🤔 Não entendi. Tente: "gastei R$ 50 no mercado" ou "recebi R$ 3000 salário".');
    return;
  }

  try {
    const salvo = await salvarLancamento(uid, lancamento);
    const tipo  = lancamento.tipo === 'receita' ? '💚 Receita' : '🔴 Despesa';
    await enviarWhatsApp(sock, jid,
      `${tipo} registrada!\n*${salvo.nome}*\nR$ ${salvo.valor.toFixed(2).replace('.', ',')}`);
  } catch (err) {
    console.error('Erro ao salvar lançamento:', err);
    await enviarWhatsApp(sock, jid, '❌ Erro ao salvar. Tente novamente.');
  }
}

async function conectar() {
  inicializar();

  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconectando...');
        conectar();
      } else {
        console.log('Sessão encerrada. Delete auth_info_baileys/ e reinicie.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot conectado ao WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await processarMensagem(sock, msg).catch(err =>
        console.error('Erro inesperado ao processar mensagem:', err));
    }
  });
}

conectar().catch(console.error);
