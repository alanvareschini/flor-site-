---
name: premium-motion
description: Design and refine Flor Alva premium motion with GSAP, Three.js, scroll animation, card transitions, microinteractions, and optional motion libraries only when warranted. Use for hero transitions, Works grid motion, scroll logic, shaders, easing, velocity, and visual reference adaptation.
---

# Premium Motion

## Quando usar
- Usar para transicoes premium, scroll criativo, hover, card zoom, shader e microinteracoes.
- Ler `docs/visual-references.md`, `docs/design-system.md` e o fluxo existente antes de mudar motion.

## Passos
1. Definir o gesto, estado inicial, estado final e resposta visual esperada.
2. Mapear input, target progress, visual progress, velocity, direction e snap se houver scroll.
3. Reusar GSAP e Three.js ja presentes antes de adicionar Framer Motion, React Three Fiber ou Lenis.
4. Isolar render de carregamento de midia/texto.
5. Verificar desktop/mobile, rotas de entrada/saida e performance.

## Checklist final
- [ ] A animacao tem logica clara, nao so duration ajustada.
- [ ] Inicio, meio e assentamento foram revisados.
- [ ] Transicao nao bloqueia clique, scroll ou rota.
- [ ] Fallback e performance foram considerados.

## Erros comuns
- Copiar referencia literal sem adaptar assets e arquitetura.
- Acoplar preload de video ao progresso visual.
- Misturar varias timelines sem ownership claro.

## Entrega esperada
- Descricao do comportamento, arquivos alterados, verificacao visual e diferencas conscientes da referencia.
