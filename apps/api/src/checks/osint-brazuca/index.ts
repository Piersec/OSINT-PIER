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
  async run(target) {
    return success('osint-brazuca', 'OSINT Brazuca · catálogo local (MIT)', {
      referencias: references
        .filter((item) => item.kinds.includes(target.kind))
        .map(({ nome, finalidade, url }) => ({ nome, finalidade, url })),
      catalogo: 'https://github.com/osintbrazuca/osint-brazuca',
      revisao: 'c5596fd157bdbfecad8a9571245556cd3348b3df',
      observacao:
        'Seleção inicial de nove referências. Abra o portal e faça a consulta manualmente; o alvo não é enviado às fontes por este catálogo. Alguns portais exigem cadastro ou CAPTCHA.',
    });
  },
};

export default check;
