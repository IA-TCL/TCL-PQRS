// Pre-warm Render service on page load (free tier spins down after inactivity)
fetch('https://tcl-pqrs.onrender.com/').catch(() => {});

// ── Copy to clipboard (cta-contact-item)
document.querySelectorAll('.cta-contact-item[data-copy]').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const value = item.dataset.copy;
        navigator.clipboard.writeText(value).then(() => {
            if (item.classList.contains('copied')) return;
            const icon   = item.querySelector('.cta-contact-icon');
            const label  = item.querySelector('.cta-copy-text');
            const origIcon  = icon.innerHTML;
            const origLabel = label.textContent;
            item.classList.add('copied');
            icon.innerHTML  = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#fff;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
            label.textContent = '¡Copiado!';
            setTimeout(() => {
                item.classList.remove('copied');
                icon.innerHTML  = origIcon;
                label.textContent = origLabel;
            }, 1800);
        });
    });
});

// ── Back to top
const backToTop = document.getElementById('back-to-top');
window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 400);
});
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ── Drawer
const drawer        = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');
const hamburgerBtn  = document.querySelector('.hdr-icon-btn[aria-label="Menú"]');

function openDrawer()  { drawer.classList.add('open'); drawerOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); document.body.style.overflow = ''; }

hamburgerBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// ── Tipo cards → pre-fill form + estado seleccionado + placeholder contextual
const dotClassMap = {
    'Petición':    'cs-sel-dot-peticion',
    'Queja':       'cs-sel-dot-queja',
    'Reclamo':     'cs-sel-dot-reclamo',
    'Sugerencia':  'cs-sel-dot-sugerencia',
    'Felicitación':'cs-sel-dot-felicitacion',
};

const tipoPlaceholders = {
    'Petición':    '¿Qué información o acción necesitas de nosotros? Sé lo más específico posible.',
    'Queja':       '¿Qué ocurrió? Incluye la fecha, el servicio afectado y el nombre del asesor si lo recuerdas.',
    'Reclamo':     '¿Qué derecho o acuerdo consideras que fue incumplido? Indica fechas y hechos concretos.',
    'Sugerencia':  '¿Qué mejorarías? Describe tu idea con el mayor detalle posible.',
    'Felicitación':'¿Qué fue lo que más te gustó? Si deseas reconocer a alguien del equipo, menciona su nombre.',
};
const defaultPlaceholder = 'Describe detalladamente tu solicitud, incluyendo fechas y hechos relevantes';

const tipoCards = document.querySelectorAll('.tipo-card[data-tipo]');

function setSelectedCard(val) {
    tipoCards.forEach(c => c.classList.toggle('selected', c.dataset.tipo === val));
}

function setDescPlaceholder(val) {
    const ta = document.getElementById('descripcion');
    if (ta) ta.placeholder = tipoPlaceholders[val] || defaultPlaceholder;
}

tipoCards.forEach(card => {
    card.addEventListener('click', () => {
        const val = card.dataset.tipo;
        document.getElementById('tipo').value = val;
        document.getElementById('tipo-display').innerHTML =
            `<span class="cs-sel-dot ${dotClassMap[val]}"></span>${val}`;
        setSelectedCard(val);
        setDescPlaceholder(val);
        document.getElementById('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// ── Scroll animations
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

// ── Features list stagger
const featObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); featObserver.unobserve(e.target); } });
}, { threshold: 0.2 });
document.querySelectorAll('.features-list li').forEach(el => featObserver.observe(el));

// ── Custom select — Tipo PQRS
const tipoTrigger  = document.getElementById('tipo-trigger');
const tipoDropdown = document.getElementById('tipo-dropdown');
const tipoSearch   = document.getElementById('tipo-search');
const tipoOptions  = document.querySelectorAll('#tipo-options .cs-option');
const tipoDisplay  = document.getElementById('tipo-display');
const tipoSelect   = document.getElementById('tipo');

tipoTrigger.addEventListener('click', () => {
    const open = tipoDropdown.style.display === 'block';
    tipoDropdown.style.display = open ? 'none' : 'block';
    tipoTrigger.classList.toggle('open', !open);
    if (!open) { tipoSearch.value = ''; filterTipo(''); tipoSearch.focus(); }
});
tipoOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        const val = opt.dataset.value;
        tipoSelect.value = val;
        tipoDisplay.innerHTML = `<span class="cs-sel-dot ${dotClassMap[val]}"></span>${val}`;
        tipoDropdown.style.display = 'none';
        tipoTrigger.classList.remove('open');
        setSelectedCard(val);
        setDescPlaceholder(val);
    });
});
tipoSearch.addEventListener('input', () => filterTipo(tipoSearch.value));
function filterTipo(q) {
    const lq = q.toLowerCase();
    tipoOptions.forEach(o => o.classList.toggle('hidden', !o.dataset.value.toLowerCase().includes(lq)));
}

