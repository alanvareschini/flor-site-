---
name: frontend-ui
description: Build and review Flor Alva frontend UI changes for layout, components, responsive behavior, design system consistency, and shadcn integration. Use for interface, CSS, component, typography, spacing, navigation chrome, and visual polish tasks.
---

# Frontend UI

## Quando usar
- Usar para layout, componentes, responsividade, estilos globais e design system.
- Ler `AGENTS.md`, `docs/design-system.md` e `docs/code-style.md` antes de editar.

## Passos
1. Identificar rota, viewport, componente e seletores afetados.
2. Conferir padroes existentes em `app/`, `components/site/` e `components/ui/`.
3. Preservar ids, classes e paths usados por GSAP, Works e WebGL.
4. Preferir tokens e utilitarios existentes; usar shadcn apenas quando ele ajudar a UI real.
5. Testar estados normal, hover/focus e mobile quando houver UI nova.

## Checklist final
- [ ] Tipografia, spacing, contraste e overflow revisados.
- [ ] Layout nao desloca midia ou textos indevidamente.
- [ ] Foco e labels basicos preservados.
- [ ] Build/lint/teste disponivel executado ou falta explicada.

## Erros comuns
- Criar cards dentro de cards ou marketing UI onde o fluxo pede ferramenta/galeria.
- Trocar classes sensiveis sem rastrear animacoes.
- Usar animacao que causa layout shift.

## Entrega esperada
- Resumo visual curto, arquivos alterados, verificacao executada e risco restante.
