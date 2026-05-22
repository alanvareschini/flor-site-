---
name: debugging
description: Investigate Flor Alva bugs through logs, reproduction, browser evidence, build output, routing, media, CSS, JSON, CORS, and runtime analysis. Use for broken imports, build failures, white screens, scroll bugs, invalid data, and hard-to-reproduce regressions.
---

# Debugging

## Quando usar
- Usar quando algo falhar, travar, piscar, abrir rota errada ou quebrar build/runtime.
- Ler `docs/debugging.md` antes de alterar comportamento.

## Passos
1. Reproduzir a falha com rota e gesto claros.
2. Ler logs, console e primeiro erro real.
3. Localizar a camada culpada: dados, rota, CSS, midia, render ou preload.
4. Fazer correcao minima e verificar regressao vizinha.
5. Registrar o que foi evidenciado e o que ficou apenas como hipotese.

## Checklist final
- [ ] Root cause ou melhor evidencia foi descrita.
- [ ] Console/build foi revisto.
- [ ] Fluxos relacionados foram checados.
- [ ] Falta de teste automatizado foi informada se relevante.

## Erros comuns
- Ajustar duration para esconder logica quebrada.
- Ignorar erro de console mais antigo que bloqueia a pagina.
- Mudar shader e rota ao mesmo tempo sem isolar causa.

## Entrega esperada
- Diagnostico curto, patch focado, verificacoes e risco residual.
