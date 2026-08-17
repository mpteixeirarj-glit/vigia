/* Mesmo número da constante VERSAO em index.html — ver a nota lá. */
const CACHE = 'vigia-v27.2';

/* O app não pode depender da rede para desenhar o próprio logo. Estes são os
   arquivos sem os quais a primeira tela já aparece quebrada — foi o que
   aconteceu: o ícone não estava aqui, vinha da rede a cada abertura, e uma
   falha de rede virava o ícone quebrado do navegador na tela de login. */
const FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './olho-aberto.png',
  './olho-fechado.png',
  './olho-aberto-lg.png',
  './olho-fechado-lg.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    /* Um a um, não `addAll`: o addAll é atômico e um único 404 derruba a
       instalação inteira, deixando o usuário sem service worker nenhum.
       Assim, o que faltar apenas não entra no cache. */
    Promise.all(FILES.map(f => c.add(f).catch(() => {})))
  ));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  /* Sem respondWith, o navegador trata sozinho. POST não se guarda em cache. */
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        /* Guarda o que deu certo: um arquivo que carregou uma vez não deve
           voltar a depender da rede. Só respostas próprias e completas —
           opaque e erro entupiriam o cache com o que não dá para reaproveitar,
           e prender uma resposta de terceiro (SDK do Firebase) num cache que
           só troca com a versão do app deixaria o usuário com um SDK velho. */
        if (resp.ok && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => {
        // Só cai pro index.html em navegação de página; requisições de terceiros
        // (ex: SDK do Firebase) que falharem devem falhar normalmente, não voltar HTML.
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
