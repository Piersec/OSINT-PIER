import type { TargetKind } from '@osint-pier/contracts';
import type { CheckPlugin } from '../../core/checks/contract.js';
import { success } from '../../core/checks/results.js';

// Curated from OSINT Brazuca c5596fd157bdbfecad8a9571245556cd3348b3df.
// Copyright (c) 2025 osintbrazuca, MIT. See docs/osint-brazuca-LICENSE.txt.
const references: {
  kinds: TargetKind[];
  nome: string;
  finalidade: string;
  url: string;
}[] = [
  {
    kinds: ['cnpj'],
    nome: 'Receita Federal',
    finalidade: 'Conferir inscrição e situação cadastral no portal oficial.',
    url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/',
  },
  {
    kinds: ['cnpj'],
    nome: 'BrasilAPI',
    finalidade: 'Documentação da consulta cadastral de empresas.',
    url: 'https://brasilapi.com.br/docs',
  },
  {
    kinds: ['cnpj'],
    nome: 'ReceitaWS',
    finalidade:
      'Referência alternativa de consulta CNPJ; conferir limites e plano no provedor.',
    url: 'https://receitaws.com.br/',
  },
  {
    kinds: ['cnpj', 'name'],
    nome: 'Querido Diário',
    finalidade: 'Pesquisar menções em diários oficiais municipais.',
    url: 'https://queridodiario.ok.org.br/',
  },
  {
    kinds: ['name'],
    nome: 'INPI — marcas',
    finalidade: 'Pesquisar marcas por nome ou razão social.',
    url: 'https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp',
  },
  {
    kinds: ['name'],
    nome: 'INPI — patentes',
    finalidade: 'Pesquisar patentes por nome ou razão social.',
    url: 'https://busca.inpi.gov.br/pePI/jsp/patentes/PatenteSearchBasico.jsp',
  },
  {
    kinds: ['domain', 'url'],
    nome: 'Registro.br — RDAP',
    finalidade: 'Consultar a documentação de registro de domínios .br.',
    url: 'https://registro.br/tecnologia/ferramentas/rdap/',
  },
  {
    kinds: ['domain', 'url'],
    nome: 'Registro.br — WHOIS',
    finalidade: 'Consultar manualmente o registro de um domínio brasileiro.',
    url: 'https://registro.br/tecnologia/ferramentas/whois/',
  },
  {
    kinds: ['email', 'phone'],
    nome: 'Pesquisa de contato',
    finalidade:
      'Pesquisar o contato entre aspas e comparar os formatos de escrita, conforme o guia Brazuca.',
    url: 'https://www.google.com/',
  },
];

const check: CheckPlugin = {
  id: 'osint-brazuca',
  label: 'Fontes brasileiras — OSINT Brazuca',
  requiredEnv: [],
  supportedTargetKinds: ['domain', 'url', 'name', 'cnpj', 'email', 'phone'],
  timeoutMs: 10_000,
  async run(target, context) {
    const selected = references.filter((item) =>
      item.kinds.includes(target.kind),
    );
    let diary: Record<string, unknown> | undefined;
    if (selected.some((item) => item.nome === 'Querido Diário')) {
      const literal = (value: string) =>
        `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      const query =
        target.kind === 'cnpj'
          ? `${literal(target.value)} | ${literal(target.value.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5'))}`
          : literal(target.value);
      const url = new URL('https://api.queridodiario.org.br/gazettes');
      url.search = new URLSearchParams({
        querystring: query,
        size: '5',
        excerpt_size: '350',
        number_of_excerpts: '1',
      }).toString();
      try {
        const response = await fetch(url, {
          signal: context.signal,
          redirect: 'error',
          headers: { accept: 'application/json' },
        });
        if (!response.ok)
          throw new Error(
            response.status === 429 ? 'rate-limit' : 'unavailable',
          );
        const payload: unknown = await response.json();
        if (
          !payload ||
          typeof payload !== 'object' ||
          !('gazettes' in payload) ||
          !Array.isArray(payload.gazettes) ||
          !('total_gazettes' in payload) ||
          !Number.isSafeInteger(payload.total_gazettes) ||
          Number(payload.total_gazettes) < 0
        )
          throw new Error('invalid');
        const publications = payload.gazettes
          .slice(0, 5)
          .flatMap((entry: unknown) => {
            if (!entry || typeof entry !== 'object') return [];
            const row = entry as Record<string, unknown>;
            if (
              typeof row.date !== 'string' ||
              typeof row.territory_name !== 'string'
            )
              return [];
            let document: string | undefined;
            try {
              const link = new URL(String(row.url));
              if (
                link.protocol === 'https:' &&
                !link.username &&
                !link.password
              )
                document = link.href;
            } catch {
              /* Invalid document links are not exposed. */
            }
            return [
              {
                data: row.date.slice(0, 10),
                municipio: row.territory_name.slice(0, 200),
                UF:
                  typeof row.state_code === 'string'
                    ? row.state_code.slice(0, 2)
                    : 'Não informada',
                trecho:
                  Array.isArray(row.excerpts) &&
                  typeof row.excerpts[0] === 'string'
                    ? row.excerpts[0].replace(/<[^>]*>/g, '').slice(0, 350)
                    : 'Trecho não fornecido',
                ...(document ? { documento: document } : {}),
              },
            ];
          });
        diary = {
          consulta: 'Consultada automaticamente',
          total: payload.total_gazettes,
          publicacoes: publications,
          observacao:
            'Até cinco publicações da cobertura municipal desta fonte. Uma menção não confirma identidade ou vínculo; ausência não comprova inexistência.',
        };
      } catch (error) {
        diary = {
          consulta: 'Falha na consulta',
          observacao:
            error instanceof Error && error.message === 'rate-limit'
              ? 'Limite da fonte atingido. Aguarde para tentar novamente.'
              : 'Querido Diário indisponível ou com resposta inválida. Nenhum resultado foi inferido.',
        };
      }
    }
    return success('osint-brazuca', 'OSINT Brazuca · catálogo local (MIT)', {
      referencias: selected.map(({ nome, finalidade, url }) => ({
        nome,
        finalidade,
        url,
        ...(nome === 'Querido Diário'
          ? diary
          : {
              consulta:
                nome === 'BrasilAPI'
                  ? 'Dados disponíveis na ferramenta Consulta de CNPJ'
                  : 'Consulta manual — não coletada',
              informacao: nome.startsWith('INPI')
                ? 'Processos, titulares e situação dos registros dependem da pesquisa no portal.'
                : nome.startsWith('Registro.br')
                  ? 'Dados de registro do domínio podem ser consultados também na ferramenta WHOIS / RDAP.'
                  : nome === 'Receita Federal'
                    ? 'A confirmação oficial exige consulta no portal; não substituímos o comprovante por dados de terceiros.'
                    : nome === 'ReceitaWS'
                      ? 'Fonte alternativa não consultada automaticamente; nenhuma assinatura ou cobrança foi ativada.'
                      : 'Referências de busca não confirmam titularidade do contato.',
            }),
      })),
      catalogo: 'https://github.com/osintbrazuca/osint-brazuca',
      revisao: 'c5596fd157bdbfecad8a9571245556cd3348b3df',
      observacao:
        'Querido Diário recebe o nome ou CNPJ para pesquisa pública. As demais fontes indicam explicitamente quando não foram consultadas. Nenhum login, CAPTCHA ou plano pago é contornado.',
    });
  },
};

export default check;
