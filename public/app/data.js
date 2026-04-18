// ============================================================
// DATA
// ============================================================
const EXTRA_HIST_MONTHS = [
  {
    id: 'setembro_2020',
    nome: 'SETEMBRO 2020',
    despesas: [
      { nome: 'NUBANK', valor: 798.13 },
      { nome: 'INTER', valor: 714.78 },
      { nome: 'NEXT', valor: 430.79 },
      { nome: 'NUBANK MAE', valor: 443.03 },
      { nome: 'RIACHUELO', valor: 380.00 },
      { nome: 'INTERNET', valor: 180.00 },
      { nome: 'TELEFONE', valor: 40.00 }
    ],
    renda: [{ fonte: 'GANHOS', valor: 4390.00 }],
    projetos: [],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'outubro_2020',
    nome: 'OUTUBRO 2020',
    despesas: [
      { nome: 'NUBANK', valor: 1312.43 },
      { nome: 'INTER', valor: 542.36 },
      { nome: 'INTERNET', valor: 129.00 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'NEXT', valor: 568.67 },
      { nome: 'NAT', valor: 149.00 }
    ],
    renda: [
      { fonte: 'SALÁRIO', valor: 2593.00 },
      { fonte: 'AUXÍLIO', valor: 600.00 }
    ],
    projetos: [
      { nome: 'PROJETO', valor: 625.00 },
      { nome: 'CELULAR', valor: 1150.00 },
      { nome: 'VÓ', valor: 50.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'novembro_2020',
    nome: 'NOVEMBRO 2020',
    despesas: [
      { nome: 'NUBANK', valor: 1702.14 },
      { nome: 'INTER', valor: 332.62 },
      { nome: 'INTERNET', valor: 129.00 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'NEXT', valor: 8.00 },
      { nome: 'OUTROS', valor: 100.00 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'DAS', valor: 59.00 },
      { nome: 'STROGONOFF', valor: 10.00 },
      { nome: 'NAYARA', valor: 15.00 },
      { nome: 'PAULO', valor: 10.85 }
    ],
    renda: [
      { fonte: 'SALÁRIO', valor: 2593.00 },
      { fonte: 'AUXÍLIO', valor: 600.00 }
    ],
    projetos: [
      { nome: 'NICOLAS', valor: 34.00 },
      { nome: 'PROJETO', valor: 625.00 },
      { nome: 'CANETA', valor: 900.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'dezembro_2020',
    nome: 'DEZEMBRO 2020',
    despesas: [
      { nome: 'NUBANK', valor: 1274.37 },
      { nome: 'INTER', valor: 1162.94 },
      { nome: 'NEXT', valor: 581.18 },
      { nome: 'INTERNET', valor: 125.00 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'DAS', valor: 59.00 },
      { nome: 'MAE', valor: 80.00 }
    ],
    renda: [
      { fonte: 'SALÁRIO', valor: 2666.00 },
      { fonte: 'AUXÍLIO', valor: 600.00 }
    ],
    projetos: [
      { nome: 'BIA', valor: 75.00 },
      { nome: 'NICOLAS', valor: 500.00 },
      { nome: 'LARYSSA', valor: 399.00 },
      { nome: 'CHRIS', valor: 399.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'janeiro_2021',
    nome: 'JANEIRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1143.24 },
      { nome: 'INTER', valor: 259.24 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'NEXT', valor: 28.00 },
      { nome: 'NAT', valor: 149.00 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 2705.50 },
      { nome: 'RECEITA 2', valor: 1260.00 },
      { nome: 'RECEITA 3', valor: 1333.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'fevereiro_2021',
    nome: 'FEVEREIRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 721.04 },
      { nome: 'INTER', valor: 394.73 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'DAS', valor: 122.18 },
      { nome: 'NAT', valor: 149.00 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 800.00 },
      { nome: 'RECEITA 2', valor: 1260.00 },
      { nome: 'RECEITA 3', valor: 1333.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'março_2021',
    nome: 'MARÇO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1278.61 },
      { nome: 'INTER', valor: 563.37 },
      { nome: 'CELULAR', valor: 45.00 },
      { nome: 'NEXT', valor: 476.41 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'INTERNET', valor: 120.00 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1260.00 },
      { nome: 'RECEITA 2', valor: 1333.00 },
      { nome: 'RECEITA 3', valor: 500.00 },
      { nome: 'RECEITA 4', valor: 150.00 },
      { nome: 'RECEITA 5', valor: 1000.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'abril_2021',
    nome: 'ABRIL 2021',
    despesas: [
      { nome: 'NUBANK', valor: 947.62 },
      { nome: 'INTER', valor: 703.40 },
      { nome: 'CELULAR', valor: 44.99 },
      { nome: 'NEXT', valor: 191.83 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'RESERVA', valor: 808.52 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 550.00 },
      { nome: 'RECEITA 2', valor: 1260.00 },
      { nome: 'RECEITA 3', valor: 1333.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'maio_2021',
    nome: 'MAIO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 3667.61 },
      { nome: 'INTER', valor: 630.06 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 99.00 },
      { nome: 'DAS', valor: 60.00 },
      { nome: 'ALUGUEL', valor: 807.81 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 401.68 },
      { nome: 'ÁGUA', valor: 68.91 },
      { nome: 'ENERGIA', valor: 95.27 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 500.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'junho_2021',
    nome: 'JUNHO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1176.07 },
      { nome: 'INTER', valor: 711.00 },
      { nome: 'CELULAR', valor: 45.00 },
      { nome: 'NEXT', valor: 150.91 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'INTERNET', valor: 86.00 },
      { nome: 'VIAGEM', valor: 103.00 },
      { nome: 'DAS', valor: 120.00 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1260.00 },
      { nome: 'RECEITA 2', valor: 1333.00 },
      { nome: 'RECEITA 3', valor: 500.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'julho_2021',
    nome: 'JULHO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1528.21 },
      { nome: 'INTER', valor: 702.42 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 39.80 },
      { nome: 'NAT', valor: 149.00 },
      { nome: 'INTERNET', valor: 86.00 },
      { nome: 'VIAGEM', valor: 103.00 },
      { nome: 'DAS', valor: 120.00 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1260.00 },
      { nome: 'RECEITA 2', valor: 1333.00 },
      { nome: 'RECEITA 3', valor: 505.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'agosto_2021',
    nome: 'AGOSTO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1556.89 },
      { nome: 'INTER', valor: 719.44 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 277.07 },
      { nome: 'INTERNET', valor: 86.00 },
      { nome: 'VIAGEM', valor: 103.00 },
      { nome: 'DAS', valor: 120.00 },
      { nome: 'UBER', valor: 51.00 },
      { nome: 'ENTRADA APÊ', valor: 517.87 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1300.00 },
      { nome: 'RECEITA 2', valor: 1333.00 },
      { nome: 'RECEITA 3', valor: 750.00 },
      { nome: 'RECEITA 4', valor: 64.70 },
      { nome: 'RECEITA 5', valor: 100.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'setembro_2021',
    nome: 'SETEMBRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1530.33 },
      { nome: 'INTER', valor: 594.61 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 733.14 },
      { nome: 'INTERNET', valor: 80.00 },
      { nome: 'DAS', valor: 60.00 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 395.90 },
      { nome: 'ÁGUA', valor: 20.59 },
      { nome: 'ENERGIA', valor: 65.68 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1333.00 },
      { nome: 'RECEITA 3', valor: 800.00 },
      { nome: 'RECEITA 4', valor: 45.70 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'outubro_2021',
    nome: 'OUTUBRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 1695.12 },
      { nome: 'INTER', valor: 418.75 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 111.31 },
      { nome: 'INTERNET', valor: 56.70 },
      { nome: 'DAS', valor: 60.00 },
      { nome: 'ALUGUEL', valor: 860.17 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 412.50 },
      { nome: 'ÁGUA', valor: 36.28 },
      { nome: 'ENERGIA', valor: 96.44 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 800.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'novembro_2021',
    nome: 'NOVEMBRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 869.49 },
      { nome: 'INTER', valor: 473.09 },
      { nome: 'CELULAR', valor: 41.99 },
      { nome: 'NEXT', valor: 10.00 },
      { nome: 'NAT', valor: 149.00 }
    ],
    renda: [{ fonte: 'SALÁRIO', valor: 2593.00 }],
    projetos: [],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'dezembro_2021',
    nome: 'DEZEMBRO 2021',
    despesas: [
      { nome: 'NUBANK', valor: 2053.03 },
      { nome: 'INTER', valor: 51.40 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 218.65 },
      { nome: 'INTERNET', valor: 99.00 },
      { nome: 'DAS', valor: 120.00 },
      { nome: 'ALUGUEL', valor: 828.34 },
      { nome: 'CONDOMÍNIO', valor: 350.13 },
      { nome: 'ÁGUA', valor: 56.06 },
      { nome: 'ENERGIA', valor: 86.04 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 1000.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'janeiro_2022',
    nome: 'JANEIRO 2022',
    despesas: [
      { nome: 'NUBANK', valor: 1919.00 },
      { nome: 'INTER', valor: 1479.86 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 100.00 },
      { nome: 'DAS', valor: 60.00 },
      { nome: 'ALUGUEL', valor: 860.17 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 362.47 },
      { nome: 'RENNER', valor: 138.00 },
      { nome: 'ÁGUA', valor: 58.58 },
      { nome: 'ENERGIA', valor: 87.53 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 552.89 },
      { nome: 'RECEITA 4', valor: 900.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'fevereiro_2022',
    nome: 'FEVEREIRO 2022',
    despesas: [
      { nome: 'NUBANK', valor: 1678.96 },
      { nome: 'INTER', valor: 729.55 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 0.00 },
      { nome: 'DAS', valor: 65.90 },
      { nome: 'ALUGUEL', valor: 812.44 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 350.00 },
      { nome: 'ÁGUA', valor: 71.64 },
      { nome: 'ENERGIA', valor: 40.51 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 750.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'março_2022',
    nome: 'MARÇO 2022',
    despesas: [
      { nome: 'NUBANK', valor: 2032.97 },
      { nome: 'INTER', valor: 665.42 },
      { nome: 'CELULAR', valor: 50.00 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 100.00 },
      { nome: 'DAS', valor: 60.00 },
      { nome: 'ALUGUEL', valor: 860.17 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 354.83 },
      { nome: 'RENNER', valor: 76.11 },
      { nome: 'ÁGUA', valor: 61.94 },
      { nome: 'ENERGIA', valor: 75.51 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'abril_2022',
    nome: 'ABRIL 2022',
    despesas: [
      { nome: 'NUBANK', valor: 3628.15 },
      { nome: 'INTER', valor: 627.22 },
      { nome: 'CELULAR', valor: 55.00 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 0.00 },
      { nome: 'DAS', valor: 65.00 },
      { nome: 'ALUGUEL', valor: 857.83 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 362.47 },
      { nome: 'RENNER', valor: 140.00 },
      { nome: 'ÁGUA', valor: 65.30 },
      { nome: 'ENERGIA', valor: 95.85 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 600.00 },
      { nome: 'RECEITA 4', valor: 563.47 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  },
  {
    id: 'maio_2022',
    nome: 'MAIO 2022',
    despesas: [
      { nome: 'NUBANK', valor: 2528.95 },
      { nome: 'INTER', valor: 1085.28 },
      { nome: 'CELULAR', valor: 55.99 },
      { nome: 'NEXT', valor: 0.00 },
      { nome: 'INTERNET', valor: 100.00 },
      { nome: 'DAS', valor: 65.00 },
      { nome: 'ALUGUEL', valor: 848.58 },
      { nome: 'CONDOMÍNIO/IPTU', valor: 355.21 },
      { nome: 'RENNER', valor: 140.00 },
      { nome: 'ÁGUA', valor: 77.98 },
      { nome: 'ENERGIA', valor: 86.93 }
    ],
    renda: [],
    projetos: [
      { nome: 'RECEITA 1', valor: 1400.00 },
      { nome: 'RECEITA 2', valor: 1453.00 },
      { nome: 'RECEITA 3', valor: 600.00 },
      { nome: 'RECEITA 4', valor: 430.42 }
    ],
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {}
  }
];

const HIST_DATA = [{"id":"junho_2022","nome":"JUNHO 2022","despesas":[{"nome":"NUBANK","valor":2535.32},{"nome":"BANCO INTER","valor":591.32},{"nome":"RENNER","valor":138.0},{"nome":"CELULAR","valor":55.0},{"nome":"INTERNET","valor":105.0},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":850.0},{"nome":"CONDOMÍNIO","valor":366.0},{"nome":"ÁGUA","valor":77.98},{"nome":"ENERGIA","valor":87.53}],"renda":[{"fonte":"SALÁRIO CHRIS","valor":1460.0},{"fonte":"SALÁRIO LARYSSA","valor":1400.0},{"fonte":"HORA EXTRA","valor":700.0}],"projetos":[{"nome":"ADRIANA","valor":1550.0}],"total_gastos":4871.15,"total_renda":3560.0,"resultado":-1311.15,"categorias":{}},{"id":"julho_2022","nome":"JULHO 2022","despesas":[{"nome":"NUBANK","valor":3340.75},{"nome":"BANCO INTER","valor":829.66},{"nome":"RENNER","valor":138.07},{"nome":"CELULAR","valor":55.0},{"nome":"INTERNET","valor":104.99},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":882.71},{"nome":"CONDOMÍNIO","valor":368.65},{"nome":"ÁGUA","valor":74.72},{"nome":"ENERGIA","valor":87.53}],"renda":[{"fonte":"SALÁRIO CHRIS","valor":1460.0},{"fonte":"SALÁRIO LARYSSA","valor":1400.0},{"fonte":"HORA EXTRA","valor":600.0}],"projetos":[{"nome":"wall","valor":30.0},{"nome":"TIKTOK","valor":400.0},{"nome":"Nicolas","valor":2500.0}],"total_gastos":5947.08,"total_renda":3460.0,"resultado":-2457.08,"categorias":{}},{"id":"agosto_2022","nome":"AGOSTO 2022","despesas":[{"nome":"NUBANK","valor":3253.1},{"nome":"BANCO INTER","valor":716.31},{"nome":"RENNER","valor":75.0},{"nome":"CELULAR","valor":55.0},{"nome":"INTERNET","valor":105.0},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":702.0},{"nome":"CONDOMÍNIO","valor":377.97},{"nome":"ÁGUA","valor":66.44},{"nome":"ENERGIA","valor":78.56},{"nome":"PDA","valor":56.0}],"renda":[{"fonte":"SALÁRIO CHRIS","valor":1460.0},{"fonte":"SALÁRIO LARYSSA","valor":1600.0},{"fonte":"HORA EXTRA","valor":680.0}],"projetos":[{"nome":"Bia","valor":96.0},{"nome":"Wall","valor":96.0},{"nome":"Padoka","valor":1237.5}],"total_gastos":5550.38,"total_renda":3740.0,"resultado":-1618.38,"categorias":{}},{"id":"setembro_2022","nome":"SETEMBRO 2022","despesas":[{"nome":"NUBANK","valor":2073.54},{"nome":"BANCO INTER","valor":242.35},{"nome":"RENNER","valor":71.9},{"nome":"CELULAR","valor":55.0},{"nome":"INTERNET","valor":100.0},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":1021.3},{"nome":"CONDOMÍNIO","valor":388.0},{"nome":"ÁGUA","valor":70.3},{"nome":"ENERGIA","valor":87.53},{"nome":"PDA","valor":1654.03},{"nome":"NEXT","valor":286.25}],"renda":[{"fonte":"SALÁRIO CHRIS","valor":1460.0},{"fonte":"SALÁRIO LARYSSA","valor":1600.0},{"fonte":"HORA EXTRA","valor":500.0}],"projetos":[{"nome":"Presente Chris","valor":745.0},{"nome":"Padoka","valor":1237.5},{"nome":"Academia Arte Vida","valor":1900.0},{"nome":"passe de ônibus","valor":40.0}],"total_gastos":6115.2,"total_renda":3560.0,"resultado":-1810.2,"categorias":{}},{"id":"outubro_2022","nome":"OUTUBRO 2022","despesas":[{"nome":"NUBANK","valor":1847.66},{"nome":"BANCO INTER","valor":164.88},{"nome":"RENNER","valor":71.9},{"nome":"CELULAR","valor":55.0},{"nome":"INTERNET","valor":104.99},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":903.52},{"nome":"CONDOMÍNIO","valor":386.09},{"nome":"ÁGUA","valor":62.02},{"nome":"ENERGIA","valor":73.58},{"nome":"PDA","valor":2638.6},{"nome":"NEXT","valor":286.25}],"renda":[{"fonte":"SALÁRIO CHRIS","valor":1460.0},{"fonte":"SALÁRIO LARYSSA","valor":1600.0},{"fonte":"HORA EXTR+UBER","valor":500.0}],"projetos":[{"nome":"Padoka","valor":1237.5},{"nome":"Academia Arte Vida","valor":1900.0},{"nome":"Organização Azione","valor":700.0},{"nome":"Férias Proporcionais","valor":1409.0}],"total_gastos":6659.49,"total_renda":3560.0,"resultado":-3099.49,"categorias":{}},{"id":"novembro_2022","nome":"NOVEMBRO 2022","despesas":[{"nome":"NUBANK","valor":1324.12},{"nome":"BANCO INTER","valor":220.0},{"nome":"RENNER","valor":71.9},{"nome":"CELULAR","valor":52.99},{"nome":"INTERNET","valor":113.5},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":899.0},{"nome":"CONDOMÍNIO","valor":468.0},{"nome":"ÁGUA","valor":70.3},{"nome":"ENERGIA","valor":87.53},{"nome":"PDA","valor":2214.22},{"nome":"NEXT","valor":286.25}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"HORA EXTRA","valor":235.0}],"projetos":[{"nome":"mae","valor":50.0},{"nome":"Padoka","valor":1237.5},{"nome":"Academia Arte Vida","valor":1900.0},{"nome":"Isabela","valor":1750.0},{"nome":"Adriana","valor":400.0}],"total_gastos":5872.81,"total_renda":3935.0,"resultado":-1887.81,"categorias":{}},{"id":"dezembro_2022","nome":"DEZEMBRO 2022","despesas":[{"nome":"NUBANK","valor":170.6},{"nome":"BANCO INTER","valor":157.9},{"nome":"CELULAR","valor":52.99},{"nome":"INTERNET","valor":105.0},{"nome":"DAS","valor":65.0},{"nome":"ALUGUEL","valor":870.18},{"nome":"CONDOMÍNIO","valor":498.94},{"nome":"ÁGUA","valor":73.12},{"nome":"ENERGIA","valor":87.53},{"nome":"PDA","valor":2545.46},{"nome":"NEXT","valor":286.25}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"SALÁRIO ESO","valor":1600.0}],"projetos":[{"nome":"HELI","valor":123.0}],"total_gastos":5362.97,"total_renda":5300.0,"resultado":60.03,"categorias":{}},{"id":"janeiro_2023","nome":"JANEIRO 2023","despesas":[{"nome":"NUBANK","valor":1038.39},{"nome":"BANCO INTER","valor":676.67},{"nome":"CELULAR","valor":52.99},{"nome":"DAS","valor":70.1},{"nome":"ALUGUEL","valor":868.73},{"nome":"CONDOMÍNIO","valor":413.0},{"nome":"ÁGUA","valor":69.72},{"nome":"ENERGIA","valor":84.46},{"nome":"PDA","valor":2931.59}],"renda":[{"fonte":"UBER","valor":250.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"MOZART","valor":2000.0},{"nome":"ANESIO","valor":685.0}],"total_gastos":6205.65,"total_renda":3450.0,"resultado":-2755.65,"categorias":{}},{"id":"fevereiro_2023","nome":"FEVEREIRO 2023","despesas":[{"nome":"NUBANK","valor":2109.55},{"nome":"BANCO INTER","valor":551.44},{"nome":"CONSORCIO","valor":200.0},{"nome":"CELULAR","valor":52.99},{"nome":"INTERNET","valor":43.0},{"nome":"DAS","valor":70.1},{"nome":"ALUGUEL","valor":869.73},{"nome":"CONDOMÍNIO","valor":406.0},{"nome":"ÁGUA","valor":65.32},{"nome":"ENERGIA","valor":79.97},{"nome":"PDA","valor":1031.35}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":370.0}],"projetos":[{"nome":"GRÁ","valor":3200.0},{"nome":"ANESIO","valor":685.0}],"total_gastos":5479.45,"total_renda":870.0,"resultado":-4609.45,"categorias":{}},{"id":"março_2023","nome":"MARÇO 2023","despesas":[{"nome":"NUBANK","valor":4296.62},{"nome":"BANCO INTER","valor":716.01},{"nome":"CONSORCIO","valor":202.0},{"nome":"CELULAR","valor":52.99},{"nome":"INTERNET","valor":97.13},{"nome":"DAS","valor":70.1},{"nome":"ALUGUEL","valor":869.73},{"nome":"CONDOMÍNIO","valor":420.0},{"nome":"ÁGUA","valor":11.9},{"nome":"ENERGIA","valor":84.13}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"DANIEL","valor":47.0},{"nome":"GUSTAVO","valor":47.0},{"nome":"GRÁ","valor":3200.0},{"nome":"PONTOS","valor":250.0}],"total_gastos":6820.61,"total_renda":3700.0,"resultado":-3026.61,"categorias":{}},{"id":"abril_2023","nome":"ABRIL 2023","despesas":[{"nome":"NUBANK","valor":2148.92},{"nome":"BANCO INTER","valor":643.22},{"nome":"CONSORCIO","valor":204.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":97.13},{"nome":"DAS","valor":70.1},{"nome":"ALUGUEL","valor":914.66},{"nome":"CONDOMÍNIO","valor":448.51},{"nome":"ÁGUA","valor":228.33},{"nome":"ENERGIA","valor":82.96}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"HORA EXTRA","valor":277.0}],"projetos":[],"total_gastos":4896.82,"total_renda":3977.0,"resultado":-919.82,"categorias":{}},{"id":"maio_2023","nome":"MAIO 2023","despesas":[{"nome":"NUBANK","valor":2931.1},{"nome":"BANCO INTER","valor":396.04},{"nome":"CONSORCIO","valor":206.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":97.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":922.18},{"nome":"CONDOMÍNIO","valor":448.51},{"nome":"ÁGUA","valor":68.2},{"nome":"ENERGIA","valor":81.35}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"-","valor":3030.0},{"nome":"PROJETO 3","valor":150.0},{"nome":"Maquete Luma","valor":1500.0}],"total_gastos":5280.5,"total_renda":3700.0,"resultado":-1580.5,"categorias":{}},{"id":"junho_2023","nome":"JUNHO 2023","despesas":[{"nome":"NUBANK","valor":3601.18},{"nome":"BANCO INTER","valor":347.89},{"nome":"CONSORCIO","valor":208.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.0},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":922.18},{"nome":"CONDOMÍNIO","valor":439.85},{"nome":"ÁGUA","valor":83.29},{"nome":"ENERGIA","valor":90.0},{"nome":"NUTRICIONISTA","valor":180.0},{"nome":"CAU","valor":235.16},{"nome":"BALADA, LIMPEZA E VIAGEM","valor":778.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"MARDEN E ALANA","valor":4531.0},{"nome":"WASHINGTON","valor":1871.0},{"nome":"ELISA","valor":650.0}],"total_gastos":7117.54,"total_renda":3700.0,"resultado":-3417.54,"categorias":{}},{"id":"julho_2023","nome":"JULHO 2023","despesas":[{"nome":"NUBANK","valor":2453.38},{"nome":"BANCO INTER","valor":1119.3},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":916.62},{"nome":"CONDOMÍNIO","valor":434.48},{"nome":"ÁGUA","valor":68.2},{"nome":"ENERGIA","valor":81.35},{"nome":"Next","valor":901.44}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FERNANDA","valor":1375.0},{"nome":"Consultório","valor":500.0}],"total_gastos":6206.89,"total_renda":3700.0,"resultado":-2506.89,"categorias":{}},{"id":"agosto_2023","nome":"AGOSTO 2023","despesas":[{"nome":"NUBANK","valor":2548.0},{"nome":"BANCO INTER","valor":1057.79},{"nome":"CONSORCIO","valor":212.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":916.62},{"nome":"CONDOMÍNIO","valor":395.0},{"nome":"ÁGUA","valor":82.0},{"nome":"ENERGIA","valor":111.0},{"nome":"Next","valor":593.74}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"RT ILUMINAÇÃO 1","valor":600.0},{"nome":"RT 3","valor":3399.12},{"nome":"RT ILUMINAÇÃO","valor":500.0},{"nome":"RT MARMORARIA","valor":835.0},{"nome":"FERNANDA","valor":1375.0},{"nome":"Restaurante","valor":14500.0},{"nome":"CONSÓRCIO","valor":1800.0},{"nome":"CASHBACK TV","valor":200.0}],"total_gastos":6148.27,"total_renda":3700.0,"resultado":-2448.27,"categorias":{}},{"id":"setembro_2023","nome":"SETEMBRO 2023","despesas":[{"nome":"NUBANK","valor":1673.34},{"nome":"BANCO INTER","valor":1612.08},{"nome":"CONSORCIO","valor":214.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":1045.0},{"nome":"CONDOMÍNIO","valor":420.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":81.35},{"nome":"Next","valor":982.41}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FREDERIC","valor":2000.0},{"nome":"ELISA","valor":1000.0},{"nome":"LEVANTAMENTO","valor":500.0},{"nome":"COMISSÃO SJ","valor":422.0}],"total_gastos":6335.3,"total_renda":3700.0,"resultado":-2635.3,"categorias":{}},{"id":"outubro_2023","nome":"OUTUBRO 2023","despesas":[{"nome":"NUBANK","valor":443.12},{"nome":"BANCO INTER","valor":631.54},{"nome":"CONSORCIO","valor":216.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":459.0},{"nome":"ÁGUA","valor":65.0},{"nome":"ENERGIA","valor":90.0},{"nome":"XP","valor":2649.05},{"nome":"NEXT","valor":471.15},{"nome":"HOSPEDAGEM  1/6","valor":595.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FREDERIC","valor":2000.0},{"nome":"FER E VICTOR","valor":1350.0},{"nome":"CELULAR","valor":2150.0}],"total_gastos":6781.98,"total_renda":3700.0,"resultado":-3081.98,"categorias":{}},{"id":"novembro_2023","nome":"NOVEMBRO 2023","despesas":[{"nome":"BANCO INTER","valor":497.95},{"nome":"CONSORCIO","valor":218.0},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":459.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":95.0},{"nome":"XP","valor":3365.28},{"nome":"NEXT","valor":328.35},{"nome":"HOSPEDAGEM 2/6","valor":595.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"NINI E GILBERTO","valor":3941.0},{"nome":"FER E VICTOR","valor":1350.0},{"nome":"MANKAI","valor":500.0},{"nome":"LEVANTAMENTOS","valor":1250.0},{"nome":"MADÁ","valor":1500.0},{"nome":"DANIEL","valor":1500.0}],"total_gastos":6795.7,"total_renda":3700.0,"resultado":-3095.7,"categorias":{}},{"id":"dezembro_2023","nome":"DEZEMBRO 2023","despesas":[{"nome":"NUBANK","valor":15.0},{"nome":"BANCO INTER","valor":461.19},{"nome":"CAU","valor":502.39},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":71.0},{"nome":"ALUGUEL","valor":922.0},{"nome":"CONDOMÍNIO","valor":463.18},{"nome":"ÁGUA","valor":69.0},{"nome":"ENERGIA","valor":122.0},{"nome":"XP","valor":5575.08},{"nome":"NEXT","valor":119.53},{"nome":"HOSPEDAGEM  3/6","valor":950.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FER E VICTOR","valor":1350.0},{"nome":"JAPONES","valor":2383.33},{"nome":"MANKAI","valor":500.0},{"nome":"MADÁ","valor":1500.0},{"nome":"FREDERIC","valor":1500.0},{"nome":"MANAKAI 2","valor":1250.0}],"total_gastos":9431.49,"total_renda":3700.0,"resultado":-5731.49,"categorias":{}},{"id":"janeiro_2024","nome":"JANEIRO 2024","despesas":[{"nome":"NUBANK","valor":883.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":781.11},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":455.7},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":95.0},{"nome":"XP","valor":5866.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FAMU","valor":4500.0},{"nome":"MALIBU","valor":1783.33},{"nome":"ALPHA IMOBILIÁRIA","valor":1700.0},{"nome":"MADÁ","valor":1500.0},{"nome":"FREDERIC","valor":1500.0},{"nome":"MANAKAI 2","valor":1250.0}],"total_gastos":9322.92,"total_renda":3700.0,"resultado":-5622.92,"categorias":{}},{"id":"fevereiro_2024","nome":"FEVEREIRO 2024","despesas":[{"nome":"NUBANK","valor":2942.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":481.12},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":420.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":115.12},{"nome":"XP","valor":7564.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"CASA COR","valor":2650.0},{"nome":"MALIBU","valor":1783.33},{"nome":"CASA JOEL","valor":5750.0},{"nome":"RT ESPELHOS","valor":350.0}],"total_gastos":12764.35,"total_renda":3700.0,"resultado":-9064.35,"categorias":{}},{"id":"março_2024","nome":"MARÇO 2024","despesas":[{"nome":"NUBANK","valor":1237.62},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":461.19},{"nome":"CELULAR","valor":58.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":923.56},{"nome":"CONDOMÍNIO","valor":422.05},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":95.0},{"nome":"XP","valor":5050.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Helionardo","valor":212.5}],"total_gastos":8501.53,"total_renda":3700.0,"resultado":-4801.53,"categorias":{}},{"id":"abril_2024","nome":"ABRIL 2024","despesas":[{"nome":"NUBANK","valor":1454.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":446.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":430.2},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":95.0},{"nome":"XP","valor":3342.99}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Helionardo","valor":212.5},{"nome":"Clínica","valor":2183.0},{"nome":"Aprovação Lays","valor":2000.0},{"nome":"Aprovação Isa","valor":1400.0},{"nome":"Alok Roberta","valor":2800.0}],"total_gastos":7018.59,"total_renda":3700.0,"resultado":-3318.59,"categorias":{}},{"id":"maio_2024","nome":"MAIO 2024","despesas":[{"nome":"NUBANK","valor":930.02},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.7},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":940.0},{"nome":"CONDOMÍNIO","valor":444.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":95.0},{"nome":"XP","valor":3001.97},{"nome":"IMPOSTO DE RENDA","valor":258.31}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Clínica","valor":2183.0}],"total_gastos":6187.11,"total_renda":3700.0,"resultado":-2487.11,"categorias":{}},{"id":"junho_2024","nome":"JUNHO 2024","despesas":[{"nome":"NUBANK","valor":12.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.7},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":103.5},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":450.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":140.0},{"nome":"XP","valor":3691.0},{"nome":"IMPOSTO DE RENDA","valor":532.67}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Clínica","valor":3333.0},{"nome":"Brunch","valor":1300.0}],"total_gastos":6274.85,"total_renda":3700.0,"resultado":-2574.85,"categorias":{}},{"id":"julho_2024","nome":"JULHO 2024","despesas":[{"nome":"NUBANK","valor":215.61},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.7},{"nome":"PARCELA APARTAMENTO","valor":1877.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":930.0},{"nome":"CONDOMÍNIO","valor":430.0},{"nome":"ÁGUA","valor":75.0},{"nome":"ENERGIA","valor":150.0},{"nome":"XP","valor":3700.0},{"nome":"IMPOSTO DE RENDA","valor":258.31}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":1000.0}],"projetos":[{"nome":"ROBERTA","valor":3000.0}],"total_gastos":8079.02,"total_renda":4700.0,"resultado":-3379.02,"categorias":{}},{"id":"agosto_2024","nome":"AGOSTO 2024","despesas":[{"nome":"NUBANK","valor":504.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.7},{"nome":"PARCELA APARTAMENTO","valor":1877.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":102.13},{"nome":"DAS","valor":75.99},{"nome":"ALUGUEL","valor":867.0},{"nome":"CONDOMÍNIO","valor":437.11},{"nome":"ÁGUA","valor":91.2},{"nome":"ENERGIA","valor":136.2},{"nome":"XP","valor":3117.2},{"nome":"IMPOSTO DE RENDA","valor":258.31}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"ISA","valor":1760.0}],"total_gastos":7731.12,"total_renda":3700.0,"resultado":-4031.12,"categorias":{}},{"id":"setembro_2024","nome":"SETEMBRO 2024","despesas":[{"nome":"NUBANK","valor":349.75},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":177.8},{"nome":"PARCELA APARTAMENTO","valor":1929.65},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":103.07},{"nome":"DAS","valor":75.99},{"nome":"NOVO CONDOMÍNIO","valor":425.0},{"nome":"CONDOMÍNIO","valor":430.0},{"nome":"Contas finais apt","valor":1300.0},{"nome":"ENERGIA","valor":143.0},{"nome":"XP","valor":4139.0},{"nome":"IMPOSTO DE RENDA","valor":258.31}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":500.0}],"projetos":[],"total_gastos":9398.56,"total_renda":4200.0,"resultado":-5198.56,"categorias":{}},{"id":"outubro_2024","nome":"OUTUBRO 2024","despesas":[{"nome":"NUBANK","valor":435.46},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":177.8},{"nome":"PARCELA APARTAMENTO","valor":1877.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":103.07},{"nome":"DAS","valor":75.99},{"nome":"CONDOMÍNIO","valor":656.69},{"nome":"ENERGIA","valor":111.65},{"nome":"XP","valor":4648.0},{"nome":"IMPOSTO DE RENDA","valor":258.31}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":625.0}],"projetos":[{"nome":"Roberta","valor":1750.0}],"total_gastos":8411.25,"total_renda":4325.0,"resultado":-4086.25,"categorias":{}},{"id":"novembro_2024","nome":"NOVEMBRO 2024","despesas":[{"nome":"NUBANK","valor":238.24},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":177.8},{"nome":"PARCELA APARTAMENTO","valor":1877.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":103.07},{"nome":"DAS","valor":75.99},{"nome":"CONDOMÍNIO","valor":698.15},{"nome":"ENERGIA","valor":206.0},{"nome":"XP","valor":4220.37},{"nome":"IMPOSTO DE RENDA","valor":274.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":1800.0}],"projetos":[{"nome":"Roberta","valor":1750.0},{"nome":"Roberta","valor":4000.0}],"total_gastos":7937.9,"total_renda":5500.0,"resultado":-2437.9,"categorias":{}},{"id":"dezembro_2024","nome":"DEZEMBRO 2024","despesas":[{"nome":"NUBANK","valor":66.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":177.8},{"nome":"PARCELA APARTAMENTO","valor":1877.29},{"nome":"CELULAR","valor":66.99},{"nome":"INTERNET","valor":103.07},{"nome":"DAS","valor":75.99},{"nome":"CONDOMÍNIO","valor":700.0},{"nome":"ENERGIA","valor":200.0},{"nome":"XP","valor":5011.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":680.0}],"projetos":[{"nome":"Roberta","valor":4000.0},{"nome":"Roberta","valor":3200.0}],"total_gastos":8278.14,"total_renda":4380.0,"resultado":-3898.14,"categorias":{}},{"id":"janeiro_2025","nome":"JANEIRO 2025","despesas":[{"nome":"NUBANK","valor":9.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1881.87},{"nome":"INTERNET E CELULAR","valor":130.0},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":650.0},{"nome":"ENERGIA","valor":160.0},{"nome":"XP","valor":3797.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":200.0}],"projetos":[{"nome":"Roberta Mosha","valor":3200.0},{"nome":"Joyce Nudra","valor":1880.0},{"nome":"Roberta Luí","valor":2000.0},{"nome":"Roberta Marcello","valor":1150.0}],"total_gastos":6905.77,"total_renda":3900.0,"resultado":-3005.77,"categorias":{}},{"id":"fevereiro_2025","nome":"FEVEREIRO 2025","despesas":[{"nome":"NUBANK","valor":170.95},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":204.08},{"nome":"PARCELA APARTAMENTO","valor":1884.38},{"nome":"INTERNET","valor":80.6},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":643.53},{"nome":"Ingresso Débora","valor":142.5},{"nome":"ENERGIA","valor":175.0},{"nome":"XP","valor":3585.87}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":400.0}],"projetos":[{"nome":"Joyce Nudra","valor":1880.0},{"nome":"Roberta Luí","valor":2000.0},{"nome":"Roberta Marcello","valor":1150.0},{"nome":"Vanessa e Matheus","valor":1169.0}],"total_gastos":6967.81,"total_renda":4100.0,"resultado":-2867.81,"categorias":{}},{"id":"março_2025","nome":"MARÇO 2025","despesas":[{"nome":"NUBANK","valor":19.9},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":184.18},{"nome":"PARCELA APARTAMENTO","valor":1886.4},{"nome":"INTERNET","valor":120.0},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":680.0},{"nome":"Ingresso Débora","valor":142.5},{"nome":"ENERGIA","valor":180.0},{"nome":"XP","valor":4490.62}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":700.0}],"projetos":[{"nome":"Joyce Nudra","valor":1880.0},{"nome":"Roberta Luí","valor":2000.0},{"nome":"Roberta Marcello","valor":1150.0},{"nome":"Vanessa e Matheus","valor":1169.0}],"total_gastos":7784.5,"total_renda":4400.0,"resultado":-3384.5,"categorias":{}},{"id":"abril_2025","nome":"ABRIL 2025","despesas":[{"nome":"NUBANK","valor":241.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":184.18},{"nome":"PARCELA APARTAMENTO","valor":1886.4},{"nome":"INTERNET","valor":149.79},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":745.35},{"nome":"Ingresso Débora","valor":143.0},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":180.0},{"nome":"XP","valor":3523.98}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":300.0}],"projetos":[{"nome":"Vanessa e Matheus","valor":1169.0}],"total_gastos":7434.6,"total_renda":4000.0,"resultado":-3434.6,"categorias":{}},{"id":"maio_2025","nome":"MAIO 2025","despesas":[{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1886.4},{"nome":"INTERNET","valor":149.79},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":745.35},{"nome":"Ingresso Débora","valor":142.5},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":180.0},{"nome":"XP","valor":4176.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0},{"fonte":"COMISSÃO","valor":1000.0}],"projetos":[],"total_gastos":7857.94,"total_renda":4700.0,"resultado":-3157.94,"categorias":{"LAZER":1072.33,"IFOOD+BESTEIRAS":345.19,"PRESENTES/SOCIAL":867.21,"ALIMENTAÇÃO":745.24,"ASSINATURAS":273.72,"OUTROS":281.68}},{"id":"junho_2025","nome":"JUNHO 2025","despesas":[{"nome":"NUBANK","valor":500.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":232.0},{"nome":"PARCELA APARTAMENTO","valor":1895.81},{"nome":"INTERNET","valor":158.7},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":660.0},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":195.0},{"nome":"XP","valor":3068.97}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"FABIANA","valor":2500.0}],"total_gastos":7091.38,"total_renda":3700.0,"resultado":-3391.38,"categorias":{"TRANSPORTE":888.41,"LAZER":526.86,"IFOOD+BESTEIRAS":173.55,"PRESENTES/SOCIAL":758.66,"ALIMENTAÇÃO":517.65,"COMPRAS":511.6,"ASSINATURAS":295.22,"FARMÁCIA":135.6}},{"id":"julho_2025","nome":"JULHO 2025","despesas":[{"nome":"NUBANK","valor":279.18},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1902.0},{"nome":"INTERNET","valor":159.0},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":660.0},{"nome":"ENERGIA","valor":210.0},{"nome":"XP","valor":3618.54}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":2640.0},{"fonte":"COMISSÃO","valor":750.0}],"projetos":[{"nome":"DIEGO E MARIANA","valor":3400.0},{"nome":"VANEIDE","valor":3000.0}],"total_gastos":7106.62,"total_renda":3890.0,"resultado":-3216.62,"categorias":{"TRANSPORTE":760.92,"LAZER":567.21,"IFOOD+BESTEIRAS":204.37,"PRESENTES/SOCIAL":449.96,"ALIMENTAÇÃO":665.5,"COMPRAS":735.05,"ASSINATURAS":286.72,"FARMÁCIA":38.72,"ESO ARQUITETURA":367.65}},{"id":"agosto_2025","nome":"AGOSTO 2025","despesas":[{"nome":"NUBANK","valor":434.33},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":187.0},{"nome":"PARCELA APARTAMENTO","valor":1902.0},{"nome":"INTERNET","valor":149.79},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":660.0},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":200.0},{"nome":"XP","valor":3535.12}],"renda":[{"fonte":"SALÁRIO LARYSSA","valor":3700.0}],"projetos":[{"nome":"DIEGO E MARIANA","valor":3420.0},{"nome":"Nilda","valor":5533.0},{"nome":"Mini conto","valor":2675.0}],"total_gastos":7449.14,"total_renda":3700.0,"resultado":-3749.14,"categorias":{"TRANSPORTE":1004.74,"LAZER":1010.73,"IFOOD+BESTEIRAS":345.17,"PRESENTES/SOCIAL":1187.11,"ALIMENTAÇÃO":510.68,"COMPRAS":495.31,"ASSINATURAS":286.72,"OUTROS":1020.84,"ESO ARQUITETURA":476.99}},{"id":"setembro_2025","nome":"SETEMBRO 2025","despesas":[{"nome":"NUBANK","valor":347.84},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":188.18},{"nome":"PARCELA APARTAMENTO","valor":1905.55},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":658.83},{"nome":"Formatura Paola","valor":260.67},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":202.39},{"nome":"XP","valor":3375.66}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":1750.0},{"fonte":"COMISSÃO","valor":500.0}],"projetos":[{"nome":"Gabriela","valor":180.0},{"nome":"Paulo e Nat","valor":5250.0}],"total_gastos":7478.71,"total_renda":2750.0,"resultado":-4728.71,"categorias":{"TRANSPORTE":946.24,"LAZER":412.79,"IFOOD+BESTEIRAS":304.97,"PRESENTES/SOCIAL":212.11,"ALIMENTAÇÃO":757.75,"COMPRAS":348.95,"ASSINATURAS":435.22,"OUTROS":322.36,"ESO ARQUITETURA":432.51}},{"id":"outubro_2025","nome":"OUTUBRO 2025","despesas":[{"nome":"NUBANK","valor":542.62},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":188.18},{"nome":"PARCELA APARTAMENTO","valor":1908.94},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":690.0},{"nome":"Formatura Paola 2/3","valor":260.1},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":240.0},{"nome":"XP","valor":3628.89}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"rt","valor":680.0}],"total_gastos":7998.32,"total_renda":3700.0,"resultado":-4298.32,"categorias":{"TRANSPORTE":723.47,"LAZER":1037.8,"IFOOD+BESTEIRAS":138.55,"PRESENTES/SOCIAL":226.98,"ALIMENTAÇÃO":786.79,"COMPRAS":456.55,"ASSINATURAS":286.72,"OUTROS":259.48,"ESO ARQUITETURA":260.3}},{"id":"novembro_2025","nome":"NOVEMBRO 2025","despesas":[{"nome":"NUBANK","valor":74.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1912.0},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":720.0},{"nome":"Formatura Paola 3/3","valor":260.1},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":240.0},{"nome":"XP","valor":4602.24}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":2275.0}],"projetos":[{"nome":"ROBERTA","valor":3500.0}],"total_gastos":8544.93,"total_renda":2775.0,"resultado":-5769.93,"categorias":{"TRANSPORTE":580.4,"LAZER":1886.36,"IFOOD+BESTEIRAS":195.69,"PRESENTES/SOCIAL":59.5,"ALIMENTAÇÃO":465.36,"COMPRAS":930.13,"ASSINATURAS":286.72,"OUTROS":77.97,"ESO ARQUITETURA":116.0}},{"id":"dezembro_2025","nome":"DEZEMBRO 2025","despesas":[{"nome":"NUBANK","valor":227.14},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":188.18},{"nome":"PARCELA APARTAMENTO","valor":1916.0},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":720.0},{"nome":"ENERGIA","valor":205.0},{"nome":"XP","valor":3059.19}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"ROBERTA","valor":3500.0}],"total_gastos":6555.1,"total_renda":3700.0,"resultado":-2855.1,"categorias":{"TRANSPORTE":478.02,"LAZER":585.79,"IFOOD+BESTEIRAS":220.64,"PRESENTES/SOCIAL":479.75,"ALIMENTAÇÃO":526.54,"COMPRAS":461.78,"ASSINATURAS":270.82,"OUTROS":52.99}},{"id":"janeiro_2026","nome":"JANEIRO 2026","despesas":[{"nome":"NUBANK","valor":18.9},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1918.53},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":80.9},{"nome":"CONDOMÍNIO","valor":673.52},{"nome":"Teatro","valor":150.0},{"nome":"ENERGIA","valor":151.56},{"nome":"XP","valor":2546.06}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Roberta","valor":2000.0},{"nome":"Joyce","valor":2000.0}],"total_gastos":5895.16,"total_renda":3700.0,"resultado":-2195.16,"categorias":{"TRANSPORTE":642.4,"LAZER":418.15,"IFOOD+BESTEIRAS":194.85,"PRESENTES/SOCIAL":518.0,"ALIMENTAÇÃO":709.23,"COMPRAS":295.2,"ASSINATURAS":270.82,"OUTROS":274.64}},{"id":"fevereiro_2026","nome":"FEVEREIRO 2026","despesas":[{"nome":"NUBANK","valor":18.9},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1921.0},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":86.05},{"nome":"CONDOMÍNIO","valor":680.0},{"nome":"Teatro","valor":300.0},{"nome":"ENERGIA","valor":170.0},{"nome":"XP","valor":3106.65},{"nome":"Dinheiro","valor":939.82}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Roberta","valor":1500.0},{"nome":"RT","valor":2000.0}],"total_gastos":7578.11,"total_renda":3700.0,"resultado":-3878.11,"categorias":{"TRANSPORTE":702.33,"LAZER":1033.52,"IFOOD+BESTEIRAS":194.16,"PRESENTES/SOCIAL":865.78,"ALIMENTAÇÃO":590.3,"COMPRAS":379.2,"ASSINATURAS":270.82,"OUTROS":87.98}},{"id":"março_2026","nome":"MARÇO 2026","despesas":[{"nome":"NUBANK","valor":124.0},{"nome":"BANCO INTER (JÁ COM FINAL)","valor":197.0},{"nome":"PARCELA APARTAMENTO","valor":1924.0},{"nome":"INTERNET","valor":158.69},{"nome":"DAS","valor":86.05},{"nome":"CONDOMÍNIO","valor":680.0},{"nome":"ENERGIA","valor":178.0},{"nome":"XP","valor":2800.0},{"nome":"Dinheiro","valor":370.0}],"renda":[{"fonte":"UBER","valor":500.0},{"fonte":"SALÁRIO LARYSSA","valor":3200.0}],"projetos":[{"nome":"Booking","valor":2300.0}],"total_gastos":6517.74,"total_renda":3700.0,"resultado":-2817.74,"categorias":{"TRANSPORTE":565.64,"LAZER":454.23,"IFOOD+BESTEIRAS":271.95,"PRESENTES/SOCIAL":97.38,"ALIMENTAÇÃO":571.96,"COMPRAS":681.94,"ASSINATURAS":290.72,"OUTROS":224.97}}];