// ── Consent card — Confirmación y autorización
const consentCard = document.getElementById('auth-wrap');
const authSelect  = document.getElementById('autorizacion');
consentCard.addEventListener('click', () => {
    const accepted = consentCard.classList.toggle('accepted');
    authSelect.value = accepted ? 'si' : '';
    consentCard.setAttribute('aria-checked', accepted);
});
consentCard.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); consentCard.click(); }
});

document.addEventListener('click', e => {
    if (!document.getElementById('tipo-wrap').contains(e.target)) {
        tipoDropdown.style.display = 'none';
        tipoTrigger.classList.remove('open');
    }
});

// ── Real-time validation
function validateInput(input) {
    const wrap = input.closest('.input-wrap');
    if (!wrap) return;
    const val = input.value.trim();
    let ok = val.length > 0;
    if (input.type === 'email') ok = ok && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (input.type === 'tel')   ok = ok && val.length >= 7;
    wrap.classList.toggle('valid',   ok);
    wrap.classList.toggle('invalid', val.length > 0 && !ok);
    const icon = wrap.querySelector('.v-icon');
    if (icon) icon.textContent = ok ? '✓' : '✕';
}
document.querySelectorAll('.input-wrap input, .input-wrap textarea').forEach(inp => {
    inp.addEventListener('blur',  () => validateInput(inp));
    inp.addEventListener('input', () => { if (inp.closest('.input-wrap').classList.contains('invalid')) validateInput(inp); });
});

// ── Character counter
const descTa = document.getElementById('descripcion');
const charCounter = document.getElementById('char-counter');
if (descTa && charCounter) {
    descTa.addEventListener('input', () => {
        const len = descTa.value.length;
        const max = parseInt(descTa.getAttribute('maxlength'));
        charCounter.textContent = `${len} / ${max}`;
        charCounter.classList.toggle('warn', len > max * 0.8 && len <= max);
        charCounter.classList.toggle('over', len > max);
    });
}

// ── File drop zone con previsualización
const dropZone = document.getElementById('drop-zone');
const adjunto  = document.getElementById('adjunto');
const dropText = document.getElementById('drop-text');
const dropIcon = dropZone.querySelector('.drop-zone-icon');

function renderFilePreview(file) {
    // Limpiar estado anterior
    dropZone.querySelector('.drop-preview-img, .drop-file-info, .drop-clear-btn')
        ?.[Symbol.iterator] && null; // no-op placeholder, usamos querySelectorAll
    dropZone.querySelectorAll('.drop-preview-img, .drop-file-info, .drop-clear-btn')
        .forEach(el => el.remove());

    if (!file) {
        dropZone.classList.remove('has-preview');
        dropIcon.style.display = '';
        dropText.textContent = 'Arrastra un archivo aquí o haz clic para buscar';
        return;
    }

    dropZone.classList.add('has-preview');
    dropIcon.style.display = 'none';
    dropText.textContent = '';

    // Botón para limpiar
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'drop-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        adjunto.value = '';
        renderFilePreview(null);
    });
    dropZone.appendChild(clearBtn);

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.className = 'drop-preview-img';
            dropZone.insertBefore(img, dropZone.querySelector('input'));
        };
        reader.readAsDataURL(file);
    } else {
        const ext  = file.name.split('.').pop().toUpperCase();
        const info = document.createElement('div');
        info.className = 'drop-file-info';
        info.innerHTML = `<span class="drop-file-ext">${ext}</span><span class="drop-file-name">${file.name}</span>`;
        dropZone.insertBefore(info, dropZone.querySelector('input'));
    }
}

adjunto.addEventListener('change', () => renderFilePreview(adjunto.files[0] || null));
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        adjunto.files = dt.files;
        renderFilePreview(file);
    }
});

// ── Form
const form     = document.getElementById('pqrs-form');
const btnSend  = document.getElementById('btn-send');
const btnReset = document.getElementById('btn-reset');
const msgOk    = document.getElementById('msg-ok');
const msgErr   = document.getElementById('msg-err');

btnReset.addEventListener('click', () => {
    form.reset();
    tipoSelect.value = '';
    tipoDisplay.innerHTML = '<span class="cs-placeholder">Selecciona una opción</span>';
    authSelect.value = '';
    consentCard.classList.remove('accepted');
    consentCard.setAttribute('aria-checked', 'false');
    renderFilePreview(null);
    setSelectedCard('');
    setDescPlaceholder('');
    document.querySelectorAll('.input-wrap').forEach(wrap => {
        wrap.classList.remove('valid', 'invalid');
        const icon = wrap.querySelector('.v-icon');
        if (icon) icon.textContent = '';
    });
    msgOk.classList.remove('show');
    msgErr.classList.remove('show');
    clearDraft();
});

