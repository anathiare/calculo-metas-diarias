const mesAtual = getMesAtual();

const answers = {
  metaMensal: null,
  diasTrabalho: null,
  diasJaTrabalhados: null,
  lucroJaObtido: null,
};

let currentStepIndex = 0;
let steps = [];

const dom = {
  monthInfo: document.getElementById('month-info'),
  stepContent: document.getElementById('step-content'),
  errorMsg: document.getElementById('error-msg'),
  btnBack: document.getElementById('btn-back'),
  btnNext: document.getElementById('btn-next'),
  btnRestart: document.getElementById('btn-restart'),
  progressWrap: document.getElementById('progress-wrap'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  questionsPanel: document.getElementById('questions-panel'),
  wizardCard: document.getElementById('wizard-card'),
  resultsCard: document.getElementById('results-card'),
  headerSubtitle: document.getElementById('header-subtitle'),
  resposta1Valor: document.getElementById('resposta-1-valor'),
  resposta2Texto: document.getElementById('resposta-2-texto'),
  respostaAlerta: document.getElementById('resposta-alerta'),
  respostaAlertaTexto: document.getElementById('resposta-alerta-texto'),
  resposta3Valor: document.getElementById('resposta-3-valor'),
};

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

function buildSteps() {
  return [
    {
      id: 'metaMensal',
      question: 'Qual o valor você precisa ganhar esse mês?',
      hint: `Sua meta de ganho para ${mesAtual.nome.toLowerCase()}. Este mês tem ${mesAtual.diasNoMes} dias.`,
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
      <h2 class="step-question">${step.question}</h2>
      <p class="step-hint">${step.hint}</p>
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

function formatFolga(qtd) {
  return `${qtd} folga${qtd !== 1 ? 's' : ''}`;
}

function buildMensagemDias(result) {
  const diasRestantes = result.diasRestantesCalendario;
  const folgasRestantes = result.folgas.folgasRestantesNoPlano;

  if (folgasRestantes <= 0) {
    return `Restam <strong>${formatDias(diasRestantes)}</strong> de trabalho sem folgas.`;
  }

  const disponivel = folgasRestantes === 1 ? 'disponível' : 'disponíveis';
  return `Restam <strong>${formatDias(diasRestantes)}</strong>, <strong>${formatFolga(folgasRestantes)}</strong> ${disponivel}.`;
}

function buildAlertaAmarelo(result) {
  const { folgas, planoNaoCabeNoMes, diasAbaixoDoPlano, totalTrabalhoProjetado, diasTrabalho } = result;
  const alertas = [];

  if (folgas.situacao === 'dados_inconsistentes') {
    alertas.push('Os dias já trabalhados não podem ser maiores que o dia de hoje no calendário.');
  }

  if (folgas.situacao === 'folgou_sem_direito') {
    alertas.push(`Você folgou <strong>${formatDias(folgas.folgasUsadas)}</strong> a mais do que seu plano permite.`);
  }

  if (folgas.situacao === 'folgou_alem_do_plano') {
    alertas.push(`Você folgou <strong>${formatDias(folgas.folgasExcedentes)}</strong> a mais do que seu plano permite.`);
  }

  if (planoNaoCabeNoMes) {
    alertas.push(`
      Mesmo trabalhando todos os dias restantes, você fará
      <strong>${formatDias(totalTrabalhoProjetado)}</strong> —
      <strong>${formatDias(diasAbaixoDoPlano)} a menos</strong> do que os
      <strong>${diasTrabalho}</strong> planejados.
    `.replace(/\s+/g, ' ').trim());
  }

  return alertas;
}

function calculate() {
  const { metaMensal, diasTrabalho, diasJaTrabalhados, lucroJaObtido } = answers;

  const folgas = analyzeFolgas(diasTrabalho, diasJaTrabalhados);
  const faltaGanhar = Math.max(0, metaMensal - lucroJaObtido);
  const metaAtingida = lucroJaObtido >= metaMensal;

  const diasRestantesNoPlano = Math.max(0, diasTrabalho - diasJaTrabalhados);
  const diasRestantesNoCalendario = Math.max(0, mesAtual.diasNoMes - mesAtual.diaHoje);
  const diasRestantesEfetivos = Math.min(diasRestantesNoPlano, diasRestantesNoCalendario);

  const totalTrabalhoProjetado = diasJaTrabalhados + diasRestantesEfetivos;
  const diasAbaixoDoPlano = Math.max(0, diasTrabalho - totalTrabalhoProjetado);
  const planoNaoCabeNoMes = diasAbaixoDoPlano > 0;

  const valorDiario = diasRestantesEfetivos > 0 ? faltaGanhar / diasRestantesEfetivos : 0;

  return {
    faltaGanhar,
    folgas,
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

function showResults() {
  const result = calculate();

  dom.questionsPanel.hidden = true;
  dom.resultsCard.hidden = false;
  dom.headerSubtitle.textContent = 'Confira o planejamento do restante do seu mês.';

  dom.resposta1Valor.textContent = formatCurrency(result.faltaGanhar);
  dom.resposta2Texto.innerHTML = buildMensagemDias(result);

  const alertas = buildAlertaAmarelo(result);

  if (alertas.length > 0) {
    dom.respostaAlerta.hidden = false;
    dom.respostaAlertaTexto.innerHTML = alertas.map((texto) => `<p>${texto}</p>`).join('');
  } else {
    dom.respostaAlerta.hidden = true;
  }

  if (result.metaAtingida) {
    dom.resposta3Valor.textContent = 'Você já atingiu a meta! 🎉';
    dom.resposta3Valor.classList.add('result-value--success');
  } else if (result.diasRestantesEfetivos === 0 && result.faltaGanhar > 0) {
    dom.resposta3Valor.textContent = 'Não há mais dias no calendário para trabalhar e a meta ainda não foi atingida.';
    dom.resposta3Valor.classList.remove('result-value--success');
  } else if (result.diasRestantesEfetivos === 0) {
    dom.resposta3Valor.textContent = 'Não há mais dias disponíveis para trabalhar neste mês.';
    dom.resposta3Valor.classList.remove('result-value--success');
  } else {
    dom.resposta3Valor.textContent = formatCurrency(result.valorDiario);
    dom.resposta3Valor.classList.remove('result-value--success');
  }
}

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
  });

  currentStepIndex = 0;
  dom.questionsPanel.hidden = false;
  dom.resultsCard.hidden = true;
  dom.headerSubtitle.textContent = 'Responda as perguntas para calcular sua meta diária.';
  dom.resposta3Valor.classList.remove('result-value--success');
  dom.respostaAlerta.hidden = true;
  showError('');
  renderStep();
}

function initMonthInfo() {
  dom.monthInfo.textContent = `📅 ${mesAtual.nome} de ${mesAtual.ano} · ${mesAtual.diasNoMes} dias`;
}

dom.btnNext.addEventListener('click', goNext);
dom.btnBack.addEventListener('click', goBack);
dom.btnRestart.addEventListener('click', restart);

initMonthInfo();
renderStep();
