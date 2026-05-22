# Deploy

## Estado detectado
- O projeto e um app Next.js.
- Ha `Dockerfile` e `docker-compose.yml` voltados ao dev server.
- Configuracao explicita de producao, CI e provedor final: A confirmar.

## Caminhos provaveis
### Vercel
- Caminho natural para Next.js se nao houver requisito de container.
- Execute build antes de publicar e valide rotas com trailing slash.
- Confirme limites e cache para videos grandes.

### Docker
- O Dockerfile atual expoe a porta `3001` e executa `npm run dev`.
- Para producao, considere uma imagem que rode build e `npm run start`, com variaveis e health checks apropriados.
- Nao trate o compose atual como configuracao final de producao sem revisao.

## Variaveis de ambiente
- Detectada em `.env.docker.example`: `HOST_PORT`.
- Outras variaveis obrigatorias: nao encontradas.
- Nunca registre tokens ou segredos nos arquivos do repositorio.

## Arquivos importantes
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `public/` para tamanho e cache de midia

## Checklist antes de publicar
1. Rodar build, lint e verificacao visual das rotas principais.
2. Conferir paths de assets, posters, videos e frames.
3. Testar scroll e Works em desktop/mobile.
4. Medir performance de midia e transicoes em ambiente real.
5. Confirmar politica de cache e tamanho dos videos.

## Problemas comuns
- Videos pesados podem ampliar custo de rede, decode e GPU.
- Assets removidos sem atualizar `data/works.ts` quebram cards/slides.
- Diferenca entre dev server Docker e runtime de producao pode esconder problemas.
