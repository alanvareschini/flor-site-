---
name: backend-api
description: Plan, implement, and review backend, API, authentication, validation, and database work for Flor Alva when server features are requested. Use for endpoints, route handlers, schemas, persistence, secrets, auth, and backend integration tasks.
---

# Backend API

## Quando usar
- Usar somente quando a tarefa incluir backend, API, auth, banco ou validacao server-side.
- O repositorio atual nao mostra backend ou banco; confirmar arquitetura antes de criar um.

## Passos
1. Procurar route handlers, services, schema, env examples e clientes existentes.
2. Se nao existirem, propor o menor desenho necessario para a feature.
3. Definir contrato de entrada, saida, erros, auth e validacao.
4. Guardar segredos em env vars e documentar apenas nomes seguros.
5. Adicionar verificacao focada para happy path e falhas relevantes.

## Checklist final
- [ ] Validacao e tratamento de erro existem.
- [ ] Dados sensiveis nao vazam em logs ou docs.
- [ ] Contrato frontend/backend foi documentado.
- [ ] Migration/env/deploy foram avaliados se houver persistencia.

## Erros comuns
- Inventar banco ou API sem confirmar necessidade.
- Confiar em input do cliente.
- Misturar secrets em codigo ou arquivos example.

## Entrega esperada
- Contrato da API, arquivos alterados, comandos de verificacao e riscos de deploy.
