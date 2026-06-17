// Pre-warm Render service on page load (free tier spins down after inactivity)
fetch('https://tcl-pqrs.onrender.com/').catch(() => {});

/* ── Constants ──────────────────────────────────── */
const dotClassMap = {
    'Petición':    'cs-sel-dot-peticion',
    'Queja':       'cs-sel-dot-queja',
    'Reclamo':     'cs-sel-dot-reclamo',
    'Sugerencia':  'cs-sel-dot-sugerencia',
    'Felicitación':'cs-sel-dot-felicitacion',
};

/* ── State ──────────────────────────────────────── */
let currentStep = 1;

/* ── DOM refs ───────────────────────────────────── */
const panels   = [1,2,3].map(i => document.getElementById(`wz-panel-${i}`));
const stepEls  = [1,2,3].map(i => document.getElementById(`wz-step-${i}`));
const conn1    = document.getElementById('wz-conn-1');
const conn2    = document.getElementById('wz-conn-2');
const errorEl  = document.getElementById('wz-error');

/* ── Wizard navigation ──────────────────────────── */
function goTo(next, dir) {
    const cur = currentStep;
    const curPanel  = panels[cur - 1];
    const nextPanel = panels[next - 1];

    const exitCls  = dir === 'forward' ? 'wz-anim-out-left'  : 'wz-anim-out-right';
    const enterCls = dir === 'forward' ? 'wz-anim-in-right'  : 'wz-anim-in-left';

    curPanel.classList.add(exitCls);

    setTimeout(() => {
        curPanel.classList.remove(exitCls);
        curPanel.classList.add('hidden');

        nextPanel.classList.remove('hidden');
        nextPanel.classList.add(enterCls);
        setTimeout(() => nextPanel.classList.remove(enterCls), 380);

        if (dir === 'forward') {
            stepEls[cur - 1].classList.remove('active');
            stepEls[cur - 1].classList.add('done');
            stepEls[next - 1].classList.add('active');
        } else {
            stepEls[cur - 1].classList.remove('active', 'done');
            stepEls[next - 1].classList.remove('done');
            stepEls[next - 1].classList.add('active');
        }

        conn1.style.width = next >= 2 ? '100%' : '0%';
        conn2.style.width = next >= 3 ? '100%' : '0%';

        currentStep = next;
        errorEl.classList.remove('show');
        document.querySelector('.wz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

/* ── Validation ─────────────────────────────────── */
function validateStep1() {
    const nombres   = document.getElementById('wz-nombres').value.trim();
    const apellidos = document.getElementById('wz-apellidos').value.trim();
    const correo    = document.getElementById('wz-correo').value.trim();
    const celular   = document.getElementById('wz-celular').value.trim();
    if (!nombres)   { showError('Por favor ingresa tus nombres.'); return false; }
    if (!apellidos) { showError('Por favor ingresa tus apellidos.'); return false; }
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        showError('Ingresa un correo electrónico válido.'); return false;
    }
    if (!celular || celular.replace(/\D/g,'').length < 7) {
        showError('Ingresa un número de celular válido.'); return false;
    }
    return true;
}

function validateStep2() {
    const tipo = document.getElementById('wz-tipo').value;
    const desc = document.getElementById('wz-descripcion').value.trim();
    if (!tipo) { showError('Selecciona el tipo de PQRS.'); return false; }
    if (!desc) { showError('Por favor describe tu solicitud.'); return false; }
    return true;
}

function validateStep3() {
    if (document.getElementById('wz-autorizacion').value !== 'si') {
        showError('Debes aceptar la política de privacidad.'); return false;
    }
    return true;
}

function showError(msg) {
    errorEl.textContent = '✕ ' + msg;
    errorEl.classList.remove('show');
    void errorEl.offsetWidth;
    errorEl.classList.add('show');
    setTimeout(() => errorEl.classList.remove('show'), 4000);
}

/* ── Summary ────────────────────────────────────── */
function updateSummary() {
    const nombres   = document.getElementById('wz-nombres').value.trim();
    const apellidos = document.getElementById('wz-apellidos').value.trim();
    document.getElementById('sum-nombre').textContent  = `${nombres} ${apellidos}`;
    document.getElementById('sum-correo').textContent  = document.getElementById('wz-correo').value.trim();
    document.getElementById('sum-celular').textContent = document.getElementById('wz-celular').value.trim();
    document.getElementById('sum-tipo').textContent    = document.getElementById('wz-tipo').value;
document.getElementById('sum-desc').textContent    = document.getElementById('wz-descripcion').value.trim();
}

/* ── Button events ──────────────────────────────── */
document.getElementById('wz-next-1').addEventListener('click', () => {
    if (validateStep1()) goTo(2, 'forward');
});
document.getElementById('wz-next-2').addEventListener('click', () => {
    if (validateStep2()) { updateSummary(); goTo(3, 'forward'); }
});
document.getElementById('wz-back-2').addEventListener('click', () => goTo(1, 'back'));
document.getElementById('wz-back-3').addEventListener('click', () => goTo(2, 'back'));
document.getElementById('wz-edit-btn').addEventListener('click', () => goTo(1, 'back'));

/* ── Placeholders contextuales ──────────────────── */
const tipoPlaceholders = {
    'Petición':    '¿Qué información o acción necesitas de nosotros? Sé lo más específico posible.',
    'Queja':       '¿Qué ocurrió? Incluye la fecha, el servicio afectado y el nombre del asesor si lo recuerdas.',
    'Reclamo':     '¿Qué derecho o acuerdo consideras que fue incumplido? Indica fechas y hechos concretos.',
    'Sugerencia':  '¿Qué mejorarías? Describe tu idea con el mayor detalle posible.',
    'Felicitación':'¿Qué fue lo que más te gustó? Si deseas reconocer a alguien del equipo, menciona su nombre.',
};
const defaultPlaceholder = 'Describe detalladamente tu solicitud, incluyendo fechas y hechos relevantes';

function setDescPlaceholder(val) {
    const ta = document.getElementById('wz-descripcion');
    if (ta) ta.placeholder = tipoPlaceholders[val] || defaultPlaceholder;
}

/* ── Custom select ──────────────────────────────── */
const wzTipoTrigger  = document.getElementById('wz-tipo-trigger');
const wzTipoDropdown = document.getElementById('wz-tipo-dropdown');
const wzTipoSearch   = document.getElementById('wz-tipo-search');
const wzTipoOptions  = document.querySelectorAll('#wz-tipo-options .cs-option');
const wzTipoDisplay  = document.getElementById('wz-tipo-display');
const wzTipoSelect   = document.getElementById('wz-tipo');

wzTipoTrigger.addEventListener('click', () => {
    const open = wzTipoDropdown.style.display === 'block';
    wzTipoDropdown.style.display = open ? 'none' : 'block';
    wzTipoTrigger.classList.toggle('open', !open);
    if (!open) { wzTipoSearch.value = ''; filterTipo(''); wzTipoSearch.focus(); }
});
wzTipoOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        const val = opt.dataset.value;
        wzTipoSelect.value = val;
        wzTipoDisplay.innerHTML = `<span class="cs-sel-dot ${dotClassMap[val]}"></span>${val}`;
        wzTipoDropdown.style.display = 'none';
        wzTipoTrigger.classList.remove('open');
        setDescPlaceholder(val);
        saveDraft();
    });
});
wzTipoSearch.addEventListener('input', () => filterTipo(wzTipoSearch.value));
function filterTipo(q) {
    const lq = q.toLowerCase();
    wzTipoOptions.forEach(o => o.classList.toggle('hidden', !o.dataset.value.toLowerCase().includes(lq)));
}
document.addEventListener('click', e => {
    if (!document.getElementById('wz-tipo-wrap').contains(e.target)) {
        wzTipoDropdown.style.display = 'none';
        wzTipoTrigger.classList.remove('open');
    }
});

