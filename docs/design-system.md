# Design System

## Estado atual
O projeto tem um padrao visual forte, mas ainda nao possui um design system formal completo. Esta base documenta o que ja existe sem alterar layout.

## Cores encontradas
- Fundo principal: `#050505`, `#0b0b0b`.
- Texto claro: `#f7f5ef`.
- Linhas/bordas frequentes: branco translucido, exemplo `rgba(255, 255, 255, 0.08)`.
- Sakura loader/cursor: rosas e lilases luminosos com amarelos pontuais.
- Tailwind custom existente: `obsidian`, `carbon`, `graphite`, `ember`, `amberglow`, `smoke`.
- shadcn: tokens neutros via CSS variables como `--background`, `--foreground`, `--border`, `--ring`.

## Tipografia
- Fonte de interface principal: Outfit via `--font-outfit`.
- Mono auxiliar: Geist Mono via `--font-geist-mono`.
- A lista Works usa referencias serifadas em pontos especificos, como Georgia/Times.
- Titulos de slide tendem a ser grandes, leves, com tracking amplo e alto contraste.

## Espacamento e densidade
- Layout de hero ocupa viewport e trabalha com overlays.
- Padding de chrome/navigation usa escalas compactas em mobile e mais ar em desktop.
- Use Tailwind spacing existente antes de criar valores arbitrarios.
- Mantenha controles pequenos e legiveis; nao transforme Works em landing page de cards decorativos.

## Bordas, radius e sombras
- Bordas sao discretas e translucidas.
- Painel glass existente usa blur, sombra longa e border sutil.
- shadcn introduz radius por token `--radius`; preserve o radius atual quando usar componentes novos.
- Evite sombras pesadas sobre videos e WebGL se reduzirem nitidez.

## Componentes visuais recorrentes
- Hero fullscreen com midia.
- Menu trigger fixo de tres linhas/close.
- Texto de slide central e chrome pequeno nas bordas.
- Cards de Works com thumbs, hover WebGL e zoom de rota.
- Loader Sakura e cursor trail floral.

## Responsividade
- Teste desktop e mobile.
- O menu trigger tem regras especificas em `app/globals.css` para telas menores.
- Midia deve manter cover sem texto sobreposto incoerente.
- Respeite `prefers-reduced-motion` onde ja existe e adicione fallback quando motion novo for intenso.

## Padrao visual esperado
- Premium, cinematografico, floral e motion-first.
- Transicoes devem parecer continuas e responsivas, nao fades genericos.
- Preserve qualidade de midia sem saturar decode, compositor ou GPU.
- WebGL e efeitos devem servir a navegacao, nao competir com legibilidade.
