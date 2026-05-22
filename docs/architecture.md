# Architecture

## Stack
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS.
- Motion/render: GSAP, GSAP ScrollTrigger e Three.js.
- Dados: arrays locais em TypeScript.
- Backend/API/banco: nao encontrados no repositorio atual.

## Pastas
- `app/`: rotas Next, `layout.tsx`, `globals.css`, pagina raiz e paginas de Works.
- `components/site/`: experiencia principal, controles de rota, transicoes, cursor e loader.
- `components/ui/`: componentes copiados pelo shadcn.
- `data/`: modelos e registros locais de obras.
- `lib/`: utilitarios compartilhados, hoje inclui `cn`.
- `public/`: midia servida diretamente pelo Next.
- `.codex/skills/`: instrucoes locais para futuras tarefas Codex.
- `docs/`: referencia tecnica e de produto.

## Rotas
- `/`: monta `HeroScrollVideoSection`.
- `/works/`: monta a mesma experiencia e ativa a vista Works conforme o path.
- `/works/[id]/`: monta a mesma experiencia no slide correspondente.
- `/about/` aparece nos paths validos do route manager, mas uma pagina `app/about` nao foi encontrada.

## Fluxo geral
1. `app/layout.tsx` aplica fontes, CSS global, Sakura loader e cursor trail.
2. As rotas principais renderizam `HeroScrollVideoSection`.
3. `data/works.ts` define obras, slugs, videos, posters e lista de paths validos.
4. `routeManagerPlus` normaliza paths e usa `window.history.pushState` e `popstate` para navegacao interna.
5. `HeroScrollVideoSection` coordena scroll, preload, videos, canvas WebGL e troca entre slides.
6. A grade Works e carregada dinamicamente pelo hero via `CenasGridSection`.

## Responsabilidades importantes
- `components/site/hero-scroll-video.tsx`: home, abertura, slide loop, videos, transicoes menu/Works e WebGL de slide.
- `components/site/cenas-grid.tsx`: grade Works, hover, click de cards, card zoom e shaders da lista.
- `components/site/route-manager-plus.ts`: estado de rota interna e mapeamento slide/path.
- `components/site/page-fade.ts`: overlays DOM para fade e frame hold em transicoes.
- `components/site/sakura-loader.tsx`: loader visual inicial.
- `components/site/flower-cursor.tsx`: efeito de cursor em canvas para ponteiro fino.

## Estilos e configuracao
- Estilos globais e regras do menu ficam em `app/globals.css`.
- Tokens e extensoes Tailwind ficam em `tailwind.config.ts`.
- `next.config.ts` define trailing slash, headers de cache para midia e configuracao de watch em dev.
- `tsconfig.json` define strict TypeScript e alias `@/*`.

## Assets
- `public/works-videos/`: videos de obras.
- `public/works-thumbs/`: thumbnails/posters usados por cards e slides.
- `public/works-posters/`: posters adicionais.
- `public/frames/`: frames da abertura/hero.
- Videos raiz como `hero-scroll.mp4` e pastas `saida/` e `sem_audio/`: uso exato deve ser confirmado antes de limpar.

## Comunicacao frontend/backend
- Nao ha endpoints locais, `app/api`, fetch recorrente ou cliente de banco detectado.
- A experiencia atual le dados e midia do proprio app.
