# Como criar um plugin de check

Um plugin vive em seu próprio diretório dentro de `apps/api/src/checks`. O loader
descobre automaticamente qualquer subdiretório que contenha `index.ts` no desenvolvimento
ou `index.js` no build. Não é necessário editar um registro central.

## Contrato mínimo

O módulo deve exportar o objeto como `default` (ou como `check`) e declarar os metadados
abaixo:

```ts
import type { CheckPlugin } from '../../core/checks/contract.js';
import { failure, success } from '../../core/checks/results.js';

const check: CheckPlugin = {
  id: 'example-signal',
  label: 'Example signal',
  requiredEnv: [],
  supportedTargetKinds: ['domain', 'ip', 'url'],
  timeoutMs: 5_000,
  async run(target, context) {
    try {
      const response = await fetch(
        `https://service.example/${target.hostname}`,
        {
          signal: context.signal,
        },
      );

      if (!response.ok) {
        return failure(
          check.id,
          'Example service',
          'Serviço externo indisponível.',
        );
      }

      const payload = (await response.json()) as { score?: number };
      return success(check.id, 'Example service', {
        hostname: target.hostname,
        score: payload.score ?? null,
      });
    } catch {
      return failure(
        check.id,
        'Example service',
        'Não foi possível consultar o serviço.',
      );
    }
  },
};

export default check;
```

Regras importantes:

- `id` deve ser único e usar kebab-case; `label` é o nome exibido no dashboard.
- `requiredEnv` lista apenas os identificadores canônicos das credenciais. O valor real
  chega em `context.credentials` pelo cofre interno ou pelo ambiente.
- `supportedTargetKinds` lista os tipos de consulta aceitos pelo plugin. Para checks web
  legados, o loader assume `domain`, `ip` e `url`; declare a lista explicitamente para
  plugins de nome, username, e-mail ou telefone.
- Nunca inclua credenciais, headers privados ou respostas brutas desnecessárias em `data`.
  Retorne somente os campos úteis para a análise.
- Use `context.signal` em toda chamada de rede e mantenha o timeout específico abaixo de
  120 segundos. O executor ainda valida o resultado, mede a duração e remove segredos.
- Trate respostas HTTP, rate limit e exceções dentro do plugin. Um erro deve virar
  `failure(...)`; não deixe uma exceção derrubar os outros checks.
- Se a credencial estiver ausente, o executor retorna `skipped` antes de chamar `run`.

## Credencial opcional

```ts
const check: CheckPlugin = {
  id: 'external-reputation',
  label: 'External reputation',
  requiredEnv: ['EXTERNAL_API_KEY'],
  async run(target, context) {
    const apiKey = context.credentials.EXTERNAL_API_KEY;
    // O executor só chama este ponto quando apiKey está configurada.
    // Use o signal e não devolva apiKey no resultado.
    return success(check.id, 'External API', {
      target: target.value,
      configured: Boolean(apiKey),
    });
  },
};
```

Depois de criar o módulo:

1. adicione uma variável nova ao `.env.sample`, mesmo que o uso recomendado seja o cofre;
2. crie testes isolados em `apps/api/src/checks`, usando mocks de `fetch` ou TLS;
3. confirme que o renderer genérico apresenta os campos curados;
4. atualize a seção correspondente em `PLAN.md` e documente limites da API;
5. abra o painel administrativo e habilite o plugin, se ele tiver sido desabilitado.

O catálogo público expõe `enabled` e `configured`. Plugins desabilitados não aparecem no
dashboard e a API responde `409` se alguém tentar executá-los diretamente.