const IMPORTED_BREAKDOWNS = {
  maio_2025: {
    'TRANSPORTE': [11.55, 17.80, 10.68, 15.84, 18.40, 15.60, 12.11, 18.55, 12.82, 11.76, 11.82, 16.85, 17.40, 10.01, 24.40, 9.73, 14.98, 17.09, 10.70, 16.40, 16.40, 8.50, 12.20, 7.50, 15.10, 23.21, 10.99, 18.20, 14.20, 11.90, 10.15, 11.79, 10.33, 15.65, 13.00, 19.90, 11.79, 11.05, 9.90, 10.33, 16.42, 16.45, 12.98, 12.26, 10.00, 6.90, 12.80, 10.71, 8.40, 16.85, 14.20, 6.22, 6.93, 15.10, 22.90, 16.47, 11.79, 8.60, 9.10, 8.80, 8.00, 9.90, 9.70, 15.30, 18.90, 15.85, 11.48, 11.52, 11.83, 11.80, 18.09, 11.84, 11.82, 9.40, 8.20, 14.05, 16.10, 7.14, 10.04, 13.00],
    'LAZER': [126.28, 148.00, 90.23, 9.00, 20.00, 44.00, 17.76, 89.86, 35.00, 11.50, 64.00, 32.00, 97.90, 71.80, 35.98, 39.76, 34.96, 9.99, 62.00, 15.31, 17.00],
    'IFOOD+BESTEIRAS': [19.80, 8.50, 22.95, 22.96, 17.57, 14.98, 7.25, 32.00, 26.00, 63.23, 29.98, 11.48, 7.48, 30.50, 10.51, 20.00],
    'PRESENTES/SOCIAL': [61.79, 80.00, 99.99, 104.30, 51.15, 175.00, 4.48, 74.40, 70.00, 48.00, 29.00, 31.00, 14.60, 13.50, 10.00],
    'ALIMENTAÇÃO': [126.28, 6.98, 24.00, 218.28, 17.76, 4.49, 11.49, 68.23, 17.97, 4.99, 4.79, 23.97, 28.00, 10.49, 21.17, 31.61, 34.11, 18.20, 12.98, 17.49, 41.96],
    'ASSINATURAS': [19.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90],
    'OUTROS': [62.80, 35.00, 74.99, 50.00, 58.89],
  },
  junho_2025: {
    'TRANSPORTE': [11.98, 15.55, 19.70, 19.80, 22.80, 26.42, 31.67, 5.63, 4.40, 9.60, 9.80, 17.90, 11.24, 9.59, 14.40, 50.00, 12.75, 12.49, 8.05, 9.49, 17.07, 12.19, 17.19, 19.40, 17.82, 12.00, 9.26, 32.33, 20.54, 6.70, 8.40, 10.92, 14.72, 19.90, 12.71, 13.18, 10.62, 12.48, 15.54, 42.21, 10.20, 9.56, 14.00, 12.72, 18.00, 12.51, 11.75, 12.55, 19.27, 10.48, 12.67, 10.71, 11.71, 11.40, 11.11, 8.15, 17.70, 12.12, 13.36],
    'LAZER': [49.30, 174.90, 45.68, 35.00, 45.68, 51.15, 39.00, 37.00, 49.15],
    'IFOOD+BESTEIRAS': [12.99, 16.41, 34.23, 3.99, 25.43, 24.45, 5.99, 26.00, 24.06],
    'PRESENTES/SOCIAL': [61.79, 80.00, 99.99, 104.30, 51.15, 175.00, 99.45, 4.40, 40.00, 42.58],
    'ALIMENTAÇÃO': [81.98, 20.82, 17.80, 7.58, 3.19, 61.75, 11.50, 14.99, 147.07, 27.62, 50.45, 34.85, 27.90, 10.15],
    'COMPRAS': [67.81, 60.19, 52.43, 27.26, 47.90, 52.72, 154.85, 4.28, 44.16],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90, 8.50],
  },
  julho_2025: {
    'TRANSPORTE': [13.30, 13.58, 17.80, 13.65, 15.99, 10.18, 21.78, 5.42, 17.56, 26.80, 12.18, 13.04, 16.26, 4.99, 20.07, 15.23, 11.07, 13.79, 4.15, 13.59, 14.76, 7.78, 9.81, 17.37, 21.68, 11.44, 13.50, 7.30, 9.40, 12.63, 12.51, 12.55, 12.31, 17.80, 4.92, 12.00, 5.59, 14.64, 20.20, 12.34, 14.40, 13.29, 15.83, 12.13, 14.15, 12.34, 10.97, 18.73, 6.85, 8.80, 8.50, 16.66, 17.34, 11.44, 13.90, 7.32, 14.20, 13.11],
    'LAZER': [43.67, 43.80, 49.00, 65.70, 70.00, 35.75, 22.50, 24.99, 58.00, 87.00, 42.80, 24.00],
    'IFOOD+BESTEIRAS': [18.00, 32.90, 15.97, 4.79, 4.73, 34.34, 6.97, 13.17, 10.97, 27.53, 35.00],
    'PRESENTES/SOCIAL': [159.22, 104.30, 99.45, 52.72, 4.27, 30.00],
    'ALIMENTAÇÃO': [39.38, 16.99, 9.00, 11.99, 180.00, 30.00, 55.54, 31.13, 15.00, 63.85, 80.03, 132.59],
    'COMPRAS': [67.81, 52.43, 154.84, 30.00, 68.15, 25.43, 37.99, 193.60, 104.80],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90],
    'ESO ARQUITETURA': [61.80, 40.28, 10.56, 74.90, 7.22, 21.00, 5.94, 37.68, 15.10, 41.86, 12.00, 15.03, 14.85, 9.43],
  },
  agosto_2025: {
    'TRANSPORTE': [11.72, 15.76, 17.00, 11.38, 13.84, 15.56, 14.02, 14.30, 16.34, 16.10, 16.20, 14.20, 16.33, 15.10, 13.28, 32.64, 17.00, 14.70, 10.45, 25.92, 27.90, 24.64, 12.34, 34.49, 5.60, 5.22, 21.40, 18.60, 12.32, 13.34, 12.42, 14.80, 12.34, 8.76, 11.70, 24.75, 14.30, 14.71, 12.20, 12.78, 7.28, 16.00, 8.23, 19.90, 8.40, 15.33, 8.75, 13.15, 10.97, 14.31, 11.62, 14.30, 16.40, 7.30, 13.07, 20.00, 24.32, 11.98, 16.90, 8.70, 10.12, 16.08, 12.25, 11.77, 12.58, 11.74, 11.84, 15.00],
    'LAZER': [34.99, 24.75, 50.74, 19.99, 94.09, 69.00, 26.90, 16.00, 41.97, 61.16, 7.50, 38.99, 16.00, 60.45, 180.00, 100.00, 89.70, 40.00, 13.50, 25.00],
    'IFOOD+BESTEIRAS': [6.59, 6.11, 21.74, 23.00, 4.79, 39.00, 6.47, 16.97, 7.48, 10.50, 40.00, 2.00, 62.04, 38.93, 20.57, 38.98],
    'PRESENTES/SOCIAL': [45.86, 62.40, 45.35, 14.75, 120.00, 109.44, 79.61, 59.98, 158.80, 129.97, 65.00, 62.04, 130.51, 69.90, 33.50],
    'ALIMENTAÇÃO': [52.76, 13.78, 57.96, 47.18, 18.00, 29.04, 43.89, 9.99, 41.97, 22.47, 91.78, 58.17, 6.53, 14.36, 2.80],
    'COMPRAS': [193.60, 73.00, 52.43, 20.00, 46.29, 100.00, 9.99],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90],
    'OUTROS': [738.85, 250.00, 31.99],
    'ESO ARQUITETURA': [78.77, 83.22, 120.00, 195.00],
  },
  setembro_2025: {
    'TRANSPORTE': [11.80, 15.00, 19.77, 12.00, 17.83, 14.90, 14.44, 12.36, 16.78, 10.90, 16.66, 14.53, 27.05, 12.92, 17.31, 14.38, 16.12, 21.20, 20.40, 11.13, 20.71, 7.70, 9.67, 18.01, 10.40, 11.90, 9.90, 12.13, 17.48, 13.33, 19.90, 18.67, 11.32, 12.62, 14.04, 18.55, 12.83, 13.10, 10.30, 8.70, 12.92, 29.00, 23.10, 7.60, 9.60, 20.10, 20.70, 12.06, 26.37, 9.81, 10.50, 12.90, 19.82, 12.58, 17.40, 12.32, 7.29, 15.56, 12.21, 12.55, 18.52, 14.99, 19.60],
    'LAZER': [57.76, 29.99, 40.70, 20.00, 165.88, 63.46, 35.00],
    'IFOOD+BESTEIRAS': [6.98, 69.90, 10.00, 40.00, 26.25, 43.70, 50.00, 19.48, 22.50, 16.16],
    'PRESENTES/SOCIAL': [45.85, 108.27, 45.00, 12.99],
    'ALIMENTAÇÃO': [63.46, 7.25, 326.43, 2.24, 43.54, 18.98, 31.20, 44.70, 18.97, 128.24, 43.76, 28.98],
    'COMPRAS': [193.60, 46.28, 20.00, 39.90, 49.17],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90, 148.50],
    'OUTROS': [97.36, 25.00, 200.00],
    'ESO ARQUITETURA': [78.77, 83.22, 42.64, 26.98, 45.90, 55.00, 100.00],
  },
  outubro_2025: {
    'TRANSPORTE': [17.77, 23.28, 22.10, 13.20, 7.40, 12.66, 13.15, 12.48, 16.80, 12.20, 5.10, 20.67, 9.90, 10.00, 7.30, 23.00, 10.20, 12.25, 18.92, 18.10, 16.05, 18.70, 12.47, 17.72, 16.17, 19.90, 11.80, 28.32, 22.10, 12.48, 18.60, 13.38, 11.72, 17.84, 10.10, 8.74, 17.13, 10.81, 17.52, 13.79, 10.04, 20.50, 10.01, 7.53, 15.15, 15.40, 17.43, 14.80, 10.79],
    'LAZER': [40.77, 22.00, 158.31, 18.00, 115.48, 56.13, 105.00, 9.97, 200.00, 29.50, 69.77, 104.97, 40.00, 48.00, 19.90],
    'IFOOD+BESTEIRAS': [33.07, 42.99, 20.00, 19.99, 22.50],
    'PRESENTES/SOCIAL': [121.00, 70.98, 35.00],
    'ALIMENTAÇÃO': [63.36, 20.99, 101.02, 11.39, 60.21, 78.95, 103.97, 59.23, 31.46, 73.57, 55.29, 53.89, 73.46],
    'COMPRAS': [148.50, 193.60, 30.50, 39.05, 23.99, 20.91],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90],
    'OUTROS': [30.00, 18.00, 113.79, 49.90, 47.79],
    'ESO ARQUITETURA': [50.00, 127.10, 83.20],
  },
  novembro_2025: {
    'TRANSPORTE': [10.78, 16.17, 12.23, 15.76, 7.37, 7.70, 13.43, 13.26, 8.90, 7.90, 15.39, 18.90, 12.00, 8.36, 15.40, 21.11, 15.50, 5.86, 16.70, 15.00, 23.07, 14.10, 22.67, 20.64, 5.95, 9.10, 9.80, 11.60, 9.90, 15.50, 5.85, 9.36, 8.05, 10.90, 7.13, 28.10, 15.26, 16.84, 15.23, 14.39, 16.54, 11.40, 21.30],
    'LAZER': [70.00, 130.00, 79.87, 27.90, 76.00, 151.90, 20.00, 117.00, 34.00, 27.00, 5.00, 40.00, 100.00, 27.90, 4.99, 25.00, 45.10, 10.00, 184.80, 60.50, 8.80, 167.20, 44.00, 78.00, 60.00, 38.90, 23.50, 41.00, 11.00, 16.00, 123.00, 22.00, 16.00],
    'IFOOD+BESTEIRAS': [20.99, 25.10, 34.08, 8.48, 42.92, 39.12, 25.00],
    'PRESENTES/SOCIAL': [59.50],
    'ALIMENTAÇÃO': [73.46, 50.98, 39.28, 43.24, 16.99, 7.70, 7.41, 23.07, 65.70, 6.98, 40.75, 9.99, 39.90, 6.98, 15.32, 17.61],
    'COMPRAS': [193.60, 148.50, 39.05, 55.91, 260.10, 58.17, 100.00, 74.80],
    'ASSINATURAS': [32.90, 5.95, 9.99, 19.90, 14.90, 156.28, 27.90, 18.90],
    'OUTROS': [47.97, 30.00],
    'ESO ARQUITETURA': [116.00],
  },
  dezembro_2025: {
    'TRANSPORTE': [8.53, 14.67, 5.95, 10.32, 11.63, 11.63, 10.96, 12.66, 23.60, 14.90, 20.70, 14.90, 21.90, 13.56, 9.10, 8.02, 11.18, 11.12, 17.92, 14.30, 8.70, 15.20, 20.57, 4.99, 11.97, 16.90, 13.59, 20.70, 13.32, 8.27, 8.64, 14.94, 18.00, 12.56, 7.02, 15.10],
    'LAZER': [46.87, 46.60, 56.50, 49.80, 49.80, 51.65, 45.50, 80.50, 76.18, 45.00, 37.39],
    'IFOOD+BESTEIRAS': [36.00, 27.95, 13.00, 33.34, 24.99, 55.36, 30.00],
    'PRESENTES/SOCIAL': [30.00, 87.00, 45.00, 59.95, 5.00, 51.80, 109.00, 92.00],
    'ALIMENTAÇÃO': [185.48, 85.09, 53.49, 7.00, 10.75, 7.00, 38.68, 33.98, 16.99, 14.28, 24.00, 49.80],
    'COMPRAS': [5.49, 12.00, 4.60, 30.00, 55.13, 24.08, 58.17, 99.98, 74.90, 97.43],
    'ASSINATURAS': [32.90, 14.99, 19.90, 19.90, 156.28, 18.90, 7.95],
    'OUTROS': [22.99, 30.00],
  },
  janeiro_2026: {
    'TRANSPORTE': [23.72, 6.86, 17.47, 5.38, 6.28, 21.68, 28.50, 11.56, 11.99, 8.50, 15.02, 18.41, 6.13, 9.60, 15.43, 24.60, 11.00, 19.90, 8.43, 13.67, 16.17, 7.70, 11.72, 13.78, 14.20, 10.64, 15.70, 6.80, 13.60, 3.50, 20.00, 12.13, 20.40, 9.30, 19.30, 8.28, 17.34, 15.74, 15.27, 3.00, 12.60, 11.73, 18.80, 11.57, 16.00, 7.60, 8.50, 16.90],
    'LAZER': [116.96, 7.99, 9.00, 49.80, 89.00, 28.50, 36.00, 42.00, 23.90, 15.00],
    'IFOOD+BESTEIRAS': [23.49, 18.47, 23.90, 39.99, 89.00],
    'PRESENTES/SOCIAL': [200.00, 100.00, 53.00, 65.00, 100.00],
    'ALIMENTAÇÃO': [150.16, 12.00, 14.56, 35.98, 49.70, 46.61, 20.00, 42.68, 6.98, 50.84, 68.45, 31.89, 23.61, 18.48, 16.98, 16.98, 16.04, 26.87, 19.00, 41.42],
    'COMPRAS': [97.50, 60.47, 20.84, 52.93, 23.47, 39.99],
    'ASSINATURAS': [32.90, 14.99, 19.90, 19.90, 156.28, 18.90, 7.95],
    'OUTROS': [14.00, 119.74, 35.00, 86.94, 18.96],
  },
  fevereiro_2026: {
    'TRANSPORTE': [17.50, 15.84, 5.00, 12.92, 16.01, 14.74, 20.60, 13.70, 17.80, 16.80, 8.47, 12.30, 20.13, 7.90, 11.64, 17.30, 17.30, 24.18, 12.40, 16.50, 12.53, 22.50, 10.70, 16.90, 9.50, 26.20, 27.77, 14.90, 16.26, 14.70, 17.50, 12.83, 18.80, 15.50, 16.90, 7.32, 11.10, 16.10, 18.10, 7.95, 14.70, 24.30, 13.00, 37.24],
    'LAZER': [29.90, 83.71, 60.80, 119.90, 126.13, 13.00, 10.00, 40.00, 27.60, 46.00, 13.99, 32.00, 31.00, 71.90, 38.00, 170.00, 27.60, 46.00, 13.99, 32.00],
    'IFOOD+BESTEIRAS': [39.99, 18.80, 29.49, 26.90, 55.49, 23.49],
    'PRESENTES/SOCIAL': [200.00, 20.00, 18.80, 40.00, 40.00, 45.98, 300.00, 66.00, 135.00],
    'ALIMENTAÇÃO': [28.91, 14.62, 50.00, 28.04, 115.22, 17.57, 25.31, 14.78, 11.99, 85.53, 8.28, 71.02, 85.12, 8.87, 7.25, 17.79],
    'COMPRAS': [97.43, 31.98, 64.95, 64.85, 119.99],
    'ASSINATURAS': [32.90, 14.99, 19.90, 19.90, 156.28, 18.90, 7.95],
    'OUTROS': [30.00, 27.98, 30.00],
  },
  março_2026: {
    'TRANSPORTE': [12.15, 12.70, 15.22, 18.42, 14.30, 15.11, 15.70, 17.40, 15.80, 19.53, 18.45, 31.10, 22.44, 14.20, 18.17, 13.28, 12.10, 17.49, 13.80, 17.40, 14.96, 23.70, 13.90, 16.21, 5.60, 12.90, 14.50, 9.90, 8.60, 11.70, 7.84, 10.66, 8.00, 14.16, 4.30, 4.30, 6.94, 12.07, 16.34, 14.30, 18.74, 13.10, 17.30],
    'LAZER': [10.00, 32.00, 30.10, 10.00, 78.40, 3.50, 82.85, 17.90, 65.00, 35.90, 50.00, 20.00, 18.58, 11.00],
    'IFOOD+BESTEIRAS': [18.51, 40.00, 32.46, 14.86, 30.00, 61.38, 29.74, 45.00, 4.49],
    'PRESENTES/SOCIAL': [45.14, 52.24],
    'ALIMENTAÇÃO': [22.97, 10.00, 77.30, 169.44, 12.49, 27.15, 9.98, 15.99, 63.22, 15.20, 36.87, 22.28, 14.48, 74.59, 19.00],
    'COMPRAS': [54.55, 18.95, 17.26, 97.43, 64.95, 104.85, 119.99, 64.99, 64.99, 59.99, 13.99],
    'ASSINATURAS': [32.90, 14.99, 19.90, 19.90, 156.28, 18.90, 7.95, 19.90],
    'OUTROS': [38.74, 126.24, 59.99],
  },
};