form.addEventListener('submit', async e => {
    e.preventDefault();
    msgOk.classList.remove('show');
    msgErr.classList.remove('show');

    const req = ['nombres', 'apellidos', 'correo', 'celular', 'tipo', 'descripcion'];
    for (const f of req) {
        if (!form[f].value.trim()) {
            showError('Por favor completa todos los campos obligatorios.');
            return;
        }
    }
    if (!form.autorizacion.value) {
        showError('Debes aceptar la política de privacidad.');
        return;
    }

    btnSend.disabled = true;
    btnSend.innerHTML = '<span class="spin"></span>Enviando…';

    try {
        const res  = await fetch('https://tcl-pqrs.onrender.com/pqrs', { method: 'POST', body: new FormData(form) });
        let json;
        try { json = await res.json(); } catch { json = {}; }
        if (res.ok && json.success) {
            clearDraft();
            showSuccessScreen(json.radicado || '');
        } else {
            const detail = json.message || (json.detail && json.detail[0] && json.detail[0].msg) || '';
            showError(detail || `Error del servidor (${res.status}). Intenta más tarde.`);
        }
    } catch {
        showError('Error de red. Verifica tu conexión e intenta de nuevo.');
    } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = 'Enviar solicitud →';
    }
});

function showError(msg) {
    msgErr.textContent = '✕ ' + msg;
    msgErr.classList.add('show');
}

// ── Pantalla de éxito
const successScreen = document.getElementById('success-screen');
const formBody      = document.querySelector('.form-body');
const ssRadicado    = document.getElementById('ss-radicado');
const ssCopyBtn     = document.getElementById('ss-copy-btn');
const btnNueva      = document.getElementById('btn-nueva');
const formTitle     = document.querySelector('.form-title');
const formSubtitle  = document.querySelector('.form-subtitle');

const origTitle    = formTitle?.textContent    || '';
const origSubtitle = formSubtitle?.textContent || '';
const ssCopyIconOriginal = ssCopyBtn.innerHTML;

ssCopyBtn.addEventListener('click', () => {
    const num = ssRadicado.textContent;
    navigator.clipboard.writeText(num).then(() => {
        ssCopyBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => { ssCopyBtn.innerHTML = ssCopyIconOriginal; }, 1800);
    });
});

btnNueva.addEventListener('click', () => {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.reload();
    }
});

function showSuccessScreen(radicado) {
    ssRadicado.textContent = radicado || '—';
    ssCopyBtn.innerHTML    = ssCopyIconOriginal;
    if (formTitle)    formTitle.textContent    = '¡Solicitud recibida!';
    if (formSubtitle) formSubtitle.textContent = radicado ? `Radicado: ${radicado}` : 'Procesando tu solicitud…';
    formBody.style.display = 'none';
    successScreen.style.display = 'flex';
    successScreen.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Autoguardado en localStorage
const DRAFT_KEY    = 'pqrs_draft';
const DRAFT_FIELDS = ['nombres', 'apellidos', 'correo', 'celular', 'descripcion'];
const draftNotice  = document.getElementById('draft-notice');
const draftDiscard = document.getElementById('draft-discard');

function saveDraft() {
    const draft = {};
    DRAFT_FIELDS.forEach(id => { draft[id] = document.getElementById(id)?.value || ''; });
    draft.tipo = tipoSelect.value;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}

function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    draftNotice.style.display = 'none';
}

function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);

        const hasData = DRAFT_FIELDS.some(id => draft[id]) || draft.tipo;
        if (!hasData) return;

        DRAFT_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el && draft[id]) { el.value = draft[id]; validateInput(el); }
        });

        if (draft.tipo && dotClassMap[draft.tipo]) {
            tipoSelect.value = draft.tipo;
            tipoDisplay.innerHTML = `<span class="cs-sel-dot ${dotClassMap[draft.tipo]}"></span>${draft.tipo}`;
            setSelectedCard(draft.tipo);
            setDescPlaceholder(draft.tipo);
        }

        if (draft.descripcion && charCounter) {
            const len = draft.descripcion.length;
            const max = parseInt(descTa.getAttribute('maxlength'));
            charCounter.textContent = `${len} / ${max}`;
            charCounter.classList.toggle('warn', len > max * 0.8 && len <= max);
        }

        draftNotice.style.display = 'flex';
    } catch {}
}

DRAFT_FIELDS.forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveDraft);
});
tipoOptions.forEach(opt => opt.addEventListener('click', saveDraft));

draftDiscard.addEventListener('click', () => {
    clearDraft();
    btnReset.click();
});

loadDraft();
