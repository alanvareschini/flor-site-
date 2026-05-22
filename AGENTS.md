# AGENTS

## Projeto
- Flor Alva e uma experiencia web floral e cinematografica baseada em videos, scroll, cards de Works e transicoes premium.
- Priorize fluidez visual, preservacao de rotas internas e carregamento cuidadoso de midia.

## Stack detectada
- Next.js App Router, React 19, TypeScript e Tailwind CSS v3.
- GSAP e Three.js para motion, WebGL e transicoes.
- shadcn configurado com componentes locais e Base UI.
- Docker e docker-compose para desenvolvimento local.
- Backend, API propria, banco e testes automatizados: nao encontrados.

## Estrutura principal
- `app/`: rotas, layout global e CSS global.
- `components/site/`: hero, Works grid, route manager, cursor e loaders.
- `components/ui/`: componentes adicionados via shadcn.
- `data/`: dados locais de Works e paths.
- `public/`: videos, thumbs, posters, frames e assets de midia.
- `docs/`: contexto e guias para tarefas futuras.

## Comandos reais
- Instalar: `npm install` ou `npm ci`.
- Rodar local: `npm run dev` em `http://localhost:3001`.
- Build: `npm run build`.
- Lint: `npm run lint` existe, mas hoje abre o prompt inicial de configuracao ESLint.
- Dev utilitario: `npm run dev:restart`, `npm run dev:fresh`, `npm run clean`.
- Docker: `docker compose up --build`.
- Testes: nao existe script de teste hoje.
- Typecheck: nao existe script dedicado; use `npx tsc --noEmit` se necessario.

## Regras de codigo
- Leia os arquivos afetados antes de editar.
- Prefira padroes existentes, aliases `@/` e mudancas pequenas.
- Nao renomeie ids, classes, paths ou assets usados por scroll, Works e transicoes sem necessidade clara.
- Nao mova trabalho pesado para loops de animacao, `requestAnimationFrame`, wheel ou hover.
- Preserve acessibilidade basica: foco, labels, reduced motion e pointer behavior.

## Seguranca
- Nunca grave tokens, senhas ou segredos.
- Use `.env*.example` apenas para nomes de variaveis seguras.
- Nao rode comandos destrutivos nem apague assets sem pedido explicito.

## Fluxo de trabalho
1. Antes: inspecione stack, rotas, dados, CSS, assets e scripts envolvidos.
2. Durante: mantenha a tarefa no escopo e proteja comportamento visual existente.
3. Depois: revise responsividade, console, build/lint/testes disponiveis e riscos.

## Fechamento obrigatorio
- Liste arquivos criados e alterados.
- Informe comandos de verificacao executados.
- Avise claramente se algo nao foi testado ou nao existe no projeto.
