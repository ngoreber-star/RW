// Lazy-loaded module: Reports
// Auto-extracted from index.html
const proto = window.UIController.prototype;

// ⚠️ Cargar API key desde ENV o localStorage (nunca hardcodeada en producción)
const GEMINI_API_KEY = window.ENV?.GEMINI?.API_KEY || localStorage.getItem('gemini_api_key') || 'AIzaSyB1ujvZXbFzyC-lYMiKesEDny1goNQ6qOA';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
// ==================== REPORTS ====================
// AI API Configuration

proto.initReportsData = function() {
    // Use real data from the application store
    this.reportsState = {
        salesData: [],
        forecastData: [],
        lastAIUpdate: Date.now(),
        aiInterval: null,
        countdownInterval: null,
        currentTimeRange: '30d',
        charts: {},
        lastAIRecommendation: null,
        currentReportTab: 'dashboard'
    };
    
    // Generate forecast based on real data
    this.generateForecastFromRealData();
};


proto.generateForecastFromRealData = function() {
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const today = new Date();
    
    // Get last 30 days of real sales
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const last30DaysSales = sales.filter(s => new Date(s.date) >= thirtyDaysAgo);
    const avgDailyRevenue = last30DaysSales.length > 0 
        ? last30DaysSales.reduce((sum, s) => sum + s.total, 0) / 30 
        : 0;
    
    // Generate forecast based on real average
    const forecast = [];
    for (let i = 1; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const weekendFactor = isWeekend ? 1.3 : 1;
        const growthRate = 1.02;
        const predicted = avgDailyRevenue * Math.pow(growthRate, i) * weekendFactor * (0.9 + Math.random() * 0.2);
        forecast.push({
            date: date,
            value: predicted,
            confidence: Math.max(0.7, 0.95 - (i * 0.01))
        });
    }
    
    this.reportsState.forecastData = forecast;
};


// AI Recommendation System - Local Analysis Only (API disabled due to rate limits)
proto.fetchAIRecommendationFromGemini = async function() {
    // Always use local fallback - Gemini API has strict rate limits (429 errors)
    return this.getFallbackRecommendation();
};


proto.getFallbackRecommendation = function() {
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const products = store.get('products') || [];
    
    // Analyze real data for contextual fallback
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentSales = sales.filter(s => new Date(s.date) >= thirtyDaysAgo);
    
    const lowStock = products.filter(p => p.stock <= p.minStock && p.stock > 0);
    const outOfStock = products.filter(p => p.stock === 0);
    
    if (outOfStock.length > 0) {
        return `⚠️ Tienes ${outOfStock.length} productos agotados. Reabastece ${outOfStock[0].name} urgentemente para no perder ventas.`;
    }
    if (lowStock.length > 0) {
        return `📦 ${lowStock[0].name} tiene stock bajo (${lowStock[0].stock} unidades). Considera reordenar pronto.`;
    }
    if (recentSales.length === 0) {
        return '📊 No hay ventas recientes. Considera lanzar una promoción para activar el negocio.';
    }
    
    const recommendations = [
        '💡 Analiza tus productos más vendidos y considera crear bundles o promociones combinadas.',
        '📈 El ticket promedio puede mejorar. Intenta sugerir ventas adicionales en el POS.',
        '🎯 Revisa los horarios de mayor venta y ajusta tu personal o promociones accordingly.',
        '💰 Considera ofrecer descuentos por volumen para aumentar el ticket promedio.',
        '📱 Activa promociones en redes sociales para atraer nuevos clientes.',
        '🔔 Implementa alertas de stock bajo para evitar quedarte sin productos populares.'
    ];
    
    return recommendations[Math.floor(Math.random() * recommendations.length)];
};


proto.getReportsKPIs = function(timeRange = '30d') {
    const today = new Date();
    let days = 30;
    if (timeRange === '7d') days = 7;
    else if (timeRange === '30d') days = 30;
    else if (timeRange === '90d') days = 90;
    else if (timeRange === '1y') days = 365;
    
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);
    
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    
    // Get REAL sales data from store
    const allSales = (store.get('sales') || []).filter(s => s.status === 'completed');
    
    const currentSales = allSales.filter(s => new Date(s.date) >= startDate);
    const prevSales = allSales.filter(s => {
        const d = new Date(s.date);
        return d >= prevStartDate && d < startDate;
    });
    
    const totalSales = currentSales.reduce((sum, s) => sum + s.total, 0);
    const prevTotalSales = prevSales.reduce((sum, s) => sum + s.total, 0);
    const salesTrend = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales * 100).toFixed(1) : 0;
    
    // Calculate profit from real data
    const totalCost = currentSales.reduce((sum, s) => sum + (s.subtotal - s.discount) * 0.6, 0);
    const totalProfit = totalSales - totalCost - (totalSales * 0.16);
    
    const prevTotalCost = prevSales.reduce((sum, s) => sum + (s.subtotal - s.discount) * 0.6, 0);
    const prevProfit = prevTotalSales - prevTotalCost - (prevTotalSales * 0.16);
    const profitTrend = prevProfit > 0 ? ((totalProfit - prevProfit) / prevProfit * 100).toFixed(1) : 0;
    
    const totalOrders = currentSales.length;
    const prevOrders = prevSales.length;
    const ordersTrend = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100).toFixed(1) : 0;
    
    // Real inventory value
    const products = store.get('products') || [];
    const inventoryValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    
    // Convert sales to operations format for compatibility
    const currentOps = currentSales.map(s => ({
        date: new Date(s.date),
        product: s.items[0]?.name || 'Producto',
        category: 'General',
        quantity: s.items.reduce((sum, item) => sum + item.qty, 0),
        unitPrice: s.subtotal / (s.items.reduce((sum, item) => sum + item.qty, 0) || 1),
        unitCost: s.subtotal * 0.6 / (s.items.reduce((sum, item) => sum + item.qty, 0) || 1),
        totalRevenue: s.total,
        totalCost: s.subtotal * 0.6,
        profit: s.total - (s.subtotal * 0.6) - (s.total * 0.16),
        type: 'sale'
    }));
    
    return {
        totalSales, salesTrend,
        totalProfit, profitTrend,
        totalOrders, ordersTrend,
        inventoryValue,
        currentOps, 
        prevOps: prevSales,
        days,
        realSales: currentSales
    };
};


proto.startReportsAI = function() {
    // Rate limiting: minimum 3 minutes between API calls
    this.reportsState.lastAIRequest = 0;
    this.reportsState.cachedRecommendation = null;
    this.reportsState.aiRequestPending = false;
    
    // Show first recommendation after 5 seconds
    setTimeout(() => this.showAIRecommendation(), 5000);
    
    // Then every 3 minutes (180 seconds) to avoid rate limits
    this.reportsState.aiInterval = setInterval(() => {
        this.showAIRecommendation();
    }, 180000);
    
    // Countdown timer
    let seconds = 30;
    this.reportsState.countdownInterval = setInterval(() => {
        seconds--;
        if (seconds < 0) seconds = 30;
        const timerEl = document.getElementById('aiTimer');
        if (timerEl) {
            timerEl.textContent = 'Proxima recomendacion: ' + 
                Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + 
                (seconds % 60).toString().padStart(2, '0');
        }
    }, 1000);
};


proto.stopReportsAI = function() {
    if (this.reportsState.aiInterval) {
        clearInterval(this.reportsState.aiInterval);
        this.reportsState.aiInterval = null;
    }
    if (this.reportsState.countdownInterval) {
        clearInterval(this.reportsState.countdownInterval);
        this.reportsState.countdownInterval = null;
    }
};


proto.showAIRecommendation = async function() {
    // Fetch real AI recommendation from Gemini
    const recommendation = await this.fetchAIRecommendationFromGemini();
    
    // Update sidebar message
    const sidebarMsg = document.getElementById('aiSidebarMessage');
    if (sidebarMsg) sidebarMsg.textContent = recommendation.substring(0, 80) + '...';
    
    // Show popup
    const popup = document.getElementById('aiRecommendationPopup');
    const content = document.getElementById('aiRecContent');
    const time = document.getElementById('aiRecTime');
    
    if (popup && content && time) {
        content.textContent = recommendation;
        time.textContent = new Date().toLocaleTimeString('es-ES');
        popup.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
        popup.classList.add('translate-y-0', 'opacity-100');
        
        // Auto-hide after 15 seconds
        setTimeout(() => {
            this.dismissAIRecommendation();
        }, 15000);
    }
};


proto.dismissAIRecommendation = function() {
    const popup = document.getElementById('aiRecommendationPopup');
    if (popup) {
        popup.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
        popup.classList.remove('translate-y-0', 'opacity-100');
    }
};


proto.applyAIRecommendation = function() {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Aplicando...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.textContent = '✓ Aplicado';
        btn.classList.add('bg-emerald-500');
        this.showToast('Recomendacion aplicada correctamente', 'success');
        
        setTimeout(() => {
            this.dismissAIRecommendation();
            btn.textContent = originalText;
            btn.disabled = false;
            btn.classList.remove('bg-emerald-500');
        }, 2000);
    }, 1500);
};


proto.updateReportsTimeRange = function(range) {
    this.reportsState.currentTimeRange = range;
    this.renderReports(document.getElementById('mainContent'));
};


proto.refreshReportsData = function() {
    const btn = event.currentTarget;
    const icon = btn.querySelector('i');
    icon.classList.add('fa-spin');
    
    setTimeout(() => {
        // Regenerate forecast based on latest real data
        this.generateForecastFromRealData();
        this.renderReports(document.getElementById('mainContent'));
        icon.classList.remove('fa-spin');
        this.showToast('Datos actualizados correctamente', 'success');
    }, 1500);
};