const IMPORTED_PROJECTS = {
  junho_2022: [{ nome: 'ADRIANA', valor: 1550.00 }],
  julho_2022: [{ nome: 'wall', valor: 30.00 }, { nome: 'TIKTOK', valor: 400.00 }, { nome: 'Nicolas', valor: 2500.00 }],
  agosto_2022: [{ nome: 'Bia', valor: 96.00 }, { nome: 'Wall', valor: 96.00 }, { nome: 'Padoka', valor: 1237.50 }],
  setembro_2022: [{ nome: 'Presente Chris', valor: 745.00 }, { nome: 'Padoka', valor: 1237.50 }, { nome: 'Academia Arte Vida', valor: 1900.00 }, { nome: 'passe de ônibus', valor: 40.00 }],
  outubro_2022: [{ nome: 'Padoka', valor: 1237.50 }, { nome: 'Academia Arte Vida', valor: 1900.00 }, { nome: 'Organização Azione', valor: 700.00 }, { nome: 'Férias Proporcionais', valor: 1409.00 }],
  novembro_2022: [{ nome: 'mae', valor: 50.00 }, { nome: 'Padoka', valor: 1237.50 }, { nome: 'Academia Arte Vida', valor: 1900.00 }, { nome: 'Isabela', valor: 1750.00 }, { nome: 'Adriana', valor: 400.00 }],
  dezembro_2022: [{ nome: 'HELI', valor: 123.00 }],
  janeiro_2023: [{ nome: 'MOZART', valor: 2000.00 }, { nome: 'ANESIO', valor: 685.00 }],
  fevereiro_2023: [{ nome: 'GRÁ', valor: 3200.00 }, { nome: 'ANESIO', valor: 685.00 }],
  março_2023: [{ nome: 'DANIEL', valor: 47.00 }, { nome: 'GUSTAVO', valor: 47.00 }, { nome: 'GRÁ', valor: 3200.00 }, { nome: 'PONTOS', valor: 250.00 }],
  abril_2023: [],
  maio_2023: [{ nome: '-', valor: 3030.00 }, { nome: 'PROJETO 3', valor: 150.00 }, { nome: 'Maquete Luma', valor: 1500.00 }],
  junho_2023: [{ nome: 'MARDEN E ALANA', valor: 4531.00 }, { nome: 'WASHINGTON', valor: 1871.00 }, { nome: 'ELISA', valor: 650.00 }],
  julho_2023: [{ nome: 'FERNANDA', valor: 1375.00 }, { nome: 'Consultório', valor: 500.00 }],
  agosto_2023: [{ nome: 'RT ILUMINAÇÃO 1', valor: 600.00 }, { nome: 'RT 3', valor: 3399.12 }, { nome: 'RT ILUMINAÇÃO', valor: 500.00 }, { nome: 'RT MARMORARIA', valor: 835.00 }, { nome: 'FERNANDA', valor: 1375.00 }, { nome: 'Restaurante', valor: 14500.00 }, { nome: 'CONSÓRCIO', valor: 1800.00 }, { nome: 'CASHBACK TV', valor: 200.00 }],
  setembro_2023: [{ nome: 'FREDERIC', valor: 2000.00 }, { nome: 'ELISA', valor: 1000.00 }, { nome: 'LEVANTAMENTO', valor: 500.00 }, { nome: 'COMISSÃO SJ', valor: 422.00 }],
  outubro_2023: [{ nome: 'FREDERIC', valor: 2000.00 }, { nome: 'FER E VICTOR', valor: 1350.00 }, { nome: 'CELULAR', valor: 2150.00 }],
  novembro_2023: [{ nome: 'NINI E GILBERTO', valor: 3941.00 }, { nome: 'FER E VICTOR', valor: 1350.00 }, { nome: 'MANKAI', valor: 500.00 }, { nome: 'LEVANTAMENTOS', valor: 1250.00 }, { nome: 'MADÁ', valor: 1500.00 }, { nome: 'DANIEL', valor: 1500.00 }],
  dezembro_2023: [{ nome: 'FER E VICTOR', valor: 1350.00 }, { nome: 'JAPONES', valor: 2383.33 }, { nome: 'MANKAI', valor: 500.00 }, { nome: 'MADÁ', valor: 1500.00 }, { nome: 'FREDERIC', valor: 1500.00 }, { nome: 'MANAKAI 2', valor: 1250.00 }],
  janeiro_2024: [{ nome: 'FAMU', valor: 4500.00 }, { nome: 'MALIBU', valor: 1783.33 }, { nome: 'ALPHA IMOBILIÁRIA', valor: 1700.00 }, { nome: 'MADÁ', valor: 1500.00 }, { nome: 'FREDERIC', valor: 1500.00 }, { nome: 'MANAKAI 2', valor: 1250.00 }],
  fevereiro_2024: [{ nome: 'CASA COR', valor: 2650.00 }, { nome: 'MALIBU', valor: 1783.33 }, { nome: 'CASA JOEL', valor: 5750.00 }, { nome: 'RT ESPELHOS', valor: 350.00 }],
  março_2024: [{ nome: 'Helionardo', valor: 212.50 }],
  abril_2024: [{ nome: 'Helionardo', valor: 212.50 }, { nome: 'Clínica', valor: 2183.00 }, { nome: 'Aprovação Lays', valor: 2000.00 }, { nome: 'Aprovação Isa', valor: 1400.00 }, { nome: 'Alok Roberta', valor: 2800.00 }],
  maio_2024: [{ nome: 'Clínica', valor: 2183.00 }],
  junho_2024: [{ nome: 'Clínica', valor: 3333.00 }, { nome: 'Brunch', valor: 1300.00 }],
  julho_2024: [{ nome: 'ROBERTA', valor: 3000.00 }],
  agosto_2024: [{ nome: 'ISA', valor: 1760.00 }],
  setembro_2024: [],
  outubro_2024: [{ nome: 'Roberta', valor: 1750.00 }],
  novembro_2024: [{ nome: 'Roberta', valor: 1750.00 }, { nome: 'Roberta', valor: 4000.00 }],
  dezembro_2024: [{ nome: 'Roberta', valor: 4000.00 }, { nome: 'Roberta', valor: 3200.00 }],
  janeiro_2025: [{ nome: 'Roberta Mosha', valor: 3200.00 }, { nome: 'Joyce Nudra', valor: 1880.00 }, { nome: 'Roberta Luí', valor: 2000.00 }, { nome: 'Roberta Marcello', valor: 1150.00 }],
  fevereiro_2025: [{ nome: 'Joyce Nudra', valor: 1880.00 }, { nome: 'Roberta Luí', valor: 2000.00 }, { nome: 'Roberta Marcello', valor: 1150.00 }, { nome: 'Vanessa e Matheus', valor: 1169.00 }],
  março_2025: [{ nome: 'Joyce Nudra', valor: 1880.00 }, { nome: 'Roberta Luí', valor: 2000.00 }, { nome: 'Roberta Marcello', valor: 1150.00 }, { nome: 'Vanessa e Matheus', valor: 1169.00 }],
  abril_2025: [{ nome: 'Vanessa e Matheus', valor: 1169.00 }],
  maio_2025: [],
  junho_2025: [{ nome: 'FABIANA', valor: 2500.00 }],
  julho_2025: [{ nome: 'DIEGO E MARIANA', valor: 3400.00 }, { nome: 'VANEIDE', valor: 3000.00 }],
  agosto_2025: [{ nome: 'DIEGO E MARIANA', valor: 3420.00 }, { nome: 'Nilda', valor: 5533.00 }, { nome: 'Mini conto', valor: 2675.00 }],
  setembro_2025: [{ nome: 'Gabriela', valor: 180.00 }, { nome: 'Paulo e Nat', valor: 5250.00 }],
  outubro_2025: [{ nome: 'rt', valor: 680.00 }],
  novembro_2025: [{ nome: 'ROBERTA', valor: 3500.00 }],
  dezembro_2025: [{ nome: 'ROBERTA', valor: 3500.00 }],
  janeiro_2026: [{ nome: 'Roberta', valor: 2000.00 }, { nome: 'Joyce', valor: 2000.00 }],
  fevereiro_2026: [{ nome: 'Roberta', valor: 1500.00 }, { nome: 'RT', valor: 2000.00 }],
  março_2026: [{ nome: 'Booking', valor: 2300.00 }],
};

