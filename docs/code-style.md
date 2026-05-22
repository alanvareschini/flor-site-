# Code Style

## Arquivos e nomes
- Use arquivos em kebab-case para componentes e helpers ja existentes, por exemplo `hero-scroll-video.tsx`.
- Use componentes React em PascalCase.
- Use funcoes e variaveis em camelCase.
- Use constantes de configuracao em UPPER_SNAKE_CASE quando forem parametros globais do efeito.

## Componentes
- Declare `"use client"` apenas em arquivos que dependem de browser, hooks ou DOM.
- Separe dados locais de UI quando a base ja faz isso, como `data/works.ts`.
- Preserve refs e contratos de componentes que alimentam scroll, videos e shaders.
- Prefira composicao local antes de criar uma camada abstrata nova.

## Funcoes
- Mantenha helpers pequenos e com nomes que descrevam o papel no fluxo.
- Em motion, diferencie input bruto, progresso visual, preload e render.
- Evite criar listeners, texturas ou queries pesadas por frame.

## Imports
1. React/Next e tipos.
2. Bibliotecas externas.
3. Modulos locais com alias `@/`.
4. Imports relativos do mesmo modulo quando fizer sentido.

## Duplicacao
- Reuse utilitarios existentes como `cn`, route helpers e dados de Works.
- Extraia helper quando ele reduz risco real ou duplica logica de midia/transicao.
- Nao centralize cedo demais shaders e motion com comportamentos diferentes.

## Comentarios
- Comente somente blocos complexos, shaders, sincronizacao de video ou decisoes de performance.
- Nao narre linhas obvias.
- Se uma regra depende de referencia visual, explique o comportamento esperado em uma frase curta.

## Evitar
- Mudar paths ou slugs sem revisar `data/works.ts` e `routeManagerPlus`.
- Alterar classes/ids usados por GSAP ou WebGL sem rastrear seletores.
- Animar layout custoso (`top`, `left`, `height`) quando `transform` resolve.
- Colocar secretos, tokens ou dumps de log em docs ou codigo.
