# Temas e Personalização

## Visão geral

O usuário pode personalizar as cores do sistema (modo claro/escuro, cor primária, cor de destaque). As preferências são salvas no banco e sincronizadas entre dispositivos.

## Campos no model User

```prisma
themeMode     String   @default("light")   // "light" | "dark"
themePrimary  String   @default("#1f4b46") // cor primária hex
themeAccent   String   @default("#dceae7") // cor de destaque hex
```

## Endpoint

| Método | Rota | Descrição |
|--------|------|-----------|
| PUT | `/auth/theme` | Atualiza preferências de tema |

**Body (todos opcionais):**
```json
{
  "themeMode": "dark",
  "themePrimary": "#4c1d95",
  "themeAccent": "#ede9fe"
}
```

Validação: `themeMode` deve ser "light" ou "dark", cores devem ser hex válido (#RRGGBB).

## Retorno

`GET /auth/me` retorna `themeMode`, `themePrimary`, `themeAccent` no objeto do usuário.

## Impacto nos gráficos

Os gráficos do dashboard usam cores dinâmicas derivadas da variável CSS `--primary`:
- `getChartPrimaryColor()` — lê a cor primária atual do DOM
- `getChartSeriesColors()` — gera 6 variações da primária para donut/pie charts

Definidos em `src/lib/chart-theme.ts`.
