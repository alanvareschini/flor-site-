# Debugging

## Comece por aqui
1. Reproduza a rota e o gesto exato: home, Works, card click, scroll ou reload.
2. Verifique console do navegador e logs do dev server.
3. Leia os arquivos de fluxo antes de mudar timing ou shader.
4. Separe falha de rota, midia, render, CSS e preload.

## Arquivos provaveis
- Scroll e slides: `components/site/hero-scroll-video.tsx`.
- Works grid e card hover/click: `components/site/cenas-grid.tsx`.
- Rotas internas: `components/site/route-manager-plus.ts`.
- Dados, slugs e assets: `data/works.ts`.
- CSS global/menu/loader: `app/globals.css`.
- Cache e watch: `next.config.ts`, Docker files.

## Erros comuns observaveis
- Tela preta/pisca em transicao: poster/video nao pronto, canvas sem par de textura ou sobreposicao errada.
- Microtravadas: videos demais carregando/decodificando, canvas renderizando sem necessidade ou trabalho pesado por frame.
- Card envia para rota errada: slug/path divergente ou estado de rota fora de sincronia.
- Works branca apos voltar: camada Works, overlay ou route state nao voltou ao estado esperado.
- Build quebra em import/CSS: alias, dependency, Tailwind token ou CSS gerado pelo shadcn fora da configuracao atual.

## Comandos uteis
```powershell
npm run dev
npm run dev:fresh
npm run build
npm run lint
npx tsc --noEmit
docker compose up --build
```

## Logs
- Leia saida do terminal/dev server primeiro.
- Arquivos `*.log` existem na raiz em alguns fluxos locais; confirme se sao atuais antes de confiar neles.
- No browser, cheque Console, Network Media, Performance e Rendering/Compositing quando o problema for de video ou scroll.

## Build e imports
- Confirme `@/*` em `tsconfig.json`.
- Confirme dependencias instaladas antes de culpar runtime.
- Quando CSS global falhar, leia o primeiro erro PostCSS/Tailwind e o token exato que faltou.

## API, CORS e banco
- O projeto atual nao tem backend/API/banco detectados.
- Se uma API for adicionada, investigue request, response, headers, origem, auth e validacao antes de mudar frontend.
- Se banco for adicionado, documente migration, schema e env vars antes de depurar conexao.

## Docker
- O compose usa polling e bind mount para dev.
- Se hot reload falhar, verifique porta, volume, `HOST_PORT` e logs do container.
