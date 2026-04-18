let loginProfile = { programName: 'Controle Financeiro' };

function formatBirthDateTyping(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatBrazilPhoneTyping(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidBrazilPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{10,11}$/.test(digits);
}

function isValidBirthDate(value) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(value || '').trim());
}

async function loadLoginProfile() {
  try {
    const sessionResponse = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (sessionResponse.ok) {
      window.location.replace('/app');
      return;
    }

    const configResponse = await fetch('/api/auth/login-config', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    if (!configResponse.ok) return;
    loginProfile = await configResponse.json();
  } catch (error) {
    // A tela continua funcional mesmo sem carregar configuracoes extras.
  }
}

function resetForgotFlow() {
  const panel = document.getElementById('forgotPanel');
  const birthDateInput = document.getElementById('birthDateInput');
  const emailInput = document.getElementById('forgotEmailInput');
  const feedback = document.getElementById('forgotFeedback');
  if (panel) panel.hidden = true;
  if (birthDateInput) birthDateInput.value = '';
  if (emailInput) emailInput.value = '';
  if (feedback) feedback.textContent = '';
}

function openRegisterModal() {
  const modal = document.getElementById('registerModal');
  const error = document.getElementById('registerError');
  if (error) error.textContent = '';
  if (modal) modal.hidden = false;
}

function closeRegisterModal() {
  const modal = document.getElementById('registerModal');
  const form = document.getElementById('registerForm');
  const error = document.getElementById('registerError');
  if (form) form.reset();
  if (error) error.textContent = '';
  if (modal) modal.hidden = true;
}

async function requestPasswordHint() {
  const emailInput = document.getElementById('forgotEmailInput');
  const birthDateInput = document.getElementById('birthDateInput');
  const feedback = document.getElementById('forgotFeedback');
  const hintButton = document.getElementById('hintButton');

  feedback.textContent = '';
  hintButton.disabled = true;
  hintButton.textContent = 'Buscando...';

  try {
    const response = await fetch('/api/auth/password-hint', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        birthDate: birthDateInput.value
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      feedback.textContent = payload.message || 'Nao foi possivel validar os dados.';
      return;
    }
    feedback.textContent = `Dica: ${payload.hint}`;
  } catch (error) {
    feedback.textContent = 'Falha ao consultar a dica da senha.';
  } finally {
    hintButton.disabled = false;
    hintButton.textContent = 'Ver dica';
  }
}

async function submitLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const rememberMeInput = document.getElementById('rememberMeInput');
  const errorEl = document.getElementById('loginError');
  const button = form.querySelector('button[type="submit"]');
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorEl.textContent = '';
  button.disabled = true;
  button.textContent = 'Entrando...';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        email,
        password,
        rememberMe: !!rememberMeInput?.checked
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      errorEl.textContent = payload.message || 'Login invalido.';
      if (!email) {
        emailInput.focus();
      } else {
        passwordInput.focus();
        passwordInput.select();
      }
      return;
    }

    if (payload?.crypto && window.FinCrypto?.deriveSessionKey) {
      const sessionKey = await window.FinCrypto.deriveSessionKey(password, payload.crypto);
      window.FinCrypto.storeSessionEncryptionKey(sessionKey);
    }
    window.location.replace('/app');
  } catch (error) {
    errorEl.textContent = 'Falha ao conectar com o servidor de login.';
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar';
  }
}

async function submitRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById('registerError');
  const submitButton = form.querySelector('button[type="submit"]');
  const payload = {
    fullName: document.getElementById('registerFullName').value.trim(),
    email: document.getElementById('registerEmail').value.trim(),
    phone: document.getElementById('registerPhone').value.trim(),
    birthDate: document.getElementById('registerBirthDate').value.trim(),
    password: document.getElementById('registerPassword').value,
    passwordHint: document.getElementById('registerPasswordHint').value.trim()
  };

  errorEl.textContent = '';
  if (!isValidEmail(payload.email)) {
    errorEl.textContent = 'Digite um e-mail válido.';
    document.getElementById('registerEmail').focus();
    return;
  }
  if (!isValidBrazilPhone(payload.phone)) {
    errorEl.textContent = 'Digite um celular brasileiro válido.';
    document.getElementById('registerPhone').focus();
    return;
  }
  if (!isValidBirthDate(payload.birthDate)) {
    errorEl.textContent = 'Digite a data de nascimento no formato dd/mm/aaaa.';
    document.getElementById('registerBirthDate').focus();
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = 'Criando...';

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      errorEl.textContent = result.message || 'Nao foi possivel criar a conta.';
      return;
    }
    if (result?.crypto && window.FinCrypto?.deriveSessionKey) {
      const sessionKey = await window.FinCrypto.deriveSessionKey(payload.password, result.crypto);
      window.FinCrypto.storeSessionEncryptionKey(sessionKey);
    }
    window.location.replace('/app');
  } catch (error) {
    errorEl.textContent = 'Falha ao conectar com o servidor de cadastro.';
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Criar conta';
  }
}

document.getElementById('loginForm').addEventListener('submit', submitLogin);
document.getElementById('registerForm').addEventListener('submit', submitRegistration);
document.getElementById('forgotToggle').addEventListener('click', () => {
  const panel = document.getElementById('forgotPanel');
  const shouldOpen = panel.hidden;
  resetForgotFlow();
  if (panel) {
    panel.hidden = !shouldOpen;
    if (shouldOpen) {
      document.getElementById('forgotEmailInput').value = document.getElementById('emailInput').value.trim();
    }
  }
});
document.getElementById('registerToggle').addEventListener('click', openRegisterModal);
document.getElementById('registerClose').addEventListener('click', closeRegisterModal);
document.getElementById('registerCancel').addEventListener('click', closeRegisterModal);
document.getElementById('togglePassword').addEventListener('click', () => {
  const input = document.getElementById('passwordInput');
  const button = document.getElementById('togglePassword');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  button.textContent = showing ? 'Mostrar' : 'Ocultar';
});
document.getElementById('toggleRegisterPassword').addEventListener('click', () => {
  const input = document.getElementById('registerPassword');
  const button = document.getElementById('toggleRegisterPassword');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  button.setAttribute('aria-label', showing ? 'Mostrar senha do cadastro' : 'Ocultar senha do cadastro');
  button.textContent = showing ? 'Mostrar' : 'Ocultar';
});
document.getElementById('birthDateInput').addEventListener('input', event => {
  event.target.value = formatBirthDateTyping(event.target.value);
});
document.getElementById('registerPhone').addEventListener('input', event => {
  event.target.value = formatBrazilPhoneTyping(event.target.value);
});
document.getElementById('registerBirthDate').addEventListener('input', event => {
  event.target.value = formatBirthDateTyping(event.target.value);
});
document.getElementById('hintButton').addEventListener('click', requestPasswordHint);
loadLoginProfile();
