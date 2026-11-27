# Vigia Financeiro — instruções para o Claude

Leia também `docs/REFERENCIA.md`, em especial a seção **2. Regras da casa** (armadilhas que já
custaram bug nesta base: `dados/principal` gravado inteiro, assinatura só pelo bot, etc.).

## Regra permanente: toda mudança vai para o "Sobre"

Pedido do dono do projeto (27/11/2026). Vale para TODA alteração entregue, por menor que seja
(funcionalidade, correção, texto, visual):

1. **Subir a versão** do app, no formato deste projeto `UNIDADE.DÉCIMO`:
   - mudança pequena (ajuste, correção, texto) → sobe o décimo: 29.0 → 29.1
   - mudança grande (recurso novo, tela nova) → sobe a unidade: 29.1 → 30.0
2. **Registrar e resumir a mudança no histórico de versões** — nova entrada NO TOPO do array
   `NOVIDADES` (logo abaixo de `var VERSAO` em `index.html`), com data e um item por mudança
   que quem usa consegue perceber, em linguagem simples. Aparece em
   **Configurações → Aplicativo → 📋 Novidades e versões**.
3. **Manter o cache do service worker igual à versão**: `sw.js` → `const CACHE = 'vigia-vX.Y'`.
   Se ficar diferente, o celular continua preso na versão velha.

Não entregar commit que mude o app sem a entrada correspondente em `NOVIDADES`.
O histórico até a v28.2 foi reconstruído do `git log` em 27/11/2026 (até a v27 o número
existia só no cache: vigia-v2 … vigia-v27).

## Outras regras do ecossistema
- Mesma origem dos outros Vigias (`mpteixeirarj-glit.github.io`: Vigia Energy em `/Vigia-energy-/`,
  Vigia Auto em `/AUTO-VIGIA-/`). Chaves do localStorage deste app: prefixo `vigia_`.
  Nunca usar `localStorage.clear()`.
- **Pendência conhecida:** o `sw.js` deste app apaga, ao ativar, TODOS os caches que não são o
  dele — inclusive os do Energy (`ve-*`) e do Auto (`av-*`), que ficam sem modo offline até a
  próxima abertura online. Correção: filtrar só caches com prefixo `vigia-v`.
- Projeto Firebase deste app: `vigia-56137` (o Energy e o Auto têm projetos próprios).