/* ── Consent card ───────────────────────────────── */
const wzConsent    = document.getElementById('wz-auth-wrap');
const wzAuthSelect = document.getElementById('wz-autorizacion');
wzConsent.addEventListener('click', () => {
    const ok = wzConsent.classList.toggle('accepted');
    wzAuthSelect.value = ok ? 'si' : '';
    wzConsent.setAttribute('aria-checked', ok);
});
wzConsent.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); wzConsent.click(); }
});

/* ── Drop zone con previsualización ─────────────── */
const wzDropZone = document.getElementById('wz-drop-zone');
const wzAdjunto  = document.getElementById('wz-adjunto');
const wzDropText = document.getElementById('wz-drop-text');
const wzDropIcon = wzDropZone.querySelector('.drop-zone-icon');

function renderWzFilePreview(file) {
    wzDropZone.querySelectorAll('.drop-preview-img, .drop-file-info, .drop-clear-btn')
        .forEach(el => el.remove());
    if (!file) {
        wzDropZone.classList.remove('has-preview');
        wzDropIcon.style.display = '';
        wzDropText.textContent = 'Arrastra un archivo o haz clic para buscar';
        return;
    }
    wzDropZone.classList.add('has-preview');
    wzDropIcon.style.display = 'none';
    wzDropText.textContent = '';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'drop-clear-btn';
    clearBtn.innerHTML = '✕';
    clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        wzAdjunto.value = '';
        renderWzFilePreview(null);
    });
    wzDropZone.appendChild(clearBtn);

    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = document.createElement('img');
            img.src = ev.target.result;
            img.className = 'drop-preview-img';
            wzDropZone.insertBefore(img, wzDropZone.querySelector('input'));
        };
        reader.readAsDataURL(file);
    } else {
        const ext  = file.name.split('.').pop().toUpperCase();
        const info = document.createElement('div');
        info.className = 'drop-file-info';
        info.innerHTML = `<span class="drop-file-ext">${ext}</span><span class="drop-file-name">${file.name}</span>`;
        wzDropZone.insertBefore(info, wzDropZone.querySelector('input'));
    }
}