const ESO_IMPORTED_CLOSINGS = [{"data":"30/06/2020","cliente":"Galpão Comercial","tipo":"Interiores","valor":6650,"entrada":"-","status":"Não fechado"},{"data":"30/10/2020","cliente":"Dona Zélia","tipo":"Interiores Sala","valor":1500,"entrada":"Indicação","status":"Não Fechado"},{"data":"24/11/2020","cliente":"Lucielly","tipo":"Interiores E Fachada","valor":3800,"entrada":"-","status":"Não Fechado"},{"data":"19/02/2021","cliente":"Babi","tipo":"Interiores","valor":7820,"entrada":"Instagram","status":"Não fechado"},{"data":"14/05/2021","cliente":"Natalia","tipo":"Interiores","valor":700,"entrada":"-","status":"Não fechado"},{"data":"19/05/2021","cliente":"Karol","tipo":"Arq e interiores","valor":2340,"entrada":"Indicação","status":"Não Fechado"},{"data":"23/06/2021","cliente":"Rauana","tipo":"Arq e interiores","valor":4400,"entrada":"Indicação","status":"Não Fechado"},{"data":"23/06/2021","cliente":"Christina","tipo":"Arq e interiores","valor":1350,"entrada":"Indicação","status":"Não Fechado"},{"data":"01/07/2021","cliente":"Polly e Caio","tipo":"Arq e interiores","valor":1250,"entrada":"Amigo","status":"Não Fechado"},{"data":"21/07/2021","cliente":"Priscila","tipo":"Interiores","valor":750,"entrada":"Indicação","status":"Fechado"},{"data":"29/07/2021","cliente":"Evilia","tipo":"Arq e interiores","valor":1320,"entrada":"-","status":"Não fechado"},{"data":"23/08/2021","cliente":"Erica","tipo":"Interiores","valor":600,"entrada":"Tiktok","status":"Não fechado"},{"data":"23/08/2021","cliente":"Brenda","tipo":"Interiores","valor":750,"entrada":"Tiktok","status":"Não fechado"},{"data":"23/08/2021","cliente":"Denyan","tipo":"Interiores","valor":3270,"entrada":"Tiktok","status":"Não fechado"},{"data":"23/08/2021","cliente":"Mirely","tipo":"Interiores","valor":900,"entrada":"Tiktok","status":"Não fechado"},{"data":"27/08/2021","cliente":"Luiza","tipo":"interiores","valor":600,"entrada":"Tiktok","status":"Não Fechado"},{"data":"30/08/2021","cliente":"Pedro","tipo":"Interiores","valor":1500,"entrada":"Tiktok","status":"Não fechado"},{"data":"02/09/2021","cliente":"Ana Luiza","tipo":"Interiores","valor":400,"entrada":"Tiktok","status":"Não fechado"},{"data":"08/09/2021","cliente":"Giovanni","tipo":"Interiores","valor":3200,"entrada":"Tiktok","status":"Não fechado"},{"data":"29/09/2021","cliente":"Lorraine","tipo":"Arq e interiores","valor":2460,"entrada":"-","status":"Não fechado"},{"data":"09/09/2021","cliente":"Keyciane","tipo":"Interiores","valor":4350,"entrada":"Tiktok","status":"Não Fechado"},{"data":"09/11/2021","cliente":"Marcelo","tipo":"Interiores","valor":600,"entrada":"Tiktok","status":"Não Fechado"},{"data":"30/11/2021","cliente":"Duda","tipo":"Interiores","valor":700,"entrada":"Amigo","status":"Não Fechado"},{"data":"10/12/2021","cliente":"Tiele","tipo":"Interiores","valor":1500,"entrada":"-","status":"Não fechado"},{"data":"30/09/2021","cliente":"Carlos","tipo":"Interiores","valor":3100,"entrada":"-","status":"Não fechado"},{"data":"09/01/2022","cliente":"Carlos","tipo":"Interiores","valor":950,"entrada":"-","status":"Não Fechado"},{"data":"13/01/2022","cliente":"Eduarda","tipo":"Arq e interiores","valor":5850,"entrada":"Amigo","status":"Não Fechado"},{"data":"08/03/2022","cliente":"Fabiane","tipo":"Interiores","valor":5820,"entrada":"-","status":"Não fechado"},{"data":"30/03/2022","cliente":"Daniela","tipo":"Interiores","valor":1450,"entrada":"-","status":"Não Fechado"},{"data":"11/04/2022","cliente":"Kamilla","tipo":"Interiores Comercial","valor":4700,"entrada":"Indicação","status":"Fechado"},{"data":"13/04/2022","cliente":"Nudra","tipo":"Interiores Comercial","valor":1400,"entrada":"Amigo","status":"Fechado"},{"data":"20/04/2022","cliente":"Anderson","tipo":"Interiores Comercial","valor":800,"entrada":"Indicação","status":"Não fechado"},{"data":"23/05/2022","cliente":"Fernanda","tipo":"3D","valor":1250,"entrada":"Cliente","status":"Não Fechado"},{"data":"27/06/2022","cliente":"Emporio Nicolas","tipo":"Interiores Comercial","valor":2600,"entrada":"Amigo","status":"Fechado"},{"data":"02/09/2022","cliente":"Helinho","tipo":"Interiores","valor":4950,"entrada":"Indicação","status":"Fechado"},{"data":"15/08/2022","cliente":"Rominia","tipo":"Interiores","valor":700,"entrada":"-","status":"Não fechado"},{"data":"26/10/2022","cliente":"David","tipo":"Interiores","valor":3125,"entrada":"-","status":"Não fechado"},{"data":"28/10/2022","cliente":"-","tipo":"Legalização","valor":1750,"entrada":"-","status":"Não fechado"},{"data":"20/11/2022","cliente":"Raphaela","tipo":"Arq e interiores","valor":17560,"entrada":"Indicação","status":"Não fechado"},{"data":"30/12/2022","cliente":"Igor e Leticia","tipo":"Arquitetura","valor":9900,"entrada":"-","status":"Não fechado"},{"data":"09/01/2023","cliente":"Marcos e Raissa","tipo":"Arquitetura","valor":5750,"entrada":"Amigo","status":"Não Fechado"},{"data":"09/01/2023","cliente":"Samuel e Aline","tipo":"Arq e interiores","valor":6750,"entrada":"-","status":"Não fechado"},{"data":"12/02/2023","cliente":"Tropical Prive","tipo":"Arq e interiores","valor":21000,"entrada":"-","status":"Não fechado"},{"data":"31/03/2023","cliente":"Vinicius","tipo":"Arq e interiores","valor":8850,"entrada":"Indicação","status":"Não fechado"},{"data":"16/05/2023","cliente":"Victor e Fer","tipo":"Interiores","valor":4050,"entrada":"Amigos","status":"Fechado"},{"data":"16/05/2023","cliente":"Gilberto e Nini","tipo":"Interiores","valor":3930,"entrada":"Amigos","status":"Fechado"},{"data":"25/05/2023","cliente":"Alana e Marden","tipo":"Interiores","valor":4770,"entrada":"Amigos","status":"Fechado"},{"data":"29/05/2023","cliente":"Roberto Pizarro","tipo":"Interiores","valor":5750,"entrada":"Indicação","status":"Não fechado"},{"data":"30/05/2023","cliente":"Washington","tipo":"Interiores","valor":1970,"entrada":"Indicação","status":"Fechado"},{"data":"19/06/2023","cliente":"Washington","tipo":"Interiores","valor":1250,"entrada":"Cliente","status":"Não fechado"},{"data":"19/06/2023","cliente":"Fernanda Yamamoto","tipo":"Personalização","valor":2750,"entrada":"Indicação","status":"Fechado"},{"data":"07/07/2023","cliente":"Claudia","tipo":"Interiores Comercial","valor":6750,"entrada":"Indicação","status":"Não Fechado"},{"data":"14/08/2023","cliente":"Luiza","tipo":"Interiores","valor":6650,"entrada":"Indicação","status":"Não fechado"},{"data":"18/10/2023","cliente":"Fabbyo","tipo":"Interiores Comercial","valor":9850,"entrada":"-","status":"Não fechado"},{"data":"06/11/2023","cliente":"Jonas","tipo":"Interiores Comercial","valor":2850,"entrada":"Indicação","status":"Não fechado"},{"data":"20/11/2023","cliente":"Pedro","tipo":"Interiores","valor":6650,"entrada":"-","status":"Não fechado"},{"data":"06/01/2024","cliente":"Casa Joel","tipo":"Arquitetura","valor":6400,"entrada":"Amigo","status":"Fechado"},{"data":"23/03/2024","cliente":"Rosane","tipo":"Arquitetura","valor":10850,"entrada":"Indicação","status":"Fechado"},{"data":"15/07/2024","cliente":"Kitnets","tipo":"Arquitetura","valor":4200,"entrada":"-","status":"Não fechado"},{"data":"15/07/2024","cliente":"Florata","tipo":"Arquitetura","valor":11500,"entrada":"-","status":"Não fechado"},{"data":"09/10/2024","cliente":"Bel","tipo":"Decoração","valor":3500,"entrada":"Indicação","status":"Não fechado"},{"data":"27/11/2024","cliente":"Matheus e Vanessa","tipo":"Interiores","valor":4925,"entrada":"Amigo","status":"Fechado"},{"data":"29/12/2024","cliente":"Novo Nudra","tipo":"Interiores","valor":11280,"entrada":"Amigo","status":"Fechado"},{"data":"20/01/2025","cliente":"Ana e Marcelo","tipo":"Interiores","valor":14875,"entrada":"Indicação","status":"Não fechado"},{"data":"08/03/2025","cliente":"Debora","tipo":"Interiores","valor":1500,"entrada":"Cliente","status":"Não fechado"},{"data":"19/05/2025","cliente":"Helinho","tipo":"Interiores","valor":5760,"entrada":"Cliente","status":"Não fechado"},{"data":"13/05/2025","cliente":"Euvanice","tipo":"Interiores","valor":4650,"entrada":"Indicação","status":"Não fechado"},{"data":"30/05/2025","cliente":"Fabiana","tipo":"Interiores","valor":2650,"entrada":"Indicação","status":"Fechado"},{"data":"30/05/2025","cliente":"Nilda","tipo":"Interiores","valor":5800,"entrada":"Indicação","status":"Fechado"},{"data":"20/06/2025","cliente":"Mariana e Diego","tipo":"Interiores","valor":6840,"entrada":"Conhecidos","status":"Fechado"},{"data":"05/07/2025","cliente":"Vaneide","tipo":"Interiores","valor":3000,"entrada":"Indicação","status":"Fechado"},{"data":"21/07/2025","cliente":"Mini Conto","tipo":"Interiores","valor":4550,"entrada":"Conhecidos","status":"Fechado"},{"data":"16/07/2025","cliente":"Thiálita","tipo":"Interiores","valor":7950,"entrada":"Cliente","status":"Não fechado"},{"data":"01/08/2025","cliente":"Fernanda Yamamoto","tipo":"Interiores","valor":8950,"entrada":"Cliente","status":"Não fechado"},{"data":"27/08/2025","cliente":"Natalia e Paulo","tipo":"Interiores","valor":5250,"entrada":"Conhecidos","status":"Fechado"},{"data":"01/10/2025","cliente":"Gilberth","tipo":"Interiores","valor":6500,"entrada":"Indicação","status":"Não fechado"},{"data":"12/11/2025","cliente":"Claudia","tipo":"Interiores","valor":29000,"entrada":"Indicação","status":"Não fechado"},{"data":"18/11/2025","cliente":"Nini","tipo":"Interiores","valor":11000,"entrada":"Conhecidos","status":"Não fechado"},{"data":"18/11/2025","cliente":"Claudia","tipo":"Interiores","valor":5820,"entrada":"Indicação","status":"Não Fechado"},{"data":"06/01/2025","cliente":"Gabriel","tipo":"Interiores","valor":6800,"entrada":"Conhecidos","status":"Aguardando"}];

