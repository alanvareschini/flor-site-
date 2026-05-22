---
name: performance
description: Profile and optimize Flor Alva performance for LCP, CLS, INP, videos, images, WebGL, bundle size, lazy loading, preloading, compositor cost, and smooth scroll. Use for dropped frames, slow transitions, heavy assets, network media, and rendering regressions.
---

# Performance

## Quando usar
- Usar para scroll lento, videos pesados, INP ruim, bundle, midia e WebGL custoso.
- Priorizar evidencia de navegador e codigo antes de trocar qualidade visual.

## Passos
1. Medir rota e gesto afetado com console, network media e performance trace quando disponivel.
2. Separar custo de input, JS, layout, decode, upload GPU e composicao.
3. Revisar preload atual, videos ativos, posters, canvas e loops RAF.
4. Corrigir gargalo com cache/range/lazy loading/render controlado.
5. Verificar qualidade visual e metrics relevantes depois.

## Checklist final
- [ ] Midia inativa nao continua pesando sem motivo.
- [ ] Loops nao fazem DOM/query/load pesado por frame.
- [ ] LCP, CLS e INP foram considerados.
- [ ] Qualidade, fallback e reduced motion foram avaliados.

## Erros comuns
- Baixar qualidade por reflexo sem medir.
- Deixar muitos videos invisiveis decodificando.
- Criar texturas ou listeners dentro do frame loop.

## Entrega esperada
- Evidencia do gargalo, mudanca focada, metricas/verificacoes e tradeoff assumido.
