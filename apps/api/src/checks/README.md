# Checks

Cada subdiretório desta pasta representa um plugin autocontido e deve exportar `default`
ou `check` seguindo `CheckPlugin`. O carregador procura automaticamente por
`<check-id>/index.ts` no desenvolvimento e `index.js` no build.

Não registre o plugin manualmente em outro arquivo. Credenciais devem ser declaradas em
`requiredEnv` e acessadas somente por `context.credentials`.

Declare `supportedTargetKinds` quando o plugin não aceitar todos os alvos web padrão.
Os valores válidos são `domain`, `ip`, `url`, `name`, `username`, `email` e `phone`.
O catálogo e o dashboard usam essa lista para filtrar ferramentas antes de uma análise;
o executor também devolve `skipped` se receber um tipo incompatível diretamente.
