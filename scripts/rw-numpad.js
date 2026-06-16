// Lazy-loaded module: Numpad (Touch)
// Auto-extracted for touch POS and login
const proto = window.UIController.prototype;

/**
 * Muestra el panel numérico táctil
 * options: { targetId, mode, title, onConfirm(value), maxDecimals=2 }
 */
proto.showNumpad = function(options) {
    this._numpadOptions = options || {};
    this._numpadValue = '';
    this._numpadMode = options.mode || 'number';
    this._numpadMaxDecimals = options.maxDecimals !== undefined ? options.maxDecimals : 2;
    
    const title = options.title || 'Introducir valor';
    const isDark = document.documentElement.classList.contains('dark');
    const bgPanel = isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200';
    const bgKey = isDark ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800';
    const bgFunc = isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-600 hover:bg-slate-500 text-white';
    const bgAction = isDark ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white';
    const bgDanger = isDark ? 'bg-rose-700 hover:bg-rose-600 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white';
    const textDisplay = isDark ? 'text-white' : 'text-gray-900';
    
    const showFunc = this._numpadMode === 'pos';
    const showLogin = this._numpadMode === 'login';
    
    const html = [
        '<div id="numpadOverlay" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onclick="if(event.target===this) ui.hideNumpad()">',
        '    <div class="' + bgPanel + ' border rounded-2xl shadow-2xl p-4 w-full max-w-[420px] mx-4 animate-enter">',
        '        <div class="flex justify-between items-center mb-3">',
        '            <h3 class="font-bold text-lg ' + textDisplay + '">' + this.escapeHtml(title) + '</h3>',
        '            <button onclick="ui.hideNumpad()" class="w-8 h-8 rounded-full flex items-center justify-center ' + (isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100') + '"><i class="fas fa-times"></i></button>',
        '        </div>',
        '        <div id="numpadDisplay" class="mb-4 px-4 py-3 rounded-xl text-right text-3xl font-mono font-bold ' + (isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900') + ' tracking-wider overflow-hidden text-ellipsis whitespace-nowrap">',
        showLogin ? '••••••' : '0',
        '        </div>',
        '        <div class="grid grid-cols-4 gap-2">',
        // Fila 1
        '            <button onclick="ui.numpadInput(\'7\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">7</button>',
        '            <button onclick="ui.numpadInput(\'8\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">8</button>',
        '            <button onclick="ui.numpadInput(\'9\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">9</button>',
        showFunc ? '            <button onclick="ui.numpadAction(\'discountPct\')" class="h-14 rounded-xl text-sm font-bold ' + bgFunc + ' transition">DTQ%</button>' : (showLogin ? '            <button onclick="ui.numpadBackspace()" class="h-14 rounded-xl text-lg font-bold ' + bgDanger + ' transition"><i class="fas fa-backspace"></i></button>' : '            <button onclick="ui.numpadBackspace()" class="h-14 rounded-xl text-lg font-bold ' + bgDanger + ' transition"><i class="fas fa-backspace"></i></button>'),
        // Fila 2
        '            <button onclick="ui.numpadInput(\'4\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">4</button>',
        '            <button onclick="ui.numpadInput(\'5\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">5</button>',
        '            <button onclick="ui.numpadInput(\'6\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">6</button>',
        showFunc ? '            <button onclick="ui.numpadAction(\'discountAmt\')" class="h-14 rounded-xl text-sm font-bold ' + bgFunc + ' transition">DTO €</button>' : '',
        // Fila 3
        '            <button onclick="ui.numpadInput(\'1\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">1</button>',
        '            <button onclick="ui.numpadInput(\'2\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">2</button>',
        '            <button onclick="ui.numpadInput(\'3\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">3</button>',
        showFunc ? '            <button onclick="ui.numpadClear()" class="h-14 rounded-xl text-sm font-bold ' + bgDanger + ' transition">CAN</button>' : '',
        // Fila 4
        '            <button onclick="ui.numpadInput(\'0\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">0</button>',
        '            <button onclick="ui.numpadInput(\',\')" class="h-14 rounded-xl text-xl font-semibold ' + bgKey + ' transition">,</button>',
        '            <button onclick="ui.numpadClear()" class="h-14 rounded-xl text-sm font-bold ' + bgDanger + ' transition">CLR</button>',
        showFunc ? '            <button onclick="ui.numpadConfirm()" class="h-14 rounded-xl text-sm font-bold ' + bgAction + ' transition">CONF</button>' : (showLogin ? '            <button onclick="ui.numpadConfirm()" class="h-14 rounded-xl text-sm font-bold ' + bgAction + ' transition">ENTRAR</button>' : '            <button onclick="ui.numpadConfirm()" class="h-14 rounded-xl text-sm font-bold ' + bgAction + ' transition">OK</button>'),
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
    
    // Si ya existe, reemplazar
    const existing = document.getElementById('numpadOverlay');
    if (existing) existing.remove();
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild);
    
    // Si hay targetId, cargar valor actual
    if (options.targetId) {
        const input = document.getElementById(options.targetId);
        if (input && input.value) {
            this._numpadValue = String(input.value).replace('.', ',');
            this.numpadUpdateDisplay();
        }
    }
};

proto.hideNumpad = function() {
    const overlay = document.getElementById('numpadOverlay');
    if (overlay) overlay.remove();
    this._numpadOptions = null;
    this._numpadValue = '';
};

proto.numpadInput = function(key) {
    if (key === ',') {
        if (this._numpadValue.includes(',')) return; // solo una coma
    }
    // Limitar longitud
    if (this._numpadValue.length >= 12) return;
    this._numpadValue += key;
    this.numpadUpdateDisplay();
};

proto.numpadBackspace = function() {
    this._numpadValue = this._numpadValue.slice(0, -1);
    this.numpadUpdateDisplay();
};

proto.numpadClear = function() {
    this._numpadValue = '';
    this.numpadUpdateDisplay();
};

proto.numpadUpdateDisplay = function() {
    const display = document.getElementById('numpadDisplay');
    if (!display) return;
    
    if (this._numpadMode === 'login') {
        display.textContent = '•'.repeat(this._numpadValue.length) || '••••••';
        return;
    }
    
    if (!this._numpadValue) {
        display.textContent = '0';
        return;
    }
    
    // Formatear con separador de miles y coma decimal
    const parts = this._numpadValue.split(',');
    let intPart = parts[0];
    let decPart = parts[1] || '';
    
    // Limitar decimales
    if (decPart.length > this._numpadMaxDecimals) {
        decPart = decPart.slice(0, this._numpadMaxDecimals);
        this._numpadValue = intPart + ',' + decPart;
    }
    
    // Agregar separadores de miles
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    display.textContent = decPart !== undefined && this._numpadValue.includes(',') ? intPart + ',' + decPart : intPart;
};

proto.numpadConfirm = function() {
    const opts = this._numpadOptions || {};
    let value = this._numpadValue;
    
    if (this._numpadMode === 'login') {
        if (opts.targetId) {
            const input = document.getElementById(opts.targetId);
            if (input) input.value = value;
        }
        if (typeof opts.onConfirm === 'function') {
            opts.onConfirm(value);
        }
        this.hideNumpad();
        return;
    }
    
    // Convertir coma a punto para JavaScript
    const numericValue = value ? parseFloat(value.replace(',', '.')) : 0;
    
    if (opts.targetId) {
        const input = document.getElementById(opts.targetId);
        if (input) {
            input.value = numericValue;
            // Disparar evento input para que otros listeners reaccionen
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    if (typeof opts.onConfirm === 'function') {
        opts.onConfirm(numericValue);
    }
    
    this.hideNumpad();
};

proto.numpadAction = function(action) {
    const opts = this._numpadOptions || {};
    const numericValue = this._numpadValue ? parseFloat(this._numpadValue.replace(',', '.')) : 0;
    
    if (action === 'discountPct' && numericValue > 0) {
        this.applyDiscount(numericValue);
        this.showToast('Descuento ' + numericValue + '% aplicado', 'success');
        this.hideNumpad();
        return;
    }
    
    if (action === 'discountAmt' && numericValue > 0) {
        // Descuento fijo en moneda: lo aplicamos como descuento manual global fijo
        // Guardamos en una propiedad temporal
        this._fixedDiscountAmount = numericValue;
        this.showToast('Descuento fijo ' + this.formatMoney(numericValue) + ' aplicado', 'success');
        this.updateCartUI();
        this.hideNumpad();
        return;
    }
    
    if (typeof opts.onAction === 'function') {
        opts.onAction(action, numericValue);
    }
};