const IMPORTED_CATEGORY_ORDER = ['TRANSPORTE', 'LAZER', 'IFOOD+BESTEIRAS', 'PRESENTES/SOCIAL', 'ALIMENTAÇÃO', 'COMPRAS', 'ASSINATURAS', 'OUTROS', 'ESO ARQUITETURA'];
const DATA_MIGRATION_VERSION = 4;

const CAT_COLORS = {
  'TRANSPORTE':'#3266ad','LAZER':'#8e44ad','IFOOD+BESTEIRAS':'#e67e22',
  'PRESENTES/SOCIAL':'#e74c3c','ALIMENTAÇÃO':'#27ae60','COMPRAS':'#2980b9',
  'ASSINATURAS':'#16a085','FARMÁCIA':'#c0392b','SAÚDE':'#d35400',
  'OUTROS':'#95a5a6','ESO ARQUITETURA':'#1a5276'
};
const SYSTEM_DEFAULT_CATEGORY_PRESETS = [
  { name: 'MORADIA', emoji: '🏠' },
  { name: 'SERVIÇOS', emoji: '🛠️' },
  { name: 'ALIMENTAÇÃO', emoji: '🍽️' },
  { name: 'TRANSPORTE', emoji: '🚗' },
  { name: 'COMPRAS', emoji: '🛍️' },
  { name: 'SAÚDE', emoji: '💊' },
  { name: 'LAZER', emoji: '🎬' },
  { name: 'EDUCAÇÃO', emoji: '🎓' },
  { name: 'FINANCEIRO', emoji: '💳' },
  { name: 'ASSINATURAS', emoji: '📱' },
  { name: 'TRABALHO', emoji: '💼' },
  { name: 'OUTROS', emoji: '📦' }
];
if (typeof window !== 'undefined') {
  window.SYSTEM_DEFAULT_CATEGORY_PRESETS = SYSTEM_DEFAULT_CATEGORY_PRESETS;
}
const DEFAULT_CATS = SYSTEM_DEFAULT_CATEGORY_PRESETS.map(item => item.name);

