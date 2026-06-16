// Lazy-loaded module: POS
// proto is already declared in ui-controller.js

// ==================== POS ====================
proto.getLogoHtml = function(settings, type = 'a4') {
    const logo = settings?.logoBase64;
    if (!logo) return '';
    if (type === 'ticket') {
        return `<div class="center" style="margin-bottom: 8px;"><img src="${logo}" style="max-height: 60px; max-width: 60mm; width: auto; height: auto; display: inline-block;"></div>`;
    }
    return `<div style="margin-bottom: 10px;"><img src="${logo}" style="max-height: 80px; max-width: 200px; width: auto; height: auto; display: inline-block;"></div>`;
};

proto.renderPOS = function(container) {
    const products = store.get('products').filter(p => p.active);
    const categories = store.get('categories');
    const clients = store.get('clients');
    const uniqueCategories = categories.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i);
    const sellerName = AppState.user?.displayName || AppState.user?.email || t('pos.seller');
    const connStatus = this.getPOSConnectionStatus();
    const currTicket = this.currentTicket;
    const hasPending = store.get('pendingTickets').length > 0;
    this._notesCollapsed = this._notesCollapsed !== false;

    container.innerHTML = `
        <div class="min-h-[calc(100dvh-140px)] flex flex-col xl:flex-row gap-4 overflow-hidden">
            <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-4 elevation-1 sticky top-0 z-10">
                    <div class="flex gap-3 mb-3">
                        <div class="relative flex-1">
                            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input type="text" id="posSearch" placeholder="${t('pos.searchPlaceholder')}" 
                                class="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white text-base"
                                oninput="ui.filterPOSProducts(this.value)">
                        </div>
                    </div>
                    <div class="pos-filter-bar flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                        <button onclick="ui.filterPOSByCategory('')" class="pos-cat-btn px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-primary-600 text-white" data-cat="">
                            <i class="fas fa-th-large mr-1"></i>${t('pos.all','Todas')}
                        </button>
                        ${uniqueCategories.map(c => `
                            <button onclick="ui.filterPOSByCategory('${c.name}')" class="pos-cat-btn px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" data-cat="${c.name}">
                                <i class="fas ${c.icon || 'fa-tag'} mr-1"></i>${c.name}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl p-4 elevation-1">
                    <div id="posProductGrid" class="pos-grid">
                        ${this.renderPOSProductGrid(products)}
                    </div>
                </div>
            </div>

            <div class="pos-ticket-wrapper">
                <!-- ZONE 1: HEADER -->
                <div class="pos-ticket-header">
                    <div class="header-row">
                        <div class="ticket-num">
                            <button onclick="ui.setTicketNumber(-1)" class="action-btn"><i class="fas fa-minus"></i></button>
                            <span>#<span id="posTicketNum">${currTicket}</span></span>
                            <button onclick="ui.setTicketNumber(1)" class="action-btn"><i class="fas fa-plus"></i></button>
                        </div>
                        <div class="action-bar">
                            <button onclick="ui.holdTicket()" class="action-btn" title="Pausar"><i class="fas fa-pause"></i></button>
                            <button onclick="ui.showPendingTickets()" class="action-btn" title="Pendientes"><i class="fas fa-clipboard-list"></i></button>
                            <button onclick="ui.clearCart()" class="action-btn" style="color:#ef4444;" title="Vaciar"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="client-bar">
                        <select id="posClient" class="client-select">
                            <option value="">Cliente ocasional</option>
                            ${clients.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('')}
                        </select>
                        <button onclick="ui.quickAddClient()" class="client-btn"><i class="fas fa-plus"></i></button>
                    </div>
                </div>

                <!-- ZONE 2: CARRITO (scrollable) -->
                <div id="posCartItems" class="pos-ticket-items">
                    ${this.renderCartItems()}
                </div>

                <!-- ZONE 3: TERMINAL (fijo abajo) -->
                <div class="pos-ticket-terminal">
                    <div class="totals-row"><span>Subtotal</span><span id="posSubtotal">0 FCFA</span></div>
                    <div class="totals-row"><span>Descuento</span><span id="posDiscount" style="color:#6ee7b7;">-0 FCFA</span></div>
                    <div class="totals-row"><span>IVA (15%)</span><span id="posTax">0 FCFA</span></div>
                    <div class="totals-row total"><span>TOTAL</span><span id="posTotal">0 FCFA</span></div>

                    <div class="payment-row" id="paymentMethodGrid">
                        <button onclick="ui.setPaymentMethod('cash')" class="payment-btn active" data-method="cash">
                            <i class="fas fa-money-bill-wave"></i><span>Efectivo</span>
                        </button>
                        <button onclick="ui.setPaymentMethod('card')" class="payment-btn" data-method="card">
                            <i class="fas fa-credit-card"></i><span>Tarjeta</span>
                        </button>
                        <button onclick="ui.setPaymentMethod('mobile')" class="payment-btn" data-method="mobile">
                            <i class="fas fa-mobile-alt"></i><span>Móvil</span>
                        </button>
                        <button onclick="ui.setPaymentMethod('wallet')" class="payment-btn" data-method="wallet">
                            <i class="fas fa-wallet"></i><span>Billetera</span>
                        </button>
                        <button onclick="ui.setPaymentMethod('credit')" class="payment-btn" data-method="credit">
                            <i class="fas fa-hand-holding-usd"></i><span>Crédito</span>
                        </button>
                    </div>

                    <div id="cashInputSection" class="hidden">
                        <input type="text" id="cashReceived" readonly onclick="ui.showNumpad({targetId:'cashReceived', mode:'cash', title:'Efectivo recibido', onConfirm:function(){ui.calculateChange();}})" 
                            class="cash-input" placeholder="Recibido: 0">
                        <div id="changeDisplay" class="change-row hidden">
                            <span>Cambio:</span><span id="posChange">0 FCFA</span>
                        </div>
                    </div>

                    <div class="discount-row">
                        <button onclick="ui.applyDiscount(5)">-5%</button>
                        <button onclick="ui.applyDiscount(10)">-10%</button>
                        <button onclick="ui.applyDiscount(15)">-15%</button>
                        <button onclick="ui.clearDiscount()"><i class="fas fa-times"></i></button>
                    </div>

                    <button onclick="ui.processCheckout()" id="checkoutBtn" class="checkout-btn" disabled>
                        <i class="fas fa-check-circle"></i>COBRAR
                    </button>
                </div>
            </div>
        </div>`;
    
    this._posDateInterval = setInterval(() => {
        const el = document.getElementById('posTicketDate');
        if (el) el.innerHTML = '<i class="far fa-clock mr-1 text-primary-500"></i>' + new Date().toLocaleString();
    }, 30000);
    setTimeout(() => this.updateCartUI(), 100);

    if (this._posKeyHandler) {
        document.removeEventListener('keydown', this._posKeyHandler);
    }
    this._posKeyHandler = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            if (e.key !== 'Escape') return;
        }
        if ((e.ctrlKey && e.key === 'k') || e.key === '/') {
            e.preventDefault();
            document.getElementById('posSearch')?.focus();
        }
        if (e.key === 'Escape') {
            const search = document.getElementById('posSearch');
            if (document.activeElement === search) {
                search.value = '';
                this.filterPOSProducts('');
                search.blur();
            } else {
                const modal = document.getElementById('modalOverlay');
                if (modal && !modal.classList.contains('hidden')) {
                    this.closeModal();
                }
            }
        }
        if (e.key === 'F9' && AppState.posCart.length > 0) {
            e.preventDefault();
            this.processCheckout();
        }
        if (e.key === 'F8') {
            e.preventDefault();
            this.holdTicket();
        }
        if (e.key === '+' && document.activeElement.id !== 'posSearch') {
            e.preventDefault();
            document.getElementById('posSearch')?.focus();
        }
    };
    document.addEventListener('keydown', this._posKeyHandler);
};


proto.renderPOSProductGrid = function(products) {
    const storeWarehouse = this.getStoreWarehouse();
    const minStockAlert = storeWarehouse?.minStockAlert || 10;
    
    return products.map(p => {
        const hasVariants = this.getProductVariants(p).length > 0;
        const saleOptions = this.getProductSaleOptions(p);
        const boxOption = saleOptions.find(option => option.key === 'box');
        const halfOption = saleOptions.find(option => option.key === 'half-box');
        const applicablePromotions = this.getApplicablePromotions(p);
        const previewPromotion = applicablePromotions[0] || null;
        const previewDiscount = previewPromotion && previewPromotion.type !== '2x1'
            ? this.getBestPromotionForItem(p, 1, p.price)
            : null;
        const previewPrice = previewDiscount?.discount > 0
            ? previewDiscount.effectiveUnitPrice
            : Number(p.price || 0);
        const promoBadge = previewPromotion
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">${this.escapeHtml(this.getPromotionBadgeText(previewPromotion) || t('pos.promo','Promo'))}</span>`
            : '';
        
        // Usar stock del almacén de tienda, no el global
        const storeStock = this.getProductStockInStore(p.id);
        const isLowStock = storeStock <= minStockAlert && storeStock > 0;
        const isOutOfStock = storeStock === 0;
        const stockStatus = isOutOfStock ? 'out' : isLowStock ? 'low' : 'ok';
        const stockBadgeColor = isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500';
        const stockLabel = isOutOfStock ? t('pos.stockOut','Sin stock') : isLowStock ? t('pos.stockLow','Stock bajo') : t('pos.stockOk','Stock ok');

        return `
        <button onclick="${isOutOfStock ? `ui.showToast('${t('pos.stockOut','Sin stock')}', 'warning')` : `ui.addToCart('${p.id}')`}" class="pos-product-card group bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 elevation-1 transition-all text-left relative ${isOutOfStock ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-xl'}" ${isOutOfStock ? 'disabled' : ''}>
            <div class="absolute top-2 right-2 z-10">
                <span class="w-3 h-3 rounded-full ${stockBadgeColor} ring-2 ring-white dark:ring-gray-700 shadow-sm" title="${stockLabel}: ${storeStock} und"></span>
            </div>
            <div class="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-600 dark:to-gray-500 flex items-center justify-center text-3xl mb-3 overflow-hidden">
                ${p.image ? `<img src="${p.image}" class="w-full h-full object-cover">` : '📦'}
            </div>
            <h4 class="font-semibold text-sm mb-1 dark:text-white truncate">${p.name}</h4>
            <div class="flex justify-between items-center gap-2">
                <div>
                    <p class="font-bold text-primary-600">${this.formatMoney(previewPrice)}</p>
                    ${previewPrice < Number(p.price || 0) ? `<p class="text-[10px] text-gray-400 line-through">${this.formatMoney(p.price)}</p>` : ''}
                </div>
                <div class="text-right">
                    <p class="text-xs ${isOutOfStock ? 'text-red-500 font-bold' : isLowStock ? 'text-amber-500 font-bold' : 'text-gray-400'}">${this.formatQuantity(storeStock)} und</p>
                    ${storeWarehouse ? `<p class="text-[9px] text-gray-400">${storeWarehouse.name}</p>` : ''}
                </div>
            </div>
            ${promoBadge ? `<div class="mt-1">${promoBadge}</div>` : ''}
            ${saleOptions.length > 1 ? `<p class="text-[10px] text-sky-600 mt-1 font-medium">${t('pos.boxPrice','Caja:')} ${this.formatMoney(boxOption?.price || 0)}${halfOption ? ` · ${t('pos.halfBox','1/2:')} ${this.formatMoney(halfOption.price)}` : ''}</p>` : ''}
            ${hasVariants ? `<p class="text-[10px] text-blue-500 mt-1 font-medium"><i class="fas fa-layer-group mr-1"></i>${t('pos.chooseVariant','Elegir talla/color')}</p>` : ''}
            ${p.hasExpiry && p.expiryDate ? `<p class="text-[10px] text-amber-500 mt-1"><i class="fas fa-calendar-alt mr-1"></i>${p.expiryDate}</p>` : ''}
        </button>
    `;
    }).join('');
};


proto.filterPOSProducts = function(query) {
    const normalized = query.trim();
    const lower = normalized.toLowerCase();
    const products = store.get('products').filter(p => p.active && (
        p.name.toLowerCase().includes(lower) ||
        String(p.sku || '').toLowerCase().includes(lower) ||
        String(p.barcode || '').toLowerCase().includes(lower)
    ));
    const grid = document.getElementById('posProductGrid');
    if (grid) grid.innerHTML = this.renderPOSProductGrid(products);

    // Escáner de código de barras: si hay coincidencia exacta por barcode o sku, agregar al carrito
    if (this._barcodeScanTimer) clearTimeout(this._barcodeScanTimer);
    this._barcodeScanTimer = setTimeout(() => {
        if (!normalized) return;
        // Detectar código de barras de tarjeta CRM
        if (lower.startsWith('rwcrm-card-')) {
            const cardNumber = normalized.substring('RWCRM-CARD-'.length);
            const client = store.get('clients').find(c => c.loyaltyCardNumber === cardNumber);
            if (client) {
                const sel = document.getElementById('posClient');
                if (sel) { sel.value = client.id; this.showToast(`Cliente: ${client.firstName} ${client.lastName}`, 'success'); }
                const input = document.getElementById('posSearch');
                if (input) input.value = '';
                this.applyActiveCampaignsAndCoupons(client.id);
                return;
            }
        }
        // Detectar código de barras de cupón CRM
        if (lower.startsWith('rwcrm-coupon-')) {
            const couponCode = normalized.substring('RWCRM-COUPON-'.length);
            const coupon = store.get('crmCoupons')?.find(c => c.code === couponCode && c.isActive);
            if (coupon) {
                this.appliedCoupon = coupon;
                this.showToast(`Cupón aplicado: ${coupon.name}`, 'success');
                this.updateCartUI();
                const input = document.getElementById('posSearch');
                if (input) input.value = '';
                return;
            } else {
                this.showToast('Cupón no válido o expirado', 'error');
            }
        }
        const exactByBarcode = store.get('products').find(p => p.active && String(p.barcode || '').toLowerCase() === lower);
        const exactBySku = store.get('products').find(p => p.active && String(p.sku || '').toLowerCase() === lower);
        const exact = exactByBarcode || exactBySku;
        if (exact) {
            const input = document.getElementById('posSearch');
            if (input) input.value = '';
            this.addToCart(exact.id);
        }
    }, 120);
};


