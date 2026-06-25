const mesAtual = getMesAtual();

/* --- Configuração e estado --- */

const HISTORY_KEY = 'metasdiarias-history';
const MAX_HISTORY = 5;

const answers = {
  metaMensal: null,
  diasTrabalho: null,
  diasJaTrabalhados: null,
  lucroJaObtido: null,
  folgasParaTrabalhar: null,
};

let currentStepIndex = 0;
let steps = [];
let historyOpen = false;

const dom = {
  monthInfo: document.getElementById('month-info'),
  stepContent: document.getElementById('step-content'),
  errorMsg: document.getElementById('error-msg'),
  btnBack: document.getElementById('btn-back'),
  btnNext: document.getElementById('btn-next'),
  btnRestart: document.getElementById('btn-restart'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  questionsPanel: document.getElementById('questions-panel'),
  resultsCard: document.getElementById('results-card'),
  headerSubtitle: document.getElementById('header-subtitle'),
  resposta1Valor: document.getElementById('resposta-1-valor'),
  resposta2Texto: document.getElementById('resposta-2-texto'),
  respostaAlerta: document.getElementById('resposta-alerta'),
  respostaAlertaTexto: document.getElementById('resposta-alerta-texto'),
  resposta3Valor: document.getElementById('resposta-3-valor'),
  resposta3Texto: document.getElementById('resposta-3-texto'),
  resposta3Wrap: document.getElementById('resposta-3-wrap'),
  respostaFolgas: document.getElementById('resposta-folgas'),
  folgasParaTrabalharInput: document.getElementById('folgas-para-trabalhar-input'),
  folgasTrabalhoHint: document.getElementById('folgas-trabalho-hint'),
  folgasTrabalhoError: document.getElementById('folgas-trabalho-error'),
  btnCalcularFolgas: document.getElementById('btn-calcular-folgas'),
  historyCard: document.getElementById('history-card'),
  historyList: document.getElementById('history-list'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  btnVerHistorico: document.getElementById('btn-ver-historico'),
};

/* --- Calendário e formatação --- */

function getMesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long' });
  const nomeFormatado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

  return { ano, mes, diasNoMes, nome: nomeFormatado, diaHoje: hoje.getDate() };
}

function getFolgasPlanejadas(diasTrabalho) {
  return mesAtual.diasNoMes - diasTrabalho;
}

function formatDias(qtd) {
  return `${qtd} dia${qtd !== 1 ? 's' : ''}`;
}

function parseCurrency(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatCurrency(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatInputCurrency(value) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildFolgasPreview(diasTrabalho) {
  if (!diasTrabalho || diasTrabalho <= 0) {
    return '📌 Informe quantos dias vai trabalhar para ver suas folgas.';
  }

  const folgas = getFolgasPlanejadas(diasTrabalho);

  if (folgas > 0) {
    return `📌 Trabalhando <strong>${diasTrabalho}</strong> dias em um mês de <strong>${mesAtual.diasNoMes}</strong>, você terá <strong>${formatDias(folgas)}</strong> de folga.`;
  }

  if (folgas === 0) {
    return `📌 Trabalhando <strong>${diasTrabalho}</strong> dias, você não terá folgas neste mês.`;
  }

  const extras = Math.abs(folgas);
  return `📌 Você planejou <strong>${formatDias(diasTrabalho)}</strong> em um mês de <strong>${mesAtual.diasNoMes}</strong> — <strong>${formatDias(extras)}</strong> a mais do que o calendário tem.`;
}

/* --- Folgas: análise e regras --- */

function analyzeFolgas(diasTrabalho, diasJaTrabalhados) {
  const folgasPlanejadas = getFolgasPlanejadas(diasTrabalho);
  const folgasPlanejadasPositivas = Math.max(0, folgasPlanejadas);
  const diasSemTrabalhar = mesAtual.diaHoje - diasJaTrabalhados;
  const folgasUsadas = Math.max(0, diasSemTrabalhar);
  const folgasRestantesNoPlano = folgasPlanejadasPositivas - folgasUsadas;
  const folgasExcedentes = Math.max(0, folgasUsadas - folgasPlanejadasPositivas);

  let situacao = 'em_dia';

  if (diasJaTrabalhados > mesAtual.diaHoje) {
    situacao = 'dados_inconsistentes';
  } else if (folgasPlanejadas <= 0 && folgasUsadas > 0) {
    situacao = 'folgou_sem_direito';
  } else if (folgasExcedentes > 0) {
    situacao = 'folgou_alem_do_plano';
  } else if (folgasPlanejadasPositivas > 0 && folgasUsadas === folgasPlanejadasPositivas) {
    situacao = 'folgas_esgotadas';
  } else if (folgasUsadas > 0 && folgasRestantesNoPlano > 0) {
    situacao = 'folgas_disponiveis';
  }

  return {
    folgasPlanejadas,
    folgasPlanejadasPositivas,
    diasSemTrabalhar: folgasUsadas,
    folgasUsadas,
    folgasRestantesNoPlano: Math.max(0, folgasRestantesNoPlano),
    folgasExcedentes,
    situacao,
  };
}

function podeUsarFolgasParaTrabalhar(diasTrabalho, diasJaTrabalhados) {
  const diasRestantesNoPlano = Math.max(0, diasTrabalho - diasJaTrabalhados);
  const diasRestantesNoCalendario = Math.max(0, mesAtual.diasNoMes - mesAtual.diaHoje);
  const folgas = analyzeFolgas(diasTrabalho, diasJaTrabalhados);

  return (
    diasRestantesNoPlano === 0 &&
    folgas.folgasRestantesNoPlano > 0 &&
    diasRestantesNoCalendario > 0
  );
}

function getMaxFolgasParaTrabalhar(diasTrabalho, diasJaTrabalhados) {
  if (!podeUsarFolgasParaTrabalhar(diasTrabalho, diasJaTrabalhados)) {
    return 0;
  }

  const folgas = analyzeFolgas(diasTrabalho, diasJaTrabalhados);
  const diasRestantesNoCalendario = Math.max(0, mesAtual.diasNoMes - mesAtual.diaHoje);

  return Math.min(folgas.folgasRestantesNoPlano, diasRestantesNoCalendario);
}

function shouldAskFolgasParaTrabalhar() {
  const { metaMensal, diasTrabalho, diasJaTrabalhados, lucroJaObtido } = answers;
  if (
    metaMensal == null ||
    diasTrabalho == null ||
    diasJaTrabalhados == null ||
    lucroJaObtido == null
  ) {
    return false;
  }

  const faltaGanhar = Math.max(0, metaMensal - lucroJaObtido);
  if (faltaGanhar <= 0) return false;

  return podeUsarFolgasParaTrabalhar(diasTrabalho, diasJaTrabalhados);
}

/* --- Wizard: perguntas 1 a 4 --- */

function buildSteps() {
  return [
    {
      id: 'metaMensal',
      title: 'Valor total da meta:',
      type: 'currency',
      placeholder: '5.000,00',
      startEmpty: true,
    },
    {
      id: 'diasTrabalho',
      question: 'Quantos dias no mês você <span class="question-highlight">vai trabalhar</span>?',
      hint: 'Não importa quantos dias já passaram — informe o total planejado desde o início, sem as folgas.',
      type: 'number',
      min: 1,
      step: 1,
      suffix: 'dias',
      placeholder: '28',
      integer: true,
      startEmpty: true,
      showFolgasPreview: true,
    },
    {
      id: 'diasJaTrabalhados',
      question: 'Quantos dias desse mês você <span class="question-highlight">já trabalhou</span>?',
      hint: `Hoje é dia ${mesAtual.diaHoje} de ${mesAtual.nome.toLowerCase()}. Informe quantos dias de trabalho você já fez.`,
      type: 'number',
      min: 0,
      step: 1,
      suffix: 'dias',
      placeholder: '20',
      integer: true,
      allowZero: true,
      startEmpty: true,
    },
    {
      id: 'lucroJaObtido',
      question: 'Quanto de lucro você já obteve?',
      hint: 'Some todo o lucro que você já ganhou neste mês até agora.',
      type: 'currency',
      placeholder: '1.500,00',
      allowZero: true,
      startEmpty: true,
    },
  ];
}

function getAnswerValue(step) {
  return answers[step.id];
}

function getStepMax(step) {
  return typeof step.max === 'function' ? step.max() : step.max;
}

function showError(message) {
  dom.errorMsg.textContent = message;
  dom.errorMsg.hidden = !message;
}

function isEmptyAnswer(value) {
  return value === null || value === undefined || value === '';
}

function getDisplayValue(step, value) {
  if (step.startEmpty && (isEmptyAnswer(value) || value === 0)) {
    return '';
  }
  if (isEmptyAnswer(value)) {
    return step.default !== undefined ? step.default : '';
  }
  return value;
}

function validateCurrentStep() {
  const step = steps[currentStepIndex];
  if (!step) return false;

  const input = dom.stepContent.querySelector('[data-answer]');
  if (!input) return false;

  const inputVazio = input.value.trim() === '';

  if (step.type === 'currency') {
    if (inputVazio && step.allowZero) {
      answers[step.id] = 0;
    } else {
      const value = parseCurrency(input.value);
      if (!step.allowZero && value <= 0) {
        showError('Informe um valor maior que zero.');
        return false;
      }
      if (value < 0) {
        showError('Informe um valor válido.');
        return false;
      }
      answers[step.id] = value;
    }
  }

  if (step.type === 'number') {
    let value;
    if (inputVazio && step.allowZero) {
      value = 0;
    } else {
      value = parseFloat(input.value);
      const min = step.min ?? 0;
      const max = getStepMax(step);

      if (isNaN(value) || (!step.allowZero && value <= 0)) {
        showError(step.allowZero ? 'Informe um número válido.' : 'Informe um número maior que zero.');
        return false;
      }
      if (step.integer && !Number.isInteger(value)) {
        showError('Informe um número inteiro de dias.');
        return false;
      }
      if (value < min) {
        showError(`O valor mínimo é ${min}.`);
        return false;
      }
      if (max !== undefined && value > max) {
        showError(`O valor máximo é ${max}.`);
        return false;
      }
    }
    answers[step.id] = value;
  }

  showError('');
  return true;
}

function renderInputStep(step) {
  const value = getAnswerValue(step);
  const displayValue = getDisplayValue(step, value);

  let inputHtml = '';
  let folgasPreview = '';

  if (step.type === 'currency') {
    const display = displayValue !== '' ? formatInputCurrency(displayValue) : '';
    inputHtml = `
      <div class="input-wrap input-wrap--large">
        <span class="prefix">R$</span>
        <input type="text" data-answer data-currency data-allow-zero="${step.allowZero || false}"
          inputmode="decimal" placeholder="${step.placeholder || '0,00'}" value="${display}" autofocus>
      </div>
    `;
  }

  if (step.type === 'number') {
    const max = getStepMax(step);
    const maxAttr = max !== undefined ? `max="${max}"` : '';
    const placeholderAttr = step.placeholder ? `placeholder="${step.placeholder}"` : '';
    const useTextForPlaceholder = Boolean(step.placeholder);

    inputHtml = `
      <div class="input-row">
        <input type="${useTextForPlaceholder ? 'text' : 'number'}" data-answer data-step-id="${step.id}"
          ${useTextForPlaceholder ? 'inputmode="numeric"' : ''}
          min="${step.min}" ${maxAttr} step="${step.step || 1}"
          value="${displayValue}" ${placeholderAttr} autofocus>
        ${step.suffix ? `<span class="input-suffix">${step.suffix}</span>` : ''}
      </div>
    `;

    if (step.showFolgasPreview) {
      const dias = parseFloat(displayValue) || 0;
      folgasPreview = `<p class="folgas-preview" id="folgas-preview">${buildFolgasPreview(dias)}</p>`;
    }
  }

  return `
    <div class="step-enter">
      <span class="step-number">Pergunta ${currentStepIndex + 1}</span>
      ${step.title ? `<h2 class="step-title">${step.title}</h2>` : `<h2 class="step-question">${step.question}</h2>`}
      ${step.hint ? `<p class="step-hint">${step.hint}</p>` : ''}
      ${inputHtml}
      ${folgasPreview}
    </div>
  `;
}

function bindStepEvents(step) {
  const input = dom.stepContent.querySelector('[data-answer]');
  if (!input) return;

  input.addEventListener('focus', () => {
    requestAnimationFrame(() => input.select());
  });

  if (input.dataset.currency !== undefined) {
    const allowZero = input.dataset.allowZero === 'true';
    input.addEventListener('input', () => {
      const raw = input.value.replace(/\D/g, '');
      const num = parseInt(raw, 10) || 0;
      input.value = num > 0 || (allowZero && raw === '') ? formatInputCurrency(num / 100) : '';
      if (allowZero && raw === '') input.value = '';
      showError('');
    });
  } else {
    input.addEventListener('input', () => {
      showError('');
      if (input.dataset.stepId === 'diasTrabalho') {
        const preview = document.getElementById('folgas-preview');
        if (preview) {
          const dias = parseFloat(input.value) || 0;
          preview.innerHTML = buildFolgasPreview(dias);
        }
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.btnNext.click();
    });
  }
}

function updateProgress() {
  const total = steps.length;
  const current = currentStepIndex + 1;
  const pct = total > 0 ? (current / total) * 100 : 0;

  dom.progressFill.style.width = `${pct}%`;
  dom.progressText.textContent = `Pergunta ${current} de ${total}`;
}

function renderStep() {
  steps = buildSteps();

  if (currentStepIndex >= steps.length) {
    showResults();
    return;
  }

  const step = steps[currentStepIndex];
  dom.stepContent.innerHTML = renderInputStep(step);

  bindStepEvents(step);
  updateProgress();

  dom.btnBack.hidden = currentStepIndex === 0;
  dom.btnNext.textContent = currentStepIndex === steps.length - 1 ? 'Ver resultado' : 'Próxima';

  const input = dom.stepContent.querySelector('[data-answer]');
  if (input) input.focus();
}

/* --- Cálculo principal --- */

function calculate(fromAnswers = answers) {
  const { metaMensal, diasTrabalho, diasJaTrabalhados, lucroJaObtido } = fromAnswers;

  const folgas = analyzeFolgas(diasTrabalho, diasJaTrabalhados);
  const faltaGanhar = Math.max(0, metaMensal - lucroJaObtido);
  const metaAtingida = lucroJaObtido >= metaMensal;

  const diasRestantesNoPlano = Math.max(0, diasTrabalho - diasJaTrabalhados);
  const diasRestantesNoCalendario = Math.max(0, mesAtual.diasNoMes - mesAtual.diaHoje);
  const diasRestantesBase = Math.min(diasRestantesNoPlano, diasRestantesNoCalendario);
  const maxFolgasParaTrabalhar = getMaxFolgasParaTrabalhar(diasTrabalho, diasJaTrabalhados);
  const folgasParaTrabalhar = maxFolgasParaTrabalhar > 0
    ? Math.min(Math.max(0, fromAnswers.folgasParaTrabalhar ?? 0), maxFolgasParaTrabalhar)
    : 0;
  const diasRestantesEfetivos = diasRestantesBase + folgasParaTrabalhar;

  const totalTrabalhoProjetado = diasJaTrabalhados + diasRestantesEfetivos;
  const diasAbaixoDoPlano = Math.max(0, diasTrabalho - totalTrabalhoProjetado);
  const planoNaoCabeNoMes = diasAbaixoDoPlano > 0;

  const valorDiario = diasRestantesEfetivos > 0 ? faltaGanhar / diasRestantesEfetivos : 0;

  return {
    faltaGanhar,
    folgas,
    folgasParaTrabalhar,
    diasJaTrabalhados,
    diasTrabalho,
    diasRestantesCalendario: diasRestantesNoCalendario,
    diasRestantesEfetivos,
    totalTrabalhoProjetado,
    diasAbaixoDoPlano,
    planoNaoCabeNoMes,
    valorDiario,
    metaAtingida,
    diaHoje: mesAtual.diaHoje,
  };
}

/* --- Textos dos resultados --- */

function formatFolga(qtd) {
  return `${qtd} folga${qtd !== 1 ? 's' : ''}`;
}

function buildFolgasUsoSpan(qtd, capitalize = false) {
  const prefix = capitalize ? 'Usando' : 'usando';
  return `<span class="folgas-uso-destaque">${prefix} <strong>${formatFolga(qtd)}</strong> para trabalhar.</span>`;
}

function buildMensagemDias(result) {
  const diasRestantes = result.diasRestantesCalendario;
  const folgasTrabalho = result.folgasParaTrabalhar || 0;
  const folgasRestantes = Math.max(0, result.folgas.folgasRestantesNoPlano - folgasTrabalho);
  const base = `Restam <strong>${formatDias(diasRestantes)}</strong>`;

  if (folgasTrabalho > 0 && folgasRestantes > 0) {
    const disponivel = folgasRestantes === 1 ? 'disponível' : 'disponíveis';
    return `${base}, ${buildFolgasUsoSpan(folgasTrabalho)}, com <strong>${formatFolga(folgasRestantes)}</strong> ${disponivel}.`;
  }

  if (folgasTrabalho > 0) {
    return `${base}, ${buildFolgasUsoSpan(folgasTrabalho)} Sem folgas disponíveis.`;
  }

  if (folgasRestantes > 0) {
    const disponivel = folgasRestantes === 1 ? 'disponível' : 'disponíveis';
    return `${base}, com <strong>${formatFolga(folgasRestantes)}</strong> ${disponivel}.`;
  }

  return `${base} de trabalho sem folgas.`;
}

function buildFolgouAMaisAlerta(dias, comAumentoMeta = false) {
  let msg = `Você folgou <span class="alerta-destaque"><strong>${formatDias(dias)}</strong> a mais</span> do que seu plano permite.`;
  if (comAumentoMeta) {
    msg += ' A meta diária <span class="alerta-destaque"><strong>irá aumentar</strong></span>.';
  }
  return msg;
}

function buildAlertaAmarelo(result) {
  const { folgas, planoNaoCabeNoMes, diasAbaixoDoPlano } = result;
  const alertas = [];

  if (folgas.situacao === 'dados_inconsistentes') {
    alertas.push('Os dias já trabalhados não podem ser maiores que o dia de hoje no calendário.');
  }

  if (folgas.situacao === 'folgou_sem_direito' && !planoNaoCabeNoMes) {
    alertas.push(buildFolgouAMaisAlerta(folgas.folgasUsadas));
  }

  if (folgas.situacao === 'folgou_alem_do_plano' && !planoNaoCabeNoMes) {
    alertas.push(buildFolgouAMaisAlerta(folgas.folgasExcedentes));
  }

  if (planoNaoCabeNoMes) {
    alertas.push(buildFolgouAMaisAlerta(diasAbaixoDoPlano, true));
  }

  return alertas;
}

function getFolgasExcesso(result) {
  const { folgas, planoNaoCabeNoMes, diasAbaixoDoPlano } = result;

  if (folgas.situacao === 'folgou_sem_direito') {
    return folgas.folgasUsadas;
  }
  if (folgas.situacao === 'folgou_alem_do_plano') {
    return folgas.folgasExcedentes;
  }
  if (planoNaoCabeNoMes) {
    return diasAbaixoDoPlano;
  }
  return folgas.folgasExcedentes;
}

/* --- Histórico (localStorage) --- */

function getSnapshotFromEntry(entry) {
  if (entry.snapshot) return entry.snapshot;
  const saved = new Date(entry.savedAt);
  return {
    diaHoje: saved.getDate(),
    mes: saved.getMonth(),
    ano: saved.getFullYear(),
  };
}

function isSameMonthAsToday(snapshot) {
  return snapshot.mes === mesAtual.mes && snapshot.ano === mesAtual.ano;
}

function getProjectedAnswers(entry) {
  const snapshot = getSnapshotFromEntry(entry);
  if (!isSameMonthAsToday(snapshot)) {
    return null;
  }

  const { answers } = entry;
  const folgasUsadasNoSnapshot = Math.max(0, snapshot.diaHoje - answers.diasJaTrabalhados);
  const projectedDiasJaTrabalhados = Math.max(0, mesAtual.diaHoje - folgasUsadasNoSnapshot);

  return {
    ...answers,
    diasJaTrabalhados: Math.min(projectedDiasJaTrabalhados, answers.diasTrabalho),
  };
}

function buildHistoryDisplayLines(entry) {
  const projectedAnswers = getProjectedAnswers(entry);
  if (!projectedAnswers) {
    return {
      diasText: null,
      folgasStatusText: `Registro de ${entry.monthLabel}.`,
      isWarning: false,
    };
  }

  return buildHistoryFolgasLine(calculate(projectedAnswers));
}

function buildHistoryFolgasLine(result) {
  const diasText = `Restam <strong>${formatDias(result.diasRestantesCalendario)}</strong> até acabar o mês.`;
  const excesso = getFolgasExcesso(result);
  const folgasTrabalho = result.folgasParaTrabalhar || 0;
  const folgasRestantes = Math.max(0, result.folgas.folgasRestantesNoPlano - folgasTrabalho);
  const folgasUsoText = folgasTrabalho > 0 ? buildFolgasUsoSpan(folgasTrabalho, true) : null;

  if (excesso > 0) {
    return {
      diasText,
      folgasUsoText,
      folgasStatusText: `Você folgou <strong>${formatDias(excesso)}</strong> a mais.`,
      isWarning: true,
    };
  }

  if (folgasRestantes > 0) {
    return {
      diasText,
      folgasUsoText,
      folgasStatusText: `Com <strong>${formatFolga(folgasRestantes)}</strong> disponíveis.`,
      isSuccess: true,
    };
  }

  return {
    diasText,
    folgasUsoText,
    folgasStatusText: 'Sem folgas disponíveis.',
    isNeutral: true,
  };
}

function getValorDiarioLabel(result) {
  if (result.metaAtingida) {
    return 'Meta atingida! 🎉';
  }
  if (result.diasRestantesEfetivos === 0 && result.faltaGanhar > 0) {
    return 'Sem dias restantes no mês';
  }
  if (result.diasRestantesEfetivos === 0) {
    return 'Sem dias disponíveis';
  }
  return formatCurrency(result.valorDiario);
}

function getHistoryFolgasStatusClass(folgas) {
  if (folgas.isWarning) return ' history-item-folgas--warning';
  if (folgas.isSuccess) return ' history-item-folgas--success';
  if (folgas.isNeutral) return ' history-item-folgas--neutral';
  return '';
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function formatHistoryDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addToHistory(result) {
  const entry = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    monthLabel: `${mesAtual.nome} de ${mesAtual.ano}`,
    snapshot: {
      diaHoje: mesAtual.diaHoje,
      mes: mesAtual.mes,
      ano: mesAtual.ano,
    },
    answers: { ...answers },
    result: {
      faltaGanhar: result.faltaGanhar,
      valorDiario: result.valorDiario,
      metaAtingida: result.metaAtingida,
      valorDiarioLabel: getValorDiarioLabel(result),
    },
  };

  const history = loadHistory().filter((item) => item.id !== entry.id);
  history.unshift(entry);
  saveHistory(history.slice(0, MAX_HISTORY));
  renderHistory();
}

function setHistoryOpen(open) {
  historyOpen = open;
  dom.historyCard.hidden = !open || loadHistory().length === 0;

  const label = open ? 'Ocultar Histórico' : 'Ver Histórico';
  dom.btnVerHistorico.textContent = label;
}

function toggleHistory() {
  if (loadHistory().length === 0) return;
  setHistoryOpen(!historyOpen);
  if (historyOpen) {
    dom.historyCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function buildHistoryFolgasLinesHtml(folgas) {
  let html = '';

  if (folgas.diasText) {
    html += `<p class="history-item-folgas">${folgas.diasText}</p>`;
  }

  if (folgas.folgasUsoText) {
    html += `<p class="history-item-folgas history-item-folgas--uso">${folgas.folgasUsoText}</p>`;
  }

  const statusText = folgas.folgasStatusText || folgas.folgasText;
  if (statusText) {
    html += `<p class="history-item-folgas${getHistoryFolgasStatusClass(folgas)}">${statusText}</p>`;
  }

  return html;
}

function renderHistory() {
  const history = loadHistory();
  const hasHistory = history.length > 0;

  dom.btnVerHistorico.hidden = !hasHistory;

  if (!hasHistory) {
    setHistoryOpen(false);
    dom.historyList.innerHTML = '';
    return;
  }

  dom.historyList.innerHTML = history
    .map((entry) => {
      const valorClass = entry.result.metaAtingida ? 'history-item-value history-item-value--success' : 'history-item-value';
      const folgas = buildHistoryDisplayLines(entry);
      const folgasLines = buildHistoryFolgasLinesHtml(folgas);

      return `
        <li class="history-item">
          <div class="history-item-main">
            <p class="history-item-date">${formatHistoryDate(entry.savedAt)} · ${entry.monthLabel}</p>
            <p class="${valorClass}">${entry.result.valorDiarioLabel}</p>
            <p class="history-item-meta">Meta ${formatCurrency(entry.answers.metaMensal)} · <span class="history-item-falta">Falta ${formatCurrency(entry.result.faltaGanhar)}</span></p>
            ${folgasLines}
          </div>
          <button type="button" class="btn btn--ghost history-use-btn" data-history-id="${entry.id}">Usar de novo</button>
        </li>
      `;
    })
    .join('');

  dom.historyList.querySelectorAll('.history-use-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = history.find((item) => item.id === Number(btn.dataset.historyId));
      if (entry) applyHistoryEntry(entry);
    });
  });

  setHistoryOpen(historyOpen);
}

/* --- Pergunta 5: folgas para trabalhar (nos resultados) --- */

function showFolgasTrabalhoError(message) {
  dom.folgasTrabalhoError.textContent = message;
  dom.folgasTrabalhoError.hidden = !message;
}

function renderFolgasTrabalhoInput() {
  const needsFolgasInput = shouldAskFolgasParaTrabalhar();
  const folgasPending = needsFolgasInput && answers.folgasParaTrabalhar == null;

  dom.respostaFolgas.hidden = !folgasPending;
  dom.resposta3Wrap.hidden = folgasPending;

  if (!folgasPending) {
    showFolgasTrabalhoError('');
    return;
  }

  const max = getMaxFolgasParaTrabalhar(answers.diasTrabalho, answers.diasJaTrabalhados);
  const folgas = analyzeFolgas(answers.diasTrabalho, answers.diasJaTrabalhados);
  dom.folgasParaTrabalharInput.max = max;
  dom.folgasTrabalhoHint.textContent = `${formatFolga(folgas.folgasRestantesNoPlano)} disponíveis.`;
  dom.folgasParaTrabalharInput.value = '';
}

function applyFolgasParaTrabalhar() {
  const max = getMaxFolgasParaTrabalhar(answers.diasTrabalho, answers.diasJaTrabalhados);
  const raw = dom.folgasParaTrabalharInput.value.trim();

  if (raw === '') {
    showFolgasTrabalhoError('Informe quantos dias de folga quer usar (ou 0).');
    return;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > max) {
    showFolgasTrabalhoError(`Informe um número inteiro entre 0 e ${max}.`);
    return;
  }

  answers.folgasParaTrabalhar = value;
  showFolgasTrabalhoError('');
  showResults({ keepFolgas: true });
}

function applyHistoryEntry(entry) {
  Object.assign(answers, {
    metaMensal: null,
    diasTrabalho: null,
    diasJaTrabalhados: null,
    lucroJaObtido: null,
    folgasParaTrabalhar: null,
    ...entry.answers,
  });

  if (answers.folgasParaTrabalhar == null && !shouldAskFolgasParaTrabalhar()) {
    answers.folgasParaTrabalhar = 0;
  }

  setHistoryOpen(false);
  currentStepIndex = steps.length;
  showResults({ fromHistory: true, keepFolgas: true });
}

function clearHistory() {
  saveHistory([]);
  setHistoryOpen(false);
  renderHistory();
}

/* --- Tela de resultados --- */

function showResults(options = {}) {
  setHistoryOpen(false);

  if (!options.keepFolgas && !options.fromHistory) {
    if (shouldAskFolgasParaTrabalhar()) {
      answers.folgasParaTrabalhar = null;
    } else {
      answers.folgasParaTrabalhar = 0;
    }
  }

  const result = calculate();
  const needsFolgasInput = shouldAskFolgasParaTrabalhar();
  const folgasPending = needsFolgasInput && answers.folgasParaTrabalhar == null;

  dom.questionsPanel.hidden = true;
  dom.resultsCard.hidden = false;
  dom.headerSubtitle.textContent = 'Confira o planejamento do restante do seu mês.';

  dom.resposta1Valor.textContent = formatCurrency(result.faltaGanhar);
  dom.resposta2Texto.innerHTML = buildMensagemDias(result);
  renderFolgasTrabalhoInput();

  const alertas = buildAlertaAmarelo(result);

  if (alertas.length > 0) {
    dom.respostaAlerta.hidden = false;
    dom.respostaAlertaTexto.innerHTML = alertas.map((texto) => `<p>${texto}</p>`).join('');
  } else {
    dom.respostaAlerta.hidden = true;
  }

  const valorDiarioLabel = getValorDiarioLabel(result);

  dom.resposta3Texto.hidden = false;

  if (result.metaAtingida) {
    dom.resposta3Valor.textContent = valorDiarioLabel;
    dom.resposta3Valor.classList.add('result-value--success');
  } else if (
    needsFolgasInput &&
    answers.folgasParaTrabalhar === 0 &&
    result.diasRestantesEfetivos === 0 &&
    result.faltaGanhar > 0
  ) {
    dom.resposta3Texto.hidden = true;
    dom.resposta3Valor.textContent = 'Você optou por não usar folgas. Não há dias de trabalho restantes para calcular a meta diária.';
    dom.resposta3Valor.classList.remove('result-value--success');
  } else if (result.diasRestantesEfetivos === 0 && result.faltaGanhar > 0) {
    dom.resposta3Valor.textContent = 'Não há mais dias no calendário para trabalhar e a meta ainda não foi atingida.';
    dom.resposta3Valor.classList.remove('result-value--success');
  } else if (result.diasRestantesEfetivos === 0) {
    dom.resposta3Valor.textContent = 'Não há mais dias disponíveis para trabalhar neste mês.';
    dom.resposta3Valor.classList.remove('result-value--success');
  } else {
    dom.resposta3Valor.textContent = valorDiarioLabel;
    dom.resposta3Valor.classList.remove('result-value--success');
  }

  if (!options.fromHistory && !folgasPending) {
    addToHistory(result);
  }
}

/* --- Navegação --- */

function goNext() {
  if (!validateCurrentStep()) return;

  currentStepIndex += 1;

  if (currentStepIndex >= steps.length) {
    showResults();
  } else {
    renderStep();
  }
}

function goBack() {
  if (currentStepIndex === 0) return;
  validateCurrentStep();
  currentStepIndex -= 1;
  renderStep();
}

function restart() {
  Object.assign(answers, {
    metaMensal: null,
    diasTrabalho: null,
    diasJaTrabalhados: null,
    lucroJaObtido: null,
    folgasParaTrabalhar: null,
  });

  currentStepIndex = 0;
  dom.questionsPanel.hidden = false;
  dom.resultsCard.hidden = true;
  setHistoryOpen(false);
  dom.headerSubtitle.textContent = 'Responda as perguntas para calcular sua meta diária.';
  dom.resposta3Valor.classList.remove('result-value--success');
  dom.respostaAlerta.hidden = true;
  dom.respostaFolgas.hidden = true;
  dom.resposta3Wrap.hidden = false;
  showFolgasTrabalhoError('');
  showError('');
  renderStep();
}

function initMonthInfo() {
  dom.monthInfo.textContent = `📅 ${mesAtual.nome} de ${mesAtual.ano} · ${mesAtual.diasNoMes} dias`;
}

/* --- Inicialização --- */

dom.btnNext.addEventListener('click', goNext);
dom.btnBack.addEventListener('click', goBack);
dom.btnRestart.addEventListener('click', restart);
dom.btnClearHistory.addEventListener('click', clearHistory);
dom.btnVerHistorico.addEventListener('click', toggleHistory);
dom.btnCalcularFolgas.addEventListener('click', applyFolgasParaTrabalhar);
dom.folgasParaTrabalharInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyFolgasParaTrabalhar();
});

initMonthInfo();
renderHistory();
renderStep();
