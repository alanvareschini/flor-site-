# Commands

## Gerenciador detectado
- O repositorio usa `package-lock.json`; use npm por padrao.
- `pnpm` nao foi encontrado no ambiente durante a configuracao atual.

## Instalar
```powershell
npm install
```

Para instalacao reprodutivel com lockfile:
```powershell
npm ci
```

## Desenvolvimento
```powershell
npm run dev
```

- Porta esperada: `3001`.
- Reiniciar porta/dev server pelo script existente:
```powershell
npm run dev:restart
```

- Limpar `.next` e caches antes do dev server:
```powershell
npm run dev:fresh
```

- Script Windows adicional:
```powershell
.\start-dev.bat
```

## Build e lint
```powershell
npm run build
npm run lint
```

- `npm run lint` existe, mas na verificacao atual `next lint` abriu o prompt inicial de configuracao ESLint e nao concluiu automaticamente.

## Typecheck
- Nao existe script `typecheck` em `package.json`.
- Sugestao operacional:
```powershell
npx tsc --noEmit
```

## Testes
- Nao existe script `test` nem suite automatizada detectada.
- Sugestao futura: adicionar testes de componentes/rotas e verificacao visual das transicoes criticas.

## Docker
```powershell
docker compose up --build
```

- O compose publica `${HOST_PORT:-3001}:3001`.
- `.env.docker.example` documenta `HOST_PORT=3001`.

## Banco e API
- Nenhum comando de banco, migration ou API local foi encontrado.

## Utilitarios shadcn
```powershell
npx shadcn@latest info
npx shadcn@latest add button
```

- O projeto ja possui `components.json`.
- Revise build depois de adicionar componentes.