// ============================================================
// STATE
// ============================================================
let data = [];
let metas = {};
let currentMonthId = '';
function getAllFinanceMonths() {
  return Array.isArray(data) ? data : [];
}
let editingItem = null;
let editingType = null;
let charts = {};
let varSort = { field: 'valor', direction: 'desc' };
let resultMode = 'simples';
let activePage = 'dashboard';
let histActiveTab = 'tabela';
let pendingScrollY = null;
let patrimonioAccounts = [];
let patrimonioMovements = [];
let patrimonioSelectedAccountId = '';
let patrimonioFilters = {
  search: '',
  period: 'all',
  sort: 'saldo_desc',
  movementType: 'all'
};
let categoryRenameMap = {};
let expenseCategoryRules = {};
let expenseNameRenameMap = {};
let expensePaymentDateRules = {};
let incomeNameRenameMap = {};
let despSort = { field: '', direction: 'asc' };
let rendaSort = { field: '', direction: 'asc' };
let projSort = { field: '', direction: 'asc' };
let dailySort = { field: '', direction: 'asc' };
let despCategoriaFiltro = 'TODAS';
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;
let inlineEditState = null;
let titleEditKey = null;
let dashSeriesPickerOpen = false;
let dashMetricOrder = ['resultado', 'gastos', 'ganhos', 'renda', 'projetos'];
let dragDashMetricKey = '';
let dashboardWidgetOrder = ['gvsr', 'categories', 'result', 'quickhist'];
let dashboardWidgetDragState = null;
let dashboardWidgetResizeState = null;
let dashboardWidgetLayout = {
  gvsr: { x: 0, y: 0, w: 680, h: 340 },
  categories: { x: 700, y: 0, w: 340, h: 340 },
  result: { x: 0, y: 360, w: 680, h: 280 },
  quickhist: { x: 700, y: 360, w: 340, h: 280 }
};
let monthMetricOrder = ['resultado', 'gastos', 'renda', 'projetos', 'metas'];
let monthSectionOrder = ['renda', 'goals', 'despesas', 'daily', 'projetos', 'reembolsos', 'observacoes'];
let dragMonthMetricKey = '';
let dragMonthSectionKey = '';
let notificationsSeenDayKey = '';
let despSelectionState = {};
const AUTO_COPY_EXPENSES_ZEROED = ['NUBANK', 'XP', 'DINHEIRO'];
const AUTO_COPY_EXPENSES_WITH_LAST_VALUE = ['BANCO INTER (JÁ COM FINAL)', 'PARCELA APARTAMENTO', 'INTERNET', 'DAS', 'CONDOMÍNIO', 'ENERGIA'];
const AUTO_COPY_DAILY_CATEGORIES = ['ASSINATURAS'];
const AUTO_COPY_RENDA = ['UBER', 'SALÁRIO LARYSSA'];
const DASH_SERIES_OPTIONS = {
  resultSimple: {
    getLabel: list => `${labelResult(list)} · período`,
    color: '#8e44ad',
    background: 'rgba(142,68,173,.08)',
    getData: m => computeResult(m, resultMode)
  },
  totalGastos: {
    getLabel: () => 'Total acumulado gastos',
    color: '#c0392b',
    background: 'rgba(192,57,43,.08)',
    getData: m => getTotals(m).totalGastos
  },
  totalGanhos: {
    getLabel: () => 'Total acumulado ganhos',
    color: '#27ae60',
    background: 'rgba(39,174,96,.08)',
    getData: m => getTotals(m).rendaTotal
  },
  rendaFixa: {
    getLabel: () => 'Renda fixa acumulada',
    color: '#1f7a4d',
    background: 'rgba(31,122,77,.08)',
    getData: m => getTotals(m).rendaFixa
  },
  projetos: {
    getLabel: () => 'Projetos / entradas extras',
    color: '#2855a0',
    background: 'rgba(40,85,160,.08)',
    getData: m => getTotals(m).totalProj
  }
};
const DEFAULT_DASH_SERIES = Object.keys(DASH_SERIES_OPTIONS);
const DASH_SERIES_SELECTION_VERSION = 3;
const DASH_SERIES_COLOR_OPTIONS = ['#8e44ad','#c0392b','#27ae60','#1f7a4d','#2855a0','#e67e22','#16a085','#d35400','#2c3e50','#c2185b','#7f8c8d','#6c5ce7'];
let dashSeriesSelectionsByMode = {};
let dashSeriesSelection = [...DEFAULT_DASH_SERIES];
let uiDashSeriesSelectionsFallback = null;
let dashSeriesColorOverrides = {};
let dashSeriesColorPicker = { open: false, key: '', x: 0, y: 0 };
let categoryColorOverrides = {};
let categoryEmojiOverrides = {};
let categoryColorPicker = { open: false, key: '', x: 0, y: 0 };
let monthSectionColorOverrides = {};
let monthSectionColorPicker = { open: false, key: '', x: 0, y: 0 };
const MONTH_SECTION_DEFAULT_COLORS = {
  despesas: '#c0392b',
  daily: '#2855a0',
  renda: '#2d5a3d',
  goals: '#8e6a1f',
  projetos: '#2855a0',
  observacoes: '#7f8c8d'
};
const MONTH_SECTION_LABELS = {
  despesas: 'Despesas',
  daily: 'Gastos diários',
  renda: 'Renda',
  goals: 'Metas financeiras',
  projetos: 'Renda extra',
  observacoes: 'Observações'
};
let sectionTitles = {
  despesas: 'Despesas',
  renda: 'Renda fixa',
  goals: 'Metas financeiras',
  projetos: 'Projetos / entradas extras',
  patrimonioAccounts: 'Contas patrimoniais',
  patrimonioEvolution: 'Evolução do patrimônio',
  patrimonioDistribution: 'Distribuição atual',
  patrimonioForecasts: 'Previsões para transferir',
  patrimonioHistory: 'Movimentações',
  metricResultado: 'Resultado',
  metricGastos: 'Total despesas',
  metricRenda: 'Renda',
  metricProjetos: 'Projetos / entradas extras',
  metricMetas: 'Metas financeiras',
  variaveis: 'Gastos variáveis',
  daily: 'Gastos diários',
  gvsr: 'Gastos vs Renda',
  resultchart: 'Resultado por período selecionado',
  catdash: 'Categorias',
  quickhist: 'Histórico rápido'
};
let periodFilter = { type: 'all', month: '', year: '', start: '', end: '' };
let obsDraft = '';
let modalDragState = null;
let esoData = [];
let esoSort = { field: 'data', direction: 'desc' };
let esoFilter = { start: '', end: '', status: 'todas', tipo: 'todas', entrada: 'todas', search: '' };
let editingEsoId = null;

function buildBlankMonth(date = new Date()) {
  const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const monthName = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const id = `${monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}_${year}`;
  return {
    id,
    nome: `${monthName} ${year}`,
    despesas: [],
    renda: [],
    projetos: [],
    financialGoals: [],
    patrimonioTransfers: [],
    calendarEvents: [],
    outflowCards: [],
    outflows: [],
    cardBills: [],
    unifiedOutflowUi: {},
    total_gastos: 0,
    total_renda: 0,
    resultado: 0,
    categorias: {},
    gastosVar: [],
    dailyCategorySeeds: [],
    dailyGoals: {},
    dailyGoalTarget: null,
    dailyGoalManualCats: [],
    obs: ''
  };
}