proto.filterPOSByCategory = function(category) {
    document.querySelectorAll('.pos-cat-btn').forEach(btn => {
        btn.className = btn.dataset.cat === category 
            ? 'pos-cat-btn px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-primary-600 text-white'
            : 'pos-cat-btn px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    });
    const products = category 
        ? store.get('products').filter(p => p.active && p.category === category)
        : store.get('products').filter(p => p.active);
    const grid = document.getElementById('posProductGrid');
    if (grid) grid.innerHTML = this.renderPOSProductGrid(products);
};


proto.getProductVariants = function(product) {
    const directVariants = Array.isArray(product?.variants)
        ? product.variants
        : (Array.isArray(product?.variantes) ? product.variantes : []);

    const normalizedVariants = directVariants
        .filter(variant => variant?.key)
        .map(variant => ({
            key: variant.key,
            label: variant.label || this.formatVariantLabel(variant.key) || variant.key,
            stock: Math.max(0, store.getProductTotalStock(product?.id, variant.key)),
            sku: variant.sku || `${product?.sku || product?.id || 'SKU'}-${variant.key}`
        }));

    if (normalizedVariants.length) return normalizedVariants;

    const sizes = Array.isArray(product?.sizes)
        ? product.sizes
        : (Array.isArray(product?.tallas) ? product.tallas : []);
    const colors = Array.isArray(product?.colors)
        ? product.colors
        : (Array.isArray(product?.colores) ? product.colores : []);
    const normalizedSizes = sizes.map(size => String(size).trim()).filter(Boolean);
    const normalizedColors = colors.map(color => String(color).trim()).filter(Boolean);
    const combinations = [];

    if (normalizedSizes.length && normalizedColors.length) normalizedSizes.forEach(size => normalizedColors.forEach(color => combinations.push(`${size}-${color}`)));
    else if (normalizedSizes.length) normalizedSizes.forEach(size => combinations.push(size));
    else normalizedColors.forEach(color => combinations.push(color));

    const fallbackStock = Math.max(0, parseInt(product?.stock, 10) || 0);
    return combinations.map(key => ({
        key,
        label: this.formatVariantLabel(key) || key,
        stock: fallbackStock,
        sku: `${product?.sku || product?.id || 'SKU'}-${key}`
    }));
};


// Obtener el almacén de tienda (POS) o el general como fallback
proto.getStoreWarehouse = function() {
    const warehouses = store.get('warehouses');
    return warehouses.find(w => w.type === 'store') || warehouses.find(w => w.type === 'general');
};


// Obtener stock de un producto en el almacén de tienda (para POS)
proto.getProductStockInStore = function(productId, variantKey = '') {
    const storeWarehouse = this.getStoreWarehouse();
    const product = store.getById('products', productId);
    
    if (!storeWarehouse) {
        // Fallback a stock global si no hay almacenes
        if (variantKey) {
            return Math.max(0, store.getProductTotalStock(productId, variantKey));
        }
        return Math.max(0, parseInt(product?.stock, 10) || 0);
    }

    // Buscar stock del producto (o variante) en el almacén de tienda
    const warehouseStock = store.getProductStockInWarehouse(productId, storeWarehouse.id, variantKey || null);
    return Math.max(0, warehouseStock);
};


proto.getProductVariantStock = function(product, variantKey = '', useStoreWarehouse = false) {
    // Si se solicita usar el almacén de tienda (modo POS)
    if (useStoreWarehouse) {
        return this.getProductStockInStore(product?.id, variantKey);
    }
    
    if (variantKey) {
        return Math.max(0, store.getProductTotalStock(product?.id, variantKey));
    }
    return Math.max(0, parseInt(product?.stock, 10) || 0);
};


proto.openVariantSelector = function(productId) {
    const product = store.getById('products', productId);
    if (!product) return;

    const variants = this.getProductVariants(product);

    if (!variants.length) {
        this.showToast(t('pos.noVariants','Este producto no tiene variantes disponibles'), 'warning');
        return;
    }

    // Obtener stock disponible en el almacén de tienda
    const storeStock = this.getProductStockInStore(productId);
    const storeWarehouse = this.getStoreWarehouse();
    const needsPresentationSelection = this.getProductSaleOptions(product).length > 1;

    this.openModal({
        title: `${t('pos.selectVariant','Seleccionar variante')} · ${product.name}`,
        size: 'md',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-500 dark:text-gray-400">${needsPresentationSelection ? t('pos.selectVariantAndFormat','Elige la talla o color y luego el formato de venta.') : t('pos.selectVariantExact','Elige la talla o color exacto que deseas facturar.')}</p>
                ${storeWarehouse ? (() => { const qty = this.formatQuantity(storeStock); return `<p class="text-xs text-gray-400">${t('pos.stockInWarehouse', 'Stock disponible en {0}: {1} und').replace('{0}', storeWarehouse.name).replace('{1}', qty)}</p>`; })() : ''}
                <div class="grid grid-cols-1 gap-2">
                    ${variants.map(variant => {
                        const effectiveStock = this.getProductStockInStore(productId, variant.key);
                        const isAvailable = effectiveStock > 0;
                        return `
                        <button
                            type="button"
                            onclick="${isAvailable ? `ui.selectVariantAndAdd('${productId}', '${variant.key}')` : ''}"
                            class="rounded-xl border px-4 py-3 text-left transition ${isAvailable ? 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'}"
                            ${isAvailable ? '' : 'disabled'}
                        >
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <p class="font-semibold dark:text-white">${this.escapeHtml(variant.label)}</p>
                                    <p class="text-xs text-gray-500">SKU: ${this.escapeHtml(variant.sku)}</p>
                                </div>
                                <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${this.formatQuantity(effectiveStock)} und</span>
                            </div>
                        </button>
                    `}).join('')}
                </div>
            </div>
        `,
        footer: `
            <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200">${t('pos.cancel','Cancelar')}</button>
        `
    });
};


proto.selectVariantAndAdd = function(productId, variantKey) {
    const label = this.formatVariantLabel(variantKey) || variantKey;
    const product = store.getById('products', productId);
    this.closeModal();
    setTimeout(() => {
        if (product && this.getProductSaleOptions(product).length > 1) {
            this.openSalePresentationSelector(productId, variantKey, label);
            return;
        }
        this.addToCart(productId, variantKey, label, 'unit');
    }, 80);
};


proto.openSalePresentationSelector = function(productId, variantKey = '', variantLabel = '') {
    const product = store.getById('products', productId);
    if (!product) return;

    const saleOptions = this.getProductSaleOptions(product);
    if (saleOptions.length <= 1) {
        this.addToCart(productId, variantKey, variantLabel, 'unit');
        return;
    }

    const availableStock = this.getProductStockInStore(productId, variantKey || '');
    const reservedStock = this.getProductReservedCartStock(productId, variantKey || '');
    const remainingStock = Math.max(0, availableStock - reservedStock);

    this.openModal({
        title: `${t('pos.saleFormat','Formato de venta')} · ${product.name}`,
        size: 'md',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-500 dark:text-gray-400">${t('pos.selectSaleFormat','Selecciona si deseas facturar este producto por caja, media caja o unidad.')}</p>
                ${variantLabel ? `<p class="text-xs text-primary-600 dark:text-primary-300"><i class="fas fa-layer-group mr-1"></i>Variante: ${this.escapeHtml(variantLabel)}</p>` : ''}
                <p class="text-xs text-gray-400">${t('pos.availableForSale','Disponible para esta venta:')} <span class="font-semibold">${this.formatQuantity(remainingStock)} und</span></p>
                <div class="grid grid-cols-1 gap-2">
                    ${saleOptions.map(option => {
                        const isAvailable = option.units <= remainingStock;
                        return `
                            <button
                                type="button"
                                onclick="${isAvailable ? `ui.selectSaleOptionAndAdd('${productId}', '${option.key}', '${variantKey || ''}')` : ''}"
                                class="rounded-xl border px-4 py-3 text-left transition ${isAvailable ? 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700' : 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed'}"
                                ${isAvailable ? '' : 'disabled'}
                            >
                                <div class="flex items-center justify-between gap-3">
                                    <div>
                                        <p class="font-semibold dark:text-white">${this.escapeHtml(option.label)}</p>
                                        <p class="text-xs text-gray-500">${t('pos.consumesUnits','Consume {0} unidad(es) del stock').replace('{0}', this.formatQuantity(option.units))}</p>
                                    </div>
                                    <span class="font-bold text-primary-600">${this.formatMoney(option.price)}</span>
                                </div>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `,
        footer: `
            <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200">${t('pos.cancel','Cancelar')}</button>
        `
    });
};


proto.selectSaleOptionAndAdd = function(productId, saleMode, variantKey = '') {
    const label = this.formatVariantLabel(variantKey) || variantKey;
    this.closeModal();
    setTimeout(() => this.addToCart(productId, variantKey, label, saleMode), 80);
};


proto.addToCart = function(productId, variantKey = '', variantLabel = '', saleMode = '') {
    const product = store.getById('products', productId);
    if (!product) return;

    const hasVariants = this.getProductVariants(product).length > 0;
    if (hasVariants && !variantKey) {
        this.openVariantSelector(productId);
        return;
    }

    const saleOptions = this.getProductSaleOptions(product);
    if (!saleMode && saleOptions.length > 1) {
        this.openSalePresentationSelector(productId, variantKey, variantLabel);
        return;
    }

    const selectedOption = this.getProductSaleOption(product, saleMode || 'unit');
    const normalizedVariantKey = variantKey || '';
    // Usar stock del almacén de tienda (POS) en lugar del global
    const availableStock = this.getProductStockInStore(productId, normalizedVariantKey);
    const reservedStock = this.getProductReservedCartStock(productId, normalizedVariantKey);
    const unitsPerSale = Math.max(1, Number(selectedOption.units || 1));
    
    this.openLotSelector(productId, normalizedVariantKey, variantLabel, selectedOption.key);
};


proto.openLotSelector = function(productId, variantKey, variantLabel, saleMode) {
    const product = store.getById('products', productId);
    if (!product) return;
    const lots = this.getProductLotsInStore(productId, variantKey || null);
    if (lots.length === 0) {
        this.showToast(t('pos.noStoreStock','Sin stock disponible en tienda'), 'warning');
        return;
    }
    if (lots.length === 1 && !lots[0].lotNumber && !lots[0].expiryDate) {
        this.confirmAddToCart(productId, variantKey, variantLabel, saleMode, lots[0].lotNumber, lots[0].expiryDate);
        return;
    }
    const selectedOption = this.getProductSaleOption(product, saleMode || 'unit');
    const unitsPerSale = Math.max(1, Number(selectedOption?.units || 1));
    const lotRows = lots.map((lot) => {
        const reserved = this.getLotReservedCartStock(productId, lot.lotNumber, lot.expiryDate);
        const available = Math.max(0, lot.quantity - reserved);
        const disabled = available < unitsPerSale;
        const lotLabel = lot.lotNumber ? `${t('ticket.lot','Lote:')} ${this.escapeHtml(lot.lotNumber)}` : (lot.expiryDate ? `${t('ticket.expiry','Caduca:')} ${lot.expiryDate}` : t('pos.generalStock','Stock general'));
        return `
            <button type="button" onclick="${disabled ? '' : `ui.confirmAddToCart('${productId}', '${variantKey || ''}', '${this.escapeHtml(variantLabel || '')}', '${saleMode}', '${lot.lotNumber || ''}', '${lot.expiryDate || ''}')`}"
                class="w-full text-left rounded-xl border px-4 py-3 transition ${disabled ? 'border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed' : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700'}"
                ${disabled ? 'disabled' : ''}>
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="font-semibold dark:text-white">${lotLabel}</p>
                        ${lot.expiryDate ? `<p class="text-xs text-amber-500"><i class="fas fa-calendar-alt mr-1"></i>${t('ticket.expiry','Caduca:')} ${lot.expiryDate}</p>` : ''}
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold ${available < unitsPerSale ? 'text-red-500' : 'text-primary-600'}">${available} und</p>
                        <p class="text-[10px] text-gray-400">${t('pos.available','Disponible')}</p>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    this.openModal({
        title: `${t('pos.selectLot','Seleccionar lote')} · ${product.name}`,
        size: 'md',
        content: `
            <div class="space-y-3">
                <p class="text-sm text-gray-500 dark:text-gray-400">${t('pos.selectLotDesc','Elige el lote del que deseas descontar el stock.')}</p>
                <div class="grid grid-cols-1 gap-2">${lotRows}</div>
            </div>
        `
    });
};


proto.confirmAddToCart = function(productId, variantKey, variantLabel, saleMode, lotNumber, expiryDate) {
    const product = store.getById('products', productId);
    if (!product) return;
    const selectedOption = this.getProductSaleOption(product, saleMode || 'unit');
    const normalizedVariantKey = variantKey || '';
    const unitsPerSale = Math.max(1, Number(selectedOption?.units || 1));
    const availableStock = this.getLotStockInStore(productId, lotNumber, expiryDate, normalizedVariantKey);
    const reservedStock = this.getLotReservedCartStock(productId, lotNumber, expiryDate);

    if (availableStock <= 0 || reservedStock + unitsPerSale > availableStock) {
        this.showToast(t('pos.insufficientLotStock','Stock insuficiente para este lote'), 'warning');
        return;
    }

    const finalVariantLabel = normalizedVariantKey ? (variantLabel || this.formatVariantLabel(normalizedVariantKey)) : '';
    const cartKey = `${productId}::${normalizedVariantKey || 'base'}::${selectedOption.key}::${lotNumber || 'NO_LOT'}::${expiryDate || 'NO_EXP'}`;
    const existing = AppState.posCart.find(item => item.cartKey === cartKey);
    if (existing) {
        existing.qty += 1;
        existing.stockUnits = existing.qty * Math.max(1, Number(existing.unitsPerSale || unitsPerSale));
    } else {
        AppState.posCart.push({
            cartKey,
            id: productId,
            name: [product.name, finalVariantLabel, selectedOption.label].filter(Boolean).join(' · '),
            baseName: product.name,
            price: selectedOption.price,
            qty: 1,
            variantKey: normalizedVariantKey || null,
            variantLabel: finalVariantLabel || null,
            saleMode: selectedOption.key,
            presentationLabel: selectedOption.label,
            presentationShortLabel: selectedOption.shortLabel,
            unitsPerSale,
            stockUnits: unitsPerSale,
            lotNumber: lotNumber || null,
            expiryDate: expiryDate || null
        });
    }
    this.closeModal();
    this.updateCartUI();
};


proto.updateQty = function(index, delta) {
    const item = AppState.posCart[index];
    if (!item) return;

    const unitsPerSale = Math.max(1, Number(item.unitsPerSale || 1));
    const proposedQty = Math.max(0, Number(item.qty || 0) + delta);
    const availableStock = item.lotNumber || item.expiryDate
        ? this.getLotStockInStore(item.id, item.lotNumber, item.expiryDate, item.variantKey || '')
        : this.getProductStockInStore(item.id, item.variantKey || '');
    const reservedWithoutCurrent = item.lotNumber || item.expiryDate
        ? this.getLotReservedCartStock(item.id, item.lotNumber, item.expiryDate, item.cartKey)
        : this.getProductReservedCartStock(item.id, item.variantKey || '', item.cartKey);

    if (delta > 0 && reservedWithoutCurrent + (proposedQty * unitsPerSale) > availableStock) {
        this.showToast(t('pos.insufficientStock','Stock insuficiente'), 'warning');
        return;
    }

    item.qty = proposedQty;
    item.stockUnits = proposedQty * unitsPerSale;
    if (item.qty <= 0) AppState.posCart.splice(index, 1);
    this.updateCartUI();
};


proto.removeFromCart = function(index) {
    AppState.posCart.splice(index, 1);
    this.updateCartUI();
};


proto.clearCart = function() {
    if (AppState.posCart.length === 0) return;
    if (confirm(t('pos.confirmClearCart', '¿Vaciar el carrito?'))) {
        AppState.posCart = [];
        this.discount = 0;
        this.posNote = '';
        this.splitPayments = { cash: 0, card: 0, mobile: 0, credit: 0 };
        this.splitPaymentEnabled = false;
        this.updateCartUI();
    }
};


proto.renderCartItems = function() {
    if (AppState.posCart.length === 0) {
        return `<div class="text-center text-gray-400 py-12"><i class="fas fa-shopping-basket text-5xl mb-4 opacity-30"></i><p>${t('pos.emptyCart','Carrito vacío')}</p></div>`;
    }

    const pricing = this.getCartPricingBreakdown();
    return pricing.lineItems.map((item, idx) => `
        <div class="cart-item p-3 rounded-xl bg-gray-50 dark:bg-gray-700">
            <div class="flex items-start justify-between gap-3 mb-2">
                <div class="min-w-0 flex-1">
                    <p class="font-medium text-sm dark:text-white break-words leading-5">${item.baseName || item.name}</p>
                    ${item.variantLabel ? `<p class="text-[11px] text-primary-600 mt-0.5"><i class="fas fa-layer-group mr-1"></i>${item.variantLabel}</p>` : ''}
                    ${item.presentationLabel ? `<p class="text-[11px] text-sky-600 mt-0.5"><i class="fas fa-box-open mr-1"></i>${this.escapeHtml(item.presentationLabel)} · ${this.formatQuantity(item.stockUnits || item.qty)} und</p>` : ''}
                    ${item.lotNumber ? `<p class="text-[11px] text-amber-600 mt-0.5"><i class="fas fa-barcode mr-1"></i>${t('ticket.lot','Lote:')} ${this.escapeHtml(item.lotNumber)}${item.expiryDate ? ` · ${item.expiryDate}` : ''}</p>` : ''}
                    <p class="text-xs text-gray-500">${this.formatMoney(item.baseUnitPrice)} / ${item.presentationShortLabel || 'und'}</p>
                    ${item.appliedPromotionLabel ? `<p class="text-[11px] text-emerald-600 mt-0.5"><i class="fas fa-badge-percent mr-1"></i>${this.escapeHtml(item.appliedPromotionName)} · ${this.escapeHtml(item.appliedPromotionLabel)}</p>` : ''}
                    ${item.lineDiscount > 0 ? `<p class="text-[11px] text-emerald-500 mt-0.5">${t('pos.savings','Ahorro:')} ${this.formatMoney(item.lineDiscount)}</p>` : ''}
                </div>
                <button onclick="ui.removeFromCart(${idx})" class="text-red-400 hover:text-red-600 p-1"><i class="fas fa-times"></i></button>
            </div>
            <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                    <button onclick="ui.updateQty(${idx}, -1)" class="w-9 h-9 rounded-lg bg-white dark:bg-gray-600 shadow flex items-center justify-center"><i class="fas fa-minus text-xs dark:text-white"></i></button>
                    <span onclick="ui.showNumpadQty(${idx})" class="w-auto min-w-[3rem] text-center font-mono font-bold dark:text-white cursor-pointer select-none bg-white/10 hover:bg-white/20 rounded-lg px-2 py-1 transition">${this.formatQuantity(item.qty)}</span>
                    <button onclick="ui.updateQty(${idx}, 1)" class="w-9 h-9 rounded-lg bg-white dark:bg-gray-600 shadow flex items-center justify-center"><i class="fas fa-plus text-xs dark:text-white"></i></button>
                </div>
                <div class="text-right">
                    ${item.lineDiscount > 0 ? `<p class="text-[11px] text-gray-400 line-through">${this.formatMoney(item.lineSubtotal)}</p>` : ''}
                    <p class="font-bold dark:text-white whitespace-nowrap">${this.formatMoney(item.lineTotal)}</p>
                </div>
            </div>
        </div>
    `).join('');
};


proto.updateCartUI = function() {
    const container = document.getElementById('posCartItems');
    if (container) container.innerHTML = this.renderCartItems();

    const pricing = this.getCartPricingBreakdown();
    const subtotalEl = document.getElementById('posSubtotal');
    const discountEl = document.getElementById('posDiscount');
    const taxEl = document.getElementById('posTax');
    const totalEl = document.getElementById('posTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (subtotalEl) subtotalEl.textContent = this.formatMoney(pricing.subtotal);
    if (discountEl) {
        discountEl.textContent = '-' + this.formatMoney(pricing.discountAmount);
        discountEl.title = [
            pricing.promotionDiscount > 0 ? `${t('pos.promotions','Promociones:')} ${this.formatMoney(pricing.promotionDiscount)}` : '',
            pricing.manualDiscount > 0 ? `${t('pos.manualDiscount','Manual:')} ${this.formatMoney(pricing.manualDiscount)}` : ''
        ].filter(Boolean).join(' · ');
    }
    if (taxEl) {
        taxEl.textContent = this.formatMoney(pricing.tax);
        // Generar desglose de impuestos para el tooltip
        const taxBreakdown = pricing.lineItems.reduce((acc, item) => {
            const rate = item.taxRate || 15;
            if (!acc[rate]) acc[rate] = 0;
            acc[rate] += item.lineTax;
            return acc;
        }, {});
        const taxTooltip = Object.entries(taxBreakdown)
            .map(([rate, amount]) => `${t('ticket.tax','IVA')} ${rate}% ${t('pos.included','incluido:')} ${this.formatMoney(amount)}`)
            .join(' | ');
        taxEl.title = taxTooltip || t('pos.noTax','Sin impuestos');
    }
    if (totalEl) totalEl.textContent = this.formatMoney(pricing.total);
    if (checkoutBtn) checkoutBtn.disabled = AppState.posCart.length === 0;
};


proto.applyDiscount = function(percent) {
    this.discount = percent;
    this.updateCartUI();
    this.showToast(t('pos.discountApplied', 'Descuento {0}% aplicado').replace('{0}', percent), 'success');
};


proto.clearDiscount = function() {
    this.discount = 0;
    this.updateCartUI();
};

proto.applyActiveCampaignsAndCoupons = function(clientId) {
    const client = store.getById('clients', clientId);
    if (!client) return;
    const now = new Date().toISOString().split('T')[0];
    const campaigns = store.get('discountCampaigns') || [];
    const activeCampaign = campaigns.find(c => {
        return c.isActive && c.startDate <= now && c.endDate >= now &&
            (!c.targetTiers || c.targetTiers.length === 0 || c.targetTiers.includes(client.tier || 'bronze'));
    });
    if (activeCampaign) {
        this.appliedCampaign = activeCampaign;
        this.showToast(`Campaña aplicada: ${activeCampaign.name}`, 'success');
    }
    const coupons = store.get('crmCouponPurchases') || [];
    const clientCoupons = coupons.filter(cp => cp.clientId === clientId && cp.status === 'active');
    if (clientCoupons.length > 0) {
        this.showToast(`Cliente tiene ${clientCoupons.length} cupón(es) activo(s)`, 'success');
    }
    this.updateCartUI();
};

proto.clearAppliedCoupon = function() {
    this.appliedCoupon = null;
    this.couponDiscount = 0;
    this.updateCartUI();
    this.showToast('Cupón eliminado', 'success');
};

proto.setPaymentMethod = function(method) {
    this.paymentMethod = method;
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });
    const cashSection = document.getElementById('cashInputSection');
    if (cashSection) cashSection.classList.toggle('hidden', method !== 'cash');
    this.calculateChange();
};


proto.calculateChange = function() {
    const pricing = this.getCartPricingBreakdown();
    const received = parseFloat(document.getElementById('cashReceived')?.value) || 0;
    const change = received - pricing.total;
    
    const changeDisplay = document.getElementById('changeDisplay');
    const posChange = document.getElementById('posChange');
    
    if (changeDisplay && posChange) {
        changeDisplay.classList.toggle('hidden', change < 0);
        posChange.textContent = this.formatMoney(Math.max(0, change));
    }
};


proto.saveSaleRecord = async function(sale, options = {}) {
    const {
        printReceipt = true,
        successMessage = '',
        externalOrderMeta = null
    } = options;

    const shouldQueueStockSync = !!(store.cloud.userId && store.cloud.tenantId && store.cloud.tenantId !== 'default' && Array.isArray(sale.items) && sale.items.length);
    if (!sale.id) sale.id = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (shouldQueueStockSync && !sale.syncOperationId) {
        sale.syncOperationId = `stockop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    sale.syncStatus = shouldQueueStockSync
        ? (navigator.onLine ? 'syncing' : 'pending')
        : (sale.syncStatus || 'local');

    const saved = store.add('sales', sale);

    if (sale.paymentMethod === 'cash') {
        const terminal = store.getActivePosTerminal();
        const terminalId = terminal?.id || sale.posTerminalId || 'pos_default';
        const cr = store.getCashRegisterForTerminal(terminalId);
        if (cr.isOpen) {
            cr.movements.push({
                type: 'sale',
                amount: sale.total,
                concept: t('pos.saleConcept','Venta #{0}').replace('{0}', sale.ticket),
                time: Date.now()
            });
            cr.currentAmount += sale.total;
            store.data.cashRegisters[terminalId] = cr;
            store.save('cashRegisters');
            // Mantener compatibilidad legacy
            store.data.cashRegister = cr;
            store.save('cashRegister');
        }
    }

    // Descontar del almacén de tienda (venta directa/POS)
    const storeWarehouse = store.get('warehouses').find(w => w.type === 'store');
    const replenishmentAlerts = [];
    
    sale.items.forEach(item => {
        const product = store.getById('products', item.id);
        if (product) {
            const consumedUnits = Math.max(0, Number(item.stockUnitsSold ?? item.stockUnits ?? item.qty ?? 0));
            // Descontar del almacén tienda si existe, si no del general
            const warehouseId = storeWarehouse ? storeWarehouse.id : (store.get('warehouses').find(w => w.type === 'general')?.id);
            if (warehouseId) {
                if (item.lotNumber || item.expiryDate) {
                    store.deductWarehouseStock(item.id, warehouseId, consumedUnits, item.lotNumber, item.expiryDate, {
                        variantKey: item.variantKey || null,
                        type: 'sale',
                        referenceId: sale.id,
                        notes: t('pos.saleConcept','Venta #{0}').replace('{0}', sale.ticket)
                    });
                } else {
                    store.deductWarehouseStock(item.id, warehouseId, consumedUnits, null, null, {
                        variantKey: item.variantKey || null,
                        type: 'sale',
                        referenceId: sale.id,
                        notes: t('pos.saleConcept','Venta #{0}').replace('{0}', sale.ticket)
                    });
                }
                const newStock = store.getProductStockInWarehouse(item.id, warehouseId);

                // Verificar si se alcanzó el límite mínimo para alerta
                if (storeWarehouse && newStock <= (storeWarehouse.minStockAlert || 10)) {
                    replenishmentAlerts.push({
                        productId: item.id,
                        productName: product.name,
                        currentStock: newStock,
                        minAlert: storeWarehouse.minStockAlert || 10,
                        timestamp: Date.now()
                    });
                }
            }
            // Actualizar stock global
            const totalStock = store.getProductTotalStock(item.id);
            store.update('products', item.id, { stock: totalStock });
        }
    });
    
    // Mostrar alertas de reabastecimiento si las hay
    if (replenishmentAlerts.length > 0) {
        const alert = replenishmentAlerts[0]; // Mostrar la primera
        const generalWarehouse = store.get('warehouses').find(w => w.type === 'general');
        const availableInGeneral = generalWarehouse ? store.getProductStockInWarehouse(alert.productId, generalWarehouse.id) : 0;
        
        setTimeout(() => {
            this.showToast(t('pos.stockAlert', '⚠️ {0} bajó de límite ({1} und). Disponible en General: {2}').replace('{0}', alert.productName).replace('{1}', alert.currentStock).replace('{2}', availableInGeneral), 'warning', 5000);
        }, 1000);
        
        // Guardar alerta para mostrar en el dashboard de almacenes
        store.add('replenishmentAlerts', {
            id: 'alert_' + Date.now(),
            productId: alert.productId,
            productName: alert.productName,
            warehouseId: storeWarehouse?.id,
            currentStock: alert.currentStock,
            minAlert: alert.minAlert,
            availableInGeneral: availableInGeneral,
            saleId: saved.id,
            timestamp: Date.now(),
            status: 'pending'
        });
    }
    this.updateNotificationBadge();

    if (sale.clientId) {
        const client = store.getById('clients', sale.clientId);
        if (client) {
            const updates = { purchases: client.purchases + 1 };
            if (sale.paymentMethod === 'credit') {
                updates.credit = (client.credit || 0) + sale.total;
            }
            if (sale.paymentMethod === 'wallet') {
                updates.walletBalance = Math.max(0, (client.walletBalance || 0) - sale.total);
                // Registrar transacción de billetera
                const tx = {
                    id: `wtx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    clientId: sale.clientId,
                    type: 'purchase',
                    amount: sale.total,
                    balanceAfter: updates.walletBalance,
                    description: `Compra POS #${sale.ticket}`,
                    status: 'completed',
                    createdAt: new Date().toISOString()
                };
                if (!Array.isArray(store.data.walletTransactions)) store.data.walletTransactions = [];
                store.data.walletTransactions.push(tx);
                store.save('walletTransactions');
                store.scheduleCloudSave();
            }
            // Añadir puntos por compra (1 punto por cada 1000 FCFA)
            const pointsEarned = Math.floor(sale.total / 1000);
            if (pointsEarned > 0) {
                updates.loyaltyPoints = (client.loyaltyPoints || 0) + pointsEarned;
            }
            store.update('clients', sale.clientId, updates);
        }
    }

    if (shouldQueueStockSync) {
        store.queueOfflineOperation(store.createSaleSyncOperation(saved, { externalOrderMeta }));
        if (navigator.onLine) {
            await store.processOfflineOperations();
        }
    } else if (externalOrderMeta?.tenantId && externalOrderMeta?.orderId) {
        try {
            await updateDoc(doc(db, 'rw_tenants', externalOrderMeta.tenantId, 'incoming_orders', externalOrderMeta.orderId), {
                ...(externalOrderMeta.payload || {}),
                status: 'invoiced',
                linkedSaleId: saved.id,
                invoicedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.warn('No se pudo actualizar el pedido externo tras facturar:', error);
        }
    }

    if (printReceipt) {
        const tp = window.ThermalPrinter;
        const terminal = store.getActivePosTerminal();
        const prevWidth = tp ? tp.paperWidthMm : null;
        if (terminal?.printerWidth && tp) {
            // No sobreescribir ancho si la impresora USB autodetectó 58mm
            const usbName = tp.usbDevice ? (tp.usbDevice.productName || '').toLowerCase() : '';
            if (usbName.includes('58') || usbName.includes('pos58')) {
                console.log('[POS] Terminal config ' + terminal.printerWidth + 'mm ignorada: impresora USB es 58mm');
            } else {
                tp.setWidth(terminal.printerWidth);
            }
        }
        if (tp && tp.shouldUseThermal() && tp.autoPrintSale) {
            tp.printTicket({ sale: saved, settings: store.data.settings, openDrawer: terminal?.openDrawer !== 'manual' })
                .then(() => this.showToast(t('pos.ticketPrinted', 'Ticket impreso'), 'success'))
                .catch(e => console.warn('[saveSaleRecord] Error impresión:', e))
                .finally(() => { if (prevWidth && tp) tp.setWidth(prevWidth); });
        } else if (tp && tp.shouldUseBrowserThermal() && tp.autoPrintSale) {
            this.printSaleDocument(saved, 'ticket');
            if (prevWidth && tp) tp.setWidth(prevWidth);
        } else if (tp && tp.shouldUseA4() && tp.autoPrintSale) {
            this.printSaleDocument(saved, 'a4');
            if (prevWidth && tp) tp.setWidth(prevWidth);
        } else {
            this.printReceipt(saved);
            if (prevWidth && tp) tp.setWidth(prevWidth);
        }
    }
    this.lastSaleId = sale.id;
    if (successMessage) this.showToast(successMessage, 'success');
    if (shouldQueueStockSync && !navigator.onLine) {
        this.showToast(t('toast.saleSavedOffline'), 'warning', 4500);
    }

    return saved;
};


proto.processCheckout = async function() {
    if (AppState.posCart.length === 0) { this.showToast(t('toast.emptyCart'), 'warning'); return; }

    const pricing = this.getCartPricingBreakdown();
    const willUseCash = this.paymentMethod === 'cash' ||
        (this.splitPaymentEnabled && parseFloat(document.getElementById('split_cash')?.value || 0) > 0);

    if (willUseCash) {
        const terminal = store.getActivePosTerminal();
        const cr = store.getCashRegisterForTerminal(terminal?.id || 'pos_default');
        if (!cr?.isOpen) {
            this.showToast(t('pos.cashRegisterRequired','Debe abrir la caja antes de cobrar en efectivo'), 'error');
            const cashPanel = document.querySelector('.pos-ticket-header');
            if (cashPanel) {
                cashPanel.classList.add('animate-pulse');
                setTimeout(() => cashPanel.classList.remove('animate-pulse'), 2000);
            }
            return;
        }
    }
    const { subtotal, discountAmount, promotionDiscount, manualDiscount, tax, total } = pricing;

    let paymentMethod = this.paymentMethod;
    let splitPayments = null;

    if (this.splitPaymentEnabled) {
        splitPayments = {
            cash: parseFloat(document.getElementById('split_cash')?.value) || 0,
            card: parseFloat(document.getElementById('split_card')?.value) || 0,
            mobile: parseFloat(document.getElementById('split_mobile')?.value) || 0
        };
        const splitTotal = Object.values(splitPayments).reduce((a, b) => a + b, 0);
        if (Math.abs(splitTotal - total) > 0.01) {
            this.showToast(t('pos.splitPaymentMismatch', 'La suma de los pagos parciales debe ser igual al total'), 'error');
            return;
        }
        const primaryMethod = Object.entries(splitPayments).find(([_, v]) => v > 0);
        paymentMethod = primaryMethod ? primaryMethod[0] : 'cash';
    } else {
        if (this.paymentMethod === 'cash') {
            const received = parseFloat(document.getElementById('cashReceived')?.value) || 0;
            if (received < total) { this.showToast(t('toast.insufficientAmount'), 'error'); return; }
        }
    }

    if (!this.splitPaymentEnabled && this.paymentMethod === 'credit') {
        const clientId = document.getElementById('posClient')?.value || '';
        if (!clientId) {
            this.showToast(t('toast.selectClientForCredit'), 'error');
            return;
        }
    }
    if (!this.splitPaymentEnabled && this.paymentMethod === 'wallet') {
        const clientId = document.getElementById('posClient')?.value || '';
        if (!clientId) { this.showToast(t('pos.selectClientWallet','Selecciona un cliente para pagar con billetera'), 'error'); return; }
        const client = store.getById('clients', clientId);
        if (!client || (client.walletBalance || 0) < total) { this.showToast(t('pos.insufficientWallet','Saldo insuficiente en billetera'), 'error'); return; }
        const pinInput = document.getElementById('walletPinInput')?.value?.trim() || '';
        if (client.pinHash && pinInput !== client.pinHash) {
            this.showToast(t('pos.invalidPin','PIN incorrecto. Pide al cliente su PIN de 4 dígitos.'), 'error');
            return;
        }
    }

    const clientId = document.getElementById('posClient')?.value || '';
    const clientName = clientId 
        ? store.getById('clients', clientId)?.firstName + ' ' + store.getById('clients', clientId)?.lastName 
        : t('pos.occasionalClient');

    const saleItems = pricing.lineItems.map((item) => ({
        cartKey: item.cartKey,
        id: item.id,
        name: item.name,
        baseName: item.baseName,
        price: item.baseUnitPrice,
        effectiveUnitPrice: Math.round(item.effectiveUnitPrice || item.baseUnitPrice),
        qty: item.qty,
        variantKey: item.variantKey || null,
        variantLabel: item.variantLabel || null,
        saleMode: item.saleMode || 'unit',
        presentationLabel: item.presentationLabel || 'Unidad',
        presentationShortLabel: item.presentationShortLabel || 'unidad',
        unitsPerSale: Math.max(1, Number(item.unitsPerSale || 1)),
        stockUnitsSold: Math.max(1, Number(item.stockUnits || item.qty || 1)),
        stockUnits: Math.max(1, Number(item.stockUnits || item.qty || 1)),
        discount: item.lineDiscount || 0,
        total: item.lineTotal || item.lineSubtotal,
        appliedPromotionId: item.appliedPromotionId || null,
        appliedPromotionName: item.appliedPromotionName || null,
        appliedPromotionType: item.appliedPromotionType || null,
        lotNumber: item.lotNumber || null,
        expiryDate: item.expiryDate || null
    }));

    // Calcular resumen de impuestos por tasa
    const taxSummary = {};
    pricing.lineItems.forEach(item => {
        const rate = item.taxRate || 15;
        if (!taxSummary[rate]) {
            taxSummary[rate] = { rate, base: 0, tax: 0 };
        }
        taxSummary[rate].base += item.lineTotalBeforeTax;
        taxSummary[rate].tax += item.lineTax;
    });

    const terminal = store.getActivePosTerminal();
    const sale = {
        ticket: this.currentTicket,
        clientId,
        clientName,
        items: saleItems,
        subtotal,
        discount: discountAmount,
        promotionDiscount,
        manualDiscount,
        couponDiscount: this.couponDiscount || 0,
        campaignDiscount: this.campaignDiscount || 0,
        appliedCouponCode: this.appliedCoupon?.code || null,
        appliedCampaignId: this.appliedCampaign?.id || null,
        tax,
        taxSummary: Object.values(taxSummary),
        total,
        paymentMethod,
        splitPayments,
        notes: this.posNote || '',
        status: paymentMethod === 'credit' ? 'credit' : 'completed',
        paid: paymentMethod === 'credit' ? 0 : total,
        balance: paymentMethod === 'credit' ? total : 0,
        date: new Date().toISOString(),
        posTerminalId: terminal?.id || 'pos_default',
        posTerminalName: terminal?.name || 'Caja Principal',
        posTerminalCode: terminal?.code || 'C1'
    };

    // Duplicate check: if ticket was already taken (race condition), re-generate
    const exists = (store.data.sales || []).some(s => s.ticket === sale.ticket);
    if (exists) {
        if (this._reservedTickets) this._reservedTickets.delete(sale.ticket);
        sale.ticket = this.getNextTicket(terminal?.code);
    }
    if (this._reservedTickets) this._reservedTickets.delete(this.currentTicket);
    await this.saveSaleRecord(sale, {
        successMessage: paymentMethod === 'credit'
            ? t('toast.creditSaleRegistered').replace('{0}', sale.ticket)
            : t('toast.saleCompletedNum').replace('{0}', sale.ticket)
    });
    this.checkPracticalMission('sale', sale);
    
    AppState.posCart = [];
    this.discount = 0;
    this.posNote = '';
    this.appliedCoupon = null;
    this.appliedCampaign = null;
    this.couponDiscount = 0;
    this.campaignDiscount = 0;
    this.splitPayments = { cash: 0, card: 0, mobile: 0, credit: 0, wallet: 0 };
    this.splitPaymentEnabled = false;
    if (this._posDateInterval) clearInterval(this._posDateInterval);
    this.currentTicket = this.getNextTicket(terminal?.code);
    this.navigateTo('pos');
};


proto.getPaymentMethodLabel = function(method) {
    const labels = {
        cash: t('pos.cash'),
        card: t('pos.card'),
        mobile: t('pos.mobile'),
        transfer: t('pos.transfer'),
        credit: t('pos.credit')
    };
    return labels[method] || t('pos.unknown');
};


proto.printReceipt = function(sale) {
    if (!sale?.id) {
        this.showToast(t('toast.printError'), 'error');
        return;
    }
    const tp = window.ThermalPrinter;
    const terminal = store.getActivePosTerminal();
    const prevWidth = tp ? tp.paperWidthMm : null;
    if (terminal?.printerWidth && tp) {
        const usbName = tp.usbDevice ? (tp.usbDevice.productName || '').toLowerCase() : '';
        if (usbName.includes('58') || usbName.includes('pos58')) {
            console.log('[POS] Terminal config ' + terminal.printerWidth + 'mm ignorada: impresora USB es 58mm');
        } else {
            tp.setWidth(terminal.printerWidth);
        }
    }
    // Modo A4 forzado
    if (tp && tp.shouldUseA4()) {
        this.printSaleDocument(sale, 'a4');
        if (prevWidth && tp) tp.setWidth(prevWidth);
        return;
    }
    // Modo térmico ESC/POS directo (Web Serial)
    if (tp && tp.shouldUseThermal()) {
        tp.printTicket({ sale: sale, settings: store.data.settings, openDrawer: terminal?.openDrawer !== 'manual' })
            .then(() => this.showToast(t('pos.ticketPrinted', 'Ticket impreso'), 'success'))
            .catch(e => {
                console.warn('[printReceipt] Error térmico:', e);
                this.showPrintModal(sale);
            })
            .finally(() => { if (prevWidth && tp) tp.setWidth(prevWidth); });
        return;
    }
    // Modo ticket térmico vía navegador (con driver Windows)
    if (tp && tp.shouldUseBrowserThermal()) {
        this.printSaleDocument(sale, 'ticket');
        if (prevWidth && tp) tp.setWidth(prevWidth);
        return;
    }
    // Fallback: mostrar modal para elegir
    this.showPrintModal(sale);
    if (prevWidth && tp) tp.setWidth(prevWidth);
};

proto.showPrintModal = function(sale) {
    const issuedAt = sale.date ? new Date(sale.date) : new Date();
    const totalItems = (sale.items || []).reduce((sum, item) => sum + (Number(item.stockUnitsSold ?? item.qty) || 0), 0);
    this.openModal({
        title: `${t('modal.printSale')} #${sale.ticket}`,
        size: 'md',
        content: `
            <div class="space-y-4">
                <p class="text-sm text-gray-500 dark:text-gray-400">${t('sale.printFormat')}</p>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button onclick="ui.printSaleByMode('${sale.id}', 'ticket')" class="text-left rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700 transition">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-11 h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div>
                                <p class="font-bold dark:text-white">${t('sale.ticket80Name')}</p>
                                <p class="text-xs text-gray-500">${t('sale.ticket80Subtitle')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${t('sale.ticket80Desc')}</p>
                    </button>
                    <button onclick="ui.printSaleByMode('${sale.id}', 'a4')" class="text-left rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700 transition">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg">
                                <i class="fas fa-file-invoice"></i>
                            </div>
                            <div>
                                <p class="font-bold dark:text-white">${t('sale.a4Name')}</p>
                                <p class="text-xs text-gray-500">${t('sale.a4Subtitle')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${t('sale.a4Desc')}</p>
                    </button>
                    <button onclick="ui.printSaleByMode('${sale.id}', 'legal')" class="text-left rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700 transition">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-lg">
                                <i class="fas fa-file-contract"></i>
                            </div>
                            <div>
                                <p class="font-bold dark:text-white">${t('sale.legalName')}</p>
                                <p class="text-xs text-gray-500">${t('sale.legalSubtitle')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${t('sale.legalDesc')}</p>
                    </button>
                    <button onclick="ui.printSaleByMode('${sale.id}', 'proforma')" class="text-left rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700 transition">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-11 h-11 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <div>
                                <p class="font-bold dark:text-white">${t('sale.proformaName')}</p>
                                <p class="text-xs text-gray-500">${t('sale.proformaSubtitle')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${t('sale.proformaDesc')}</p>
                    </button>
                    <button onclick="ui.printSaleByMode('${sale.id}', 'delivery')" class="text-left rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:bg-primary-50/60 dark:hover:bg-gray-700 transition">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg">
                                <i class="fas fa-truck"></i>
                            </div>
                            <div>
                                <p class="font-bold dark:text-white">${t('sale.deliveryName')}</p>
                                <p class="text-xs text-gray-500">${t('sale.deliverySubtitle')}</p>
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${t('sale.deliveryDesc')}</p>
                    </button>
                </div>
                <div class="rounded-2xl bg-gray-50 dark:bg-gray-700/60 p-4 text-sm">
                    <div class="flex justify-between gap-2"><span class="text-gray-500">${t('sale.clientLabel')}</span><span class="font-semibold dark:text-white text-right">${this.escapeHtml(sale.clientName || t('sale.generalClient'))}</span></div>
                    <div class="flex justify-between gap-2 mt-1"><span class="text-gray-500">${t('sale.dateLabel')}</span><span class="dark:text-white text-right">${issuedAt.toLocaleString()}</span></div>
                    <div class="flex justify-between gap-2 mt-1"><span class="text-gray-500">${t('form.products')}</span><span class="dark:text-white">${totalItems}</span></div>
                    <div class="flex justify-between gap-2 mt-1"><span class="text-gray-500">${t('common.total')}</span><span class="font-bold text-primary-600">${this.formatMoney(sale.total || 0)}</span></div>
                </div>
            </div>
        `,
        footer: `
            <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200">${t('common.cancel')}</button>
        `
    });
};


proto.printSaleByMode = function(saleId, mode = 'ticket') {
    const sale = store.getById('sales', saleId);
    if (!sale) {
        this.showToast(t('toast.printError'), 'error');
        return;
    }
    this.closeModal();

    // Si es ticket y hay impresora térmica ESC/POS conectada, usar directamente
    const tp = window.ThermalPrinter;
    if (mode === 'ticket' && tp && tp.isConnected() && tp.shouldUseThermal()) {
        const settings = store.data.settings || {};
        tp.printTicket({ sale: sale, settings: settings, openDrawer: true })
            .then(() => this.showToast(t('pos.ticketPrinted', 'Ticket impreso'), 'success'))
            .catch(e => {
                console.warn('[printSaleByMode] Error térmico:', e);
                this.showToast('Error al imprimir ticket: ' + (e.message || 'Fallo'), 'error');
            });
        return;
    }

    setTimeout(() => this.printSaleDocument(sale, mode), 80);
};


proto.printSaleDocument = function(sale, mode = 'ticket') {
    const receiptWindow = window.open('', '_blank');
    if (!receiptWindow || !receiptWindow.document) {
        this.showToast(t('toast.printWindowError'), 'warning', 5000);
        return;
    }

    const builders = {
        ticket: () => this.buildTicketHtml(sale),
        a4: () => this.buildA4InvoiceHtml(sale),
        legal: () => this.buildLegalInvoiceHtml(sale),
        proforma: () => this.buildProformaHtml(sale),
        delivery: () => this.buildDeliveryNoteHtml(sale)
    };
    const html = (builders[mode] || builders.ticket)();
    let hasPrinted = false;
    const safePrint = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        try {
            receiptWindow.focus();
            receiptWindow.print();
        } catch (error) {
            console.error('No se pudo imprimir el documento:', error);
            this.showToast(t('toast.printErrorDoc'), 'error', 4000);
        }
    };

    try {
        receiptWindow.document.open();
        receiptWindow.document.write(html);
        receiptWindow.document.close();
        receiptWindow.onload = () => setTimeout(safePrint, 180);
        setTimeout(safePrint, 700);
    } catch (error) {
        console.error('No se pudo generar el documento:', error);
        this.showToast(t('toast.printWindowErrorDoc'), 'error', 4000);
    }
};


proto.buildTicketHtml = function(sale) {
    const settings = store.data.settings || {};
    const paperWidth = window.ThermalPrinter?.paperWidthMm || 58;
    const is58 = paperWidth <= 58;
    // Ancho en pixeles a 203 DPI (resolucion estandar de impresoras termicas)
    // 58mm = 2.283in * 203dpi ≈ 464px
    // 80mm = 3.150in * 203dpi ≈ 640px
    const PX_W = is58 ? 464 : 640;
    const PAD = 16;
    const FONT = '16px "Courier New", monospace';
    const FONT_BOLD = 'bold 16px "Courier New", monospace';
    const LH = 24; // line height
    const issuedAt = sale.date ? new Date(sale.date) : new Date();

    // Pre-calcular lineas para saber la altura del canvas
    const items = sale.items || [];
    const taxSummary = sale.taxSummary || [];
    const hasMultiTax = taxSummary.length > 1;

    let numLines = 0;
    numLines += 1; // business name
    if (settings.address) numLines += 1;
    if (settings.phone) numLines += 1;
    numLines += 3; // separadores + titulo
    numLines += 4; // fecha, ticket, cliente, pago
    numLines += 1; // linea separadora
    for (const item of items) {
        numLines += 1; // nombre + total
        numLines += 1; // qty x price
        if (item.discount > 0) numLines += 1;
    }
    numLines += 1; // separador
    numLines += 3; // subtotal, descuento, iva
    if (hasMultiTax) numLines += taxSummary.length;
    numLines += 1; // separador
    numLines += 1; // total
    if (sale.cashReceived) numLines += 2;
    numLines += 2; // separador + gracias
    if (settings.receiptQR && sale.id) numLines += 2;
    numLines += 1; // padding final

    const PX_H = Math.max(400, numLines * LH + PAD * 3);

    // Traducciones para el script de impresión
    const T = {
        title: JSON.stringify(t('ticket.title','TICKET DE VENTA')),
        date: JSON.stringify(t('ticket.date','Fecha:')),
        ticket: JSON.stringify(t('ticket.ticket','Ticket:')),
        client: JSON.stringify(t('ticket.client','Cliente:')),
        general: JSON.stringify(t('pos.generalClient','General')),
        seller: JSON.stringify(t('ticket.seller','Vendedor:')),
        payment: JSON.stringify(t('ticket.payment','Pago:')),
        subtotal: JSON.stringify(t('ticket.subtotal','SUBTOTAL:')),
        discount: JSON.stringify(t('ticket.discount','DESCUENTO:')),
        tax: JSON.stringify(t('ticket.tax','IVA INCLUIDO:')),
        total: JSON.stringify(t('ticket.total','TOTAL:')),
        received: JSON.stringify(t('ticket.received','Recibido:')),
        change: JSON.stringify(t('ticket.change','Cambio:')),
        thanks: JSON.stringify(t('ticket.thanks','Gracias por su visita!')),
        phone: JSON.stringify(t('ticket.phone','Tel: ')),
        taxId: JSON.stringify(t('ticket.taxId','NIF: ')),
        perUnit: JSON.stringify(t('pos.perUnit','und x')),
        desc: JSON.stringify(t('ticket.discount','Desc:'))
    };

    // Funciones de dibujo que se inyectan como strings en el script de la ventana
    const drawScript = `
(function(){
    var canvas = document.getElementById('ticketCanvas');
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var PAD = ${PAD}, LH = ${LH};
    var x = PAD, y = PAD + LH;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';

    function setFont(bold){ ctx.font = bold ? '${FONT_BOLD}' : '${FONT}'; }
    function measure(t){ return ctx.measureText(t).width; }
    function txt(t){ setFont(false); ctx.fillText(t, x, y); y += LH; }
    function txtBold(t){ setFont(true); ctx.fillText(t, x, y); y += LH; }
    function center(t){ setFont(false); var w = measure(t); ctx.fillText(t, (W - w) / 2, y); y += LH; }
    function centerBold(t){ setFont(true); var w = measure(t); ctx.fillText(t, (W - w) / 2, y); y += LH; }
    function right(t){ setFont(false); var w = measure(t); ctx.fillText(t, W - PAD - w, y); y += LH; }
    function rightBold(t){ setFont(true); var w = measure(t); ctx.fillText(t, W - PAD - w, y); y += LH; }
    function twoCols(l, r){ setFont(false); var rw = measure(r); ctx.fillText(l, x, y); ctx.fillText(r, W - PAD - rw, y); y += LH; }
    function twoColsBoldL(l, r){ setFont(true); var rw = measure(r); ctx.fillText(l, x, y); setFont(false); ctx.fillText(r, W - PAD - rw, y); y += LH; }
    function sep(){ ctx.beginPath(); ctx.moveTo(PAD, y - 6); ctx.lineTo(W - PAD, y - 6); ctx.stroke(); y += 4; }
    function gap(){ y += 4; }

    // Header
    centerBold(${JSON.stringify(settings.businessName || 'RIVER-WALL')});
    if (${JSON.stringify(settings.address || '')}) center(${JSON.stringify(settings.address || '')});
    if (${JSON.stringify(settings.phone || '')}) center(${JSON.stringify(t('ticket.phone','Tel: ') + ' ')} + ${JSON.stringify(settings.phone || '')});
    if (${JSON.stringify(settings.taxId || '')}) center(${JSON.stringify(t('ticket.taxId','NIF: ') + ' ')} + ${JSON.stringify(settings.taxId || '')});
    gap();
    sep();
    centerBold(${JSON.stringify(t('ticket.title','TICKET DE VENTA'))});
    sep();

    // Metadata
    twoCols(T.date, ${JSON.stringify(issuedAt.toLocaleString('es-ES'))});
    twoCols(T.ticket, ${JSON.stringify('#' + sale.ticket)});
    twoCols(T.client, ${JSON.stringify(sale.clientName || T.general)});
    ${sale.seller ? `twoCols(${JSON.stringify(t('ticket.seller','Vendedor:'))}, ${JSON.stringify(sale.seller)});` : ''}
    twoCols(${JSON.stringify(t('ticket.payment','Pago:'))}, ${JSON.stringify(this.getPaymentMethodLabel(sale.paymentMethod))});
    sep();

    // Items
    ${items.map(item => {
        const qty = Number(item.qty || item.quantity || 1);
        const price = Number(item.price || 0);
        const total = price * qty;
        const name = (item.name || t('pos.product','Producto')).substring(0, 28);
        const qtyStr = qty + 'x ' + name;
        const totalStr = this.formatMoney(total);
        const unitStr = '   ' + this.formatQuantity(qty) + ' ' + t('pos.perUnit','und x') + ' ' + this.formatMoney(price);
        const discStr = item.discount > 0 ? `twoCols(${JSON.stringify('   ' + t('ticket.discount','Desc:'))}, '-' + ${JSON.stringify(this.formatMoney(item.discount))});` : '';
        return `
    twoColsBoldL(${JSON.stringify(qtyStr)}, ${JSON.stringify(totalStr)});
    txt(${JSON.stringify(unitStr)});
    ${discStr}`;
    }).join('')}

    sep();

    // Totales
    twoCols(${JSON.stringify(t('ticket.subtotal','SUBTOTAL:'))}, ${JSON.stringify(this.formatMoney(sale.subtotal || 0))});
    ${sale.discount > 0 ? `twoCols(${JSON.stringify(t('ticket.discount','DESCUENTO:'))}, '-' + ${JSON.stringify(this.formatMoney(sale.discount))});` : ''}
    ${sale.tax > 0 ? `twoCols(${JSON.stringify(t('ticket.tax','IVA INCLUIDO:'))}, ${JSON.stringify(this.formatMoney(sale.tax))});` : ''}
    ${hasMultiTax ? taxSummary.map(t => `twoCols(${JSON.stringify(t('ticket.tax','IVA') + ' ' + t.rate + '%:')}, ${JSON.stringify(this.formatMoney(t.tax))});`).join('') : ''}
    sep();
    twoColsBoldL(${JSON.stringify(t('ticket.total','TOTAL:'))}, ${JSON.stringify(this.formatMoney(sale.total || 0))});

    ${sale.cashReceived ? `
    sep();
    twoCols(${JSON.stringify(t('ticket.received','Recibido:'))}, ${JSON.stringify(this.formatMoney(sale.cashReceived))});
    ${(Number(sale.cashReceived) - Number(sale.total || 0)) > 0 ? `twoCols(${JSON.stringify(t('ticket.change','Cambio:'))}, ${JSON.stringify(this.formatMoney(Number(sale.cashReceived) - Number(sale.total || 0)))});` : ''}
    ` : ''}

    sep();
    gap();
    center(${JSON.stringify(t('ticket.thanks','Gracias por su visita!'))});
    ${settings.receiptQR && sale.id ? `
    gap();
    center('dwall-db.web.app/track.html?id=${sale.id}');
    ` : ''}

    // Auto-print
    var done = false;
    function doPrint(){ if(done) return; done = true; window.print(); }
    window.onload = function(){ setTimeout(doPrint, 200); };
    setTimeout(doPrint, 800);
})();
    `.trim();

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Ticket #${sale.ticket}</title>
<style>
@media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    canvas { max-width: 100%; height: auto; }
}
body { margin: 0; padding: 0; background: #fff; text-align: center; }
canvas { display: block; margin: 0 auto; width: ${paperWidth}mm; height: auto; }
</style>
</head>
<body>
<canvas id="ticketCanvas" width="${PX_W}" height="${PX_H}"></canvas>
<script>
${drawScript}
</script>
</body>
</html>`;
};


proto.buildA4InvoiceHtml = function(sale) {
    const settings = store.data.settings || {};
    const businessName = this.escapeHtml(settings.businessName || 'RIVER-WALL');
    const address = this.escapeHtml(settings.address || 'Dirección no configurada');
    const phone = this.escapeHtml(settings.phone || '-');
    const email = this.escapeHtml(settings.email || '');
    const issuedAt = sale.date ? new Date(sale.date) : new Date();
    const itemsCount = (sale.items || []).reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    
    // Generar desglose de impuestos
    const taxSummary = sale.taxSummary || [];
    const hasMultipleTaxes = taxSummary.length > 1;
    const taxBreakdownHtml = hasMultipleTaxes 
        ? taxSummary.map(t => `<div class="totals-row" style="font-size: 13px; color: #64748b;"><span>IVA ${t.rate}% incluido (base: ${this.formatMoney(t.base)})</span><span>${this.formatMoney(t.tax)}</span></div>`).join('')
        : '';
    
    const rows = (sale.items || []).map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(item.name || 'Producto')}</td>
            <td class="text-center">${this.formatQuantity(item.qty || 0)} ${this.escapeHtml(item.presentationShortLabel || 'und')}</td>
            <td class="text-right">${this.formatMoney(item.price || 0)}</td>
            <td class="text-right strong">${this.formatMoney((item.price || 0) * (item.qty || 0))}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('sale.a4Title','Factura A4')} #${sale.ticket}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                * { box-sizing: border-box; }
                body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2ff; color: #0f172a; }
                .sheet { max-width: 100%; margin: 0 auto; background: #fff; border-radius: 20px; padding: 26px; box-shadow: 0 16px 45px rgba(15, 23, 42, 0.12); }
                .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #e5e7eb; }
                .brand-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: linear-gradient(135deg, #1d4ed8, #0f766e); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
                .brand-title { font-size: 30px; font-weight: 800; margin: 10px 0 6px; color: #0f172a; }
                .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
                .invoice-box { min-width: 250px; border: 1px solid #dbeafe; background: linear-gradient(135deg, #eff6ff, #ecfeff); border-radius: 18px; padding: 18px; }
                .invoice-box h1 { margin: 0 0 10px; font-size: 24px; color: #1d4ed8; }
                .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
                .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; background: #f8fafc; }
                .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 6px; }
                .card .value { font-size: 15px; font-weight: 700; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                thead th { background: #0f172a; color: #fff; padding: 12px 10px; font-size: 12px; text-align: left; }
                tbody td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .strong { font-weight: 700; }
                .totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
                .totals-box { width: 320px; border-radius: 18px; background: #0f172a; color: #fff; padding: 18px; }
                .totals-row { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; font-size: 14px; }
                .totals-row.total { font-size: 20px; font-weight: 800; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.2); }
                .footer-note { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; text-align: center; }
                @media print {
                    body { background: #fff; }
                    .sheet { box-shadow: none; border-radius: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div>
                        ${this.getLogoHtml(settings, 'a4')}
                        <span class="brand-badge">FACTURA PREMIUM A4</span>
                        <div class="brand-title">${businessName}</div>
                        <div class="muted">
                            ${address}<br>
                            ${t('ticket.phone','Tel:')} ${phone}${email ? `<br>Email: ${email}` : ''}
                        </div>
                    </div>
                    <div class="invoice-box">
                        <h1>#${sale.ticket}</h1>
                        <div class="muted"><strong>${t('ticket.date','Fecha:')}</strong> ${issuedAt.toLocaleString()}</div>
                        <div class="muted"><strong>${t('pos.paymentMethod','Método de pago:')}</strong> ${this.escapeHtml(this.getPaymentMethodLabel(sale.paymentMethod))}</div>
                        <div class="muted"><strong>${t('common.status','Estado:')}</strong> ${this.escapeHtml(sale.status || 'completed')}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <div class="label">${t('sale.clientLabel','Cliente')}</div>
                        <div class="value">${this.escapeHtml(sale.clientName || 'Cliente general')}</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('form.products','Productos')}</div>
                        <div class="value">${itemsCount} unidades</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('sale.document','Documento')}</div>
                        <div class="value">${t('sale.invoiceDoc','Factura / Recibo de venta')}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 52px;">#</th>
                            <th>${t('form.description','Descripción')}</th>
                            <th class="text-center" style="width: 80px;">${t('form.qty','Cant.')}</th>
                            <th class="text-right" style="width: 120px;">${t('ticket.price','Precio')}</th>
                            <th class="text-right" style="width: 140px;">${t('sale.amount','Importe')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals-wrap">
                    <div class="totals-box">
                        <div class="totals-row"><span>${t('sale.subtotalLabel','Subtotal')}</span><strong>${this.formatMoney(sale.subtotal || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.discountLabel','Descuento')}</span><strong>- ${this.formatMoney(sale.discount || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.taxLabel','IVA incluido')}</span><strong>${this.formatMoney(sale.tax || 0)}</strong></div>
                        ${taxBreakdownHtml}
                        <div class="totals-row total"><span>${t('sale.totalLabel','TOTAL')}</span><span>${this.formatMoney(sale.total || 0)}</span></div>
                    </div>
                </div>

                <div class="footer-note">
                    ${t('sale.footerThanks','Gracias por su compra')}. Documento generado por River-Wall para impresión en formato premium A4.
                </div>
            </div>
        </body>
        </html>
    `;
};


proto.buildLegalInvoiceHtml = function(sale) {
    const settings = store.data.settings || {};
    const businessName = this.escapeHtml(settings.businessName || 'RIVER-WALL');
    const address = this.escapeHtml(settings.address || 'Dirección no configurada');
    const phone = this.escapeHtml(settings.phone || '-');
    const email = this.escapeHtml(settings.email || '');
    const emitterNif = this.escapeHtml(settings.taxId || 'No configurado');
    const client = sale.clientId ? store.getById('clients', sale.clientId) : null;
    const receiverNif = client?.taxId ? this.escapeHtml(client.taxId) : (t('sale.receiverNif') + ': No aplica');
    const clientName = this.escapeHtml(sale.clientName || t('sale.generalClient'));
    const issuedAt = sale.date ? new Date(sale.date) : new Date();
    const invoiceNumber = `FAC-${String(sale.ticket || '000000').padStart(6, '0')}`;
    const itemsCount = (sale.items || []).reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    
    const taxSummary = sale.taxSummary || [];
    const hasMultipleTaxes = taxSummary.length > 1;
    const taxBreakdownHtml = hasMultipleTaxes 
        ? taxSummary.map(t => `<div class="totals-row" style="font-size: 13px; color: #64748b;"><span>IVA ${t.rate}% incluido (base: ${this.formatMoney(t.base)})</span><span>${this.formatMoney(t.tax)}</span></div>`).join('')
        : '';
    
    const rows = (sale.items || []).map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(item.name || 'Producto')}</td>
            <td class="text-center">${this.formatQuantity(item.qty || 0)} ${this.escapeHtml(item.presentationShortLabel || 'und')}</td>
            <td class="text-right">${this.formatMoney(item.price || 0)}</td>
            <td class="text-right strong">${this.formatMoney((item.price || 0) * (item.qty || 0))}</td>
        </tr>
    `).join('');

    const qrData = encodeURIComponent(`RIVERWALL|${invoiceNumber}|${emitterNif}|${sale.total || 0}|${sale.date || ''}|${client?.taxId || ''}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('sale.legalTitle')} #${sale.ticket}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                * { box-sizing: border-box; }
                body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2ff; color: #0f172a; }
                .sheet { max-width: 100%; margin: 0 auto; background: #fff; border-radius: 20px; padding: 26px; box-shadow: 0 16px 45px rgba(15, 23, 42, 0.12); }
                .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #e5e7eb; }
                .brand-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: linear-gradient(135deg, #059669, #047857); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
                .brand-title { font-size: 30px; font-weight: 800; margin: 10px 0 6px; color: #0f172a; }
                .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
                .invoice-box { min-width: 250px; border: 1px solid #dbeafe; background: linear-gradient(135deg, #eff6ff, #ecfeff); border-radius: 18px; padding: 18px; }
                .invoice-box h1 { margin: 0 0 10px; font-size: 22px; color: #1d4ed8; }
                .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
                .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; background: #f8fafc; }
                .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 6px; }
                .card .value { font-size: 15px; font-weight: 700; color: #0f172a; }
                .legal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 14px 0; }
                .legal-card { border: 1px solid #d1fae5; border-radius: 16px; padding: 14px; background: #ecfdf5; }
                .legal-card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #059669; margin-bottom: 6px; }
                .legal-card .value { font-size: 15px; font-weight: 700; color: #064e3b; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                thead th { background: #0f172a; color: #fff; padding: 12px 10px; font-size: 12px; text-align: left; }
                tbody td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .strong { font-weight: 700; }
                .totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
                .totals-box { width: 320px; border-radius: 18px; background: #0f172a; color: #fff; padding: 18px; }
                .totals-row { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; font-size: 14px; }
                .totals-row.total { font-size: 20px; font-weight: 800; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.2); }
                .qr-wrap { text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; }
                .qr-wrap img { width: 120px; height: 120px; }
                .qr-wrap .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-top: 8px; }
                .footer-note { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; text-align: center; }
                @media print {
                    body { background: #fff; }
                    .sheet { box-shadow: none; border-radius: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div>
                        ${this.getLogoHtml(settings, 'a4')}
                        <span class="brand-badge">${t('sale.legalTitle')}</span>
                        <div class="brand-title">${businessName}</div>
                        <div class="muted">
                            ${address}<br>
                            ${t('ticket.phone','Tel:')} ${phone}${email ? `<br>Email: ${email}` : ''}
                        </div>
                    </div>
                    <div class="invoice-box">
                        <h1>${invoiceNumber}</h1>
                        <div class="muted"><strong>${t('sale.dateLabel')}:</strong> ${issuedAt.toLocaleString()}</div>
                        <div class="muted"><strong>${t('sale.emitterNif')}:</strong> ${emitterNif}</div>
                        <div class="muted"><strong>${t('common.status')}:</strong> ${this.escapeHtml(sale.status || 'completed')}</div>
                    </div>
                </div>

                <div class="legal-grid">
                    <div class="legal-card">
                        <div class="label">${t('sale.emitterNif')}</div>
                        <div class="value">${emitterNif}</div>
                    </div>
                    <div class="legal-card">
                        <div class="label">${t('sale.receiverNif')}</div>
                        <div class="value">${client?.taxId ? this.escapeHtml(client.taxId) : 'No aplica'}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <div class="label">${t('sale.clientLabel')}</div>
                        <div class="value">${clientName}</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('form.products')}</div>
                        <div class="value">${itemsCount} unidades</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('sale.document')}</div>
                        <div class="value">${t('sale.legalTitle')}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 52px;">#</th>
                            <th>${t('form.description','Descripción')}</th>
                            <th class="text-center" style="width: 80px;">${t('form.qty','Cant.')}</th>
                            <th class="text-right" style="width: 120px;">${t('ticket.price','Precio')}</th>
                            <th class="text-right" style="width: 140px;">${t('sale.amount','Importe')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals-wrap">
                    <div class="totals-box">
                        <div class="totals-row"><span>${t('sale.subtotalLabel')}</span><strong>${this.formatMoney(sale.subtotal || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.discountLabel')}</span><strong>- ${this.formatMoney(sale.discount || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.taxLabel','IVA incluido')}</span><strong>${this.formatMoney(sale.tax || 0)}</strong></div>
                        ${taxBreakdownHtml}
                        <div class="totals-row total"><span>${t('sale.totalLabel')}</span><span>${this.formatMoney(sale.total || 0)}</span></div>
                    </div>
                </div>

                <div class="qr-wrap">
                    <img src="${qrUrl}" alt="QR" onerror="this.style.display='none'">
                    <div class="label">${t('sale.qrValidation')}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${invoiceNumber} · ${emitterNif}</div>
                </div>

                <div class="footer-note">
                    ${t('sale.legalFooter')}
                </div>
            </div>
        </body>
        </html>
    `;
};


proto.buildProformaHtml = function(sale) {
    const settings = store.data.settings || {};
    const businessName = this.escapeHtml(settings.businessName || 'RIVER-WALL');
    const address = this.escapeHtml(settings.address || 'Dirección no configurada');
    const phone = this.escapeHtml(settings.phone || '-');
    const email = this.escapeHtml(settings.email || '');
    const issuedAt = sale.date ? new Date(sale.date) : new Date();
    const itemsCount = (sale.items || []).reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    
    const taxSummary = sale.taxSummary || [];
    const hasMultipleTaxes = taxSummary.length > 1;
    const taxBreakdownHtml = hasMultipleTaxes 
        ? taxSummary.map(t => `<div class="totals-row" style="font-size: 13px; color: #64748b;"><span>IVA ${t.rate}% incluido (base: ${this.formatMoney(t.base)})</span><span>${this.formatMoney(t.tax)}</span></div>`).join('')
        : '';
    
    const rows = (sale.items || []).map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(item.name || 'Producto')}</td>
            <td class="text-center">${this.formatQuantity(item.qty || 0)} ${this.escapeHtml(item.presentationShortLabel || 'und')}</td>
            <td class="text-right">${this.formatMoney(item.price || 0)}</td>
            <td class="text-right strong">${this.formatMoney((item.price || 0) * (item.qty || 0))}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('sale.proformaTitle')} #${sale.ticket}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                * { box-sizing: border-box; }
                body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2ff; color: #0f172a; }
                .sheet { max-width: 100%; margin: 0 auto; background: #fff; border-radius: 20px; padding: 26px; box-shadow: 0 16px 45px rgba(15, 23, 42, 0.12); }
                .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #e5e7eb; }
                .brand-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
                .brand-title { font-size: 30px; font-weight: 800; margin: 10px 0 6px; color: #0f172a; }
                .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
                .invoice-box { min-width: 250px; border: 1px solid #f3e8ff; background: linear-gradient(135deg, #faf5ff, #f3e8ff); border-radius: 18px; padding: 18px; }
                .invoice-box h1 { margin: 0 0 10px; font-size: 24px; color: #7c3aed; }
                .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
                .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; background: #f8fafc; }
                .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 6px; }
                .card .value { font-size: 15px; font-weight: 700; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                thead th { background: #0f172a; color: #fff; padding: 12px 10px; font-size: 12px; text-align: left; }
                tbody td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .strong { font-weight: 700; }
                .totals-wrap { display: flex; justify-content: flex-end; margin-top: 18px; }
                .totals-box { width: 320px; border-radius: 18px; background: #0f172a; color: #fff; padding: 18px; }
                .totals-row { display: flex; justify-content: space-between; gap: 12px; margin: 8px 0; font-size: 14px; }
                .totals-row.total { font-size: 20px; font-weight: 800; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.2); }
                .footer-note { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; text-align: center; }
                .stamp { display: inline-block; margin-top: 18px; padding: 10px 24px; border: 3px dashed #7c3aed; color: #7c3aed; font-weight: 800; font-size: 14px; text-transform: uppercase; border-radius: 12px; }
                @media print {
                    body { background: #fff; }
                    .sheet { box-shadow: none; border-radius: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div>
                        ${this.getLogoHtml(settings, 'a4')}
                        <span class="brand-badge">${t('sale.proformaTitle')}</span>
                        <div class="brand-title">${businessName}</div>
                        <div class="muted">
                            ${address}<br>
                            ${t('ticket.phone','Tel:')} ${phone}${email ? `<br>Email: ${email}` : ''}
                        </div>
                    </div>
                    <div class="invoice-box">
                        <h1>REF-${sale.ticket}</h1>
                        <div class="muted"><strong>${t('sale.dateLabel')}:</strong> ${issuedAt.toLocaleString()}</div>
                        <div class="muted"><strong>${t('pos.paymentMethod')}:</strong> ${this.escapeHtml(this.getPaymentMethodLabel(sale.paymentMethod))}</div>
                        <div class="muted"><strong>${t('common.status')}:</strong> ${this.escapeHtml(sale.status || 'completed')}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <div class="label">${t('sale.clientLabel')}</div>
                        <div class="value">${this.escapeHtml(sale.clientName || t('sale.generalClient'))}</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('form.products')}</div>
                        <div class="value">${itemsCount} unidades</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('sale.document')}</div>
                        <div class="value">${t('sale.proformaTitle')}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 52px;">#</th>
                            <th>${t('form.description','Descripción')}</th>
                            <th class="text-center" style="width: 80px;">${t('form.qty','Cant.')}</th>
                            <th class="text-right" style="width: 120px;">${t('ticket.price','Precio')}</th>
                            <th class="text-right" style="width: 140px;">${t('sale.amount','Importe')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="totals-wrap">
                    <div class="totals-box">
                        <div class="totals-row"><span>${t('sale.subtotalLabel')}</span><strong>${this.formatMoney(sale.subtotal || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.discountLabel')}</span><strong>- ${this.formatMoney(sale.discount || 0)}</strong></div>
                        <div class="totals-row"><span>${t('sale.taxLabel','IVA incluido')}</span><strong>${this.formatMoney(sale.tax || 0)}</strong></div>
                        ${taxBreakdownHtml}
                        <div class="totals-row total"><span>${t('sale.totalLabel')}</span><span>${this.formatMoney(sale.total || 0)}</span></div>
                    </div>
                </div>

                <div style="text-align: center;">
                    <div class="stamp">${t('sale.proformaTitle')} — SIN VALOR FISCAL</div>
                </div>

                <div class="footer-note">
                    ${t('sale.proformaFooter')}
                </div>
            </div>
        </body>
        </html>
    `;
};


proto.buildDeliveryNoteHtml = function(sale) {
    const settings = store.data.settings || {};
    const businessName = this.escapeHtml(settings.businessName || 'RIVER-WALL');
    const address = this.escapeHtml(settings.address || 'Dirección no configurada');
    const phone = this.escapeHtml(settings.phone || '-');
    const email = this.escapeHtml(settings.email || '');
    const issuedAt = sale.date ? new Date(sale.date) : new Date();
    const itemsCount = (sale.items || []).reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
    
    const rows = (sale.items || []).map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${this.escapeHtml(item.name || 'Producto')}</td>
            <td class="text-center">${this.formatQuantity(item.qty || 0)} ${this.escapeHtml(item.presentationShortLabel || 'und')}</td>
        </tr>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${t('sale.deliveryTitle')} #${sale.ticket}</title>
            <style>
                @page { size: A4; margin: 12mm; }
                * { box-sizing: border-box; }
                body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #eef2ff; color: #0f172a; }
                .sheet { max-width: 100%; margin: 0 auto; background: #fff; border-radius: 20px; padding: 26px; box-shadow: 0 16px 45px rgba(15, 23, 42, 0.12); }
                .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 18px; border-bottom: 2px solid #e5e7eb; }
                .brand-badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: linear-gradient(135deg, #ea580c, #c2410c); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
                .brand-title { font-size: 30px; font-weight: 800; margin: 10px 0 6px; color: #0f172a; }
                .muted { color: #64748b; font-size: 13px; line-height: 1.6; }
                .invoice-box { min-width: 250px; border: 1px solid #ffedd5; background: linear-gradient(135deg, #fff7ed, #ffedd5); border-radius: 18px; padding: 18px; }
                .invoice-box h1 { margin: 0 0 10px; font-size: 24px; color: #c2410c; }
                .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 20px 0; }
                .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px; background: #f8fafc; }
                .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; margin-bottom: 6px; }
                .card .value { font-size: 15px; font-weight: 700; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                thead th { background: #0f172a; color: #fff; padding: 12px 10px; font-size: 12px; text-align: left; }
                tbody td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
                .text-center { text-align: center; }
                .footer-note { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 12px; text-align: center; }
                .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-top: 28px; }
                .sign-box { border-top: 1px solid #0f172a; padding-top: 8px; margin-top: 60px; }
                .sign-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
                @media print {
                    body { background: #fff; }
                    .sheet { box-shadow: none; border-radius: 0; padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <div>
                        ${this.getLogoHtml(settings, 'a4')}
                        <span class="brand-badge">${t('sale.deliveryTitle')}</span>
                        <div class="brand-title">${businessName}</div>
                        <div class="muted">
                            ${address}<br>
                            ${t('ticket.phone','Tel:')} ${phone}${email ? `<br>Email: ${email}` : ''}
                        </div>
                    </div>
                    <div class="invoice-box">
                        <h1>BL-${sale.ticket}</h1>
                        <div class="muted"><strong>${t('sale.dateLabel')}:</strong> ${issuedAt.toLocaleString()}</div>
                        <div class="muted"><strong>${t('common.status')}:</strong> ${this.escapeHtml(sale.status || 'completed')}</div>
                    </div>
                </div>

                <div class="grid">
                    <div class="card">
                        <div class="label">${t('sale.clientLabel')}</div>
                        <div class="value">${this.escapeHtml(sale.clientName || t('sale.generalClient'))}</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('form.products')}</div>
                        <div class="value">${itemsCount} unidades</div>
                    </div>
                    <div class="card">
                        <div class="label">${t('sale.document')}</div>
                        <div class="value">${t('sale.deliveryTitle')}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 52px;">#</th>
                            <th>Descripción</th>
                            <th class="text-center" style="width: 140px;">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer-note">
                    ${t('sale.deliveryFooter')}
                </div>

                <div class="signatures">
                    <div>
                        <div class="sign-box"></div>
                        <div class="sign-label">Entregado por</div>
                    </div>
                    <div>
                        <div class="sign-box"></div>
                        <div class="sign-label">Recibido conforme</div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};


// ==================== NUMPAD TOUCH ====================

proto.showNumpadQty = function(index) {
    const item = AppState.posCart[index];
    if (!item) return;
    const unitsPerSale = Math.max(1, Number(item.unitsPerSale || 1));
    
    ui.showNumpad({
        mode: 'qty',
        title: 'Cantidad: ' + (item.baseName || item.name),
        onConfirm: (val) => {
            const proposedQty = Math.max(0, Math.floor(val));
            if (proposedQty <= 0) {
                AppState.posCart.splice(index, 1);
                ui.updateCartUI();
                return;
            }
            const availableStock = item.lotNumber || item.expiryDate
                ? ui.getLotStockInStore(item.id, item.lotNumber, item.expiryDate)
                : ui.getProductStockInStore(item.id, item.variantKey || '');
            const reservedWithoutCurrent = item.lotNumber || item.expiryDate
                ? ui.getLotReservedCartStock(item.id, item.lotNumber, item.expiryDate, item.cartKey)
                : ui.getProductReservedCartStock(item.id, item.variantKey || '', item.cartKey);
            if (reservedWithoutCurrent + (proposedQty * unitsPerSale) > availableStock) {
                ui.showToast(t('pos.insufficientStock', 'Stock insuficiente'), 'warning');
                return;
            }
            item.qty = proposedQty;
            item.stockUnits = proposedQty * unitsPerSale;
            ui.updateCartUI();
        }
    });
};


// ==================== POS ENHANCEMENTS (1-16) ====================

proto.getPOSConnectionStatus = function() {
    const pendingCount = store.getPendingOfflineOperationCount();
    if (!navigator.onLine) {
        return { dotClass: 'bg-red-500', label: t('pos.offline') + (pendingCount ? ` · ${pendingCount}` : '') };
    }
    if (pendingCount > 0) {
        return { dotClass: 'bg-amber-400', label: `${pendingCount} ${t('pos.pendingSync')}` };
    }
    return { dotClass: 'bg-emerald-500', label: t('pos.online') };
};

proto.setTicketNumber = function(delta) {
    const terminal = store.getActivePosTerminal();
    const code = terminal?.code || 'C1';
    const prefix = code + '-';
    const parts = String(this.currentTicket || '').split('-');
    let currentNum = parseInt(parts[parts.length - 1], 10) || 1001;
    const proposed = currentNum + delta;
    if (proposed < 1) return;
    const proposedTicket = prefix + proposed;
    // Check sales and reserved tickets for collisions (same terminal prefix only)
    const collision = (store.data.sales || []).some(s => {
        const t = String(s.ticket || '');
        return t.startsWith(prefix) && parseInt(t.slice(prefix.length), 10) === proposed;
    });
    if (collision || (delta !== 0 && this._reservedTickets && this._reservedTickets.has(proposedTicket))) {
        this.showToast(t('pos.ticketExists','Ese número de ticket ya existe'), 'warning');
        return;
    }
    // Release old reservation, take new one
    if (this._reservedTickets) {
        this._reservedTickets.delete(this.currentTicket);
        this._reservedTickets.add(proposedTicket);
    }
    this.currentTicket = proposedTicket;
    const el = document.getElementById('posTicketNum');
    if (el) el.textContent = this.currentTicket;
};

proto.savePOSNote = function(value) {
    this.posNote = value || '';
};

proto.holdTicket = function() {
    if (AppState.posCart.length === 0) {
        this.showToast(t('pos.emptyCart','El carrito está vacío'), 'warning');
        return;
    }
    const clientId = document.getElementById('posClient')?.value || '';
    const pending = {
        id: 'pending_' + Date.now(),
        ticketNum: this.currentTicket,
        createdAt: Date.now(),
        cart: JSON.parse(JSON.stringify(AppState.posCart)),
        clientId,
        discount: this.discount,
        posNote: this.posNote,
        seller: AppState.user?.displayName || AppState.user?.email || ''
    };
    store.add('pendingTickets', pending);
    AppState.posCart = [];
    this.discount = 0;
    this.posNote = '';
    this.showToast(t('pos.ticketHeld','Ticket pausado'), 'success');
    this.updateCartUI();
    setTimeout(() => this.navigateTo('pos'), 100);
};

proto.showPendingTickets = function() {
    const pending = store.get('pendingTickets').sort((a, b) => b.createdAt - a.createdAt);
    if (pending.length === 0) {
        this.showToast(t('pos.noPendingTickets','No hay tickets pendientes'), 'info');
        return;
    }
    this.openModal({
        title: t('pos.pendingTickets'),
        size: 'md',
        content: `
            <div class="space-y-2">
                ${pending.map(pt => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div>
                            <p class="font-semibold dark:text-white">Ticket #${pt.ticketNum}</p>
                            <p class="text-xs text-gray-500">${new Date(pt.createdAt).toLocaleString()} · ${pt.cart.length} productos</p>
                        </div>
                        <button onclick="ui.resumePendingTicket('${pt.id}')" class="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold">${t('pos.resumeTicket')}</button>
                    </div>
                `).join('')}
            </div>
        `
    });
};

proto.resumePendingTicket = function(id) {
    const pending = store.get('pendingTickets').find(pt => pt.id === id);
    if (!pending) return;
    if (AppState.posCart.length > 0) {
        if (!confirm(t('pos.confirmReplaceCart', 'Hay un carrito activo. ¿Reemplazar con el ticket pendiente?'))) return;
    }
    AppState.posCart = JSON.parse(JSON.stringify(pending.cart));
    this.discount = pending.discount || 0;
    this.posNote = pending.posNote || '';
    this.currentTicket = pending.ticketNum;
    this.closeModal();
    setTimeout(() => {
        const clientSel = document.getElementById('posClient');
        if (clientSel && pending.clientId) clientSel.value = pending.clientId;
        this.updateCartUI();
        const ticketEl = document.getElementById('posTicketNum');
        if (ticketEl) ticketEl.textContent = this.currentTicket;
        const notesEl = document.getElementById('posNotes');
        if (notesEl) notesEl.value = this.posNote;
    }, 150);
    store.data.pendingTickets = store.data.pendingTickets.filter(pt => pt.id !== id);
    store.save('pendingTickets');
    this.showToast(t('pos.ticketResumed','Ticket reanudado'), 'success');
};

proto.toggleSplitPayment = function() {
    this.splitPaymentEnabled = !this.splitPaymentEnabled;
    const toggle = document.getElementById('splitPaymentToggle');
    const section = document.getElementById('splitPaymentSection');
    const grid = document.getElementById('paymentMethodGrid');
    const cashSection = document.getElementById('cashInputSection');
    const changeProminent = document.getElementById('changeDisplayProminent');
    if (toggle) {
        toggle.className = `relative w-8 h-4 rounded-full transition-colors ${this.splitPaymentEnabled ? 'bg-emerald-500' : 'bg-white/20'}`;
        const inner = toggle.querySelector('span');
        if (inner) inner.className = `absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${this.splitPaymentEnabled ? 'translate-x-4' : ''}`;
    }
    if (section) section.classList.toggle('hidden', !this.splitPaymentEnabled);
    if (grid) grid.classList.toggle('hidden', this.splitPaymentEnabled);
    if (cashSection) cashSection.classList.toggle('hidden', this.splitPaymentEnabled || this.paymentMethod !== 'cash');
    if (changeProminent) changeProminent.classList.add('hidden');
};

proto.updateSplitPayment = function() {
    const pricing = this.getCartPricingBreakdown();
    const cash = parseFloat(document.getElementById('split_cash')?.value) || 0;
    const card = parseFloat(document.getElementById('split_card')?.value) || 0;
    const mobile = parseFloat(document.getElementById('split_mobile')?.value) || 0;
    const sum = cash + card + mobile;
    const validation = document.getElementById('splitValidation');
    if (validation) {
        const diff = pricing.total - sum;
        if (Math.abs(diff) <= 0.01) {
            validation.textContent = '✓ Correcto';
            validation.className = 'text-xs mt-1 text-center h-4 text-emerald-400';
        } else if (diff > 0) {
            validation.textContent = `${t('pos.splitMissing','Faltan: ')}${this.formatMoney(diff)}`;
            validation.className = 'text-xs mt-1 text-center h-4 text-amber-400';
        } else {
            validation.textContent = `${t('pos.splitExcess','Sobran: ')}${this.formatMoney(Math.abs(diff))}`;
            validation.className = 'text-xs mt-1 text-center h-4 text-rose-400';
        }
    }
};

proto.addQuickProduct = function() {
    this.openModal({
        title: t('pos.quickProduct'),
        size: 'sm',
        content: `
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">${t('pos.quickProductName')}</label>
                    <input type="text" id="quickProductName" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white" placeholder="Ej: Servicio de envío">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">${t('pos.quickProductPrice')}</label>
                    <input type="number" id="quickProductPrice" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white" placeholder="0">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">Cantidad</label>
                    <input type="number" id="quickProductQty" value="1" min="1" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white">
                </div>
            </div>
        `,
        footer: `
            <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200 mr-2">${t('pos.cancelBtn')}</button>
            <button onclick="ui.confirmAddQuickProduct()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white">${t('pos.checkout')}</button>
        `
    });
};

proto.confirmAddQuickProduct = function() {
    const name = document.getElementById('quickProductName')?.value?.trim();
    const price = parseFloat(document.getElementById('quickProductPrice')?.value) || 0;
    const qty = parseInt(document.getElementById('quickProductQty')?.value) || 1;
    if (!name || price <= 0) {
        this.showToast(t('pos.invalidQuickProduct','Ingrese nombre y precio válidos'), 'warning');
        return;
    }
    const id = 'quick_' + Date.now();
    AppState.posCart.push({
        cartKey: id,
        id,
        name,
        baseName: name,
        price,
        qty,
        variantKey: null,
        variantLabel: null,
        saleMode: 'unit',
        presentationLabel: 'Unidad',
        presentationShortLabel: 'unidad',
        unitsPerSale: 1,
        stockUnits: qty,
        lotNumber: null,
        expiryDate: null
    });
    this.closeModal();
    this.updateCartUI();
    this.showToast(t('pos.productAdded','Producto agregado'), 'success');
};

proto.reprintLastTicket = function() {
    if (!this.lastSaleId) {
        this.showToast(t('pos.noRecentSale','No hay venta reciente'), 'warning');
        return;
    }
    const sale = store.getById('sales', this.lastSaleId);
    if (!sale) {
        this.showToast(t('pos.saleNotFound','Venta no encontrada'), 'error');
        return;
    }
    this.showPrintModal(sale);
};

proto.quickReturn = function() {
    const recentSales = store.get('sales')
        .filter(s => s.status === 'completed' || s.status === 'paid')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 50);

    this.openModal({
        title: t('pos.returnSearchTitle','Buscar ticket para devolución'),
        size: 'lg',
        content: `
            <div class="space-y-3">
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="returnSearchInput" placeholder="${t('pos.searchTicketPlaceholder','Buscar por ticket o cliente...')}" 
                        class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white"
                        oninput="ui.filterReturnTickets(this.value)">
                </div>
                <div id="returnTicketList" class="space-y-2 max-h-80 overflow-y-auto">
                    ${this.renderReturnTicketList(recentSales)}
                </div>
            </div>
        `,
        footer: `<button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200">${t('common.cancel','Cancelar')}</button>`
    });

    setTimeout(() => document.getElementById('returnSearchInput')?.focus(), 100);
};

proto.renderReturnTicketList = function(sales) {
    if (!sales.length) return `<div class="text-center text-gray-400 py-8">${t('pos.noSalesFound','Sin ventas recientes')}</div>`;
    return sales.map(s => `
        <button onclick="ui.startReturn('${s.id}')" class="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
            <div class="flex justify-between items-center gap-3">
                <div class="min-w-0">
                    <p class="font-semibold dark:text-white truncate">#${s.ticket}</p>
                    <p class="text-xs text-gray-500 truncate">${s.clientName || t('pos.generalClient','General')} · ${new Date(s.date).toLocaleString()}</p>
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="font-bold text-primary-600">${this.formatMoney(s.total)}</p>
                    <p class="text-[10px] text-gray-400">${s.items?.length || 0} ${t('pos.items','items')}</p>
                </div>
            </div>
        </button>
    `).join('');
};

proto.filterReturnTickets = function(query) {
    const lower = query.toLowerCase().trim();
    const allSales = store.get('sales')
        .filter(s => s.status === 'completed' || s.status === 'paid')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    const filtered = lower ? allSales.filter(s => {
        const ticketMatch = String(s.ticket || '').toLowerCase().includes(lower);
        const clientMatch = String(s.clientName || '').toLowerCase().includes(lower);
        return ticketMatch || clientMatch;
    }) : allSales.slice(0, 50);

    const container = document.getElementById('returnTicketList');
    if (container) container.innerHTML = this.renderReturnTicketList(filtered);
};

proto.startReturn = function(saleId) {
    this.closeModal();
    setTimeout(() => {
        const sale = store.getById('sales', saleId);
        if (!sale) { this.showToast(t('pos.saleNotFound','Venta no encontrada'), 'error'); return; }
        if (sale.status === 'cancelled' || sale.status === 'return') {
            this.showToast(t('pos.returnAlreadyDone','Esta venta ya fue cancelada o devuelta'), 'error');
            return;
        }
        this.openModal({
            title: `${t('pos.returnTitle','Devolución')} - Ticket #${sale.ticket}`,
            size: 'lg',
            content: `
                <div class="space-y-3">
                    <p class="text-sm text-gray-500 dark:text-gray-400">${t('pos.selectReturnItems','Seleccione los productos a devolver:')}</p>
                    ${sale.items.map((item, idx) => `
                        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                            <div>
                                <p class="font-medium dark:text-white">${this.escapeHtml(item.name)}</p>
                                <p class="text-sm text-gray-500">${this.formatMoney(item.price)} x ${item.qty}</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="number" min="0" max="${item.qty}" value="0" class="return-qty w-16 px-2 py-1 rounded-lg bg-white dark:bg-gray-600 text-center dark:text-white text-sm" data-idx="${idx}" data-price="${item.price}">
                            </div>
                        </div>
                    `).join('')}
                    <div class="border-t dark:border-gray-700 pt-3 mt-3">
                        <p class="text-right text-lg font-bold dark:text-white">${t('pos.returnTotal','Total a devolver:')} <span id="returnTotal">$0</span></p>
                    </div>
                </div>
            `,
            footer: `
                <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200 mr-2">${t('common.cancel','Cancelar')}</button>
                <button onclick="ui.confirmQuickReturn('${sale.id}')" class="px-4 py-2 rounded-xl btn-primary-gradient text-white">${t('pos.processReturn','Procesar Devolución')}</button>
            `
        });
        setTimeout(() => {
            document.querySelectorAll('.return-qty').forEach(input => {
                input.addEventListener('input', () => this.calculateQuickReturnTotal(sale));
            });
        }, 100);
    }, 100);
};

proto.calculateQuickReturnTotal = function(sale) {
    const inputs = document.querySelectorAll('.return-qty');
    let total = 0;
    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        const price = parseFloat(input.dataset.price) || 0;
        total += qty * price;
    });
    const el = document.getElementById('returnTotal');
    if (el) el.textContent = this.formatMoney(total);
};

proto.confirmQuickReturn = function(saleId) {
    const inputs = document.querySelectorAll('.return-qty');
    const sale = store.getById('sales', saleId);
    let returnAmount = 0;
    const returnItems = [];
    
    inputs.forEach(input => {
        const qty = parseInt(input.value) || 0;
        if (qty > 0) {
            const idx = parseInt(input.dataset.idx);
            const item = sale.items[idx];
            returnAmount += item.price * qty;
            returnItems.push({ ...item, qty });
        }
    });
    
    if (returnItems.length === 0) { this.showToast(t('pos.selectReturnQty','Seleccione cantidades a devolver'), 'error'); return; }
    
    const terminal = store.getActivePosTerminal();
    const returnRecord = {
        id: 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ticket: this.getNextTicket(terminal?.code),
        clientId: sale.clientId,
        clientName: sale.clientName,
        items: returnItems,
        subtotal: -returnAmount,
        discount: 0,
        tax: 0,
        total: -returnAmount,
        paymentMethod: sale.paymentMethod,
        status: 'return',
        date: new Date().toISOString(),
        originalSale: saleId,
        posTerminalId: terminal?.id || 'pos_default',
        posTerminalName: terminal?.name || 'Caja Principal',
        posTerminalCode: terminal?.code || 'C1'
    };
    
    const storeWarehouse = store.get('warehouses').find(w => w.type === 'store');
    const warehouseId = storeWarehouse ? storeWarehouse.id : (store.get('warehouses').find(w => w.type === 'general')?.id);
    
    returnItems.forEach(item => {
        const product = store.getById('products', item.id);
        if (product && warehouseId) {
            const currentStock = store.getProductStockInWarehouse(item.id, warehouseId);
            store.updateWarehouseStock(item.id, warehouseId, currentStock + item.qty, null, null, {
                type: 'return',
                referenceId: returnRecord.id,
                notes: t('pos.returnConcept','Devolución venta #{0}').replace('{0}', sale.ticket)
            });
            const totalStock = store.getProductTotalStock(item.id);
            store.update('products', item.id, { stock: totalStock });
        }
    });
    
    store.add('sales', returnRecord);
    this.closeModal();
    this.showToast(t('pos.returnProcessed','Devolución procesada: ') + this.formatMoney(returnAmount), 'success');
};

proto.quickAddClient = function() {
    this.openModal({
        title: t('pos.addClient'),
        size: 'sm',
        content: `
            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">Nombre *</label>
                    <input type="text" id="quickClientFirstName" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">Apellido</label>
                    <input type="text" id="quickClientLastName" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1 dark:text-white">Teléfono</label>
                    <input type="tel" id="quickClientPhone" class="w-full px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 border-0 dark:text-white">
                </div>
            </div>
        `,
        footer: `
            <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white hover:bg-gray-200 mr-2">${t('pos.cancelBtn')}</button>
            <button onclick="ui.confirmQuickAddClient()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white">${t('common.save')}</button>
        `
    });
};

proto.confirmQuickAddClient = function() {
    const firstName = document.getElementById('quickClientFirstName')?.value?.trim();
    const lastName = document.getElementById('quickClientLastName')?.value?.trim() || '';
    const phone = document.getElementById('quickClientPhone')?.value?.trim() || '';
    if (!firstName) {
        this.showToast(t('pos.invalidClientName','Ingrese al menos el nombre'), 'warning');
        return;
    }
    const client = store.add('clients', {
        firstName,
        lastName,
        phone,
        email: '',
        address: '',
        taxId: '',
        credit: 0,
        purchases: 0,
        notes: ''
    });
    this.closeModal();
    setTimeout(() => {
        const sel = document.getElementById('posClient');
        if (sel) {
            const opt = document.createElement('option');
            opt.value = client.id;
            opt.textContent = `${firstName} ${lastName}`;
            sel.appendChild(opt);
            sel.value = client.id;
        }
    }, 100);
    this.showToast(t('pos.clientAdded'), 'success');
};

proto.openCashDrawer = function() {
    this.showToast(t('pos.drawerOpened','Cajón abierto'), 'success');
    const receiptWindow = window.open('', '_blank');
    if (receiptWindow && receiptWindow.document) {
        receiptWindow.document.write('<html><body style="margin:0;padding:0;font-size:1px;">.</body></html>');
        receiptWindow.document.close();
        setTimeout(() => receiptWindow.close(), 100);
    }
};


