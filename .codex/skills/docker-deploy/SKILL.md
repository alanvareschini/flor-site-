---
name: docker-deploy
description: Work on Flor Alva Docker, docker-compose, environment variables, deployment readiness, Vercel, Railway, and runtime configuration. Use for container setup, port issues, env docs, build/start commands, deploy checks, and hosting decisions.
---

# Docker Deploy

## Quando usar
- Usar para Docker, compose, env vars e deploy.
- Ler `docs/deploy.md` e `docs/commands.md` primeiro.

## Passos
1. Conferir scripts reais, Dockerfile, compose e env examples.
2. Distinguir dev server de runtime de producao.
3. Confirmar portas, volumes, cache de assets e comandos de start/build.
4. Documentar nomes de env vars sem segredos.
5. Validar localmente o caminho alterado quando possivel.

## Checklist final
- [ ] Porta e comando de runtime estao claros.
- [ ] Variaveis de ambiente foram documentadas com seguranca.
- [ ] Midia e cache foram considerados.
- [ ] Provider final foi marcado como confirmado ou A confirmar.

## Erros comuns
- Publicar imagem de dev como producao sem revisar.
- Duplicar lockfiles ou gerenciadores de pacote.
- Colocar token real em compose ou docs.

## Entrega esperada
- Arquivos de deploy alterados, comandos, riscos e instrucoes de rollback basicas quando aplicavel.