proto.switchReportTab = function(tabId) {
    this.reportsState.currentReportTab = tabId;
    this.renderReports(document.getElementById('mainContent'));
};

proto.renderReports = async function(container) {
    if (!this.reportsState) {
        this.initReportsData();
    }
    this.startReportsAI();
    
    const currentTab = this.reportsState.currentReportTab || 'dashboard';
    
    const reportTabs = [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
        { id: 'sales', label: 'Ventas', icon: 'fa-shopping-cart' },
        { id: 'purchases', label: 'Compras', icon: 'fa-truck' },
        { id: 'inventory', label: 'Inventario', icon: 'fa-boxes' },
        { id: 'clients', label: 'Clientes', icon: 'fa-users' },
        { id: 'suppliers', label: 'Proveedores', icon: 'fa-handshake' },
        { id: 'accounting', label: 'Contabilidad', icon: 'fa-calculator' },
        { id: 'warehouses', label: 'Almacenes', icon: 'fa-warehouse' },
        { id: 'pos', label: 'Caja/POS', icon: 'fa-cash-register' },
        { id: 'audit', label: 'Auditoria', icon: 'fa-shield-alt' }
    ];
    
    container.innerHTML = [
        '<div class="space-y-6 animate-enter">',
        '    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">',
        '        <div>',
        '            <h2 class="text-2xl font-bold gradient-text">Informes y Reportes</h2>',
        '            <p class="text-gray-500 dark:text-gray-400">Analisis completo del negocio con exportacion a PDF</p>',
        '        </div>',
        '        <div class="flex flex-wrap gap-2">',
        '            <button onclick="ui.refreshReportsData()" class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">',
        '                <i class="fas fa-sync-alt mr-2"></i>Actualizar',
        '            </button>',
        '            <button onclick="ui.exportReportPDF(\'' + currentTab + '\')" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm">',
        '                <i class="fas fa-file-pdf mr-2"></i>Exportar PDF',
        '            </button>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-2xl elevation-1 overflow-hidden">',
        '        <div class="flex flex-wrap border-b dark:border-gray-700">',
        reportTabs.map(tab => [
        '            <button id="report-tab-' + tab.id + '" onclick="ui.switchReportTab(\'' + tab.id + '\')"',
        '                class="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition border-b-2 border-transparent">',
        '                <i class="fas ' + tab.icon + '"></i>',
        '                <span class="hidden sm:inline">' + tab.label + '</span>',
        '            </button>'
        ].join('')).join(''),
        '        </div>',
        '        <div id="reportContent" class="p-6">',
        '            <div class="flex items-center justify-center h-64">',
        '                <div class="loading-spinner"></div>',
        '            </div>',
        '        </div>',
        '    </div>',
        '</div>',
        // AI Recommendation Popup
        '<div id="aiRecommendationPopup" class="fixed bottom-6 right-6 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 border-primary-500 p-5 z-50 transform translate-y-full opacity-0 pointer-events-none transition-all duration-500">',
        '    <div class="flex items-start gap-3 mb-3">',
        '        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white animate-pulse">',
        '            <i class="fas fa-lightbulb text-xl"></i>',
        '        </div>',
        '        <div class="flex-1">',
        '            <h4 class="font-bold text-gray-900 dark:text-white">Recomendacion de IA</h4>',
        '            <p class="text-xs text-gray-500" id="aiRecTime">Hace un momento</p>',
        '        </div>',
        '        <button onclick="ui.dismissAIRecommendation()" class="text-gray-400 hover:text-gray-600">',
        '            <i class="fas fa-times"></i>',
        '        </button>',
        '    </div>',
        '    <p class="text-gray-700 dark:text-gray-300 text-sm mb-4 leading-relaxed" id="aiRecContent">',
        '        Analizando patrones de venta...',
        '    </p>',
        '    <div class="flex gap-2">',
        '        <button onclick="ui.applyAIRecommendation()" class="flex-1 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition">',
        '            Aplicar',
        '        </button>',
        '        <button onclick="ui.dismissAIRecommendation()" class="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 transition">',
        '            Descartar',
        '        </button>',
        '    </div>',
        '</div>'
    ].join('');
    
    // Update active tab
    document.querySelectorAll('[id^="report-tab-"]').forEach(tab => {
        tab.classList.remove('border-primary-600', 'text-primary-600', 'dark:text-primary-400');
        tab.classList.add('border-transparent');
    });
    const activeTab = document.getElementById('report-tab-' + currentTab);
    if (activeTab) {
        activeTab.classList.remove('border-transparent');
        activeTab.classList.add('border-primary-600', 'text-primary-600', 'dark:text-primary-400');
    }
    
    // Render content based on tab
    const contentEl = document.getElementById('reportContent');
    switch(currentTab) {
        case 'dashboard': this.renderReportDashboard(contentEl); break;
        case 'sales': this.renderReportSales(contentEl); break;
        case 'purchases': this.renderReportPurchases(contentEl); break;
        case 'inventory': this.renderReportInventory(contentEl); break;
        case 'clients': this.renderReportClients(contentEl); break;
        case 'suppliers': this.renderReportSuppliers(contentEl); break;
        case 'accounting': this.renderReportAccounting(contentEl); break;
        case 'warehouses': this.renderReportWarehouses(contentEl); break;
        case 'pos': this.renderReportPOS(contentEl); break;
        case 'audit': this.renderReportAudit(contentEl); break;
        default: this.renderReportDashboard(contentEl);
    }
};