wzAdjunto.addEventListener('change', () => renderWzFilePreview(wzAdjunto.files[0] || null));
wzDropZone.addEventListener('dragover',  e => { e.preventDefault(); wzDropZone.classList.add('drag-over'); });
wzDropZone.addEventListener('dragleave', ()  => wzDropZone.classList.remove('drag-over'));
wzDropZone.addEventListener('drop', e => {
    e.preventDefault();
    wzDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        wzAdjunto.files = dt.files;
        renderWzFilePreview(file);
    }
});

/* ── Real-time validation ───────────────────────── */
function validateInput(input) {
    const wrap = input.closest('.input-wrap');
    if (!wrap) return;
    const val = input.value.trim();
    let ok = val.length > 0;
    if (input.type === 'email') ok = ok && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    if (input.type === 'tel')   ok = ok && val.replace(/\D/g,'').length >= 7;
    wrap.classList.toggle('valid',   ok);
    wrap.classList.toggle('invalid', val.length > 0 && !ok);
    const icon = wrap.querySelector('.v-icon');
    if (icon) icon.textContent = ok ? '✓' : '✕';
}
document.querySelectorAll('.input-wrap input, .input-wrap textarea').forEach(inp => {
    inp.addEventListener('blur',  () => validateInput(inp));
    inp.addEventListener('input', () => {
        if (inp.closest('.input-wrap').classList.contains('invalid')) validateInput(inp);
    });
});

/* ── Char counter ───────────────────────────────── */
const wzDescTa    = document.getElementById('wz-descripcion');
const wzCharCount = document.getElementById('wz-char-counter');
wzDescTa.addEventListener('input', () => {
    const len = wzDescTa.value.length;
    wzCharCount.textContent = `${len} / 600`;
    wzCharCount.classList.toggle('warn', len > 480 && len <= 600);
    wzCharCount.classList.toggle('over', len > 600);
    saveDraft();
});

/* ── Submit ─────────────────────────────────────── */
const wzForm   = document.getElementById('wz-form');
const wzSubmit = document.getElementById('wz-submit');
wzForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateStep3()) return;
    wzSubmit.disabled = true;
    wzSubmit.innerHTML = '<span class="spin"></span>Enviando…';
    errorEl.classList.remove('show');
    try {
        const res  = await fetch('https://tcl-pqrs.onrender.com/pqrs', { method: 'POST', body: new FormData(wzForm) });
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
        wzSubmit.disabled = false;
        wzSubmit.innerHTML = 'Enviar solicitud →';
    }
});

/* ── Success screen ─────────────────────────────── */
const wzSuccess   = document.getElementById('wz-success');
const wzBody      = document.querySelector('.wz-body');
const wzProgress  = document.getElementById('wz-progress');
const wzHeadTitle = document.getElementById('wz-head-title');
const ssRadicado  = document.getElementById('ss-radicado');
const ssCopyBtn   = document.getElementById('ss-copy-btn');
const btnNueva    = document.getElementById('btn-nueva');
const ssCopyIconOrig = ssCopyBtn.innerHTML;

ssCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(ssRadicado.textContent).then(() => {
        ssCopyBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => { ssCopyBtn.innerHTML = ssCopyIconOrig; }, 1800);
    });
});
btnNueva.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.reload();
});