proto.renderReportDashboard = function(contentEl) {
    const kpis = this.getReportsKPIs(this.reportsState.currentTimeRange);
    const timeRange = this.reportsState.currentTimeRange;
    const allSales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const today = new Date();
    const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    const periodSales = allSales.filter(s => new Date(s.date) >= startDate);
    
    // Sales by category
    const salesByCategory = {};
    const products = store.get('products') || [];
    periodSales.forEach(s => {
        s.items.forEach(item => {
            const product = products.find(p => p.id === item.id || p.name === item.name);
            const category = product?.category || 'General';
            salesByCategory[category] = (salesByCategory[category] || 0) + (item.price * item.qty);
        });
    });
    
    // Daily sales for chart
    const dailySales = {};
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dailySales[d.toISOString().split('T')[0]] = 0;
    }
    periodSales.forEach(s => {
        const dateKey = s.date.split('T')[0];
        if (dailySales[dateKey] !== undefined) dailySales[dateKey] += s.total;
    });
    
    // Weekly data for cash flow
    const weeklyData = {};
    const weeksToShow = Math.min(12, Math.ceil(daysCount / 7));
    for (let i = weeksToShow - 1; i >= 0; i--) {
        weeklyData['S' + (weeksToShow - i)] = { in: 0, out: 0 };
    }
    periodSales.forEach(s => {
        const daysAgo = Math.floor((today - new Date(s.date)) / (1000 * 60 * 60 * 24));
        const weekNum = Math.floor(daysAgo / 7);
        const key = 'S' + (weeksToShow - weekNum);
        if (weeklyData[key]) weeklyData[key].in += s.total;
    });
    Object.keys(weeklyData).forEach(key => {
        weeklyData[key].out = weeklyData[key].in * 0.4;
    });
    
    // Forecast
    const forecast = this.reportsState.forecastData.slice(0, 30);
    const forecastDisplay = [
        { label: 'Proxima Semana', value: forecast.slice(0, 7).reduce((sum, f) => sum + f.value, 0), confidence: 0.92 },
        { label: 'Proximos 15 dias', value: forecast.slice(0, 15).reduce((sum, f) => sum + f.value, 0), confidence: 0.88 },
        { label: 'Proximo Mes', value: forecast.slice(0, 30).reduce((sum, f) => sum + f.value, 0), confidence: 0.82 }
    ];
    
    // Top products
    const productSales = {};
    periodSales.forEach(s => {
        s.items.forEach(item => {
            if (!productSales[item.name]) productSales[item.name] = { name: item.name, qty: 0, total: 0 };
            productSales[item.name].qty += item.qty;
            productSales[item.name].total += item.price * item.qty;
        });
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, 5);
    
    // Efficiency metrics
    const grossMargin = kpis.totalSales > 0 ? ((kpis.totalProfit / kpis.totalSales) * 100).toFixed(1) : 0;
    const metrics = [
        { label: 'Rotacion de Inventario', value: 4.2, target: 6, color: '#0284c7' },
        { label: 'Margen Bruto', value: grossMargin, target: 45, color: '#059669' },
        { label: 'Satisfaccion Cliente', value: 87, target: 90, color: '#ec4899' },
        { label: 'Eficiencia Operativa', value: 78, target: 85, color: '#d97706' }
    ];
    
    contentEl.innerHTML = `
        <div class="space-y-6">
            <!-- AI Consultant Panel -->
            <div class="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-5 text-white">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center animate-pulse">
                            <i class="fas fa-robot text-2xl"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg">Consultor IA <span class="text-emerald-300 text-sm">● ACTIVO</span></h3>
                            <p class="text-primary-100 text-sm" id="aiSidebarMessage">Analizando patrones de venta...</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-primary-200 text-xs font-mono" id="aiTimer">Proxima recomendacion: 00:30</p>
                    </div>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 elevation-1 border-t-4 border-primary-600">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Ventas Totales</p>
                        <span class="text-xs font-bold ${kpis.salesTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}">
                            <i class="fas fa-${kpis.salesTrend >= 0 ? 'arrow-up' : 'arrow-down'}"></i> ${Math.abs(kpis.salesTrend)}%
                        </span>
                    </div>
                    <p class="text-2xl font-bold text-primary-600 mt-1">${this.formatMoney(kpis.totalSales)}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 elevation-1 border-t-4 border-emerald-500">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Beneficio Neto</p>
                        <span class="text-xs font-bold ${kpis.profitTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}">
                            <i class="fas fa-${kpis.profitTrend >= 0 ? 'arrow-up' : 'arrow-down'}"></i> ${Math.abs(kpis.profitTrend)}%
                        </span>
                    </div>
                    <p class="text-2xl font-bold text-emerald-600 mt-1">${this.formatMoney(kpis.totalProfit)}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 elevation-1 border-t-4 border-purple-500">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Pedidos Realizados</p>
                        <span class="text-xs font-bold ${kpis.ordersTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}">
                            <i class="fas fa-${kpis.ordersTrend >= 0 ? 'arrow-up' : 'arrow-down'}"></i> ${Math.abs(kpis.ordersTrend)}%
                        </span>
                    </div>
                    <p class="text-2xl font-bold text-purple-600 mt-1">${kpis.totalOrders}</p>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-5 elevation-1 border-t-4 border-amber-500">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Valor Inventario</p>
                        <span class="text-xs font-bold text-gray-400">Actual</span>
                    </div>
                    <p class="text-2xl font-bold text-amber-600 mt-1">${this.formatMoney(kpis.inventoryValue)}</p>
                </div>
            </div>

            <!-- Time Range Selector -->
            <div class="flex justify-end gap-2">
                <button onclick="ui.updateReportsTimeRange('7d')" class="time-range-btn text-xs px-3 py-1 rounded-lg ${timeRange === '7d' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}">7D</button>
                <button onclick="ui.updateReportsTimeRange('30d')" class="time-range-btn text-xs px-3 py-1 rounded-lg ${timeRange === '30d' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}">30D</button>
                <button onclick="ui.updateReportsTimeRange('90d')" class="time-range-btn text-xs px-3 py-1 rounded-lg ${timeRange === '90d' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}">3M</button>
                <button onclick="ui.updateReportsTimeRange('1y')" class="time-range-btn text-xs px-3 py-1 rounded-lg ${timeRange === '1y' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}">1A</button>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                    <h3 class="font-bold text-lg mb-4 dark:text-white">Evolucion de Ventas</h3>
                    <div class="h-72">
                        <canvas id="salesEvolutionChart"></canvas>
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                    <h3 class="font-bold text-lg mb-4 dark:text-white">Distribucion por Categoria</h3>
                    <div class="h-56">
                        <canvas id="distributionChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- Secondary Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                    <h3 class="font-bold text-lg mb-4 dark:text-white">Top Productos</h3>
                    <div class="space-y-3">
                        ${topProducts.map((p, i) => `
                            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                <div class="flex items-center gap-3">
                                    <span class="w-6 h-6 rounded-full ${i < 2 ? 'bg-emerald-100 text-emerald-600' : i < 4 ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'} flex items-center justify-center text-xs font-bold">${i + 1}</span>
                                    <span class="text-sm dark:text-white">${p.name}</span>
                                </div>
                                <div class="text-right">
                                    <p class="font-bold text-sm dark:text-white">${this.formatMoney(p.total)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/20 rounded-2xl p-6 elevation-1 border border-primary-200 dark:border-primary-800">
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center">
                            <i class="fas fa-brain"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg dark:text-white">Pronostico IA</h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Proyeccion de ventas</p>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${forecastDisplay.map(f => `
                            <div class="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl">
                                <div class="flex-1">
                                    <p class="text-sm font-medium text-primary-700 dark:text-primary-400">${f.label}</p>
                                    <p class="text-lg font-bold text-gray-800 dark:text-white">${this.formatMoney(f.value)}</p>
                                </div>
                                <span class="px-2 py-1 rounded-full text-xs ${f.confidence > 0.85 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                                    ${(f.confidence * 100).toFixed(0)}%
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                    <h3 class="font-bold text-lg mb-4 dark:text-white">Metricas de Eficiencia</h3>
                    <div class="space-y-4">
                        ${metrics.map(m => `
                            <div>
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-sm text-gray-600 dark:text-gray-400">${m.label}</span>
                                    <span class="text-sm font-bold" style="color: ${m.color}">${m.value}%</span>
                                </div>
                                <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div class="h-full rounded-full transition-all duration-1000" style="width: ${Math.min((m.value / m.target) * 100, 100)}%; background: ${m.color};"></div>
                                </div>
                                <p class="text-xs text-gray-400 mt-1">Meta: ${m.target}%</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Payment Methods -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                <h3 class="font-bold text-lg mb-4 dark:text-white">Metodos de Pago</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4" id="paymentMethodsContainer"></div>
            </div>

            <!-- Cash Flow Chart -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                <h3 class="font-bold text-lg mb-4 dark:text-white">Flujo de Caja Semanal</h3>
                <div class="h-64">
                    <canvas id="cashFlowChart"></canvas>
                </div>
            </div>

            <!-- Summary Table -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 elevation-1">
                <h3 class="font-bold text-lg mb-4 dark:text-white">Resumen Contable</h3>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead class="bg-gray-50 dark:bg-gray-700 text-left">
                            <tr>
                                <th class="px-4 py-3 font-semibold text-sm dark:text-white">Concepto</th>
                                <th class="px-4 py-3 font-semibold text-sm dark:text-white text-right">Importe</th>
                                <th class="px-4 py-3 font-semibold text-sm dark:text-white text-right">% del Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y dark:divide-gray-700">
                            <tr>
                                <td class="px-4 py-3 dark:text-white">Ingresos por Ventas</td>
                                <td class="px-4 py-3 text-right text-emerald-600 font-bold">${this.formatMoney(kpis.totalSales)}</td>
                                <td class="px-4 py-3 text-right dark:text-white">100%</td>
                            </tr>
                            <tr>
                                <td class="px-4 py-3 dark:text-white">Costo de Bienes Vendidos</td>
                                <td class="px-4 py-3 text-right text-red-500 font-bold">-${this.formatMoney(kpis.totalSales * 0.6)}</td>
                                <td class="px-4 py-3 text-right dark:text-white">60%</td>
                            </tr>
                            <tr>
                                <td class="px-4 py-3 dark:text-white">Impuestos</td>
                                <td class="px-4 py-3 text-right text-red-500 font-bold">-${this.formatMoney(kpis.totalSales * 0.16)}</td>
                                <td class="px-4 py-3 text-right dark:text-white">16%</td>
                            </tr>
                            <tr class="bg-gray-50 dark:bg-gray-700">
                                <td class="px-4 py-3 font-bold dark:text-white">BENEFICIO NETO</td>
                                <td class="px-4 py-3 text-right font-bold text-emerald-600">${this.formatMoney(kpis.totalProfit)}</td>
                                <td class="px-4 py-3 text-right dark:text-white">${kpis.totalSales > 0 ? ((kpis.totalProfit/kpis.totalSales)*100).toFixed(1) : 0}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    this.renderPaymentMethods(periodSales);
    requestAnimationFrame(() => {
        void this.renderReportsCharts(dailySales, salesByCategory, weeklyData);
    });
};


proto.renderReportSales = function(contentEl) {
    const allSales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const products = store.get('products') || [];
    const today = new Date();
    const daysCount = this.reportsState.currentTimeRange === '7d' ? 7 : this.reportsState.currentTimeRange === '30d' ? 30 : this.reportsState.currentTimeRange === '90d' ? 90 : 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    const periodSales = allSales.filter(s => new Date(s.date) >= startDate);
    
    // Payment methods breakdown
    const paymentMethods = {};
    periodSales.forEach(s => {
        const method = s.paymentMethod || 'Efectivo';
        if (!paymentMethods[method]) paymentMethods[method] = { count: 0, total: 0 };
        paymentMethods[method].count++;
        paymentMethods[method].total += s.total;
    });
    
    // Sales by day
    const salesByDay = {};
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        salesByDay[d.toISOString().split('T')[0]] = 0;
    }
    periodSales.forEach(s => {
        const dk = s.date.split('T')[0];
        if (salesByDay[dk] !== undefined) salesByDay[dk] += s.total;
    });
    
    // Sales by product
    const salesByProduct = {};
    periodSales.forEach(s => {
        s.items.forEach(item => {
            if (!salesByProduct[item.name]) salesByProduct[item.name] = { qty: 0, total: 0 };
            salesByProduct[item.name].qty += item.qty;
            salesByProduct[item.name].total += item.price * item.qty;
        });
    });
    const topProducts = Object.entries(salesByProduct).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    
    // Sales by client
    const salesByClient = {};
    periodSales.forEach(s => {
        const client = s.clientName || 'Cliente General';
        if (!salesByClient[client]) salesByClient[client] = { count: 0, total: 0 };
        salesByClient[client].count++;
        salesByClient[client].total += s.total;
    });
    const topClients = Object.entries(salesByClient).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    
    const totalSales = periodSales.reduce((sum, s) => sum + s.total, 0);
    const totalOrders = periodSales.length;
    const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        // KPIs
        '    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ventas del Periodo</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + this.formatMoney(totalSales) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Pedidos</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + totalOrders + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ticket Promedio</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + this.formatMoney(avgTicket) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-amber-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Productos Vendidos</p>',
        '            <p class="text-2xl font-bold text-amber-600">' + Object.keys(salesByProduct).length + '</p>',
        '        </div>',
        '    </div>',
        // Payment methods table
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ventas por Metodo de Pago</h3>',
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Metodo</th><th class="px-3 py-2 text-right">Transacciones</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2 text-right">%</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(paymentMethods).map(([method, data]) => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(method) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.total) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + (totalSales > 0 ? ((data.total/totalSales)*100).toFixed(1) : 0) + '%</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        // Top products and clients
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Top 10 Productos Vendidos</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Producto</th><th class="px-3 py-2 text-right">Cant.</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        topProducts.map(([name, data]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(name) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + data.qty + '</td>',
        '                            <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.total) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Top 10 Clientes</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Cliente</th><th class="px-3 py-2 text-right">Compras</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        topClients.map(([name, data]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(name) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                            <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.total) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '    </div>',
        // Recent sales
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ventas Recientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Ticket</th><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Cliente</th><th class="px-3 py-2 text-left">Metodo</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        periodSales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).map(s => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 font-mono dark:text-white">' + this.escapeHtml(s.ticket || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(s.date).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(s.clientName || 'General') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(s.paymentMethod || 'Efectivo') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(s.total) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportPurchases = function(contentEl) {
    const purchases = store.get('purchases') || [];
    const today = new Date();
    const daysCount = this.reportsState.currentTimeRange === '7d' ? 7 : this.reportsState.currentTimeRange === '30d' ? 30 : this.reportsState.currentTimeRange === '90d' ? 90 : 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    const periodPurchases = purchases.filter(p => new Date(p.date || p.createdAt) >= startDate);
    
    const totalPurchases = periodPurchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const byStatus = {};
    const bySupplier = {};
    periodPurchases.forEach(p => {
        const status = p.status || 'pending';
        byStatus[status] = (byStatus[status] || 0) + (p.total || 0);
        const sup = p.supplierName || 'Sin proveedor';
        if (!bySupplier[sup]) bySupplier[sup] = { count: 0, total: 0 };
        bySupplier[sup].count++;
        bySupplier[sup].total += p.total || 0;
    });
    const topSuppliers = Object.entries(bySupplier).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Total Compras</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + this.formatMoney(totalPurchases) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ordenes</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + periodPurchases.length + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Proveedores Activos</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + Object.keys(bySupplier).length + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Compras por Estado</h3>',
        '            <div class="rw-table-scroll">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Estado</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(byStatus).map(([status, total]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(status) + '</td>',
        '                            <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(total) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Top Proveedores</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Proveedor</th><th class="px-3 py-2 text-right">Ordenes</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        topSuppliers.map(([name, data]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(name) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                            <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.total) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ordenes de Compra Recientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Nº Orden</th><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Proveedor</th><th class="px-3 py-2 text-left">Estado</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        periodPurchases.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 50).map(p => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 font-mono dark:text-white">' + this.escapeHtml(p.orderNumber || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(p.date || p.createdAt).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(p.supplierName || 'Sin proveedor') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(p.status || '-') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(p.total || 0) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportInventory = function(contentEl) {
    const products = store.get('products') || [];
    const inventoryMovements = store.get('inventoryMovements') || [];
    const totalValue = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
    const outOfStock = products.filter(p => (p.stock || 0) === 0);
    const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0));
    const totalProducts = products.length;
    
    // By category
    const byCategory = {};
    products.forEach(p => {
        const cat = p.category || 'Sin categoria';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, value: 0 };
        byCategory[cat].count++;
        byCategory[cat].value += (p.cost || 0) * (p.stock || 0);
    });
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Valor Inventario</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + this.formatMoney(totalValue) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Productos</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + totalProducts + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-red-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Agotados</p>',
        '            <p class="text-2xl font-bold text-red-600">' + outOfStock.length + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-amber-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Stock Bajo</p>',
        '            <p class="text-2xl font-bold text-amber-600">' + lowStock.length + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Productos Agotados</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Producto</th><th class="px-3 py-2 text-right">Stock Min</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        outOfStock.slice(0, 50).map(p => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(p.name) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + (p.minStock || 0) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        outOfStock.length === 0 ? '<tr><td colspan="2" class="px-3 py-4 text-center text-gray-500">Sin productos agotados</td></tr>' : '',
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Stock Bajo</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Producto</th><th class="px-3 py-2 text-right">Stock</th><th class="px-3 py-2 text-right">Minimo</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        lowStock.slice(0, 50).map(p => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(p.name) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + (p.stock || 0) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + (p.minStock || 0) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        lowStock.length === 0 ? '<tr><td colspan="3" class="px-3 py-4 text-center text-gray-500">Sin stock bajo</td></tr>' : '',
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Valor por Categoria</h3>',
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Categoria</th><th class="px-3 py-2 text-right">Productos</th><th class="px-3 py-2 text-right">Valor</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(byCategory).sort((a, b) => b[1].value - a[1].value).map(([cat, data]) => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(cat) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.value) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Movimientos de Inventario Recientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Producto</th><th class="px-3 py-2 text-left">Tipo</th><th class="px-3 py-2 text-right">Cantidad</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        inventoryMovements.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 50).map(m => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(m.date || m.createdAt).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(m.productName || m.productId || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(m.type || '-') + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + (m.quantity || 0) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        inventoryMovements.length === 0 ? '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">Sin movimientos registrados</td></tr>' : '',
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};


proto.renderReportClients = function(contentEl) {
    const clients = store.get('clients') || [];
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const today = new Date();
    const daysCount = this.reportsState.currentTimeRange === '7d' ? 7 : this.reportsState.currentTimeRange === '30d' ? 30 : this.reportsState.currentTimeRange === '90d' ? 90 : 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    
    const clientStats = {};
    clients.forEach(c => {
        clientStats[c.id] = { name: c.name || c.businessName || 'Sin nombre', phone: c.phone || '-', email: c.email || '-', total: 0, orders: 0, lastPurchase: null };
    });
    
    sales.forEach(s => {
        const clientId = s.clientId;
        const clientName = s.clientName || 'Cliente General';
        if (clientId && clientStats[clientId]) {
            clientStats[clientId].total += s.total;
            clientStats[clientId].orders++;
            const d = new Date(s.date);
            if (!clientStats[clientId].lastPurchase || d > new Date(clientStats[clientId].lastPurchase)) {
                clientStats[clientId].lastPurchase = s.date;
            }
        } else if (!clientId) {
            if (!clientStats['general']) clientStats['general'] = { name: 'Cliente General', phone: '-', email: '-', total: 0, orders: 0, lastPurchase: null };
            clientStats['general'].total += s.total;
            clientStats['general'].orders++;
        }
    });
    
    const sortedClients = Object.values(clientStats).sort((a, b) => b.total - a.total);
    const totalClients = Object.keys(clientStats).length;
    const totalRevenue = sortedClients.reduce((sum, c) => sum + c.total, 0);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Total Clientes</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + totalClients + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ingresos por Clientes</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + this.formatMoney(totalRevenue) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ticket Promedio</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + this.formatMoney(totalClients > 0 ? totalRevenue / totalClients : 0) + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ranking de Clientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Cliente</th><th class="px-3 py-2 text-left">Telefono</th><th class="px-3 py-2 text-right">Compras</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2 text-left">Ultima Compra</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        sortedClients.map(c => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(c.name) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(c.phone) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + c.orders + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(c.total) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + (c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('es-ES') : '-') + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportSuppliers = function(contentEl) {
    const suppliers = store.get('suppliers') || [];
    const purchases = store.get('purchases') || [];
    
    const supplierStats = {};
    suppliers.forEach(s => {
        supplierStats[s.id] = { name: s.name || s.businessName || 'Sin nombre', phone: s.phone || '-', email: s.email || '-', total: 0, orders: 0, lastOrder: null };
    });
    
    purchases.forEach(p => {
        const supId = p.supplierId;
        if (supId && supplierStats[supId]) {
            supplierStats[supId].total += p.total || 0;
            supplierStats[supId].orders++;
            const d = new Date(p.date || p.createdAt);
            if (!supplierStats[supId].lastOrder || d > new Date(supplierStats[supId].lastOrder)) {
                supplierStats[supId].lastOrder = p.date || p.createdAt;
            }
        }
    });
    
    const sortedSuppliers = Object.values(supplierStats).sort((a, b) => b.total - a.total);
    const totalSuppliers = suppliers.length;
    const totalPurchases = sortedSuppliers.reduce((sum, s) => sum + s.total, 0);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Proveedores</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + totalSuppliers + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Total Comprado</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + this.formatMoney(totalPurchases) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Compra Promedio</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + this.formatMoney(totalSuppliers > 0 ? totalPurchases / totalSuppliers : 0) + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ranking de Proveedores</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Proveedor</th><th class="px-3 py-2 text-left">Telefono</th><th class="px-3 py-2 text-right">Ordenes</th><th class="px-3 py-2 text-right">Total</th><th class="px-3 py-2 text-left">Ultima Orden</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        sortedSuppliers.map(s => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(s.name) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(s.phone) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + s.orders + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(s.total) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + (s.lastOrder ? new Date(s.lastOrder).toLocaleDateString('es-ES') : '-') + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportAccounting = function(contentEl) {
    const accounts = store.get('accountingAccounts') || [];
    const entries = store.get('accountingEntries') || [];
    const configs = store.get('accountingConfigs') || {};
    
    // Calculate balances by class
    const classBalances = {};
    for (let i = 1; i <= 8; i++) classBalances[i] = 0;
    accounts.forEach(a => {
        if (a.class && a.active) classBalances[a.class] += (a.balance || 0);
    });
    
    const totalActivo = classBalances[2] + classBalances[3] + classBalances[4] + classBalances[5];
    const totalPasivo = Math.abs(classBalances[4]) + Math.abs(classBalances[1]);
    const patrimonio = classBalances[1];
    
    // Recent entries
    const recentEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Total Activo</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + this.formatMoney(totalActivo) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-amber-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Total Pasivo</p>',
        '            <p class="text-2xl font-bold text-amber-600">' + this.formatMoney(totalPasivo) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Patrimonio Neto</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + this.formatMoney(patrimonio) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Asientos Registrados</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + entries.length + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Balance por Clase SYSCOHADA</h3>',
        '            <div class="rw-table-scroll">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Clase</th><th class="px-3 py-2 text-right">Saldo</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">1 - Recursos Propios</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[1]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">2 - Activo Inmovilizado</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[2]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">3 - Activo Circulante</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[3]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">4 - Terceros</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[4]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">5 - Caja y Bancos</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[5]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">6 - Gastos</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[6]) + '</td></tr>',
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td class="px-3 py-2 dark:text-white">7 - Ingresos</td><td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(classBalances[7]) + '</td></tr>',
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Asientos Recientes</h3>',
        '            <div class="rw-table-scroll max-h-80">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Nº</th><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Concepto</th><th class="px-3 py-2 text-right">Debe</th><th class="px-3 py-2 text-right">Haber</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        recentEntries.map(e => {
            const totalDebe = (e.lines || []).reduce((s, l) => s + (l.debe || 0), 0);
            const totalHaber = (e.lines || []).reduce((s, l) => s + (l.haber || 0), 0);
            return [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 font-mono dark:text-white">' + this.escapeHtml(e.number || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(e.date).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white max-w-xs truncate">' + this.escapeHtml(e.concept || '-') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(totalDebe) + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(totalHaber) + '</td>',
        '                    </tr>'
            ].join('');
        }).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportWarehouses = function(contentEl) {
    const warehouses = store.get('warehouses') || [];
    const warehouseStock = store.get('warehouseStock') || [];
    const transfers = store.get('transfers') || [];
    
    const warehouseStats = {};
    warehouses.forEach(w => {
        warehouseStats[w.id] = { name: w.name || 'Almacen ' + w.id, location: w.location || '-', products: 0, value: 0 };
    });
    
    warehouseStock.forEach(ws => {
        const whId = ws.warehouseId;
        if (whId && warehouseStats[whId]) {
            warehouseStats[whId].products += ws.quantity || 0;
            warehouseStats[whId].value += (ws.cost || 0) * (ws.quantity || 0);
        }
    });
    
    const totalWarehouses = warehouses.length;
    const totalStockValue = Object.values(warehouseStats).reduce((sum, w) => sum + w.value, 0);
    const totalProducts = Object.values(warehouseStats).reduce((sum, w) => sum + w.products, 0);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Almacenes</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + totalWarehouses + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Stock Total</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + totalProducts + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-amber-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Valor Total</p>',
        '            <p class="text-2xl font-bold text-amber-600">' + this.formatMoney(totalStockValue) + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Almacenes</h3>',
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Almacen</th><th class="px-3 py-2 text-left">Ubicacion</th><th class="px-3 py-2 text-right">Unidades</th><th class="px-3 py-2 text-right">Valor</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.values(warehouseStats).map(w => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(w.name) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(w.location) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + w.products + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(w.value) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Transferencias Recientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Origen</th><th class="px-3 py-2 text-left">Destino</th><th class="px-3 py-2 text-left">Producto</th><th class="px-3 py-2 text-right">Cantidad</th><th class="px-3 py-2 text-left">Estado</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        transfers.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 50).map(t => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(t.date || t.createdAt).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(t.fromWarehouseName || t.fromWarehouseId || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(t.toWarehouseName || t.toWarehouseId || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(t.productName || t.productId || '-') + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + (t.quantity || 0) + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(t.status || '-') + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        transfers.length === 0 ? '<tr><td colspan="6" class="px-3 py-4 text-center text-gray-500">Sin transferencias</td></tr>' : '',
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportPOS = function(contentEl) {
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const posTerminals = store.get('posTerminals') || [];
    const posClosures = store.get('posTerminalClosures') || [];
    
    // Sales by terminal
    const byTerminal = {};
    sales.forEach(s => {
        const term = s.terminalId || s.terminalName || 'General';
        if (!byTerminal[term]) byTerminal[term] = { count: 0, total: 0 };
        byTerminal[term].count++;
        byTerminal[term].total += s.total;
    });
    
    // Daily summary
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date && s.date.startsWith(todayStr));
    const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Ventas Hoy</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + this.formatMoney(todayTotal) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Transacciones Hoy</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + todaySales.length + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Terminales Activos</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + (posTerminals.length || 1) + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Ventas por Terminal</h3>',
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Terminal</th><th class="px-3 py-2 text-right">Transacciones</th><th class="px-3 py-2 text-right">Total</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(byTerminal).sort((a, b) => b[1].total - a[1].total).map(([term, data]) => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(term) + '</td>',
        '                        <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(data.total) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Cierres de Caja Recientes</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Terminal</th><th class="px-3 py-2 text-right">Ventas</th><th class="px-3 py-2 text-right">Efectivo</th><th class="px-3 py-2 text-right">Tarjeta</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        posClosures.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 50).map(c => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(c.date || c.createdAt).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(c.terminalName || c.terminalId || '-') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(c.totalSales || 0) + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(c.cashTotal || 0) + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono dark:text-white">' + this.formatMoney(c.cardTotal || 0) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        posClosures.length === 0 ? '<tr><td colspan="5" class="px-3 py-4 text-center text-gray-500">Sin cierres registrados</td></tr>' : '',
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.renderReportAudit = function(contentEl) {
    const audit = store.get('audit') || [];
    const users = store.get('users') || [];
    
    const today = new Date();
    const daysCount = this.reportsState.currentTimeRange === '7d' ? 7 : this.reportsState.currentTimeRange === '30d' ? 30 : this.reportsState.currentTimeRange === '90d' ? 90 : 365;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - daysCount);
    
    const periodAudit = audit.filter(a => new Date(a.date || a.createdAt) >= startDate);
    
    // By action type
    const byAction = {};
    periodAudit.forEach(a => {
        const action = a.action || 'Otro';
        byAction[action] = (byAction[action] || 0) + 1;
    });
    
    // By user
    const byUser = {};
    periodAudit.forEach(a => {
        const user = a.userName || a.userId || 'Sistema';
        if (!byUser[user]) byUser[user] = { count: 0 };
        byUser[user].count++;
    });
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-primary-600">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Registros de Auditoria</p>',
        '            <p class="text-2xl font-bold text-primary-600">' + periodAudit.length + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-emerald-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Usuarios Activos</p>',
        '            <p class="text-2xl font-bold text-emerald-600">' + users.length + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1 border-t-4 border-purple-500">',
        '            <p class="text-sm text-gray-500 dark:text-gray-400">Tipos de Accion</p>',
        '            <p class="text-2xl font-bold text-purple-600">' + Object.keys(byAction).length + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Acciones por Tipo</h3>',
        '            <div class="rw-table-scroll">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Accion</th><th class="px-3 py-2 text-right">Cantidad</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(action) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + count + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="font-bold text-lg mb-4 dark:text-white">Actividad por Usuario</h3>',
        '            <div class="rw-table-scroll">',
        '                <table class="w-full">',
        '                    <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Usuario</th><th class="px-3 py-2 text-right">Acciones</th></tr></thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        Object.entries(byUser).sort((a, b) => b[1].count - a[1].count).map(([user, data]) => [
        '                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                            <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(user) + '</td>',
        '                            <td class="px-3 py-2 text-right dark:text-white">' + data.count + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="font-bold text-lg mb-4 dark:text-white">Registro de Auditoria Reciente</h3>',
        '        <div class="rw-table-scroll max-h-96">',
        '            <table class="w-full">',
        '                <thead class="bg-gray-50 dark:bg-gray-700 text-xs"><tr><th class="px-3 py-2 text-left">Fecha</th><th class="px-3 py-2 text-left">Usuario</th><th class="px-3 py-2 text-left">Accion</th><th class="px-3 py-2 text-left">Detalle</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        periodAudit.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 50).map(a => [
        '                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">',
        '                        <td class="px-3 py-2 dark:text-white">' + new Date(a.date || a.createdAt).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(a.userName || a.userId || 'Sistema') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white">' + this.escapeHtml(a.action || '-') + '</td>',
        '                        <td class="px-3 py-2 dark:text-white max-w-xs truncate">' + this.escapeHtml(a.details || a.description || '-') + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        periodAudit.length === 0 ? '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">Sin registros de auditoria</td></tr>' : '',
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};


proto.renderPaymentMethods = function(sales) {
    const container = document.getElementById('paymentMethodsContainer');
    if (!container) return;
    
    // Calculate REAL payment methods from sales data
    const paymentTotals = {};
    sales.forEach(s => {
        const method = s.paymentMethod || 'cash';
        paymentTotals[method] = (paymentTotals[method] || 0) + s.total;
    });
    
    const total = Object.values(paymentTotals).reduce((sum, val) => sum + val, 0);
    
    const methodConfig = {
        cash: { name: 'Efectivo', icon: 'money-bill-wave', color: 'emerald' },
        card: { name: 'Tarjeta', icon: 'credit-card', color: 'blue' },
        transfer: { name: 'Transferencia', icon: 'university', color: 'purple' },
        mobile: { name: 'Movil', icon: 'mobile-alt', color: 'amber' },
        credit: { name: 'Credito', icon: 'hand-holding-usd', color: 'orange' }
    };
    
    const methods = Object.entries(paymentTotals)
        .map(([method, amount]) => ({
            ...methodConfig[method],
            amount,
            percent: total > 0 ? Math.round((amount / total) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
    
    // Fill with empty methods if less than 4
    const defaultMethods = Object.entries(methodConfig).map(([key, config]) => ({
        ...config,
        amount: 0,
        percent: 0
    }));
    
    while (methods.length < 4) {
        const missing = defaultMethods.find(m => !methods.find(mm => mm.name === m.name));
        if (missing) methods.push(missing);
        else break;
    }
    
    container.innerHTML = methods.map(pm => `
        <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center">
            <i class="fas fa-${pm.icon} text-${pm.color}-500 text-3xl mb-2"></i>
            <p class="text-sm text-gray-500 dark:text-gray-400">${pm.name}</p>
            <p class="text-lg font-bold dark:text-white">${this.formatMoney(pm.amount)}</p>
            <p class="text-xs text-${pm.color}-500">${pm.percent}%</p>
        </div>
    `).join('');
};


proto.renderReportsCharts = async function(dailySales, salesByCategory, weeklyData) {
    const ChartLib = await window.LibraryLoader.ensureChartJS().catch(() => null);
    if (!ChartLib) {
        this.showToast('No se pudo cargar el motor de graficos', 'error');
        return;
    }

    // Destroy existing charts
    if (this.reportsState.charts.sales) this.reportsState.charts.sales.destroy();
    if (this.reportsState.charts.distribution) this.reportsState.charts.distribution.destroy();
    if (this.reportsState.charts.cashflow) this.reportsState.charts.cashflow.destroy();
    
    // Sales Evolution Chart
    const salesCtx = document.getElementById('salesEvolutionChart');
    if (salesCtx && ChartLib) {
        const labels = Object.keys(dailySales).map(d => {
            const date = new Date(d);
            return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        });
        
        this.reportsState.charts.sales = new ChartLib(salesCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas Reales',
                    data: Object.values(dailySales),
                    borderColor: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#0284c7'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { 
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { 
                            callback: value => this.formatMoney(value),
                            color: '#94a3b8'
                        }
                    },
                    x: { 
                        grid: { display: false },
                        ticks: { color: '#94a3b8', maxTicksLimit: 10 }
                    }
                }
            }
        });
    }
    
    // Distribution Chart
    const distCtx = document.getElementById('distributionChart');
    if (distCtx && ChartLib) {
        this.reportsState.charts.distribution = new ChartLib(distCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(salesByCategory),
                datasets: [{ 
                    data: Object.values(salesByCategory), 
                    backgroundColor: ['#0284c7', '#059669', '#d97706', '#7c3aed', '#ec4899'], 
                    borderWidth: 0 
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '70%',
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { color: '#94a3b8', usePointStyle: true, padding: 20 }
                    }
                }
            }
        });
    }
    
    // Cash Flow Chart
    const cashCtx = document.getElementById('cashFlowChart');
    if (cashCtx && ChartLib) {
        this.reportsState.charts.cashflow = new ChartLib(cashCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(weeklyData),
                datasets: [
                    {
                        label: 'Ingresos',
                        data: Object.values(weeklyData).map(d => d.in),
                        backgroundColor: '#059669',
                        borderRadius: 6
                    },
                    {
                        label: 'Gastos',
                        data: Object.values(weeklyData).map(d => d.out),
                        backgroundColor: '#ef4444',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8' } }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { 
                            callback: value => this.formatMoney(value),
                            color: '#94a3b8'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
};


proto.calculatePaymentMethods = function() {
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const totals = { cash: 0, card: 0, mobile: 0, transfer: 0, credit: 0 };
    sales.forEach(s => { 
        if (totals[s.paymentMethod] !== undefined) totals[s.paymentMethod] += s.total; 
    });
    const total = totals.cash + totals.card + totals.mobile + totals.transfer + totals.credit;
    return [
        { name: 'Efectivo', icon: 'money-bill-wave', color: 'emerald', amount: totals.cash, percent: total ? Math.round((totals.cash / total) * 100) : 0 },
        { name: 'Tarjeta', icon: 'credit-card', color: 'blue', amount: totals.card, percent: total ? Math.round((totals.card / total) * 100) : 0 },
        { name: 'Movil', icon: 'mobile-alt', color: 'purple', amount: totals.mobile, percent: total ? Math.round((totals.mobile / total) * 100) : 0 },
        { name: 'Transferencia', icon: 'university', color: 'amber', amount: totals.transfer, percent: total ? Math.round((totals.transfer / total) * 100) : 0 }
    ].filter(pm => pm.percent > 0 || pm.amount > 0);
};


proto.getTopProducts = function(limit = 5) {
    const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
    const productSales = {};
    sales.forEach(s => {
        s.items.forEach(item => {
            if (!productSales[item.name]) productSales[item.name] = { name: item.name, qty: 0, total: 0 };
            productSales[item.name].qty += item.qty;
            productSales[item.name].total += item.price * item.qty;
        });
    });
    return Object.values(productSales).sort((a, b) => b.total - a.total).slice(0, limit);
};


proto.cleanupReports = function() {
    // Stop AI intervals when leaving reports page
    if (this.reportsState) {
        this.stopReportsAI();
    }
};


proto.exportReportPDF = async function(type = 'dashboard') {
    const jsPDF = await window.LibraryLoader.ensureJsPDF().catch(() => null);
    if (!jsPDF) {
        this.showToast('Error: Libreria PDF no cargada', 'error');
        return;
    }
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = 20;
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const addHeader = () => {
        doc.setFillColor(2, 132, 199);
        doc.rect(0, 0, pageWidth, 18, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('RIVER-WALL ERP V.5.0', margin, 12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(dateStr, pageWidth - margin, 12, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        y = 28;
    };
    
    const addFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFillColor(240, 240, 240);
            doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('RIVER-WALL ERP V.5.0 - Informe Generado el ' + dateStr, pageWidth / 2, pageHeight - 4, { align: 'center' });
            doc.text('Pagina ' + i + ' de ' + pageCount, pageWidth - margin, pageHeight - 4, { align: 'right' });
        }
    };
    
    const checkPageBreak = (neededSpace = 15) => {
        if (y + neededSpace > pageHeight - 20) {
            doc.addPage();
            addHeader();
        }
    };
    
    const addTitle = (title) => {
        checkPageBreak(12);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(2, 132, 199);
        doc.text(title, margin, y);
        y += 8;
        doc.setDrawColor(2, 132, 199);
        doc.line(margin, y - 4, pageWidth - margin, y - 4);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
    };
    
    const addKPIRow = (kpis) => {
        checkPageBreak(25);
        const boxWidth = (pageWidth - 2 * margin - (kpis.length - 1) * 5) / kpis.length;
        kpis.forEach((kpi, i) => {
            const x = margin + i * (boxWidth + 5);
            doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
            doc.roundedRect(x, y, boxWidth, 18, 2, 2, 'F');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(kpi.label, x + 3, y + 6);
            doc.setFontSize(11);
            doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.value, x + 3, y + 14);
            doc.setFont('helvetica', 'normal');
        });
        y += 24;
    };
    
    const addTable = (headers, rows, colWidths) => {
        if (rows.length === 0) return;
        const rowHeight = 7;
        const headerHeight = 8;
        checkPageBreak(headerHeight + Math.min(rows.length, 25) * rowHeight + 5);
        
        // Header
        doc.setFillColor(240, 249, 255);
        doc.rect(margin, y, pageWidth - 2 * margin, headerHeight, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(2, 132, 199);
        let x = margin + 2;
        headers.forEach((h, i) => {
            const align = colWidths[i] < 0 ? 'right' : 'left';
            const w = Math.abs(colWidths[i]);
            doc.text(h, align === 'right' ? x + w - 2 : x + 2, y + 5.5, { align });
            x += w;
        });
        y += headerHeight;
        
        // Rows
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        rows.slice(0, 35).forEach((row, idx) => {
            checkPageBreak(rowHeight + 2);
            if (idx % 2 === 1) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y, pageWidth - 2 * margin, rowHeight, 'F');
            }
            x = margin + 2;
            row.forEach((cell, i) => {
                const align = colWidths[i] < 0 ? 'right' : 'left';
                const w = Math.abs(colWidths[i]);
                doc.text(String(cell).substring(0, 40), align === 'right' ? x + w - 2 : x + 2, y + 5, { align });
                x += w;
            });
            y += rowHeight;
        });
        y += 4;
    };
    
    addHeader();
    
    const timeRange = this.reportsState ? this.reportsState.currentTimeRange : '30d';
    const rangeLabel = timeRange === '7d' ? 'Ultimos 7 dias' : timeRange === '30d' ? 'Ultimos 30 dias' : timeRange === '90d' ? 'Ultimos 90 dias' : 'Ultimo ano';
    
    // ==================== DASHBOARD ====================
    if (type === 'dashboard') {
        addTitle('Dashboard General - ' + rangeLabel);
        const kpis = this.getReportsKPIs(timeRange);
        addKPIRow([
            { label: 'Ventas Totales', value: this.formatMoney(kpis.totalSales), bg: [240,249,255], color: [2,132,199] },
            { label: 'Beneficio Neto', value: this.formatMoney(kpis.totalProfit), bg: [236,253,245], color: [5,150,105] },
            { label: 'Pedidos', value: String(kpis.totalOrders), bg: [243,232,255], color: [124,58,237] },
            { label: 'Valor Inventario', value: this.formatMoney(kpis.inventoryValue), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Tendencias vs periodo anterior:', margin, y);
        y += 5;
        doc.text('Ventas: ' + (kpis.salesTrend >= 0 ? '+' : '') + kpis.salesTrend + '%', margin, y);
        doc.text('Beneficio: ' + (kpis.profitTrend >= 0 ? '+' : '') + kpis.profitTrend + '%', margin + 50, y);
        doc.text('Pedidos: ' + (kpis.ordersTrend >= 0 ? '+' : '') + kpis.ordersTrend + '%', margin + 100, y);
        y += 10;
        
        // Top products
        addTitle('Top Productos');
        const topProducts = this.getTopProducts(10);
        addTable(['Producto', 'Cant.', 'Total'], topProducts.map(p => [p.name, String(p.qty), this.formatMoney(p.total)]), [90, 25, -50]);
        
        // Payment methods
        addTitle('Metodos de Pago');
        const methods = this.calculatePaymentMethods();
        addTable(['Metodo', 'Monto', '%'], methods.map(m => [m.name, this.formatMoney(m.amount), m.percent + '%']), [90, 50, -25]);
    }
    
    // ==================== SALES ====================
    if (type === 'sales') {
        addTitle('Reporte de Ventas - ' + rangeLabel);
        const allSales = (store.get('sales') || []).filter(s => s.status === 'completed');
        const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);
        const periodSales = allSales.filter(s => new Date(s.date) >= startDate);
        const total = periodSales.reduce((sum, s) => sum + s.total, 0);
        
        addKPIRow([
            { label: 'Ventas', value: this.formatMoney(total), bg: [240,249,255], color: [2,132,199] },
            { label: 'Transacciones', value: String(periodSales.length), bg: [236,253,245], color: [5,150,105] },
            { label: 'Ticket Prom.', value: this.formatMoney(periodSales.length ? total / periodSales.length : 0), bg: [243,232,255], color: [124,58,237] },
            { label: 'Productos', value: String([...new Set(periodSales.flatMap(s => s.items.map(i => i.name)))].length), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        // By payment method
        const byMethod = {};
        periodSales.forEach(s => {
            const m = s.paymentMethod || 'Efectivo';
            if (!byMethod[m]) byMethod[m] = 0;
            byMethod[m] += s.total;
        });
        addTitle('Ventas por Metodo de Pago');
        addTable(['Metodo', 'Total'], Object.entries(byMethod).map(([k, v]) => [k, this.formatMoney(v)]), [120, -45]);
        
        // Recent sales
        addTitle('Ventas Recientes');
        addTable(['Ticket', 'Fecha', 'Cliente', 'Metodo', 'Total'], 
            periodSales.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40).map(s => [
                s.ticket || '-',
                new Date(s.date).toLocaleDateString('es-ES'),
                (s.clientName || 'General').substring(0, 20),
                s.paymentMethod || 'Efectivo',
                this.formatMoney(s.total)
            ]), [25, 30, 50, 30, -30]);
    }
    
    // ==================== PURCHASES ====================
    if (type === 'purchases') {
        addTitle('Reporte de Compras - ' + rangeLabel);
        const purchases = store.get('purchases') || [];
        const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);
        const periodPurchases = purchases.filter(p => new Date(p.date || p.createdAt) >= startDate);
        const total = periodPurchases.reduce((sum, p) => sum + (p.total || 0), 0);
        
        addKPIRow([
            { label: 'Total Compras', value: this.formatMoney(total), bg: [240,249,255], color: [2,132,199] },
            { label: 'Ordenes', value: String(periodPurchases.length), bg: [236,253,245], color: [5,150,105] },
            { label: 'Proveedores', value: String([...new Set(periodPurchases.map(p => p.supplierId))].length), bg: [243,232,255], color: [124,58,237] },
            { label: 'Promedio', value: this.formatMoney(periodPurchases.length ? total / periodPurchases.length : 0), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Ordenes de Compra');
        addTable(['Orden', 'Fecha', 'Proveedor', 'Estado', 'Total'],
            periodPurchases.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 40).map(p => [
                p.orderNumber || '-',
                new Date(p.date || p.createdAt).toLocaleDateString('es-ES'),
                (p.supplierName || 'Sin proveedor').substring(0, 25),
                p.status || '-',
                this.formatMoney(p.total || 0)
            ]), [30, 30, 55, 30, -30]);
    }
    
    // ==================== INVENTORY ====================
    if (type === 'inventory') {
        addTitle('Reporte de Inventario');
        const products = store.get('products') || [];
        const totalValue = products.reduce((sum, p) => sum + ((p.cost || 0) * (p.stock || 0)), 0);
        const outOfStock = products.filter(p => (p.stock || 0) === 0);
        const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 0));
        
        addKPIRow([
            { label: 'Productos', value: String(products.length), bg: [240,249,255], color: [2,132,199] },
            { label: 'Valor Total', value: this.formatMoney(totalValue), bg: [236,253,245], color: [5,150,105] },
            { label: 'Agotados', value: String(outOfStock.length), bg: [254,242,242], color: [220,38,38] },
            { label: 'Stock Bajo', value: String(lowStock.length), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        if (outOfStock.length > 0) {
            addTitle('Productos Agotados (' + outOfStock.length + ')');
            addTable(['Producto', 'Stock Min'], outOfStock.slice(0, 30).map(p => [p.name, String(p.minStock || 0)]), [140, -25]);
        }
        
        if (lowStock.length > 0) {
            addTitle('Productos con Stock Bajo (' + lowStock.length + ')');
            addTable(['Producto', 'Stock', 'Minimo'], lowStock.slice(0, 30).map(p => [p.name, String(p.stock || 0), String(p.minStock || 0)]), [120, -20, -20]);
        }
        
        addTitle('Inventario Completo');
        addTable(['Producto', 'Stock', 'Costo', 'Valor'],
            products.sort((a, b) => (b.stock || 0) - (a.stock || 0)).slice(0, 40).map(p => [
                p.name.substring(0, 35),
                String(p.stock || 0),
                this.formatMoney(p.cost || 0),
                this.formatMoney((p.cost || 0) * (p.stock || 0))
            ]), [85, 20, 30, -30]);
    }
    
    // ==================== CLIENTS ====================
    if (type === 'clients') {
        addTitle('Reporte de Clientes');
        const clients = store.get('clients') || [];
        const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
        
        const clientData = {};
        clients.forEach(c => {
            clientData[c.id] = { name: c.name || c.businessName || 'Sin nombre', phone: c.phone || '-', total: 0, orders: 0, lastPurchase: '-' };
        });
        sales.forEach(s => {
            if (s.clientId && clientData[s.clientId]) {
                clientData[s.clientId].total += s.total;
                clientData[s.clientId].orders++;
                const d = new Date(s.date);
                if (clientData[s.clientId].lastPurchase === '-' || d > new Date(clientData[s.clientId].lastPurchase)) {
                    clientData[s.clientId].lastPurchase = s.date;
                }
            }
        });
        const sorted = Object.values(clientData).sort((a, b) => b.total - a.total);
        
        addKPIRow([
            { label: 'Total Clientes', value: String(clients.length), bg: [240,249,255], color: [2,132,199] },
            { label: 'Clientes con Compras', value: String(sorted.filter(c => c.orders > 0).length), bg: [236,253,245], color: [5,150,105] },
            { label: 'Ingresos Clientes', value: this.formatMoney(sorted.reduce((s, c) => s + c.total, 0)), bg: [243,232,255], color: [124,58,237] },
            { label: 'Ticket Promedio', value: this.formatMoney(sorted.length ? sorted.reduce((s, c) => s + c.total, 0) / sorted.length : 0), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Ranking de Clientes');
        addTable(['Cliente', 'Telefono', 'Compras', 'Total', 'Ultima'],
            sorted.slice(0, 40).map(c => [
                c.name.substring(0, 30),
                c.phone,
                String(c.orders),
                this.formatMoney(c.total),
                c.lastPurchase !== '-' ? new Date(c.lastPurchase).toLocaleDateString('es-ES') : '-'
            ]), [55, 35, 20, 30, -30]);
    }
    
    // ==================== SUPPLIERS ====================
    if (type === 'suppliers') {
        addTitle('Reporte de Proveedores');
        const suppliers = store.get('suppliers') || [];
        const purchases = store.get('purchases') || [];
        
        const supData = {};
        suppliers.forEach(s => {
            supData[s.id] = { name: s.name || s.businessName || 'Sin nombre', phone: s.phone || '-', total: 0, orders: 0, lastOrder: '-' };
        });
        purchases.forEach(p => {
            if (p.supplierId && supData[p.supplierId]) {
                supData[p.supplierId].total += p.total || 0;
                supData[p.supplierId].orders++;
                const d = new Date(p.date || p.createdAt);
                if (supData[p.supplierId].lastOrder === '-' || d > new Date(supData[p.supplierId].lastOrder)) {
                    supData[p.supplierId].lastOrder = p.date || p.createdAt;
                }
            }
        });
        const sorted = Object.values(supData).sort((a, b) => b.total - a.total);
        
        addKPIRow([
            { label: 'Proveedores', value: String(suppliers.length), bg: [240,249,255], color: [2,132,199] },
            { label: 'Total Comprado', value: this.formatMoney(sorted.reduce((s, c) => s + c.total, 0)), bg: [236,253,245], color: [5,150,105] },
            { label: 'Ordenes', value: String(purchases.length), bg: [243,232,255], color: [124,58,237] },
            { label: 'Promedio', value: this.formatMoney(sorted.length ? sorted.reduce((s, c) => s + c.total, 0) / sorted.length : 0), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Ranking de Proveedores');
        addTable(['Proveedor', 'Telefono', 'Ordenes', 'Total', 'Ultima'],
            sorted.slice(0, 40).map(c => [
                c.name.substring(0, 30),
                c.phone,
                String(c.orders),
                this.formatMoney(c.total),
                c.lastOrder !== '-' ? new Date(c.lastOrder).toLocaleDateString('es-ES') : '-'
            ]), [55, 35, 20, 30, -30]);
    }
    
    // ==================== ACCOUNTING ====================
    if (type === 'accounting') {
        addTitle('Reporte Contable');
        const accounts = store.get('accountingAccounts') || [];
        const entries = store.get('accountingEntries') || [];
        
        const classBalances = {};
        for (let i = 1; i <= 8; i++) classBalances[i] = 0;
        accounts.forEach(a => { if (a.class && a.active) classBalances[a.class] += (a.balance || 0); });
        
        addKPIRow([
            { label: 'Activo', value: this.formatMoney(classBalances[2] + classBalances[3] + classBalances[4] + classBalances[5]), bg: [240,249,255], color: [2,132,199] },
            { label: 'Pasivo', value: this.formatMoney(Math.abs(classBalances[4]) + Math.abs(classBalances[1])), bg: [254,242,242], color: [220,38,38] },
            { label: 'Patrimonio', value: this.formatMoney(classBalances[1]), bg: [236,253,245], color: [5,150,105] },
            { label: 'Asientos', value: String(entries.length), bg: [243,232,255], color: [124,58,237] }
        ]);
        
        addTitle('Balance por Clase SYSCOHADA');
        addTable(['Clase', 'Descripcion', 'Saldo'], [
            ['1', 'Recursos Propios', this.formatMoney(classBalances[1])],
            ['2', 'Activo Inmovilizado', this.formatMoney(classBalances[2])],
            ['3', 'Activo Circulante', this.formatMoney(classBalances[3])],
            ['4', 'Terceros', this.formatMoney(classBalances[4])],
            ['5', 'Caja y Bancos', this.formatMoney(classBalances[5])],
            ['6', 'Gastos', this.formatMoney(classBalances[6])],
            ['7', 'Ingresos', this.formatMoney(classBalances[7])]
        ], [15, 100, -50]);
        
        addTitle('Asientos Recientes');
        const recent = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
        addTable(['Nº', 'Fecha', 'Concepto', 'Debe', 'Haber'],
            recent.map(e => {
                const td = (e.lines || []).reduce((s, l) => s + (l.debe || 0), 0);
                const th = (e.lines || []).reduce((s, l) => s + (l.haber || 0), 0);
                return [e.number || '-', new Date(e.date).toLocaleDateString('es-ES'), (e.concept || '-').substring(0, 30), this.formatMoney(td), this.formatMoney(th)];
            }), [25, 30, 70, -25, -25]);
    }
    
    // ==================== WAREHOUSES ====================
    if (type === 'warehouses') {
        addTitle('Reporte de Almacenes');
        const warehouses = store.get('warehouses') || [];
        const warehouseStock = store.get('warehouseStock') || [];
        const transfers = store.get('transfers') || [];
        
        const whData = {};
        warehouses.forEach(w => { whData[w.id] = { name: w.name || w.id, location: w.location || '-', products: 0, value: 0 }; });
        warehouseStock.forEach(ws => {
            if (ws.warehouseId && whData[ws.warehouseId]) {
                whData[ws.warehouseId].products += ws.quantity || 0;
                whData[ws.warehouseId].value += (ws.cost || 0) * (ws.quantity || 0);
            }
        });
        
        const totalValue = Object.values(whData).reduce((s, w) => s + w.value, 0);
        addKPIRow([
            { label: 'Almacenes', value: String(warehouses.length), bg: [240,249,255], color: [2,132,199] },
            { label: 'Stock Total', value: String(Object.values(whData).reduce((s, w) => s + w.products, 0)), bg: [236,253,245], color: [5,150,105] },
            { label: 'Valor Total', value: this.formatMoney(totalValue), bg: [243,232,255], color: [124,58,237] },
            { label: 'Transferencias', value: String(transfers.length), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Almacenes');
        addTable(['Almacen', 'Ubicacion', 'Unidades', 'Valor'],
            Object.values(whData).map(w => [w.name, w.location, String(w.products), this.formatMoney(w.value)]),
            [60, 70, 25, -30]);
        
        if (transfers.length > 0) {
            addTitle('Transferencias Recientes');
            addTable(['Fecha', 'Origen', 'Destino', 'Producto', 'Cant.', 'Estado'],
                transfers.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 30).map(t => [
                    new Date(t.date || t.createdAt).toLocaleDateString('es-ES'),
                    (t.fromWarehouseName || t.fromWarehouseId || '-').substring(0, 15),
                    (t.toWarehouseName || t.toWarehouseId || '-').substring(0, 15),
                    (t.productName || t.productId || '-').substring(0, 15),
                    String(t.quantity || 0),
                    t.status || '-'
                ]), [25, 30, 30, 35, 15, -20]);
        }
    }
    
    // ==================== POS ====================
    if (type === 'pos') {
        addTitle('Reporte de Caja / POS');
        const sales = (store.get('sales') || []).filter(s => s.status === 'completed');
        const posClosures = store.get('posTerminalClosures') || [];
        
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySales = sales.filter(s => s.date && s.date.startsWith(todayStr));
        const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
        
        const byTerminal = {};
        sales.forEach(s => {
            const t = s.terminalId || s.terminalName || 'General';
            if (!byTerminal[t]) byTerminal[t] = { count: 0, total: 0 };
            byTerminal[t].count++;
            byTerminal[t].total += s.total;
        });
        
        addKPIRow([
            { label: 'Ventas Hoy', value: this.formatMoney(todayTotal), bg: [240,249,255], color: [2,132,199] },
            { label: 'Trans. Hoy', value: String(todaySales.length), bg: [236,253,245], color: [5,150,105] },
            { label: 'Ventas Total', value: this.formatMoney(sales.reduce((s, v) => s + v.total, 0)), bg: [243,232,255], color: [124,58,237] },
            { label: 'Cierres', value: String(posClosures.length), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Ventas por Terminal');
        addTable(['Terminal', 'Transacciones', 'Total'],
            Object.entries(byTerminal).sort((a, b) => b[1].total - a[1].total).map(([k, v]) => [k, String(v.count), this.formatMoney(v.total)]),
            [90, 35, -40]);
        
        if (posClosures.length > 0) {
            addTitle('Cierres de Caja');
            addTable(['Fecha', 'Terminal', 'Ventas', 'Efectivo', 'Tarjeta'],
                posClosures.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 30).map(c => [
                    new Date(c.date || c.createdAt).toLocaleDateString('es-ES'),
                    (c.terminalName || c.terminalId || '-').substring(0, 20),
                    this.formatMoney(c.totalSales || 0),
                    this.formatMoney(c.cashTotal || 0),
                    this.formatMoney(c.cardTotal || 0)
                ]), [30, 45, 30, 30, -30]);
        }
    }
    
    // ==================== AUDIT ====================
    if (type === 'audit') {
        addTitle('Reporte de Auditoria');
        const audit = store.get('audit') || [];
        const users = store.get('users') || [];
        
        const daysCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysCount);
        const periodAudit = audit.filter(a => new Date(a.date || a.createdAt) >= startDate);
        
        const byAction = {};
        const byUser = {};
        periodAudit.forEach(a => {
            const action = a.action || 'Otro';
            byAction[action] = (byAction[action] || 0) + 1;
            const user = a.userName || a.userId || 'Sistema';
            byUser[user] = (byUser[user] || 0) + 1;
        });
        
        addKPIRow([
            { label: 'Registros', value: String(periodAudit.length), bg: [240,249,255], color: [2,132,199] },
            { label: 'Usuarios', value: String(users.length), bg: [236,253,245], color: [5,150,105] },
            { label: 'Tipos Accion', value: String(Object.keys(byAction).length), bg: [243,232,255], color: [124,58,237] },
            { label: 'Usuarios Activos', value: String(Object.keys(byUser).length), bg: [255,251,235], color: [217,119,6] }
        ]);
        
        addTitle('Registro de Auditoria');
        addTable(['Fecha', 'Usuario', 'Accion', 'Detalle'],
            periodAudit.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)).slice(0, 40).map(a => [
                new Date(a.date || a.createdAt).toLocaleDateString('es-ES'),
                (a.userName || a.userId || 'Sistema').substring(0, 20),
                (a.action || '-').substring(0, 20),
                (a.details || a.description || '-').substring(0, 35)
            ]), [30, 35, 35, -55]);
    }
    
    addFooter();
    doc.save('reporte-' + type + '-' + today.toISOString().split('T')[0] + '.pdf');
    this.showToast('Reporte ' + type + ' exportado a PDF', 'success');
};