function showSuccessScreen(radicado) {
    ssRadicado.textContent  = radicado || '—';
    ssCopyBtn.innerHTML     = ssCopyIconOrig;
    wzHeadTitle.textContent = '¡Solicitud recibida!';
    wzProgress.style.display = 'none';
    wzForm.style.display     = 'none';
    wzSuccess.style.display  = 'flex';
    wzSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ── Reset wizard ───────────────────────────────── */
function resetWizard() {
    DRAFT_FIELDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = '';
        const wrap = el.closest('.input-wrap');
        if (wrap) {
            wrap.classList.remove('valid', 'invalid');
            const icon = wrap.querySelector('.v-icon');
            if (icon) icon.textContent = '';
        }
    });

    wzTipoSelect.value = '';
    wzTipoDisplay.innerHTML = '<span class="cs-placeholder">Selecciona una opción</span>';
    setDescPlaceholder('');
    setSelectedCard('');

    wzCharCount.textContent = '0 / 600';
    wzCharCount.classList.remove('warn', 'over');

    wzAdjunto.value = '';
    renderWzFilePreview(null);

    if (currentStep !== 1) {
        panels.forEach((p, i) => p.classList.toggle('hidden', i !== 0));
        stepEls.forEach((s, i) => {
            s.classList.remove('active', 'done');
            if (i === 0) s.classList.add('active');
        });
        conn1.style.width = '0%';
        conn2.style.width = '0%';
        currentStep = 1;
    }

    clearDraft();
    errorEl.classList.remove('show');
    document.querySelector('.wz-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('wz-clear-btn').addEventListener('click', resetWizard);

/* ── Draft saving ───────────────────────────────── */
const DRAFT_KEY    = 'pqrs_draft_wz';
const DRAFT_FIELDS = ['wz-nombres','wz-apellidos','wz-correo','wz-celular','wz-descripcion'];

/* ── Draft toast (debounced) ────────────────────── */
let _draftToastTimer;
function _showDraftToast() {
    clearTimeout(_draftToastTimer);
    _draftToastTimer = setTimeout(() => {
        const t = document.getElementById('draft-toast');
        if (!t) return;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2000);
    }, 1200);
}

function saveDraft() {
    const d = {};
    DRAFT_FIELDS.forEach(id => { d[id] = document.getElementById(id)?.value || ''; });
    d.tipo       = wzTipoSelect.value;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); _showDraftToast(); } catch {}
}
function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
}
function loadDraft() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const d = JSON.parse(raw);
        if (!DRAFT_FIELDS.some(id => d[id]) && !d.tipo) return;
        DRAFT_FIELDS.forEach(id => {
            const el = document.getElementById(id);
            if (el && d[id]) { el.value = d[id]; validateInput(el); }
        });
        if (d.tipo && dotClassMap[d.tipo]) {
            wzTipoSelect.value = d.tipo;
            wzTipoDisplay.innerHTML = `<span class="cs-sel-dot ${dotClassMap[d.tipo]}"></span>${d.tipo}`;
            setDescPlaceholder(d.tipo);
        }
        if (d['wz-descripcion']) {
            const len = d['wz-descripcion'].length;
            wzCharCount.textContent = `${len} / 600`;
            wzCharCount.classList.toggle('warn', len > 480);
        }
    } catch {}
}

DRAFT_FIELDS.forEach(id => {
    document.getElementById(id)?.addEventListener('input', saveDraft);
});
loadDraft();

/* ── Drawer ─────────────────────────────────────── */
const drawer        = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose   = document.getElementById('drawer-close');
const hamburgerBtn  = document.querySelector('.hdr-icon-btn[aria-label="Menú"]');
function openDrawer()  { drawer.classList.add('open'); drawerOverlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); document.body.style.overflow = ''; }
hamburgerBtn.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

/* ── Back to top ────────────────────────────────── */
const backToTop = document.getElementById('back-to-top');
window.addEventListener('scroll', () => { backToTop.classList.toggle('visible', window.scrollY > 400); });
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── Tipo cards ─────────────────────────────────── */
function setSelectedCard(val) {
    document.querySelectorAll('.tipo-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.tipo === val);
    });
}

document.querySelectorAll('.tipo-card').forEach(card => {
    card.addEventListener('click', () => {
        const val = card.dataset.tipo;
        setSelectedCard(val);
        setDescPlaceholder(val);
        if (dotClassMap[val]) {
            wzTipoSelect.value = val;
            wzTipoDisplay.innerHTML = `<span class="cs-sel-dot ${dotClassMap[val]}"></span>${val}`;
        }
        document.getElementById('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

/* ── Scroll animations ──────────────────────────── */
const fadeObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); fadeObs.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('.fade-up').forEach(el => fadeObs.observe(el));

const featObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.querySelectorAll('li').forEach((li, i) => setTimeout(() => li.classList.add('visible'), i * 120));
            featObs.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });
document.querySelectorAll('.features-list').forEach(el => featObs.observe(el));

/* ── FAQ accordion ──────────────────────────────── */
document.querySelectorAll('.faq-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
        const item   = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(el => {
            el.classList.remove('open');
            el.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
            item.classList.add('open');
            btn.setAttribute('aria-expanded', 'true');
        }
    });
});

/* ── Copy to clipboard ──────────────────────────── */
document.querySelectorAll('.cta-contact-item[data-copy]').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        navigator.clipboard.writeText(item.dataset.copy).then(() => {
            const txt  = item.querySelector('.cta-copy-text');
            const orig = txt.textContent;
            txt.textContent = '¡Copiado!';
            setTimeout(() => { txt.textContent = orig; }, 1600);
        });
    });
});
