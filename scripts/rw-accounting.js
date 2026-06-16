// Lazy-loaded module: Accounting (SYSCOHADA)
// Auto-extracted from index.html
const proto = window.UIController.prototype;

/**
 * Renderiza el módulo de contabilidad con tabs
 */
// ==================== MÉTODOS DE CONTABILIDAD SYSCOHADA ====================

proto.renderAccounting = function(container) {
    this.accountingEnsureConfig();
    this.accountingInitSYSCOHADA();
    
    const tabGroups = [
        {
            id: 'plan',
            label: 'Plan',
            icon: 'fa-list-ol',
            tabs: [
                { id: 'pgc', label: 'Plan de Cuentas', icon: 'fa-list-ol' },
                { id: 'subaccounts', label: 'Subcuentas', icon: 'fa-sitemap' },
                { id: 'costcenters', label: 'Centros de Costo', icon: 'fa-project-diagram' }
            ]
        },
        {
            id: 'operations',
            label: 'Operaciones',
            icon: 'fa-book',
            tabs: [
                { id: 'journal', label: 'Libro Diario', icon: 'fa-book' },
                { id: 'import', label: 'Ventas', icon: 'fa-file-import' },
                { id: 'purchases', label: 'Compras', icon: 'fa-shopping-cart' },
                { id: 'vat', label: 'IVA / TVA', icon: 'fa-percent' },
                { id: 'banks', label: 'Bancos', icon: 'fa-university' },
                { id: 'reconcile', label: 'Conciliación', icon: 'fa-check-double' }
            ]
        },
        {
            id: 'reports',
            label: 'Informes',
            icon: 'fa-chart-bar',
            tabs: [
                { id: 'ledger', label: 'Libro Mayor', icon: 'fa-columns' },
                { id: 'balances', label: 'Balances', icon: 'fa-balance-scale' },
                { id: 'cashflow', label: 'Flujo de Caja', icon: 'fa-money-bill-wave' },
                { id: 'aging', label: 'Vencimientos', icon: 'fa-hourglass-half' },
                { id: 'ratios', label: 'Ratios', icon: 'fa-chart-pie' },
                { id: 'comparison', label: 'Comparativa', icon: 'fa-chart-bar' },
                { id: 'notes', label: 'Memoria', icon: 'fa-sticky-note' }
            ]
        },
        {
            id: 'closing',
            label: 'Cierre',
            icon: 'fa-lock',
            tabs: [
                { id: 'closing', label: 'Cierre Ejercicio', icon: 'fa-lock' },
                { id: 'config', label: 'Configuración', icon: 'fa-cog' }
            ]
        }
    ];
    
    this._accountingTabGroups = tabGroups;
    this._accountingActiveGroup = this._accountingActiveGroup || 'plan';
    this._accountingActiveTab = this._accountingActiveTab || 'pgc';
    
    container.innerHTML = `
        <div class="max-w-6xl mx-auto space-y-6">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Contabilidad SYSCOHADA</h2>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestión contable conforme normativa OHADA</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="ui.accountingExportPGC()" class="btn-secondary-enterprise text-sm">
                        <i class="fas fa-download mr-1.5"></i>Exportar PGC
                    </button>
                    <button onclick="ui.accountingExportEntries()" class="btn-primary-enterprise text-sm">
                        <i class="fas fa-file-excel mr-1.5"></i>Exportar Asientos
                    </button>
                </div>
            </div>
            
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <!-- Group Tabs -->
                <div class="flex flex-wrap border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    ${tabGroups.map(g => `
                        <button id="acct-grp-${g.id}" onclick="ui.accountingSwitchGroup('${g.id}')"
                            class="acct-grp-btn flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition whitespace-nowrap"
                            data-group="${g.id}">
                            <i class="fas ${g.icon}"></i>
                            <span>${g.label}</span>
                        </button>
                    `).join('')}
                </div>
                
                <!-- Sub Tabs -->
                <div id="acctSubTabs" class="flex flex-wrap border-b border-slate-200 dark:border-slate-700 px-4 pt-2 gap-1 bg-white dark:bg-slate-800">
                    <!-- populated by JS -->
                </div>
                
                <!-- Content -->
                <div id="accountingContent" class="p-6 min-h-[400px]">
                    <div class="flex items-center justify-center h-64">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    this.accountingSwitchGroup(this._accountingActiveGroup);
};

/**
 * Cambia entre tabs del modulo contable
 */

proto.accountingSwitchGroup = function(groupId) {
    this._accountingActiveGroup = groupId;
    const groups = this._accountingTabGroups || [];
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    // Update group buttons
    document.querySelectorAll('.acct-grp-btn').forEach(btn => {
        const isActive = btn.dataset.group === groupId;
        btn.className = isActive
            ? 'acct-grp-btn flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 border-sky-600 text-sky-600 bg-white dark:bg-slate-800 whitespace-nowrap transition'
            : 'acct-grp-btn flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap transition';
    });
    
    // Render sub-tabs
    const subTabsContainer = document.getElementById('acctSubTabs');
    if (subTabsContainer) {
        const defaultTab = group.tabs[0]?.id;
        const activeTab = group.tabs.find(t => t.id === this._accountingActiveTab) ? this._accountingActiveTab : defaultTab;
        this._accountingActiveTab = activeTab;
        
        subTabsContainer.innerHTML = group.tabs.map(t => `
            <button id="acct-tab-${t.id}" onclick="ui.accountingSwitchTab('${t.id}')"
                class="acct-sub-btn px-3 py-2 rounded-lg text-xs font-medium transition mb-2 ${t.id === activeTab ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'}">
                <i class="fas ${t.icon} mr-1"></i>${t.label}
            </button>
        `).join('');
    }
    
    this.accountingSwitchTab(this._accountingActiveTab);
};

proto.accountingSwitchTab = function(tabName) {
    this._accountingActiveTab = tabName;
    
    document.querySelectorAll('.acct-sub-btn').forEach(tab => {
        tab.className = 'acct-sub-btn px-3 py-2 rounded-lg text-xs font-medium transition mb-2 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700';
    });
    
    const activeTab = document.getElementById('acct-tab-' + tabName);
    if (activeTab) {
        activeTab.className = 'acct-sub-btn px-3 py-2 rounded-lg text-xs font-medium transition mb-2 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300';
    }
    
    const contentEl = document.getElementById('accountingContent');
    if (contentEl) {
        contentEl.innerHTML = '<div class="flex items-center justify-center h-64"><div class="loading-spinner"></div></div>';
        // Small delay to allow spinner to render
        setTimeout(() => this.accountingRenderTab(tabName, contentEl), 10);
    }
};

/**
 * Dispatcher de tabs
 */

proto.accountingRenderTab = function(tabName, contentEl) {
    switch(tabName) {
        case 'pgc': this.accountingRenderPGC(contentEl); break;
        case 'journal': this.accountingRenderJournal(contentEl); break;
        case 'ledger': this.accountingRenderLedger(contentEl); break;
        case 'balances': this.accountingRenderBalances(contentEl); break;
        case 'import': this.accountingRenderImport(contentEl); break;
        case 'purchases': this.accountingRenderImportPurchases(contentEl); break;
        case 'vat': this.accountingRenderVAT(contentEl); break;
        case 'closing': this.accountingRenderClosing(contentEl); break;
        case 'aging': this.accountingRenderAging(contentEl); break;
        case 'ratios': this.accountingRenderRatios(contentEl); break;
        case 'comparison': this.accountingRenderComparison(contentEl); break;
        case 'costcenters': this.accountingRenderCostCenters(contentEl); break;
        case 'subaccounts': this.accountingRenderSubaccounts(contentEl); break;
        case 'notes': this.accountingRenderNotes(contentEl); break;
        case 'cashflow': this.accountingRenderCashFlow(contentEl); break;
        case 'banks': this.accountingRenderBanks(contentEl); break;
        case 'reconcile': this.accountingRenderReconciliation(contentEl); break;
        case 'config': this.accountingRenderConfig(contentEl); break;
        default: this.accountingRenderPGC(contentEl);
    }
};

/**
 * Asegura la configuracion contable OHADA
 */

proto.accountingEnsureConfig = function() {
    const configs = store.get('accountingConfigs');
    if (!configs || Object.keys(configs).length === 0) {
        const settings = store.get('settings');
        store.data.accountingConfigs = {
            fiscalYearStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
            fiscalYearEnd: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
            defaultCurrency: 'XAF',
            secondaryCurrencies: ['EUR', 'USD'],
            accountingMethod: 'accrual',
            invoiceAutoEntries: true,
            nextEntryNumber: 1,
            lockedPeriods: [],
            costCenters: ['General', 'Ventas', 'Administración', 'Producción'],
            notes: '',
            companyInfo: {
                name: settings?.businessName || '',
                taxId: settings?.taxId || '',
                address: settings?.address || '',
                country: 'GQ',
                regime: 'normal'
            }
        };
        store.save('accountingConfigs');
    }
};

/**
 * Inicializa el Plan de Cuentas SYSCOHADA completo
 */

proto.accountingInitSYSCOHADA = function() {
    const accounts = store.get('accountingAccounts');
    const currentAccounts = Array.isArray(accounts) ? accounts : [];

    const make = (code, name, type, nature, classNumber, description = '', isInactive = false) => ({
        code,
        name,
        type,
        nature,
        class: classNumber,
        description,
        active: !isInactive
    });

    const syscohadaAccounts = [
        // CLASE 1: CUENTAS DE RECURSOS DURADEROS
        make('101', 'Capital social', 'equity', 'creditor', 1, 'Aportes de los socios'),
        make('1011', 'Capital souscrit non appelé', 'equity', 'creditor', 1),
        make('1012', 'Capital souscrit appelé non versé', 'equity', 'creditor', 1),
        make('1013', 'Capital souscrit appelé versé', 'equity', 'creditor', 1),
        make('104', 'Primes liées au capital', 'equity', 'creditor', 1),
        make('105', 'Écarts de réévaluation', 'equity', 'creditor', 1),
        make('106', 'Réserves', 'equity', 'creditor', 1),
        make('107', 'Report à nouveau', 'equity', 'creditor', 1),
        make('109', 'Actionnaires capital souscrit non appelé', 'asset', 'debtor', 1),
        make('111', 'Réserve légale', 'equity', 'creditor', 1),
        make('112', 'Réserves statutaires', 'equity', 'creditor', 1),
        make('113', 'Réserves réglementées', 'equity', 'creditor', 1),
        make('118', 'Autres réserves', 'equity', 'creditor', 1),
        make('121', 'Résultat net de l\'exercice', 'equity', 'creditor', 1),
        make('129', 'Résultat de l\'exercice (perte)', 'equity', 'debtor', 1),
        make('131', 'Subventions d\'investissement', 'liability', 'creditor', 1),
        make('132', 'Subventions d\'équipement', 'liability', 'creditor', 1),
        make('133', 'Subventions de bilan', 'liability', 'creditor', 1),
        make('141', 'Provisions réglementées', 'liability', 'creditor', 1),
        make('151', 'Provisions pour risques', 'liability', 'creditor', 1),
        make('152', 'Provisions pour risques et charges financières', 'liability', 'creditor', 1),
        make('153', 'Provisions pour charges de personnel', 'liability', 'creditor', 1),
        make('154', 'Provisions pour restructuration', 'liability', 'creditor', 1),
        make('155', 'Provisions pour charges', 'liability', 'creditor', 1),
        make('161', 'Emprunts obligataires', 'liability', 'creditor', 1),
        make('162', 'Emprunts auprès des établissements de crédit', 'liability', 'creditor', 1),
        make('163', 'Autres emprunts et dettes assimilées', 'liability', 'creditor', 1),
        make('165', 'Dépôts et cautionnements reçus', 'liability', 'creditor', 1),
        make('166', 'Intérêts courus sur emprunts', 'liability', 'creditor', 1),
        make('171', 'Dettes liées à des participations', 'liability', 'creditor', 1),
        make('176', 'Dettes de crédit-bail', 'liability', 'creditor', 1),
        make('181', 'Dettes de location acquisition', 'liability', 'creditor', 1),
        make('191', 'Provisions financières pour risques et charges', 'liability', 'creditor', 1),
        make('198', 'Provisions pour dépréciation des comptes de ressources', 'liability', 'creditor', 1),

        // CLASE 2: COMPTES D\'ACTIF IMMOBILISÉ
        make('202', 'Frais de recherche appliquée', 'asset', 'debtor', 2),
        make('211', 'Frais de développement', 'asset', 'debtor', 2),
        make('212', 'Brevets, licences, logiciels', 'asset', 'debtor', 2),
        make('213', 'Fonds commercial', 'asset', 'debtor', 2),
        make('214', 'Droit au bail', 'asset', 'debtor', 2),
        make('215', 'Marques', 'asset', 'debtor', 2),
        make('216', 'Droit de propriété industrielle', 'asset', 'debtor', 2),
        make('218', 'Autres immobilisations incorporelles', 'asset', 'debtor', 2),
        make('219', 'Immobilisations incorporelles en cours', 'asset', 'debtor', 2),
        make('221', 'Terrains', 'asset', 'debtor', 2, 'Terrenos'),
        make('222', 'Aménagements de terrains', 'asset', 'debtor', 2),
        make('223', 'Bâtiments', 'asset', 'debtor', 2),
        make('224', 'Installations techniques', 'asset', 'debtor', 2),
        make('225', 'Matériel et outillage', 'asset', 'debtor', 2),
        make('226', 'Matériel de transport', 'asset', 'debtor', 2, 'Vehiculos de transporte'),
        make('227', 'Mobilier de bureau', 'asset', 'debtor', 2, 'Mobiliario'),
        make('228', 'Autres immobilisations corporelles', 'asset', 'debtor', 2),
        make('229', 'Immobilisations corporelles en cours', 'asset', 'debtor', 2),
        make('231', 'Participations', 'asset', 'debtor', 2),
        make('232', 'Créances rattachées à des participations', 'asset', 'debtor', 2),
        make('233', 'Titres immobilisés', 'asset', 'debtor', 2),
        make('234', 'Prêts', 'asset', 'debtor', 2),
        make('235', 'Dépôts et cautionnements versés', 'asset', 'debtor', 2),
        make('238', 'Autres créances immobilisées', 'asset', 'debtor', 2),
        make('241', 'Avances et acomptes versés sur immobilisations incorporelles', 'asset', 'debtor', 2),
        make('242', 'Avances et acomptes versés sur immobilisations corporelles', 'asset', 'debtor', 2),
        make('243', 'Avances et acomptes versés sur immobilisations financières', 'asset', 'debtor', 2),
        make('251', 'Écart de conversion - actif immobilisé', 'asset', 'debtor', 2),
        make('281', 'Amortissements des immobilisations incorporelles', 'contra-asset', 'creditor', 2),
        make('282', 'Amortissements des terrains aménagés', 'contra-asset', 'creditor', 2),
        make('283', 'Amortissements des bâtiments', 'contra-asset', 'creditor', 2),
        make('284', 'Amortissements des installations techniques', 'contra-asset', 'creditor', 2),
        make('285', 'Amortissements du matériel et outillage', 'contra-asset', 'creditor', 2),
        make('286', 'Amortissements du matériel de transport', 'contra-asset', 'creditor', 2),
        make('287', 'Amortissements du mobilier', 'contra-asset', 'creditor', 2),
        make('288', 'Amortissements des autres immobilisations corporelles', 'contra-asset', 'creditor', 2),
        make('291', 'Dépréciations des immobilisations incorporelles', 'contra-asset', 'creditor', 2),
        make('292', 'Dépréciations des immobilisations corporelles', 'contra-asset', 'creditor', 2),
        make('293', 'Dépréciations des immobilisations financières', 'contra-asset', 'creditor', 2),

        // CLASE 3: COMPTES DE STOCKS
        make('311', 'Marchandises', 'asset', 'debtor', 3, 'Mercaderías'),
        make('312', 'Matières premières et fournitures liées', 'asset', 'debtor', 3),
        make('321', 'Matières consommables', 'asset', 'debtor', 3),
        make('322', 'Fournitures consommables', 'asset', 'debtor', 3),
        make('331', 'Produits en cours', 'asset', 'debtor', 3),
        make('332', 'Travaux en cours', 'asset', 'debtor', 3),
        make('341', 'Produits intermédiaires et résiduels', 'asset', 'debtor', 3),
        make('342', 'Produits finis', 'asset', 'debtor', 3),
        make('351', 'Stocks en cours de route', 'asset', 'debtor', 3),
        make('352', 'Stocks chez les tiers', 'asset', 'debtor', 3),
        make('361', 'Comptes de régularisation des stocks de marchandises', 'asset', 'debtor', 3),
        make('362', 'Comptes de régularisation des stocks de MP', 'asset', 'debtor', 3),
        make('381', 'Stocks hors activité ordinaire', 'asset', 'debtor', 3),
        make('391', 'Dépréciations des stocks de marchandises', 'contra-asset', 'creditor', 3),
        make('392', 'Dépréciations des stocks de matières premières', 'contra-asset', 'creditor', 3),
        make('393', 'Dépréciations des stocks de produits', 'contra-asset', 'creditor', 3),
        make('397', 'Dépréciations des créances liées aux stocks', 'contra-asset', 'creditor', 3),

        // CLASE 4: COMPTES DE TIERS
        make('401', 'Fournisseurs', 'liability', 'creditor', 4, 'Proveedores'),
        make('402', 'Fournisseurs - Effets à payer', 'liability', 'creditor', 4),
        make('403', 'Fournisseurs d\'immobilisations', 'liability', 'creditor', 4),
        make('404', 'Fournisseurs d\'immobilisations - Effets à payer', 'liability', 'creditor', 4),
        make('408', 'Fournisseurs - Factures non parvenues', 'liability', 'creditor', 4),
        make('409', 'Fournisseurs débiteurs', 'asset', 'debtor', 4),
        make('411', 'Clients', 'asset', 'debtor', 4, 'Clientes deudores'),
        make('412', 'Clients - Effets à recevoir', 'asset', 'debtor', 4),
        make('413', 'Clients - Retenues de garantie', 'asset', 'debtor', 4),
        make('414', 'Clients douteux ou litigieux', 'asset', 'debtor', 4),
        make('416', 'Clients douteux', 'asset', 'debtor', 4),
        make('418', 'Clients - Produits non encore facturés', 'asset', 'debtor', 4),
        make('419', 'Clients créditeurs - Avances reçues', 'liability', 'creditor', 4),
        make('421', 'Personnel - Avances et acomptes', 'asset', 'debtor', 4, 'Avances personal'),
        make('422', 'Personnel - Rémunérations dues', 'liability', 'creditor', 4, 'Sueldos por pagar'),
        make('423', 'Personnel - Oppositions', 'liability', 'creditor', 4),
        make('424', 'Personnel - Participation', 'liability', 'creditor', 4),
        make('425', 'Personnel - Cessions et saisies', 'liability', 'creditor', 4),
        make('426', 'Personnel - Dépôts', 'liability', 'creditor', 4),
        make('427', 'Personnel - Charges à payer', 'liability', 'creditor', 4),
        make('431', 'Sécurité sociale', 'liability', 'creditor', 4, 'Seguridad Social'),
        make('432', 'Autres organismes sociaux', 'liability', 'creditor', 4),
        make('433', 'Mutuelles', 'liability', 'creditor', 4),
        make('434', 'Organismes sociaux - charges à payer', 'liability', 'creditor', 4),
        make('441', 'État et collectivités - impôts sur bénéfices', 'liability', 'creditor', 4),
        make('442', 'État - autres impôts et taxes', 'liability', 'creditor', 4),
        make('443', 'État - TVA facturée', 'liability', 'creditor', 4),
        make('444', 'État - TVA due ou crédit de TVA', 'liability', 'creditor', 4),
        make('445', 'État - taxes sur le chiffre d\'affaires', 'liability', 'creditor', 4, 'IVA repercutado'),
        make('4451', 'État - TVA collectée', 'liability', 'creditor', 4),
        make('4452', 'État - TVA sur factures non parvenues', 'liability', 'creditor', 4),
        make('4455', 'État - TVA à décaisser', 'liability', 'creditor', 4),
        make('4456', 'État - TVA récupérable sur immobilisations', 'asset', 'debtor', 4, 'IVA deducible inmovilizado'),
        make('4457', 'État - TVA récupérable sur charges', 'asset', 'debtor', 4, 'IVA deducible gastos'),
        make('4458', 'État - TVA à régulariser', 'liability', 'creditor', 4, 'IVA a regularizar'),
        make('446', 'État - Subventions à recevoir', 'asset', 'debtor', 4),
        make('447', 'État - Produits à recevoir', 'asset', 'debtor', 4),
        make('448', 'État - Charges à payer', 'liability', 'creditor', 4),
        make('449', 'État - Dettes et créances diverses', 'liability', 'creditor', 4),
        make('451', 'Groupe', 'asset', 'debtor', 4),
        make('452', 'Associés - Comptes courants', 'liability', 'creditor', 4),
        make('453', 'Associés - Opérations sur le capital', 'liability', 'creditor', 4),
        make('454', 'Associés - Dividendes à payer', 'liability', 'creditor', 4),
        make('455', 'Associés - Versements reçus', 'liability', 'creditor', 4),
        make('456', 'Associés - Opérations diverses', 'asset', 'debtor', 4),
        make('461', 'Débiteurs divers', 'asset', 'debtor', 4),
        make('462', 'Créditeurs divers', 'liability', 'creditor', 4),
        make('463', 'Comptes transitoires ou d\'attente', 'asset', 'debtor', 4),
        make('464', 'Produits constatés d\'avance', 'liability', 'creditor', 4),
        make('465', 'Charges à répartir sur plusieurs exercices', 'asset', 'debtor', 4),
        make('466', 'Différences de conversion actif', 'asset', 'debtor', 4),
        make('467', 'Différences de conversion passif', 'liability', 'creditor', 4),
        make('471', 'Compte d\'attente - recettes', 'liability', 'creditor', 4),
        make('472', 'Compte d\'attente - dépenses', 'asset', 'debtor', 4),
        make('481', 'Charges constatées d\'avance', 'asset', 'debtor', 4),
        make('487', 'Charges à répartir sur plusieurs exercices', 'asset', 'debtor', 4),
        make('491', 'Dépréciations des comptes clients', 'contra-asset', 'creditor', 4),
        make('499', 'Dépréciations des autres comptes de tiers', 'contra-asset', 'creditor', 4),

        // CLASE 5: COMPTES DE TRÉSORERIE
        make('511', 'Valeurs à encaisser', 'asset', 'debtor', 5),
        make('512', 'Banques', 'asset', 'debtor', 5, '', true),
        make('5121', 'Banque principale', 'asset', 'debtor', 5),
        make('5122', 'Banque secondaire', 'asset', 'debtor', 5),
        make('513', 'Chèques postaux', 'asset', 'debtor', 5),
        make('514', 'Etablissements financiers', 'asset', 'debtor', 5),
        make('515', 'Autres organismes financiers', 'asset', 'debtor', 5),
        make('521', 'Caisse', 'asset', 'debtor', 5, 'Caja general', true),
        make('5211', 'Caisse - XAF (Francos CFA)', 'asset', 'debtor', 5, 'Caja en Francos CFA'),
        make('5212', 'Caisse - EUR (Euros)', 'asset', 'debtor', 5, 'Caja en Euros'),
        make('5213', 'Caisse - USD (Dólares)', 'asset', 'debtor', 5, 'Caja en Dólares'),
        make('531', 'Banques', 'asset', 'debtor', 5, 'Cuentas bancarias', true),
        make('5311', 'Banque CCEI Bank Guinée Equatoriale', 'asset', 'debtor', 5, 'Banco CCEI'),
        make('5312', 'Banque BEAC', 'asset', 'debtor', 5, 'Banco BEAC'),
        make('5313', 'Banque BGFI Bank Guinée Equatoriale', 'asset', 'debtor', 5, 'Banco BGFI'),
        make('5314', 'Banque BANGE Bank', 'asset', 'debtor', 5, 'Banco BANGE'),
        make('532', 'Banques - Comptes d\'épargne', 'asset', 'debtor', 5),
        make('533', 'Banques - Dépôts à terme', 'asset', 'debtor', 5),
        make('541', 'Caisse - régies d\'avances', 'asset', 'debtor', 5),
        make('542', 'Caisse - accréditifs', 'asset', 'debtor', 5),
        make('571', 'Banques - Découverts', 'liability', 'creditor', 5),
        make('581', 'Virements internes', 'asset', 'debtor', 5),
        make('585', 'Transferts de fonds', 'asset', 'debtor', 5),
        make('588', 'Autres mouvements de trésorerie', 'asset', 'debtor', 5),
        make('599', 'Dépréciations des comptes financiers', 'contra-asset', 'creditor', 5),

        // CLASE 6: COMPTES DE CHARGES
        make('601', 'Achats de marchandises', 'expense', 'debtor', 6, 'Compras mercaderías'),
        make('602', 'Achats de matières premières', 'expense', 'debtor', 6, 'Compras materiales'),
        make('603', 'Variations des stocks', 'expense', 'debtor', 6),
        make('604', 'Achats stockés de matières et fournitures', 'expense', 'debtor', 6),
        make('605', 'Autres achats', 'expense', 'debtor', 6),
        make('606', 'Achats non stockés', 'expense', 'debtor', 6),
        make('607', 'Rabais, remises et ristournes obtenus', 'expense', 'debtor', 6),
        make('611', 'Transports', 'expense', 'debtor', 6, 'Transportes'),
        make('612', 'Redevances de crédit-bail', 'expense', 'debtor', 6),
        make('613', 'Locations et charges locatives', 'expense', 'debtor', 6, 'Arrendamientos'),
        make('614', 'Charges locatives et de copropriété', 'expense', 'debtor', 6),
        make('615', 'Entretien, réparations et maintenance', 'expense', 'debtor', 6, 'Mantenimiento'),
        make('616', 'Primes d\'assurance', 'expense', 'debtor', 6, 'Seguros'),
        make('617', 'Études et recherches', 'expense', 'debtor', 6),
        make('618', 'Divers services extérieurs', 'expense', 'debtor', 6),
        make('621', 'Personnel extérieur à l\'entreprise', 'expense', 'debtor', 6),
        make('622', 'Rémunérations d\'intermédiaires et honoraires', 'expense', 'debtor', 6, 'Honorarios'),
        make('623', 'Publicité et relations publiques', 'expense', 'debtor', 6, 'Publicidad'),
        make('624', 'Transports de biens et personnel', 'expense', 'debtor', 6),
        make('625', 'Déplacements, missions et réceptions', 'expense', 'debtor', 6),
        make('626', 'Frais postaux et télécommunications', 'expense', 'debtor', 6),
        make('627', 'Services bancaires et assimilés', 'expense', 'debtor', 6),
        make('628', 'Autres services extérieurs', 'expense', 'debtor', 6),
        make('631', 'Impôts et taxes directs', 'expense', 'debtor', 6),
        make('632', 'Impôts et taxes indirects', 'expense', 'debtor', 6),
        make('633', 'Taxes diverses', 'expense', 'debtor', 6),
        make('634', 'Droits d\'enregistrement', 'expense', 'debtor', 6),
        make('635', 'Autres impôts et taxes', 'expense', 'debtor', 6),
        make('641', 'Rémunérations du personnel', 'expense', 'debtor', 6, 'Sueldos y salarios'),
        make('642', 'Charges sociales', 'expense', 'debtor', 6, 'Cargas sociales'),
        make('643', 'Rémunérations diverses', 'expense', 'debtor', 6),
        make('644', 'Indemnités', 'expense', 'debtor', 6),
        make('645', 'Avantages en nature', 'expense', 'debtor', 6),
        make('646', 'Charges sociales sur congés', 'expense', 'debtor', 6),
        make('651', 'Redevances pour concessions', 'expense', 'debtor', 6),
        make('652', 'Pertes sur créances irrécouvrables', 'expense', 'debtor', 6),
        make('653', 'Jetons de présence', 'expense', 'debtor', 6),
        make('654', 'Valeurs comptables des cessions', 'expense', 'debtor', 6),
        make('655', 'Quote-part de résultat sur opérations en commun', 'expense', 'debtor', 6),
        make('656', 'Transferts de charges', 'expense', 'debtor', 6),
        make('657', 'Charges diverses de gestion courante', 'expense', 'debtor', 6),
        make('661', 'Charges d\'intérêts', 'expense', 'debtor', 6, 'Intereses'),
        make('662', 'Pertes de change', 'expense', 'debtor', 6),
        make('663', 'Charges nettes sur cessions VMP', 'expense', 'debtor', 6),
        make('664', 'Escomptes accordés', 'expense', 'debtor', 6),
        make('665', 'Charges financières diverses', 'expense', 'debtor', 6),
        make('671', 'Charges exceptionnelles', 'expense', 'debtor', 6),
        make('672', 'Pénalités et amendes', 'expense', 'debtor', 6),
        make('673', 'Dons et libéralités', 'expense', 'debtor', 6),
        make('674', 'Mali provenant de clauses d\'indexation', 'expense', 'debtor', 6),
        make('675', 'Valeurs comptables des éléments cédés', 'expense', 'debtor', 6),
        make('676', 'Charges sur exercices antérieurs', 'expense', 'debtor', 6),
        make('677', 'Autres charges exceptionnelles', 'expense', 'debtor', 6),
        make('681', 'Dotations aux amortissements', 'expense', 'debtor', 6),
        make('691', 'Impôt sur les bénéfices', 'expense', 'debtor', 6),

        // CLASE 7: COMPTES DE PRODUITS
        make('701', 'Ventes de marchandises', 'revenue', 'creditor', 7, 'Ventas mercaderías'),
        make('7011', 'Ventes au pays', 'revenue', 'creditor', 7),
        make('7012', 'Ventes à l\'étranger', 'revenue', 'creditor', 7),
        make('702', 'Ventes de produits finis', 'revenue', 'creditor', 7),
        make('703', 'Ventes de produits intermédiaires', 'revenue', 'creditor', 7),
        make('704', 'Travaux', 'revenue', 'creditor', 7),
        make('705', 'Études', 'revenue', 'creditor', 7),
        make('706', 'Services vendus', 'revenue', 'creditor', 7, 'Servicios prestados'),
        make('707', 'Produits accessoires', 'revenue', 'creditor', 7),
        make('708', 'Produits des activités annexes', 'revenue', 'creditor', 7),
        make('709', 'Remises, rabais et ristournes accordés', 'contra-revenue', 'debtor', 7, 'Descuentos concedidos'),
        make('711', 'Variation de stocks de produits', 'revenue', 'creditor', 7),
        make('712', 'Variation de stocks de travaux en cours', 'revenue', 'creditor', 7),
        make('713', 'Immobilisations produites par l\'entreprise', 'revenue', 'creditor', 7),
        make('721', 'Subventions d\'exploitation', 'revenue', 'creditor', 7),
        make('722', 'Produits des activités connexes', 'revenue', 'creditor', 7),
        make('723', 'Production immobilisée', 'revenue', 'creditor', 7),
        make('731', 'Reprises sur provisions', 'revenue', 'creditor', 7),
        make('732', 'Transferts de charges', 'revenue', 'creditor', 7),
        make('751', 'Produits financiers', 'revenue', 'creditor', 7),
        make('752', 'Produits des participations', 'revenue', 'creditor', 7),
        make('753', 'Gains de change', 'revenue', 'creditor', 7),
        make('754', 'Escomptes obtenus', 'revenue', 'creditor', 7),
        make('755', 'Produits nets sur cessions VMP', 'revenue', 'creditor', 7),
        make('756', 'Autres produits financiers', 'revenue', 'creditor', 7),
        make('771', 'Produits exceptionnels', 'revenue', 'creditor', 7),
        make('772', 'Bonis provenant de clauses d\'indexation', 'revenue', 'creditor', 7),
        make('773', 'Produits sur exercices antérieurs', 'revenue', 'creditor', 7),
        make('774', 'Subventions d\'équilibre', 'revenue', 'creditor', 7),
        make('775', 'Produits de cession d\'éléments d\'actif', 'revenue', 'creditor', 7),
        make('776', 'Autres produits exceptionnels', 'revenue', 'creditor', 7),
        make('781', 'Reprises d\'amortissements et provisions', 'revenue', 'creditor', 7),
        make('791', 'Transferts de charges', 'revenue', 'creditor', 7),

        // CLASE 8: COMPTES SPÉCIAUX
        make('801', 'Engagements obtenus', 'result', 'variable', 8),
        make('802', 'Engagements accordés', 'result', 'variable', 8),
        make('811', 'Contrepartie des engagements obtenus', 'result', 'variable', 8),
        make('812', 'Contrepartie des engagements accordés', 'result', 'variable', 8),
        make('871', 'Écarts de conversion actif (hors bilan)', 'result', 'variable', 8),
        make('872', 'Écarts de conversion passif (hors bilan)', 'result', 'variable', 8),
        make('881', 'Résultat d\'exploitation', 'result', 'variable', 8),
        make('882', 'Résultat financier', 'result', 'variable', 8),
        make('883', 'Résultat hors activités ordinaires', 'result', 'variable', 8),
        make('884', 'Résultat net', 'result', 'variable', 8)
    ];

    const existingByCode = new Map(currentAccounts.map(acc => [acc.code, acc]));
    let addedCount = 0;
    let updatedCount = 0;

    const merged = syscohadaAccounts.map(template => {
        const existing = existingByCode.get(template.code);
        if (!existing) {
            addedCount += 1;
            return { ...template, balance: 0 };
        }

        const normalized = {
            ...existing,
            code: template.code,
            name: existing.name || template.name,
            type: existing.type || template.type,
            nature: existing.nature || template.nature,
            class: existing.class || template.class,
            description: existing.description || template.description || '',
            balance: typeof existing.balance === 'number' ? existing.balance : 0,
            active: existing.active !== false
        };

        const changed = (
            normalized.name !== existing.name ||
            normalized.type !== existing.type ||
            normalized.nature !== existing.nature ||
            normalized.class !== existing.class ||
            normalized.description !== (existing.description || '') ||
            normalized.active !== existing.active ||
            normalized.balance !== existing.balance
        );

        if (changed) updatedCount += 1;
        return normalized;
    });

    currentAccounts.forEach(acc => {
        if (!acc?.code || existingByCode.has(acc.code) && syscohadaAccounts.some(t => t.code === acc.code)) return;
        merged.push(acc);
    });

    merged.sort((a, b) => a.code.localeCompare(b.code));
    store.data.accountingAccounts = merged;
    store.save('accountingAccounts');

    if (addedCount > 0 || updatedCount > 0) {
        this.showToast('Plan SYSCOHADA sincronizado: ' + addedCount + ' cuentas nuevas, ' + updatedCount + ' actualizadas', 'success');
    }
};

/**
 * Renderiza el Plan de Cuentas
 */


proto.accountingRenderPGC = function(contentEl) {
    const accounts = Array.isArray(store.get('accountingAccounts')) ? [...store.get('accountingAccounts')] : [];
    const savedFilter = this._accountingPGCFilter || '';
    const savedSearch = this._accountingPGCSearch || '';
    const filterClass = document.getElementById('pgcFilter')?.value ?? savedFilter;
    const searchValue = document.getElementById('pgcSearch')?.value ?? savedSearch;
    const searchQuery = String(searchValue || '').trim().toLowerCase();

    this._accountingPGCFilter = filterClass;
    this._accountingPGCSearch = searchValue;
    
    const classColors = {
        1: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        2: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        3: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        4: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        5: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
        6: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        7: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        8: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    
    const typeLabels = {
        'asset': 'Activo', 'contra-asset': 'Activo (contra)',
        'liability': 'Pasivo', 'equity': 'Patrimonio',
        'expense': 'Gasto', 'revenue': 'Ingreso', 'result': 'Resultado'
    };

    let filtered = accounts;
    if (filterClass) {
        filtered = filtered.filter(a => String(a.class) === filterClass);
    }
    if (searchQuery) {
        filtered = filtered.filter(acc => {
            const searchableText = [
                acc.code,
                acc.name,
                acc.description,
                typeLabels[acc.type] || acc.type,
                acc.nature === 'debtor' ? 'deudor' : acc.nature === 'creditor' ? 'acreedor' : 'variable',
                'clase ' + acc.class
            ].join(' ').toLowerCase();
            return searchableText.includes(searchQuery);
        });
    }
    
    filtered.sort((a, b) => a.code.localeCompare(b.code));

    const pageSize = 10;
    const totalAccounts = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalAccounts / pageSize));
    const currentPage = Math.min(Math.max(1, Number(this._accountingPGCPage) || 1), totalPages);
    this._accountingPGCPage = currentPage;
    this._accountingPGCTotalPages = totalPages;

    const startIndex = totalAccounts === 0 ? 0 : (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalAccounts);
    const paginated = filtered.slice(startIndex, endIndex);

    const pageTokens = [];
    for (let page = 1; page <= totalPages; page++) {
        if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
            pageTokens.push(page);
        } else if (pageTokens[pageTokens.length - 1] !== '...') {
            pageTokens.push('...');
        }
    }
    
    contentEl.innerHTML = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">',
        '        <div class="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">',
        '            <select id="pgcFilter" onchange="ui.accountingSetPGCFilter(this.value)"',
        '                class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white">',
        '                <option value=""' + (filterClass === '' ? ' selected' : '') + '>Todas las clases</option>',
        '                <option value="1"' + (filterClass === '1' ? ' selected' : '') + '>Clase 1: Recursos Propios</option>',
        '                <option value="2"' + (filterClass === '2' ? ' selected' : '') + '>Clase 2: Activo Inmovilizado</option>',
        '                <option value="3"' + (filterClass === '3' ? ' selected' : '') + '>Clase 3: Activo Circulante</option>',
        '                <option value="4"' + (filterClass === '4' ? ' selected' : '') + '>Clase 4: Terceros</option>',
        '                <option value="5"' + (filterClass === '5' ? ' selected' : '') + '>Clase 5: Caja y Bancos</option>',
        '                <option value="6"' + (filterClass === '6' ? ' selected' : '') + '>Clase 6: Gastos</option>',
        '                <option value="7"' + (filterClass === '7' ? ' selected' : '') + '>Clase 7: Ingresos</option>',
        '                <option value="8"' + (filterClass === '8' ? ' selected' : '') + '>Clase 8: Cuentas Resultado</option>',
        '            </select>',
        '            <input type="text" id="pgcSearch" placeholder="Buscar cuenta..." value="' + this.escapeHtml(searchValue) + '"',
        '                onkeyup="ui.accountingFilterPGC(this.value)"',
        '                class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white w-full sm:min-w-[220px]">',
        '        </div>',
        '        <div class="text-sm text-slate-500 dark:text-slate-400 text-right">',
        '            Mostrando ' + (totalAccounts === 0 ? '0' : (startIndex + 1) + '-' + endIndex) + ' de ' + totalAccounts + ' cuentas',
        '        </div>',
        '    </div>',
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Clase</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Código</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Nombre</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Naturaleza</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        (paginated.length === 0 ? [
        '                <tr>',
        '                    <td colspan="6" class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No se encontraron cuentas para los filtros aplicados.</td>',
        '                </tr>'
        ].join('') : paginated.map(acc => [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3">',
        '                        <span class="px-2 py-1 rounded-full text-xs font-medium ' + (classColors[acc.class] || classColors[8]) + '">',
        '                            Clase ' + acc.class,
        '                        </span>',
        '                    </td>',
        '                    <td class="px-4 py-3 font-mono font-medium dark:text-white">' + this.escapeHtml(acc.code) + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + this.escapeHtml(acc.name) + '</td>',
        '                    <td class="px-4 py-3">',
        '                        <span class="text-xs text-slate-600 dark:text-slate-400">' + (typeLabels[acc.type] || acc.type) + '</span>',
        '                    </td>',
        '                    <td class="px-4 py-3">',
        '                        <span class="px-2 py-1 rounded text-xs ' + (acc.nature === 'debtor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200') + '">',
        '                            ' + (acc.nature === 'debtor' ? 'Deudor' : acc.nature === 'creditor' ? 'Acreedor' : 'Variable'),
        '                        </span>',
        '                    </td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(acc.balance || 0) + '</td>',
        '                </tr>'
        ].join('')).join('')),
        '            </tbody>',
        '        </table>',
        '    </div>',
        '    <div class="flex flex-col lg:flex-row items-center justify-between gap-3">',
        '        <p class="text-xs text-slate-500 dark:text-slate-400">Máximo 10 cuentas por página para que la vista respire mejor.</p>',
        '        <div class="flex flex-wrap items-center justify-end gap-2">',
        '            <button onclick="ui.accountingChangePGCPage(' + (currentPage - 1) + ')" ' + (currentPage === 1 ? 'disabled' : '') + ' class="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-sm dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>',
        pageTokens.map(token => {
            if (token === '...') {
                return '<span class="px-2 text-sm text-gray-400">...</span>';
            }
            const tokenStart = ((token - 1) * pageSize) + 1;
            const tokenEnd = Math.min(token * pageSize, totalAccounts);
            return '<button onclick="ui.accountingChangePGCPage(' + token + ')" class="px-3 py-2 rounded-lg text-sm border ' + (token === currentPage ? 'bg-primary-600 border-sky-600 text-white' : 'border-slate-200 dark:border-gray-600 text-gray-700 dark:text-gray-200') + '">' + tokenStart + '-' + tokenEnd + '</button>';
        }).join(''),
        '            <button onclick="ui.accountingChangePGCPage(' + (currentPage + 1) + ')" ' + (currentPage === totalPages ? 'disabled' : '') + ' class="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 text-sm dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">Siguiente</button>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};


proto.accountingSetPGCFilter = function(value) {
    this._accountingPGCFilter = value || '';
    this._accountingPGCPage = 1;
    this.accountingRenderPGC(document.getElementById('accountingContent'));
};

/**
 * Filtra el PGC por texto
 */

proto.accountingFilterPGC = function(query) {
    this._accountingPGCSearch = query || '';
    this._accountingPGCPage = 1;
    this.accountingRenderPGC(document.getElementById('accountingContent'));
};


proto.accountingChangePGCPage = function(page) {
    const totalPages = this._accountingPGCTotalPages || 1;
    this._accountingPGCPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    this.accountingRenderPGC(document.getElementById('accountingContent'));
};

/**
 * Renderiza el Libro Diario
 */

proto.accountingRenderJournal = function(contentEl) {
    const allEntries = store.get('accountingEntries');
    const entries = this._journalFilteredEntries || allEntries;
    const configs = store.get('accountingConfigs') || {};
    const hasFilter = !!this._journalFilteredEntries;
    
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('es-ES');
    };
    
    contentEl.innerHTML = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <div class="flex gap-2">',
        '            <button onclick="ui.accountingOpenEntryModal()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm flex items-center gap-2">',
        '                <i class="fas fa-plus"></i>Nuevo Asiento',
        '            </button>',
        '            <button onclick="ui.accountingExportFEC()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 text-sm" title="Exportar FEC DGFiP">',
        '                <i class="fas fa-file-csv mr-2"></i>FEC',
        '            </button>',
        '            <button onclick="ui.accountingExportEntries()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">',
        '                <i class="fas fa-file-excel mr-2"></i>Exportar',
        '            </button>',
        hasFilter ? '            <button onclick="ui.accountingClearJournalFilter()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"><i class="fas fa-times mr-2"></i>Limpiar Filtro</button>' : '',
        '        </div>',
        '        <div class="flex gap-2">',
        '            <input type="date" id="journalDateFrom" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            <input type="date" id="journalDateTo" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            <button onclick="ui.accountingFilterJournal()" class="btn-secondary-enterprise text-sm">',
        '                <i class="fas fa-filter"></i>',
        '            </button>',
        '        </div>',
        '    </div>',
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">N°</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Concepto</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Documento</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Debe</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Haber</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Estado</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Acciones</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        entries.length === 0 ? [
        '                <tr>',
        '                    <td colspan="8" class="px-4 py-8 text-center text-slate-500 dark:text-slate-400">',
        '                        No hay asientos registrados',
        '                    </td>',
        '                </tr>'
        ].join('') : entries.map(entry => {
            const totalDebe = (entry.lines || []).reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
            const totalHaber = (entry.lines || []).reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
            const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;
            return [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer" onclick="ui.accountingOpenEntryModal(' + JSON.stringify(entry).replace(/"/g, '&quot;') + ')">',
        '                    <td class="px-4 py-3 font-mono font-medium dark:text-white">' + this.escapeHtml(entry.number || '-') + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + formatDate(entry.date) + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(entry.concept || '-') + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + this.escapeHtml(entry.documentRef || '-') + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(totalDebe) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(totalHaber) + '</td>',
        '                    <td class="px-4 py-3 text-center">',
        '                        <span class="px-2 py-1 rounded-full text-xs ' + (isBalanced ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200') + '">',
        '                            <i class="fas ' + (isBalanced ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i>',
        '                            ' + (isBalanced ? 'Cuadrado' : 'Descuadrado'),
        '                        </span>',
        '                    </td>',
        '                    <td class="px-4 py-3 text-center">',
        '                        <button onclick="event.stopPropagation(); ui.accountingCancelEntry(\'' + entry.id + '\')" class="text-amber-500 hover:text-amber-700 mr-2" title="Anular">',
        '                            <i class="fas fa-undo"></i>',
        '                        </button>',
        '                        <button onclick="event.stopPropagation(); ui.accountingDeleteEntry(\'' + entry.id + '\')" class="text-red-500 hover:text-red-700">',
        '                            <i class="fas fa-trash"></i>',
        '                        </button>',
        '                    </td>',
        '                </tr>'
            ].join('');
        }).join(''),
        '            </tbody>',
        '        </table>',
        '    </div>',
        '</div>'
    ].join('');
};

/**
 * Filtra el libro diario por fechas
 */

proto.accountingFilterJournal = function() {
    const from = document.getElementById('journalDateFrom')?.value;
    const to = document.getElementById('journalDateTo')?.value;
    
    const entries = store.get('accountingEntries');
    const filtered = entries.filter(e => {
        const d = new Date(e.date);
        if (from && d < new Date(from)) return false;
        if (to && d > new Date(to + 'T23:59:59')) return false;
        return true;
    });
    
    this._journalFilteredEntries = (from || to) ? filtered : null;
    this.accountingRenderJournal(document.getElementById('accountingContent'));
};

proto.accountingClearJournalFilter = function() {
    this._journalFilteredEntries = null;
    this.accountingRenderJournal(document.getElementById('accountingContent'));
};

/**
 * Abre modal para crear/editar asiento contable
 */

proto.accountingOpenEntryModal = function(entryData) {
    const isEdit = !!entryData;
    const entry = isEdit ? { ...entryData, lines: [...(entryData.lines || [])] } : {
        id: null,
        number: this.accountingGetNextEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        documentDate: new Date().toISOString().split('T')[0],
        concept: '',
        documentRef: '',
        lines: [{ id: 1, accountCode: '', description: '', debe: '', haber: '', costCenter: '' }]
    };
    
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    
    const costCenters = (store.get('accountingConfigs') || {}).costCenters || ['General'];
    
    const renderLines = () => {
        return (entry.lines || []).map((line, idx) => [
        '        <div class="grid grid-cols-12 gap-2 mb-2 entry-line" data-index="' + idx + '">',
        '            <div class="col-span-3">',
        '                <select class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm account-select">',
        '                    <option value="">Seleccionar cuenta</option>',
        accounts.map(acc => '<option value="' + acc.code + '" ' + (line.accountCode === acc.code ? 'selected' : '') + '>' + acc.code + ' - ' + acc.name + '</option>').join(''),
        '                </select>',
        '            </div>',
        '            <div class="col-span-3">',
        '                <input type="text" placeholder="Descripción" value="' + this.escapeHtml(line.description || '') + '"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm desc-input">',
        '            </div>',
        '            <div class="col-span-2">',
        '                <select class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm cost-center-select">',
        costCenters.map(cc => '<option value="' + cc + '" ' + (line.costCenter === cc ? 'selected' : '') + '>' + cc + '</option>').join(''),
        '                </select>',
        '            </div>',
        '            <div class="col-span-1">',
        '                <input type="number" placeholder="Debe" value="' + (line.debe || '') + '" step="0.01" min="0"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right debe-input" onchange="ui.accountingUpdateEntryBalance()">',
        '            </div>',
        '            <div class="col-span-1">',
        '                <input type="number" placeholder="Haber" value="' + (line.haber || '') + '" step="0.01" min="0"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right haber-input" onchange="ui.accountingUpdateEntryBalance()">',
        '            </div>',
        '            <div class="col-span-1 flex items-center justify-center">',
        '                <button onclick="ui.accountingRemoveEntryLine(' + idx + ')" class="text-red-500 hover:text-red-700 ' + (entry.lines.length <= 1 ? 'hidden' : '') + '">',
        '                    <i class="fas fa-times"></i>',
        '                </button>',
        '            </div>',
        '        </div>'
        ].join('')).join('');
    };
    
    const modal = this.openModal({
        title: (isEdit ? 'Editar' : 'Nuevo') + ' Asiento Contable',
        size: 'xl',
        content: [
        '    <div class="space-y-4">',
        '        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">',
        '            <div>',
        '                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">N° Asiento</label>',
        '                <input type="text" id="entryNumber" value="' + entry.number + '" readonly',
        '                    class="w-full h-10 px-3 rounded-lg bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all dark:bg-slate-800 dark:border-slate-600 dark:text-white">',
        '            </div>',
        '            <div>',
        '                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Contable *</label>',
        '                <input type="date" id="entryDate" value="' + entry.date + '" required',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            </div>',
        '            <div>',
        '                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha Documento</label>',
        '                <input type="date" id="entryDocDate" value="' + (entry.documentDate || entry.date) + '"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            </div>',
        '            <div>',
        '                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia</label>',
        '                <input type="text" id="entryDocRef" value="' + this.escapeHtml(entry.documentRef || '') + '" placeholder="Factura, Recibo..."',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            </div>',
        '        </div>',
        '        <div>',
        '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto *</label>',
        '            <input type="text" id="entryConcept" value="' + this.escapeHtml(entry.concept || '') + '" placeholder="Descripción del asiento" required',
        '                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '        </div>',
        '        <div class="border-t dark:border-slate-700 pt-4">',
        '            <div class="flex justify-between items-center mb-3">',
        '                <h4 class="font-medium dark:text-white">Líneas del Asiento</h4>',
        '                <button onclick="ui.accountingAddEntryLine()" class="px-3 py-1 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700">',
        '                    <i class="fas fa-plus mr-1"></i>Agregar línea',
        '                </button>',
        '            </div>',
        '            <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">',
        '                <div class="grid grid-cols-12 gap-2 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">',
        '                    <div class="col-span-3">Cuenta SYSCOHADA</div>',
        '                    <div class="col-span-3">Descripción</div>',
        '                    <div class="col-span-2">Centro Costo</div>',
        '                    <div class="col-span-1 text-right">Debe</div>',
        '                    <div class="col-span-1 text-right">Haber</div>',
        '                    <div class="col-span-1"></div>',
        '                </div>',
        '                <div id="entryLinesContainer">',
        renderLines(),
        '                </div>',
        '            </div>',
        '        </div>',
        '        <div class="flex justify-between items-center p-4 rounded-xl ' + (this.isBalanced(entry.lines) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20') + '">',
        '            <div class="flex items-center gap-2">',
        '                <i id="balanceIcon" class="fas ' + (this.isBalanced(entry.lines) ? 'fa-check-circle text-emerald-500' : 'fa-exclamation-circle text-red-500') + ' text-xl"></i>',
        '                <span id="balanceText" class="font-medium ' + (this.isBalanced(entry.lines) ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400') + '">',
        '                    ' + (this.isBalanced(entry.lines) ? 'Asiento cuadrado' : 'Diferencia: ' + this.formatMoney(this.getDiff(entry.lines))),
        '                </span>',
        '            </div>',
        '            <div class="flex gap-4 font-mono dark:text-white">',
        '                <div>Total Debe: <span id="totalDebe">' + this.formatMoney(this.getTotalDebe(entry.lines)) + '</span></div>',
        '                <div>Total Haber: <span id="totalHaber">' + this.formatMoney(this.getTotalHaber(entry.lines)) + '</span></div>',
        '            </div>',
        '        </div>',
        '    </div>'
        ].join(''),
        footer: [
        '    <div class="flex justify-end gap-2">',
        '        <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>',
        '        <button onclick="ui.accountingSaveEntry(\'' + (entry.id || '') + '\')" class="px-4 py-2 rounded-xl btn-primary-gradient text-white">Guardar Asiento</button>',
        '    </div>'
        ].join('')
    });
    
    // Guardar referencia al entry en curso
    this._currentEntry = entry;
};


proto.isBalanced = function(lines) {
    if (!lines || lines.length === 0) return false;
    const totalDebe = lines.reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
    const totalHaber = lines.reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
    return Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;
};


proto.getTotalDebe = function(lines) {
    return (lines || []).reduce((sum, l) => sum + (parseFloat(l.debe) || 0), 0);
};


proto.getTotalHaber = function(lines) {
    return (lines || []).reduce((sum, l) => sum + (parseFloat(l.haber) || 0), 0);
};


proto.getDiff = function(lines) {
    return Math.abs(this.getTotalDebe(lines) - this.getTotalHaber(lines));
};

/**
 * Obtiene el siguiente número de asiento
 */

proto.accountingGetNextEntryNumber = function() {
    const now = new Date();
    const prefix = now.getFullYear();
    const ts = String(now.getFullYear()) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return prefix + '-' + ts + '-' + rand;
};

/**
 * Genera UUID v4 para IDs internos
 */
/**
 * Crea una entrada contable con metadata de usuario
 */
proto.accountingCreateEntry = function(entryData) {
    const sessionUser = store.get('session')?.user || store.get('user');
    const entry = {
        ...entryData,
        createdBy: entryData.createdBy || sessionUser?.id || sessionUser?.email || 'system',
        createdAt: entryData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    const saved = store.add('accountingEntries', entry);
    this.accountingApplyBalances({ ...entry, id: saved.id });
    return saved;
};

proto.accountingGenerateUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

/**
 * Agrega una línea al asiento
 */

proto.accountingAddEntryLine = function() {
    if (!this._currentEntry) return;
    const newLine = { id: Date.now(), accountCode: '', description: '', costCenter: '', debe: '', haber: '' };
    this._currentEntry.lines.push(newLine);
    this.accountingRefreshEntryLines();
};

/**
 * Elimina una línea del asiento
 */

proto.accountingRemoveEntryLine = function(index) {
    if (!this._currentEntry || this._currentEntry.lines.length <= 1) return;
    this._currentEntry.lines.splice(index, 1);
    this.accountingRefreshEntryLines();
};

/**
 * Actualiza el balance del asiento en tiempo real
 */

proto.accountingUpdateEntryBalance = function() {
    const container = document.getElementById('entryLinesContainer');
    if (!container) return;
    
    const lines = [];
    container.querySelectorAll('.entry-line').forEach(lineEl => {
        lines.push({
            debe: parseFloat(lineEl.querySelector('.debe-input')?.value) || 0,
            haber: parseFloat(lineEl.querySelector('.haber-input')?.value) || 0
        });
    });
    
    const totalDebe = lines.reduce((sum, l) => sum + l.debe, 0);
    const totalHaber = lines.reduce((sum, l) => sum + l.haber, 0);
    const diff = Math.abs(totalDebe - totalHaber);
    const balanced = diff < 0.01 && totalDebe > 0;
    
    const balanceIcon = document.getElementById('balanceIcon');
    const balanceText = document.getElementById('balanceText');
    const totalDebeEl = document.getElementById('totalDebe');
    const totalHaberEl = document.getElementById('totalHaber');
    
    if (balanceIcon) {
        balanceIcon.className = 'fas ' + (balanced ? 'fa-check-circle text-emerald-500' : 'fa-exclamation-circle text-red-500') + ' text-xl';
    }
    if (balanceText) {
        balanceText.className = 'font-medium ' + (balanced ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400');
        balanceText.textContent = balanced ? 'Asiento cuadrado' : 'Diferencia: ' + this.formatMoney(diff);
    }
    if (totalDebeEl) totalDebeEl.textContent = this.formatMoney(totalDebe);
    if (totalHaberEl) totalHaberEl.textContent = this.formatMoney(totalHaber);
};

/**
 * Refresca las líneas del asiento en el modal
 */

proto.accountingRefreshEntryLines = function() {
    const container = document.getElementById('entryLinesContainer');
    if (!container || !this._currentEntry) return;
    
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    const costCenters = (store.get('accountingConfigs') || {}).costCenters || ['General'];
    
    container.innerHTML = (this._currentEntry.lines || []).map((line, idx) => [
        '        <div class="grid grid-cols-12 gap-2 mb-2 entry-line" data-index="' + idx + '">',
        '            <div class="col-span-3">',
        '                <select class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm account-select">',
        '                    <option value="">Seleccionar cuenta</option>',
        accounts.map(acc => '<option value="' + acc.code + '" ' + (line.accountCode === acc.code ? 'selected' : '') + '>' + acc.code + ' - ' + acc.name + '</option>').join(''),
        '                </select>',
        '            </div>',
        '            <div class="col-span-3">',
        '                <input type="text" placeholder="Descripción" value="' + this.escapeHtml(line.description || '') + '"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm desc-input">',
        '            </div>',
        '            <div class="col-span-2">',
        '                <select class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm cost-center-select">',
        costCenters.map(cc => '<option value="' + cc + '" ' + (line.costCenter === cc ? 'selected' : '') + '>' + cc + '</option>').join(''),
        '                </select>',
        '            </div>',
        '            <div class="col-span-1">',
        '                <input type="number" placeholder="Debe" value="' + (line.debe || '') + '" step="0.01" min="0"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right debe-input" onchange="ui.accountingUpdateEntryBalance()">',
        '            </div>',
        '            <div class="col-span-1">',
        '                <input type="number" placeholder="Haber" value="' + (line.haber || '') + '" step="0.01" min="0"',
        '                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right haber-input" onchange="ui.accountingUpdateEntryBalance()">',
        '            </div>',
        '            <div class="col-span-1 flex items-center justify-center">',
        '                <button onclick="ui.accountingRemoveEntryLine(' + idx + ')" class="text-red-500 hover:text-red-700 ' + (this._currentEntry.lines.length <= 1 ? 'hidden' : '') + '">',
        '                    <i class="fas fa-times"></i>',
        '                </button>',
        '            </div>',
        '        </div>'
    ].join('')).join('');
    
    this.accountingUpdateEntryBalance();
};

/**
 * Guarda el asiento contable
 */

proto.accountingSaveEntry = function(entryId) {
    const number = document.getElementById('entryNumber')?.value;
    const date = document.getElementById('entryDate')?.value;
    const documentDate = document.getElementById('entryDocDate')?.value;
    const concept = document.getElementById('entryConcept')?.value;
    const documentRef = document.getElementById('entryDocRef')?.value;
    
    if (!date || !concept) {
        this.showToast('Fecha y concepto son obligatorios', 'error');
        return;
    }
    
    const conceptTrimmed = concept.trim();
    if (conceptTrimmed.length < 3) {
        this.showToast('El concepto debe tener al menos 3 caracteres', 'error');
        return;
    }
    
    if (this.accountingIsPeriodLocked(date)) {
        this.showToast('El periodo contable está bloqueado. No se pueden registrar asientos.', 'error');
        return;
    }
    
    const accounts = store.get('accountingAccounts') || [];
    
    // Recopilar y validar líneas
    const lines = [];
    const container = document.getElementById('entryLinesContainer');
    const errors = [];
    container.querySelectorAll('.entry-line').forEach((lineEl, idx) => {
        const accountCode = lineEl.querySelector('.account-select')?.value;
        const description = lineEl.querySelector('.desc-input')?.value;
        const costCenter = lineEl.querySelector('.cost-center-select')?.value || 'General';
        const debe = parseFloat(lineEl.querySelector('.debe-input')?.value) || 0;
        const haber = parseFloat(lineEl.querySelector('.haber-input')?.value) || 0;
        
        // Validar cuenta existe
        if (accountCode) {
            const accountExists = accounts.some(a => a.code === accountCode && a.active !== false);
            if (!accountExists) {
                errors.push('Línea ' + (idx + 1) + ': La cuenta ' + accountCode + ' no existe o está inactiva');
                return;
            }
        }
        
        // Validar no negativos
        if (debe < 0 || haber < 0) {
            errors.push('Línea ' + (idx + 1) + ': No se permiten importes negativos');
            return;
        }
        
        // Cada línea debe tener Debe o Haber (no ambos cero si hay cuenta)
        if (accountCode && debe === 0 && haber === 0) {
            errors.push('Línea ' + (idx + 1) + ': Debe tener un importe en Debe o Haber');
            return;
        }
        
        if (accountCode && (debe > 0 || haber > 0)) {
            lines.push({ accountCode, description, costCenter, debe, haber });
        }
    });
    
    if (errors.length > 0) {
        this.showToast('Errores de validación:\n' + errors.join('\n'), 'error');
        return;
    }
    
    if (lines.length < 2) {
        this.showToast('El asiento debe tener al menos 2 líneas con cuenta e importe', 'error');
        return;
    }
    
    const totalDebe = lines.reduce((sum, l) => sum + l.debe, 0);
    const totalHaber = lines.reduce((sum, l) => sum + l.haber, 0);
    
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
        this.showToast('El asiento no está cuadrado. Diferencia: ' + this.formatMoney(Math.abs(totalDebe - totalHaber)), 'error');
        return;
    }
    
    // Preservar createdAt en edición
    let originalCreatedAt;
    let oldLines;
    if (entryId) {
        const oldEntry = store.getById('accountingEntries', entryId);
        originalCreatedAt = oldEntry?.createdAt || new Date().toISOString();
        oldLines = oldEntry?.lines ? [...oldEntry.lines] : [];
    }
    
    const sessionUser = store.get('session')?.user || store.get('user');
    const createdBy = sessionUser?.id || sessionUser?.email || 'system';
    
    const entry = {
        number,
        date,
        documentDate: documentDate || date,
        concept: conceptTrimmed,
        documentRef,
        lines,
        totalDebe,
        totalHaber,
        status: 'posted',
        createdBy: entryId ? undefined : createdBy,
        createdAt: entryId ? originalCreatedAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (entryId) {
        // Actualización atómica: aplicar delta neto entre líneas viejas y nuevas
        this.accountingApplyDeltaBalances(oldLines, lines);
        store.update('accountingEntries', entryId, {
            ...entry,
            updatedAt: new Date().toISOString()
        });
    } else {
        this.accountingCreateEntry(entry);
    }
    
    // Incrementar número de asiento
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.closeModal();
    this.showToast('Asiento guardado correctamente', 'success');
    this.accountingRenderTab('journal', document.getElementById('accountingContent'));
};

/**
 * Elimina un asiento
 */

proto.accountingDeleteEntry = function(entryId) {
    if (!confirm('¿Está seguro de eliminar este asiento?')) return;
    
    const entry = store.getById('accountingEntries', entryId);
    if (entry && this.accountingIsPeriodLocked(entry.date)) {
        this.showToast('El periodo contable está bloqueado. No se pueden eliminar asientos.', 'error');
        return;
    }
    if (entry) {
        this.accountingReverseBalances(entry);
        store.delete('accountingEntries', entryId);
        this.showToast('Asiento eliminado', 'success');
        this.accountingRenderTab('journal', document.getElementById('accountingContent'));
    }
};

/**
 * Aplica los saldos de un asiento a las cuentas
 */


proto.accountingApplyBalances = function(entry) {
    if (!entry || !entry.lines) return;
    const deb = entry.lines.reduce((s, l) => s + (l.debe || 0), 0);
    const hab = entry.lines.reduce((s, l) => s + (l.haber || 0), 0);
    if (Math.abs(deb - hab) > 0.01) {
        this.showToast('ERROR: asiento desbalanceado (D=' + deb + ' H=' + hab + '). No se aplican saldos.', 'error');
        return;
    }
    const accounts = store.get('accountingAccounts');
    
    entry.lines.forEach(line => {
        if (!line.accountCode) return;
        
        const account = accounts.find(a => a.code === line.accountCode);
        if (!account) return;
        
        let change = 0;
        if (account.nature === 'debtor') {
            change = (line.debe || 0) - (line.haber || 0);
        } else if (account.nature === 'creditor') {
            change = (line.haber || 0) - (line.debe || 0);
        }
        
        const newBalance = (account.balance || 0) + change;
        const accountIndex = accounts.findIndex(a => a.code === line.accountCode);
        if (accountIndex >= 0) {
            accounts[accountIndex].balance = newBalance;
        }
    });
    
    store.save('accountingAccounts', accounts);
};

/**
 * Revierte los saldos de un asiento (para edición/eliminación)
 */

proto.accountingReverseBalances = function(entry) {
    if (!entry || !entry.lines) return;
    
    entry.lines.forEach(line => {
        if (!line.accountCode) return;
        
        const accounts = store.get('accountingAccounts');
        const account = accounts.find(a => a.code === line.accountCode);
        if (!account) return;
        
        let change = 0;
        if (account.nature === 'debtor') {
            change = (line.haber || 0) - (line.debe || 0); // Inverso
        } else if (account.nature === 'creditor') {
            change = (line.debe || 0) - (line.haber || 0); // Inverso
        }
        
        const newBalance = (account.balance || 0) + change;
        const accountIndex = accounts.findIndex(a => a.code === line.accountCode);
        if (accountIndex >= 0) {
            accounts[accountIndex].balance = newBalance;
        }
    });
    
    store.save('accountingAccounts', accounts);
};

/**
 * Aplica delta atómico entre líneas viejas y nuevas (para edición)
 */
proto.accountingApplyDeltaBalances = function(oldLines, newLines) {
    const accounts = store.get('accountingAccounts');
    if (!accounts) return;
    
    const deltaMap = {};
    
    const addToDelta = (lines, sign) => {
        (lines || []).forEach(line => {
            if (!line.accountCode) return;
            const account = accounts.find(a => a.code === line.accountCode);
            if (!account) return;
            
            let change = 0;
            if (account.nature === 'debtor') {
                change = (line.debe || 0) - (line.haber || 0);
            } else if (account.nature === 'creditor') {
                change = (line.haber || 0) - (line.debe || 0);
            }
            deltaMap[line.accountCode] = (deltaMap[line.accountCode] || 0) + change * sign;
        });
    };
    
    addToDelta(oldLines, -1); // Remove old effect
    addToDelta(newLines, 1);  // Add new effect
    
    Object.entries(deltaMap).forEach(([code, delta]) => {
        if (Math.abs(delta) < 0.001) return;
        const idx = accounts.findIndex(a => a.code === code);
        if (idx >= 0) {
            accounts[idx].balance = (accounts[idx].balance || 0) + delta;
        }
    });
    
    store.save('accountingAccounts', accounts);
};

/**
 * Renderiza el Libro Mayor
 */

proto.accountingRenderLedger = function(contentEl) {
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    const entries = store.get('accountingEntries');
    const selectedAccount = document.getElementById('ledgerAccountSelect')?.value;
    const dateFrom = document.getElementById('ledgerDateFrom')?.value || '';
    const dateTo = document.getElementById('ledgerDateTo')?.value || '';
    
    let html = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">',
        '        <div class="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">',
        '            <select id="ledgerAccountSelect" onchange="ui.accountingRenderLedger(document.getElementById(\'accountingContent\'))"',
        '                class="w-full sm:w-80 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white">',
        '                <option value="">Seleccionar cuenta...</option>',
        accounts.map(acc => '<option value="' + acc.code + '" ' + (selectedAccount === acc.code ? 'selected' : '') + '>' + acc.code + ' - ' + acc.name + '</option>').join(''),
        '            </select>',
        '            <input type="date" id="ledgerDateFrom" value="' + dateFrom + '" placeholder="Desde" onchange="ui.accountingRenderLedger(document.getElementById(\'accountingContent\'))"',
        '                class="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '            <input type="date" id="ledgerDateTo" value="' + dateTo + '" placeholder="Hasta" onchange="ui.accountingRenderLedger(document.getElementById(\'accountingContent\'))"',
        '                class="px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
        '        </div>',
        '        <button onclick="ui.accountingExportLedger()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">',
        '            <i class="fas fa-file-excel mr-2"></i>Exportar Mayor',
        '        </button>',
        '    </div>'
    ].join('');
    
    if (!selectedAccount) {
        html += [
        '    <div class="text-center py-12 text-slate-500 dark:text-slate-400">',
        '        <i class="fas fa-book-open text-4xl mb-4 opacity-50"></i>',
        '        <p>Seleccione una cuenta para ver su movimiento</p>',
        '    </div>',
        '</div>'
        ].join('');
        contentEl.innerHTML = html;
        return;
    }
    
    const account = accounts.find(a => a.code === selectedAccount);
    if (!account) {
        contentEl.innerHTML = html + '<p class="text-red-500">Cuenta no encontrada</p></div>';
        return;
    }
    
    // Filtrar líneas de asientos para esta cuenta
    const allMovements = [];
    entries.forEach(entry => {
        (entry.lines || []).forEach(line => {
            if (line.accountCode === selectedAccount) {
                allMovements.push({
                    date: entry.date,
                    entryNumber: entry.number,
                    concept: entry.concept,
                    documentRef: entry.documentRef,
                    debe: line.debe || 0,
                    haber: line.haber || 0
                });
            }
        });
    });
    
    allMovements.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calcular saldo inicial (movimientos antes de dateFrom)
    let initialBalance = 0;
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : null;
    
    const preMovements = fromDate ? allMovements.filter(m => new Date(m.date) < fromDate) : [];
    preMovements.forEach(m => {
        if (account.nature === 'debtor') {
            initialBalance += m.debe - m.haber;
        } else {
            initialBalance += m.haber - m.debe;
        }
    });
    
    const movements = allMovements.filter(m => {
        const d = new Date(m.date);
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
    });
    
    // Calcular saldos
    let runningBalance = initialBalance;
    const movementsWithBalance = movements.map(m => {
        if (account.nature === 'debtor') {
            runningBalance += m.debe - m.haber;
        } else {
            runningBalance += m.haber - m.debe;
        }
        return { ...m, balance: runningBalance };
    });
    
    const totalDebe = movements.reduce((s, m) => s + m.debe, 0);
    const totalHaber = movements.reduce((s, m) => s + m.haber, 0);
    
    html += [
        '    <div class="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4 mb-4">',
        '        <div class="flex flex-wrap gap-4">',
        '            <div><span class="text-sm text-slate-500 dark:text-slate-400">Cuenta:</span> <span class="font-medium dark:text-white">' + account.code + ' - ' + account.name + '</span></div>',
        '            <div><span class="text-sm text-slate-500 dark:text-slate-400">Naturaleza:</span> <span class="font-medium dark:text-white">' + (account.nature === 'debtor' ? 'Deudora' : 'Acreedora') + '</span></div>',
        '            <div><span class="text-sm text-slate-500 dark:text-slate-400">Saldo Actual:</span> <span class="font-mono font-medium ' + (runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + this.formatMoney(runningBalance) + '</span></div>',
        '        </div>',
        '    </div>',
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Asiento</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Concepto</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Debe</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Haber</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        (initialBalance !== 0 || preMovements.length > 0) ? [
        '                <tr class="bg-amber-50 dark:bg-amber-900/20 font-medium">',
        '                    <td class="px-4 py-3 text-amber-700 dark:text-amber-400" colspan="3">Saldo Inicial (' + preMovements.length + ' movimientos anteriores)</td>',
        '                    <td class="px-4 py-3"></td>',
        '                    <td class="px-4 py-3"></td>',
        '                    <td class="px-4 py-3 text-right font-mono font-medium text-amber-700 dark:text-amber-400">' + this.formatMoney(initialBalance) + '</td>',
        '                </tr>'
        ].join('') : '',
        movementsWithBalance.map(m => [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + new Date(m.date).toLocaleDateString('es-ES') + '</td>',
        '                    <td class="px-4 py-3 font-mono dark:text-white">' + this.escapeHtml(m.entryNumber) + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(m.concept) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + (m.debe > 0 ? this.formatMoney(m.debe) : '-') + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + (m.haber > 0 ? this.formatMoney(m.haber) : '-') + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono font-medium ' + (m.balance >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + this.formatMoney(m.balance) + '</td>',
        '                </tr>'
        ].join('')).join(''),
        '                <tr class="bg-slate-50 dark:bg-slate-700 font-semibold">',
        '                    <td colspan="3" class="px-4 py-3 text-right dark:text-white">TOTALES DEL PERIODO</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(totalDebe) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(totalHaber) + '</td>',
        '                    <td class="px-4 py-3"></td>',
        '                </tr>',
        '            </tbody>',
        '        </table>',
        movements.length === 0 && initialBalance === 0 ? '<p class="text-center py-8 text-slate-500 dark:text-slate-400">No hay movimientos para esta cuenta en el rango seleccionado</p>' : '',
        '    </div>',
        '</div>'
    ].join('');
    
    contentEl.innerHTML = html;
};

/**
 * Renderiza los Balances OHADA
 */

proto.accountingRenderBalances = function(contentEl) {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    
    // Calcular sumas y saldos (Balance 6 columnas)
    const accountBalances = {};
    entries.forEach(entry => {
        (entry.lines || []).forEach(line => {
            if (!line.accountCode) return;
            if (!accountBalances[line.accountCode]) {
                accountBalances[line.accountCode] = { sumDebe: 0, sumHaber: 0 };
            }
            accountBalances[line.accountCode].sumDebe += line.debe || 0;
            accountBalances[line.accountCode].sumHaber += line.haber || 0;
        });
    });
    
    // Calcular saldos deudores/acreedores
    Object.keys(accountBalances).forEach(code => {
        const bal = accountBalances[code];
        const account = accounts.find(a => a.code === code);
        const net = bal.sumDebe - bal.sumHaber;
        
        if (account?.nature === 'debtor') {
            bal.saldoDeudor = net > 0 ? net : 0;
            bal.saldoAcreedor = net < 0 ? Math.abs(net) : 0;
        } else {
            bal.saldoDeudor = net < 0 ? Math.abs(net) : 0;
            bal.saldoAcreedor = net > 0 ? net : 0;
        }
    });
    
    // Balance de situación SYSCOHADA con desglose por naturaleza
    const activoNoCorriente = this.accountingGetGroupBalance(accounts, accountBalances, [2]);
    const activoCorrienteStocks = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [3], ['debtor']);
    const activoCorrienteTerceros = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [4], ['debtor']);
    const activoCorrienteTesoreria = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [5], ['debtor']);
    const activoCorriente = activoCorrienteStocks + activoCorrienteTerceros + activoCorrienteTesoreria;
    const patrimonio = this.accountingGetGroupBalance(accounts, accountBalances, [1]);
    const pasivoTerceros = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [4], ['creditor']);
    const pasivoTesoreria = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [5], ['creditor']);
    const pasivoCorriente = pasivoTerceros + pasivoTesoreria;
    
    // Cuenta de resultados
    const ingresos = accounts.filter(a => a.class === 7).reduce((s, a) => {
        const bal = accountBalances[a.code];
        return s + (bal ? bal.sumHaber - bal.sumDebe : 0);
    }, 0);
    const gastos = accounts.filter(a => a.class === 6).reduce((s, a) => {
        const bal = accountBalances[a.code];
        return s + (bal ? bal.sumDebe - bal.sumHaber : 0);
    }, 0);
    const resultado = ingresos - gastos;
    
    // Verificar ecuación patrimonial
    const totalActivo = activoNoCorriente + activoCorriente;
    const totalPasivoPatrimonio = patrimonio + pasivoCorriente;
    const isBalanced = Math.abs(totalActivo - totalPasivoPatrimonio) < 0.01;
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="flex flex-wrap gap-2">',
        '        <button onclick="ui.accountingExportBalances()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm">',
        '            <i class="fas fa-file-excel mr-2"></i>Exportar Balance',
        '        </button>',
        '    </div>',
        // Ecuación Patrimonial
        '    <div class="p-4 rounded-xl ' + (isBalanced ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800') + '">',
        '        <div class="flex flex-col md:flex-row items-center justify-center gap-4 text-center">',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">ACTIVO</p>',
        '                <p class="text-xl font-bold dark:text-white">' + this.formatMoney(totalActivo) + '</p>',
        '            </div>',
        '            <div class="text-2xl dark:text-gray-400">=</div>',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">PATRIMONIO</p>',
        '                <p class="text-xl font-bold dark:text-white">' + this.formatMoney(patrimonio) + '</p>',
        '            </div>',
        '            <div class="text-2xl dark:text-gray-400">+</div>',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">PASIVO</p>',
        '                <p class="text-xl font-bold dark:text-white">' + this.formatMoney(pasivoCorriente) + '</p>',
        '            </div>',
        '            <div class="ml-4">',
        '                <i class="fas ' + (isBalanced ? 'fa-check-circle text-emerald-500' : 'fa-exclamation-circle text-red-500') + ' text-2xl"></i>',
        '            </div>',
        '        </div>',
        '    </div>',
        // Balance de Situación
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="text-lg font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Balance de Situación</h3>',
        '            <div class="space-y-3">',
        '                <div class="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">',
        '                    <span class="font-medium dark:text-white">Activo No Corriente (Clase 2)</span>',
        '                    <span class="font-mono font-bold text-blue-700 dark:text-blue-400">' + this.formatMoney(activoNoCorriente) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-2 pl-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">',
        '                    <span class="text-sm dark:text-gray-300">Activo Corriente — Stocks (Clase 3)</span>',
        '                    <span class="font-mono text-sm text-cyan-700 dark:text-cyan-400">' + this.formatMoney(activoCorrienteStocks) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-2 pl-8 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg">',
        '                    <span class="text-sm dark:text-gray-300">Activo Corriente — Terceros Deudores (Clase 4)</span>',
        '                    <span class="font-mono text-sm text-purple-700 dark:text-purple-400">' + this.formatMoney(activoCorrienteTerceros) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-2 pl-8 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg">',
        '                    <span class="text-sm dark:text-gray-300">Activo Corriente — Tesorería (Clase 5)</span>',
        '                    <span class="font-mono text-sm text-rose-700 dark:text-rose-400">' + this.formatMoney(activoCorrienteTesoreria) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">',
        '                    <span class="font-medium dark:text-white">Activo Corriente (Clases 3-5)</span>',
        '                    <span class="font-mono font-bold text-cyan-700 dark:text-cyan-400">' + this.formatMoney(activoCorriente) + '</span>',
        '                </div>',
        '                <div class="border-t dark:border-slate-700 pt-3 flex justify-between items-center">',
        '                    <span class="font-bold dark:text-white">TOTAL ACTIVO</span>',
        '                    <span class="font-mono font-bold text-lg dark:text-white">' + this.formatMoney(totalActivo) + '</span>',
        '                </div>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <h3 class="text-lg font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Pasivo y Patrimonio</h3>',
        '            <div class="space-y-3">',
        '                <div class="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">',
        '                    <span class="font-medium dark:text-white">Patrimonio Neto (Clase 1)</span>',
        '                    <span class="font-mono font-bold text-emerald-700 dark:text-emerald-400">' + this.formatMoney(patrimonio) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-2 pl-8 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">',
        '                    <span class="text-sm dark:text-gray-300">Pasivo — Terceros Acreedores (Clase 4)</span>',
        '                    <span class="font-mono text-sm text-amber-700 dark:text-amber-400">' + this.formatMoney(pasivoTerceros) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-2 pl-8 bg-red-50/50 dark:bg-red-900/10 rounded-lg">',
        '                    <span class="text-sm dark:text-gray-300">Pasivo — Tesorería (Clase 5) / Descubiertos</span>',
        '                    <span class="font-mono text-sm text-red-700 dark:text-red-400">' + this.formatMoney(pasivoTesoreria) + '</span>',
        '                </div>',
        '                <div class="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">',
        '                    <span class="font-medium dark:text-white">Pasivo Corriente</span>',
        '                    <span class="font-mono font-bold text-amber-700 dark:text-amber-400">' + this.formatMoney(pasivoCorriente) + '</span>',
        '                </div>',
        '                <div class="border-t dark:border-slate-700 pt-3 flex justify-between items-center">',
        '                    <span class="font-bold dark:text-white">TOTAL PASIVO + PATRIMONIO</span>',
        '                    <span class="font-mono font-bold text-lg dark:text-white">' + this.formatMoney(totalPasivoPatrimonio) + '</span>',
        '                </div>',
        '            </div>',
        '        </div>',
        '    </div>',
        // Cuenta de Resultados
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="text-lg font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Cuenta de Resultados</h3>',
        '        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '            <div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">INGRESOS (Clase 7)</p>',
        '                <p class="text-2xl font-bold text-green-700 dark:text-green-400">' + this.formatMoney(ingresos) + '</p>',
        '            </div>',
        '            <div class="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">GASTOS (Clase 6)</p>',
        '                <p class="text-2xl font-bold text-red-700 dark:text-red-400">' + this.formatMoney(gastos) + '</p>',
        '            </div>',
        '            <div class="text-center p-4 ' + (resultado >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20') + ' rounded-xl">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">RESULTADO</p>',
        '                <p class="text-2xl font-bold ' + (resultado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400') + '">',
        '                    ' + (resultado >= 0 ? '+' : '') + this.formatMoney(resultado),
        '                </p>',
        '                <p class="text-xs ' + (resultado >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + (resultado >= 0 ? 'BENEFICIO' : 'PÉRDIDA') + '</p>',
        '            </div>',
        '        </div>',
        '    </div>',
        // Balance de Sumas y Saldos (6 columnas)
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h3 class="text-lg font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Balance de Sumas y Saldos</h3>',
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-slate-50 dark:bg-slate-700">',
        '                    <tr>',
        '                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Cuenta</th>',
        '                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Suma Debe</th>',
        '                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Suma Haber</th>',
        '                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo Deudor</th>',
        '                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Saldo Acreedor</th>',
        '                    </tr>',
        '                </thead>',
        '                <tbody class="divide-y dark:divide-gray-700">',
        Object.keys(accountBalances).sort().map(code => {
            const bal = accountBalances[code];
            const acc = accounts.find(a => a.code === code);
            return [
        '                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                        <td class="px-3 py-2">',
        '                            <span class="font-mono text-sm dark:text-white">' + code + '</span>',
        '                            <span class="text-sm text-slate-600 dark:text-slate-400 ml-2">' + (acc?.name || '') + '</span>',
        '                        </td>',
        '                        <td class="px-3 py-2 text-right font-mono text-sm dark:text-white">' + this.formatMoney(bal.sumDebe) + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono text-sm dark:text-white">' + this.formatMoney(bal.sumHaber) + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono text-sm text-blue-600 dark:text-blue-400">' + (bal.saldoDeudor > 0 ? this.formatMoney(bal.saldoDeudor) : '-') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono text-sm text-orange-600 dark:text-orange-400">' + (bal.saldoAcreedor > 0 ? this.formatMoney(bal.saldoAcreedor) : '-') + '</td>',
        '                    </tr>'
            ].join('');
        }).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

/**
 * Obtiene el saldo de un grupo de clases
 */

proto.accountingGetGroupBalance = function(accounts, balances, classes) {
    return this.accountingGetGroupBalanceByNature(accounts, balances, classes, null);
};

proto.accountingGetGroupBalanceByNature = function(accounts, balances, classes, natures) {
    return accounts
        .filter(a => classes.includes(a.class) && (!natures || natures.includes(a.nature)))
        .reduce((sum, a) => {
            const bal = balances[a.code];
            if (!bal) return sum;
            if (a.nature === 'debtor') {
                return sum + (bal.sumDebe - bal.sumHaber);
            } else {
                return sum + (bal.sumHaber - bal.sumDebe);
            }
        }, 0);
};

/**
 * Renderiza la importación de ventas
 */


proto.accountingRenderImport = function(contentEl) {
    const sales = store.get('sales');
    const entries = store.get('accountingEntries');
    
    // Filtrar ventas no contabilizadas
    const unaccountedSales = sales.filter(s => 
        s.status === 'completed' && 
        !entries.some(e => e.saleId === s.id || e.documentRef === s.ticket)
    );
    
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
    
    contentEl.innerHTML = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <div>',
        '            <h3 class="text-lg font-bold dark:text-white">Ventas pendientes de contabilizar</h3>',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">' + unaccountedSales.length + ' ventas encontradas</p>',
        '        </div>',
        '        <div class="flex gap-2">',
        '            <button onclick="ui.accountingImportAllSales()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm">',
        '                <i class="fas fa-magic mr-2"></i>Contabilizar Todas',
        '            </button>',
        '        </div>',
        '    </div>',
        unaccountedSales.length === 0 ? [
        '    <div class="text-center py-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">',
        '        <i class="fas fa-check-circle text-4xl text-emerald-500 mb-4"></i>',
        '        <p class="text-emerald-700 dark:text-emerald-400 font-medium">Todas las ventas están contabilizadas</p>',
        '    </div>'
        ].join('') : [
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Ticket</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Cliente</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Método Pago</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Total</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Asiento</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Acciones</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        unaccountedSales.map(sale => {
            const accountMapping = this.accountingGetSaleAccountMapping(sale.paymentMethod);
            const products = store.get('products') || [];
            const saleItems = sale.items || [];
            const accountCodes = {};
            saleItems.forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const code = product.saleAccountCode || '701';
                    accountCodes[code] = (accountCodes[code] || 0) + 1;
                }
            });
            const defaultSaleCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '701';
            return [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + formatDate(sale.date || sale.createdAt) + '</td>',
        '                    <td class="px-4 py-3 font-mono dark:text-white">' + this.escapeHtml(sale.ticket || '-') + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + this.escapeHtml(sale.clientName || 'Cliente General') + '</td>',
        '                    <td class="px-4 py-3">',
        '                        <span class="px-2 py-1 rounded text-xs ' + this.accountingGetPaymentMethodClass(sale.paymentMethod) + '">',
        '                            ' + this.escapeHtml(sale.paymentMethod || 'Efectivo'),
        '                        </span>',
        '                    </td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(sale.total) + '</td>',
        '                    <td class="px-4 py-3 text-center">',
        '                        <div class="text-xs text-slate-500 dark:text-slate-400">',
        '                            <div>' + accountMapping.debe + ' (Debe)</div>',
        '                            <div>' + defaultSaleCode + ' (Haber)</div>',
        '                        </div>',
        '                    </td>',
        '                    <td class="px-4 py-3 text-center">',
        '                        <button onclick="ui.accountingImportSale(\'' + sale.id + '\')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700">',
        '                            <i class="fas fa-check mr-1"></i>Contabilizar',
        '                        </button>',
        '                    </td>',
        '                </tr>'
            ].join('');
        }).join(''),
        '            </tbody>',
        '        </table>',
        '    </div>'
        ].join(''),
        '</div>'
    ].join('');
};

/**
 * Obtiene el mapeo de cuentas según método de pago
 */

proto.accountingGetSaleAccountMapping = function(paymentMethod) {
    const method = (paymentMethod || '').toLowerCase();
    
    if (method.includes('efectivo') || method.includes('cash')) {
        return { debe: '5211', haber: '701', name: 'Caja XAF' };
    }
    if (method.includes('tarjeta') || method.includes('card')) {
        return { debe: '5311', haber: '701', name: 'Banco CCEI' };
    }
    if (method.includes('transferencia') || method.includes('transfer')) {
        return { debe: '5311', haber: '701', name: 'Banco CCEI' };
    }
    if (method.includes('crédito') || method.includes('credito') || method.includes('credit')) {
        return { debe: '411', haber: '701', name: 'Clientes' };
    }
    // Default: Efectivo
    return { debe: '5211', haber: '701', name: 'Caja XAF' };
};

/**
 * Obtiene la clase CSS para el método de pago
 */

proto.accountingGetPaymentMethodClass = function(method) {
    const m = (method || '').toLowerCase();
    if (m.includes('efectivo')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (m.includes('tarjeta')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    if (m.includes('transferencia')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    if (m.includes('crédito')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

/**
 * Contabiliza una venta individual
 */

proto.accountingImportSale = function(saleId) {
    const sale = store.getById('sales', saleId);
    if (!sale) {
        this.showToast('Venta no encontrada', 'error');
        return;
    }
    
    const hasTax = (sale.tax || 0) > 0;
    const tax = hasTax ? (sale.tax || 0) : 0;
    const netTotal = sale.total || 0;
    const base = hasTax ? Math.max(0, netTotal - tax) : netTotal;
    
    // Determine sale account code from products (default 701)
    const products = store.get('products') || [];
    const saleItems = sale.items || [];
    const accountCodes = {};
    let totalCost = 0;
    saleItems.forEach(item => {
        const product = products.find(p => p.id === item.id);
        if (product) {
            const code = product.saleAccountCode || '701';
            const qty = Number(item.qty || item.stockUnitsSold || 1);
            const unitCost = Number(product.cost || 0);
            accountCodes[code] = (accountCodes[code] || 0) + (qty * unitCost);
            totalCost += qty * unitCost;
        }
    });
    const defaultSaleCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '701';
    
    // Build debit lines: handle split payments
    const debitLines = [];
    const splitPayments = sale.splitPayments;
    if (splitPayments && typeof splitPayments === 'object') {
        const methodMap = {
            cash: { debe: '5211', name: 'Caja XAF' },
            card: { debe: '5311', name: 'Banco CCEI' },
            mobile: { debe: '5311', name: 'Banco CCEI' },
            credit: { debe: '411', name: 'Clientes' },
            wallet: { debe: '411', name: 'Clientes' }
        };
        let splitTotal = 0;
        Object.entries(splitPayments).forEach(([method, amount]) => {
            const amt = parseFloat(amount) || 0;
            if (amt <= 0) return;
            splitTotal += amt;
            const m = methodMap[method.toLowerCase()] || this.accountingGetSaleAccountMapping(method);
            debitLines.push({
                accountCode: m.debe,
                description: 'Cobro ' + (m.name || method) + ' - Venta ' + sale.ticket,
                debe: Math.round(amt * 100) / 100,
                haber: 0
            });
        });
        if (Math.abs(splitTotal - netTotal) > 0.01) {
            debitLines.push({
                accountCode: '5211',
                description: 'Diferencia cobro - Venta ' + sale.ticket,
                debe: Math.round((netTotal - splitTotal) * 100) / 100,
                haber: 0
            });
        }
    } else {
        const mapping = this.accountingGetSaleAccountMapping(sale.paymentMethod);
        debitLines.push({
            accountCode: mapping.debe,
            description: 'Cobro ' + mapping.name + ' - Venta ' + sale.ticket,
            debe: netTotal,
            haber: 0
        });
    }
    
    const lines = [
        ...debitLines,
        {
            accountCode: defaultSaleCode,
            description: 'Venta (neta descuento) - ' + sale.ticket,
            debe: 0,
            haber: base
        }
    ];
    if (hasTax) {
        lines.push({
            accountCode: '443',
            description: 'TVA facturée - ' + sale.ticket,
            debe: 0,
            haber: tax
        });
    }
    
    const totalDebe = lines.reduce((s, l) => s + (l.debe || 0), 0);
    const totalHaber = lines.reduce((s, l) => s + (l.haber || 0), 0);
    
    const savedEntry = this.accountingCreateEntry({
        number: this.accountingGetNextEntryNumber(),
        date: new Date(sale.date || sale.createdAt).toISOString().split('T')[0],
        documentDate: new Date(sale.date || sale.createdAt).toISOString().split('T')[0],
        concept: 'Venta ' + (sale.ticket || saleId) + ' - ' + (sale.clientName || 'Cliente General'),
        documentRef: sale.ticket || saleId,
        saleId: sale.id,
        lines,
        totalDebe,
        totalHaber,
        status: 'posted',
        source: 'imported'
    });
    
    // Asiento de costo de ventas (603 / 311)
    if (totalCost > 0) {
        this.accountingCreateEntry({
            number: this.accountingGetNextEntryNumber(),
            date: savedEntry.date,
            documentDate: savedEntry.documentDate,
            concept: 'Costo venta ' + (sale.ticket || saleId),
            documentRef: sale.ticket || saleId,
            saleId: sale.id,
            lines: [
                { accountCode: '603', description: 'Costo de ventas - ' + sale.ticket, debe: totalCost, haber: 0 },
                { accountCode: '311', description: 'Salida inventario - ' + sale.ticket, debe: 0, haber: totalCost }
            ],
            totalDebe: totalCost,
            totalHaber: totalCost,
            status: 'posted',
            source: 'imported-cost'
        });
    }
    
    this.showToast('Venta contabilizada correctamente', 'success');
    this.accountingRenderTab('import', document.getElementById('accountingContent'));
};

/**
 * Crea un savepoint para rollback
 */
proto.accountingCreateSavepoint = function() {
    return {
        entries: JSON.parse(JSON.stringify(store.get('accountingEntries') || [])),
        accounts: JSON.parse(JSON.stringify(store.get('accountingAccounts') || [])),
        configs: JSON.parse(JSON.stringify(store.get('accountingConfigs') || {}))
    };
};

/**
 * Restaura un savepoint (rollback)
 */
proto.accountingRestoreSavepoint = function(sp) {
    if (!sp) return false;
    store.save('accountingEntries', sp.entries);
    store.save('accountingAccounts', sp.accounts);
    store.save('accountingConfigs', sp.configs);
    return true;
};

/**
 * Contabiliza todas las ventas pendientes (batch atómico con rollback)
 */

proto.accountingImportAllSales = function() {
    const sales = store.get('sales');
    const entries = store.get('accountingEntries');
    
    const unaccountedSales = sales.filter(s => 
        s.status === 'completed' && 
        !entries.some(e => e.saleId === s.id || e.documentRef === s.ticket)
    );
    
    if (unaccountedSales.length === 0) {
        this.showToast('No hay ventas pendientes', 'info');
        return;
    }
    
    if (!confirm('¿Contabilizar ' + unaccountedSales.length + ' ventas?')) return;
    
    // Crear savepoint para rollback
    const savepoint = this.accountingCreateSavepoint();
    
    let imported = 0;
    const products = store.get('products') || [];
    let batchError = false;
    
    unaccountedSales.forEach(sale => {
        if (batchError) return;
        try {
            const hasTax = (sale.tax || 0) > 0;
            const tax = hasTax ? (sale.tax || 0) : 0;
            const netTotal = sale.total || 0;
            const base = hasTax ? Math.max(0, netTotal - tax) : netTotal;
            
            const saleItems = sale.items || [];
            const accountCodes = {};
            let totalCost = 0;
            saleItems.forEach(item => {
                const product = products.find(p => p.id === item.id);
                if (product) {
                    const code = product.saleAccountCode || '701';
                    const qty = Number(item.qty || item.stockUnitsSold || 1);
                    const unitCost = Number(product.cost || 0);
                    accountCodes[code] = (accountCodes[code] || 0) + (qty * unitCost);
                    totalCost += qty * unitCost;
                }
            });
            const defaultSaleCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '701';
            
            // Build debit lines: handle split payments
            const debitLines = [];
            const splitPayments = sale.splitPayments;
            if (splitPayments && typeof splitPayments === 'object') {
                const methodMap = {
                    cash: { debe: '5211', name: 'Caja XAF' },
                    card: { debe: '5311', name: 'Banco CCEI' },
                    mobile: { debe: '5311', name: 'Banco CCEI' },
                    credit: { debe: '411', name: 'Clientes' },
                    wallet: { debe: '411', name: 'Clientes' }
                };
                let splitTotal = 0;
                Object.entries(splitPayments).forEach(([method, amount]) => {
                    const amt = parseFloat(amount) || 0;
                    if (amt <= 0) return;
                    splitTotal += amt;
                    const m = methodMap[method.toLowerCase()] || this.accountingGetSaleAccountMapping(method);
                    debitLines.push({
                        accountCode: m.debe,
                        description: 'Cobro ' + (m.name || method),
                        debe: Math.round(amt * 100) / 100,
                        haber: 0
                    });
                });
                if (Math.abs(splitTotal - netTotal) > 0.01) {
                    debitLines.push({
                        accountCode: '5211',
                        description: 'Diferencia cobro',
                        debe: Math.round((netTotal - splitTotal) * 100) / 100,
                        haber: 0
                    });
                }
            } else {
                const mapping = this.accountingGetSaleAccountMapping(sale.paymentMethod);
                debitLines.push({
                    accountCode: mapping.debe,
                    description: 'Cobro ' + mapping.name,
                    debe: netTotal,
                    haber: 0
                });
            }
            
            const lines = [
                ...debitLines,
                { accountCode: defaultSaleCode, description: 'Venta (neta descuento)', debe: 0, haber: base }
            ];
            if (hasTax) {
                lines.push({ accountCode: '443', description: 'TVA facturée', debe: 0, haber: tax });
            }
            
            const totalDebe = lines.reduce((s, l) => s + (l.debe || 0), 0);
            const totalHaber = lines.reduce((s, l) => s + (l.haber || 0), 0);
            
            const entry = {
                number: this.accountingGetNextEntryNumber(),
                date: new Date(sale.date || sale.createdAt).toISOString().split('T')[0],
                documentDate: new Date(sale.date || sale.createdAt).toISOString().split('T')[0],
                concept: 'Venta ' + (sale.ticket || sale.id) + ' - ' + (sale.clientName || 'Cliente General'),
                documentRef: sale.ticket || sale.id,
                saleId: sale.id,
                lines,
                totalDebe,
                totalHaber,
                status: 'posted',
                source: 'imported'
            };
            
            this.accountingCreateEntry(entry);
            imported++;
            
            // Asiento de costo de ventas
            if (totalCost > 0) {
                this.accountingCreateEntry({
                    number: this.accountingGetNextEntryNumber(),
                    date: entry.date,
                    documentDate: entry.documentDate,
                    concept: 'Costo venta ' + (sale.ticket || sale.id),
                    documentRef: sale.ticket || sale.id,
                    saleId: sale.id,
                    lines: [
                        { accountCode: '603', description: 'Costo de ventas', debe: totalCost, haber: 0 },
                        { accountCode: '311', description: 'Salida inventario', debe: 0, haber: totalCost }
                    ],
                    totalDebe: totalCost,
                    totalHaber: totalCost,
                    status: 'posted',
                    source: 'imported-cost'
                });
            }
            
        } catch (e) {
            console.error('Error importando venta', sale.id, e);
            batchError = true;
        }
    });
    
    if (batchError) {
        this.accountingRestoreSavepoint(savepoint);
        this.showToast('Error en batch. Se ha revertido la operación. ' + imported + ' ventas deshechas.', 'error');
    } else {
        this.showToast(imported + ' ventas contabilizadas correctamente', 'success');
    }
    this.accountingRenderTab('import', document.getElementById('accountingContent'));
};

/**
 * Renderiza la conciliación bancaria
 */

proto.accountingRenderReconciliation = function(contentEl) {
    const accounts = store.get('accountingAccounts').filter(a => 
        a.code.startsWith('521') || a.code.startsWith('531')
    );
    
    const selectedAccount = document.getElementById('reconcileAccountSelect')?.value;
    const entries = store.get('accountingEntries');
    const bankStatement = this._currentBankStatement || [];
    
    // Movimientos de la cuenta seleccionada
    let movements = [];
    if (selectedAccount) {
        entries.forEach(entry => {
            (entry.lines || []).forEach((line, lineIdx) => {
                if (line.accountCode === selectedAccount && (line.debe > 0 || line.haber > 0)) {
                    movements.push({
                        id: entry.id + '|' + lineIdx + '|' + line.accountCode,
                        entryId: entry.id,
                        lineIdx: lineIdx,
                        date: entry.date,
                        concept: entry.concept,
                        documentRef: entry.documentRef,
                        amount: line.debe > 0 ? line.debe : -line.haber,
                        reconciled: line.reconciled || false
                    });
                }
            });
        });
    }
    
    // Matching automático con extracto importado
    const unmatchedBank = [];
    bankStatement.forEach(bankTx => {
        const matched = movements.some(m => {
            const sameAmount = Math.abs(Math.abs(m.amount) - Math.abs(bankTx.amount)) < 0.01;
            const sameDate = bankTx.date && m.date && new Date(bankTx.date).toDateString() === new Date(m.date).toDateString();
            return sameAmount && sameDate && m.reconciled;
        });
        if (!matched) unmatchedBank.push(bankTx);
    });
    
    contentEl.innerHTML = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <div class="w-full sm:w-auto">',
        '            <select id="reconcileAccountSelect" onchange="ui.accountingRenderReconciliation(document.getElementById(\'accountingContent\'))"',
        '                class="w-full sm:w-80 px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white">',
        '                <option value="">Seleccionar cuenta bancaria...</option>',
        accounts.map(acc => '<option value="' + acc.code + '" ' + (selectedAccount === acc.code ? 'selected' : '') + '>' + acc.code + ' - ' + acc.name + '</option>').join(''),
        '            </select>',
        '        </div>',
        '        <div class="flex gap-2">',
        '            <button onclick="ui.accountingImportBankStatement()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">',
        '                <i class="fas fa-file-upload mr-2"></i>Importar Extracto',
        '            </button>',
        '        </div>',
        '    </div>',
        !selectedAccount ? [
        '    <div class="text-center py-12 text-slate-500 dark:text-slate-400">',
        '        <i class="fas fa-university text-4xl mb-4 opacity-50"></i>',
        '        <p>Seleccione una cuenta bancaria para conciliar</p>',
        '    </div>'
        ].join('') : [
        '    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 elevation-1">',
        '            <h4 class="font-bold mb-3 dark:text-white">Movimientos del Sistema</h4>',
        '            <div class="rw-table-scroll max-h-96">',
        '                <table class="w-full">',
        '                    <thead class="bg-slate-50 dark:bg-slate-700 text-xs">',
        '                        <tr>',
        '                            <th class="px-2 py-2 text-left">Fecha</th>',
        '                            <th class="px-2 py-2 text-left">Concepto</th>',
        '                            <th class="px-2 py-2 text-right">Monto</th>',
        '                            <th class="px-2 py-2 text-center"><i class="fas fa-check"></i></th>',
        '                        </tr>',
        '                    </thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        movements.length === 0 ? '<tr><td colspan="4" class="px-2 py-4 text-center text-gray-500">Sin movimientos</td></tr>' :
        movements.map(m => [
        '                        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 ' + (m.reconciled ? 'bg-emerald-50 dark:bg-emerald-900/20' : '') + '">',
        '                            <td class="px-2 py-2 dark:text-gray-200">' + new Date(m.date).toLocaleDateString('es-ES') + '</td>',
        '                            <td class="px-2 py-2 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(m.concept) + '</td>',
        '                            <td class="px-2 py-2 text-right font-mono ' + (m.amount >= 0 ? 'text-green-600' : 'text-red-600') + '">' + (m.amount >= 0 ? '+' : '') + this.formatMoney(Math.abs(m.amount)) + '</td>',
        '                            <td class="px-2 py-2 text-center">',
        '                                <input type="checkbox" ' + (m.reconciled ? 'checked' : '') + ' onchange="ui.accountingToggleReconciliation(\'' + m.id + '\')" class="rounded text-sky-600">',
        '                            </td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 elevation-1">',
        '            <h4 class="font-bold mb-3 dark:text-white">Extracto Bancario</h4>',
        unmatchedBank.length === 0 ? [
        '            <div id="bankStatementContainer" class="text-center py-12 text-slate-500 dark:text-slate-400">',
        '                <i class="fas fa-file-csv text-4xl mb-4 opacity-50"></i>',
        bankStatement.length === 0 ? '<p>Importe el extracto bancario para comparar</p><p class="text-xs mt-2">Formatos: CSV</p>' : '<p class="text-emerald-600 font-medium">Todas las transacciones del extracto están conciliadas</p>',
        '            </div>'
        ].join('') : [
        '            <div class="rw-table-scroll max-h-96">',
        '                <table class="w-full">',
        '                    <thead class="bg-slate-50 dark:bg-slate-700 text-xs">',
        '                        <tr><th class="px-2 py-2 text-left">Fecha</th><th class="px-2 py-2 text-left">Concepto</th><th class="px-2 py-2 text-right">Monto</th></tr>',
        '                    </thead>',
        '                    <tbody class="divide-y dark:divide-gray-700 text-sm">',
        unmatchedBank.map((tx, idx) => [
        '                        <tr class="bg-red-50 dark:bg-red-900/20">',
        '                            <td class="px-2 py-2 dark:text-gray-200">' + (tx.date || '-') + '</td>',
        '                            <td class="px-2 py-2 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(tx.concept || '') + '</td>',
        '                            <td class="px-2 py-2 text-right font-mono ' + (tx.amount >= 0 ? 'text-green-600' : 'text-red-600') + '">' + (tx.amount >= 0 ? '+' : '') + this.formatMoney(Math.abs(tx.amount)) + '</td>',
        '                        </tr>'
        ].join('')).join(''),
        '                    </tbody>',
        '                </table>',
        '            </div>'
        ].join(''),
        '        </div>',
        '    </div>',
        '    <div class="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">',
        '        <div class="flex flex-wrap gap-6 justify-center">',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">Movimientos Sistema</p>',
        '                <p class="text-xl font-bold dark:text-white">' + movements.length + '</p>',
        '            </div>',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">Conciliados</p>',
        '                <p class="text-xl font-bold text-emerald-600">' + movements.filter(m => m.reconciled).length + '</p>',
        '            </div>',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">Pendientes</p>',
        '                <p class="text-xl font-bold text-amber-600">' + movements.filter(m => !m.reconciled).length + '</p>',
        '            </div>',
        '            <div class="text-center">',
        '                <p class="text-sm text-slate-500 dark:text-slate-400">Extracto sin match</p>',
        '                <p class="text-xl font-bold text-red-600">' + unmatchedBank.length + '</p>',
        '            </div>',
        '        </div>',
        '    </div>'
        ].join(''),
        '</div>'
    ].join('');
};

/**
 * Renderiza la sección de Bancos
 */
proto.accountingRenderBanks = function(contentEl) {
    const accounts = store.get('accountingAccounts').filter(a => a.active);
    const entries = store.get('accountingEntries');
    
    // Cuentas bancarias: 512, 521, 531 y subcuentas
    const bankAccounts = accounts.filter(a => 
        a.code.startsWith('512') || a.code.startsWith('521') || a.code.startsWith('531')
    ).sort((a, b) => a.code.localeCompare(b.code));
    
    // Movimientos que involucran cuentas bancarias (últimos 50)
    const bankMovements = [];
    entries.forEach(entry => {
        (entry.lines || []).forEach((line, lineIdx) => {
            if (bankAccounts.some(ba => ba.code === line.accountCode) && (line.debe > 0 || line.haber > 0)) {
                const counterpart = (entry.lines || []).find(l => l !== line && (l.debe > 0 || l.haber > 0));
                bankMovements.push({
                    id: entry.id + '|' + lineIdx,
                    entryId: entry.id,
                    date: entry.date,
                    concept: entry.concept,
                    documentRef: entry.documentRef,
                    accountCode: line.accountCode,
                    accountName: bankAccounts.find(ba => ba.code === line.accountCode)?.name || line.accountCode,
                    amount: line.debe > 0 ? line.debe : -line.haber,
                    counterpartAccount: counterpart?.accountCode || '',
                    counterpartName: accounts.find(a => a.code === counterpart?.accountCode)?.name || counterpart?.accountCode || '',
                    type: line.debe > 0 ? 'income' : 'expense'
                });
            }
        });
    });
    bankMovements.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentMovements = bankMovements.slice(0, 50);
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <h3 class="text-lg font-bold dark:text-white">Gestión Bancaria</h3>',
        '        <div class="flex flex-wrap gap-2">',
        '            <button onclick="ui.accountingOpenBankPaymentModal()" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2">',
        '                <i class="fas fa-arrow-up"></i>Pago',
        '            </button>',
        '            <button onclick="ui.accountingOpenBankIncomeModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm flex items-center gap-2">',
        '                <i class="fas fa-arrow-down"></i>Ingreso',
        '            </button>',
        '            <button onclick="ui.accountingOpenBankWithdrawalModal()" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm flex items-center gap-2">',
        '                <i class="fas fa-money-bill-wave"></i>Reintegro',
        '            </button>',
        '        </div>',
        '    </div>',
        // Tarjetas de saldos
        '    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">',
        bankAccounts.length === 0 ? [
        '        <div class="col-span-full text-center py-8 text-slate-500 dark:text-slate-400">',
        '            <i class="fas fa-university text-4xl mb-4 opacity-50"></i>',
        '            <p>No hay cuentas bancarias configuradas</p>',
        '        </div>'
        ].join('') : bankAccounts.map(acc => [
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-5 elevation-1">',
        '            <div class="flex items-center justify-between mb-3">',
        '                <div class="flex items-center gap-3">',
        '                    <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">',
        '                        <i class="fas fa-university"></i>',
        '                    </div>',
        '                    <div>',
        '                        <p class="font-medium dark:text-white text-sm">' + this.escapeHtml(acc.name) + '</p>',
        '                        <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">' + acc.code + '</p>',
        '                    </div>',
        '                </div>',
        '            </div>',
        '            <p class="text-2xl font-bold font-mono dark:text-white">' + this.formatMoney(acc.balance || 0) + '</p>',
        '            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">' + (acc.nature === 'debtor' ? 'Saldo deudor' : 'Saldo acreedor') + '</p>',
        '        </div>'
        ].join('')).join(''),
        '    </div>',
        // Movimientos recientes
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <h4 class="font-bold mb-4 dark:text-white border-b dark:border-slate-700 pb-2">Movimientos Bancarios Recientes</h4>',
        recentMovements.length === 0 ? [
        '        <div class="text-center py-8 text-slate-500 dark:text-slate-400">',
        '            <p>No hay movimientos bancarios registrados</p>',
        '        </div>'
        ].join('') : [
        '        <div class="rw-table-scroll">',
        '            <table class="w-full">',
        '                <thead class="bg-slate-50 dark:bg-slate-700 text-xs">',
        '                    <tr>',
        '                        <th class="px-3 py-2 text-left">Fecha</th>',
        '                        <th class="px-3 py-2 text-left">Concepto</th>',
        '                        <th class="px-3 py-2 text-left">Cuenta</th>',
        '                        <th class="px-3 py-2 text-left">Contrapartida</th>',
        '                        <th class="px-3 py-2 text-right">Monto</th>',
        '                        <th class="px-3 py-2 text-center">Tipo</th>',
        '                    </tr>',
        '                </thead>',
        '                <tbody class="divide-y dark:divide-gray-700 text-sm">',
        recentMovements.map(m => [
        '                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                        <td class="px-3 py-2 dark:text-gray-200">' + new Date(m.date).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-3 py-2 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(m.concept) + '</td>',
        '                        <td class="px-3 py-2 dark:text-gray-200">' + this.escapeHtml(m.accountName) + '</td>',
        '                        <td class="px-3 py-2 dark:text-gray-200">' + (m.counterpartName ? this.escapeHtml(m.counterpartName) : '-') + '</td>',
        '                        <td class="px-3 py-2 text-right font-mono ' + (m.type === 'income' ? 'text-emerald-600' : 'text-red-600') + '">' + (m.type === 'income' ? '+' : '-') + this.formatMoney(Math.abs(m.amount)) + '</td>',
        '                        <td class="px-3 py-2 text-center">',
        '                            <span class="px-2 py-1 rounded-full text-xs ' + (m.type === 'income' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200') + '">',
        '                                ' + (m.type === 'income' ? 'Ingreso' : 'Egreso') + '</span>',
        '                        </td>',
        '                    </tr>'
        ].join('')).join(''),
        '                </tbody>',
        '            </table>',
        '        </div>'
        ].join(''),
        '    </div>',
        '</div>'
    ].join('');
};

/**
 * Abre modal para registrar un pago desde banco
 */
proto.accountingOpenBankPaymentModal = function() {
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    const bankAccounts = accounts.filter(a => a.code.startsWith('512') || a.code.startsWith('521') || a.code.startsWith('531'));
    const expenseAccounts = accounts.filter(a => a.class === 6);
    const supplierAccounts = accounts.filter(a => a.code.startsWith('401'));
    const otherAccounts = accounts.filter(a => ![5,6,7].includes(a.class) && !a.code.startsWith('401'));
    
    const today = new Date().toISOString().split('T')[0];
    
    this.openModal({
        title: 'Nuevo Pago desde Banco',
        size: 'lg',
        content: [
            '<div class="space-y-4">',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Bancaria *</label>',
            '            <select id="bankPaymentBankAccount" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <option value="">Seleccionar cuenta...</option>',
            bankAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha *</label>',
            '            <input type="date" id="bankPaymentDate" value="' + today + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '        </div>',
            '    </div>',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta de Destino *</label>',
            '            <select id="bankPaymentTargetAccount" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <optgroup label="Proveedores">',
            supplierAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '                <optgroup label="Gastos">',
            expenseAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '                <optgroup label="Otras">',
            otherAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importe *</label>',
            '            <input type="number" id="bankPaymentAmount" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right">',
            '        </div>',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto *</label>',
            '        <input type="text" id="bankPaymentConcept" placeholder="Descripción del pago..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia / Documento</label>',
            '        <input type="text" id="bankPaymentRef" placeholder="Nº factura, transferencia..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '</div>'
        ].join(''),
        footer: [
            '<div class="flex justify-end gap-2">',
            '    <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>',
            '    <button onclick="ui.accountingSaveBankPayment()" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white">Guardar Pago</button>',
            '</div>'
        ].join('')
    });
};

/**
 * Guarda un pago desde banco
 */
proto.accountingSaveBankPayment = function() {
    const bankAccount = document.getElementById('bankPaymentBankAccount')?.value;
    const date = document.getElementById('bankPaymentDate')?.value;
    const targetAccount = document.getElementById('bankPaymentTargetAccount')?.value;
    const amount = parseFloat(document.getElementById('bankPaymentAmount')?.value) || 0;
    const concept = document.getElementById('bankPaymentConcept')?.value?.trim();
    const documentRef = document.getElementById('bankPaymentRef')?.value?.trim();
    
    if (!bankAccount || !targetAccount || !date || !concept || amount <= 0) {
        this.showToast('Complete todos los campos obligatorios', 'error');
        return;
    }
    
    if (this.accountingIsPeriodLocked(date)) {
        this.showToast('El periodo contable está bloqueado', 'error');
        return;
    }
    
    const lines = [
        { accountCode: targetAccount, description: concept, debe: amount, haber: 0 },
        { accountCode: bankAccount, description: 'Pago bancario - ' + concept, debe: 0, haber: amount }
    ];
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: date,
        documentDate: date,
        concept: 'Pago: ' + concept,
        documentRef: documentRef || '',
        lines: lines,
        totalDebe: amount,
        totalHaber: amount,
        status: 'posted',
        source: 'bank-payment'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.closeModal();
    this.showToast('Pago registrado correctamente', 'success');
    this.accountingRenderTab('banks', document.getElementById('accountingContent'));
};

/**
 * Abre modal para registrar un ingreso a banco
 */
proto.accountingOpenBankIncomeModal = function() {
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    const bankAccounts = accounts.filter(a => a.code.startsWith('512') || a.code.startsWith('521') || a.code.startsWith('531'));
    const revenueAccounts = accounts.filter(a => a.class === 7);
    const clientAccounts = accounts.filter(a => a.code.startsWith('411'));
    const otherAccounts = accounts.filter(a => ![5,6,7].includes(a.class) && !a.code.startsWith('411'));
    
    const today = new Date().toISOString().split('T')[0];
    
    this.openModal({
        title: 'Nuevo Ingreso a Banco',
        size: 'lg',
        content: [
            '<div class="space-y-4">',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Bancaria *</label>',
            '            <select id="bankIncomeBankAccount" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <option value="">Seleccionar cuenta...</option>',
            bankAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha *</label>',
            '            <input type="date" id="bankIncomeDate" value="' + today + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '        </div>',
            '    </div>',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta de Origen *</label>',
            '            <select id="bankIncomeSourceAccount" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <optgroup label="Clientes">',
            clientAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '                <optgroup label="Ingresos">',
            revenueAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '                <optgroup label="Otras">',
            otherAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importe *</label>',
            '            <input type="number" id="bankIncomeAmount" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right">',
            '        </div>',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto *</label>',
            '        <input type="text" id="bankIncomeConcept" placeholder="Descripción del ingreso..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia / Documento</label>',
            '        <input type="text" id="bankIncomeRef" placeholder="Nº factura, transferencia..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '</div>'
        ].join(''),
        footer: [
            '<div class="flex justify-end gap-2">',
            '    <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>',
            '    <button onclick="ui.accountingSaveBankIncome()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Guardar Ingreso</button>',
            '</div>'
        ].join('')
    });
};

/**
 * Guarda un ingreso a banco
 */
proto.accountingSaveBankIncome = function() {
    const bankAccount = document.getElementById('bankIncomeBankAccount')?.value;
    const date = document.getElementById('bankIncomeDate')?.value;
    const sourceAccount = document.getElementById('bankIncomeSourceAccount')?.value;
    const amount = parseFloat(document.getElementById('bankIncomeAmount')?.value) || 0;
    const concept = document.getElementById('bankIncomeConcept')?.value?.trim();
    const documentRef = document.getElementById('bankIncomeRef')?.value?.trim();
    
    if (!bankAccount || !sourceAccount || !date || !concept || amount <= 0) {
        this.showToast('Complete todos los campos obligatorios', 'error');
        return;
    }
    
    if (this.accountingIsPeriodLocked(date)) {
        this.showToast('El periodo contable está bloqueado', 'error');
        return;
    }
    
    const lines = [
        { accountCode: bankAccount, description: 'Ingreso bancario - ' + concept, debe: amount, haber: 0 },
        { accountCode: sourceAccount, description: concept, debe: 0, haber: amount }
    ];
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: date,
        documentDate: date,
        concept: 'Ingreso: ' + concept,
        documentRef: documentRef || '',
        lines: lines,
        totalDebe: amount,
        totalHaber: amount,
        status: 'posted',
        source: 'bank-income'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.closeModal();
    this.showToast('Ingreso registrado correctamente', 'success');
    this.accountingRenderTab('banks', document.getElementById('accountingContent'));
};

/**
 * Abre modal para registrar un reintegro de banco
 */
proto.accountingOpenBankWithdrawalModal = function() {
    const accounts = store.get('accountingAccounts').filter(a => a.active).sort((a, b) => a.code.localeCompare(b.code));
    const bankAccounts = accounts.filter(a => a.code.startsWith('512') || a.code.startsWith('521') || a.code.startsWith('531'));
    const cashAccounts = accounts.filter(a => a.code.startsWith('521'));
    const otherAccounts = accounts.filter(a => a.code.startsWith('512') || a.code.startsWith('531'));
    
    const today = new Date().toISOString().split('T')[0];
    
    this.openModal({
        title: 'Nuevo Reintegro / Transferencia',
        size: 'lg',
        content: [
            '<div class="space-y-4">',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Origen *</label>',
            '            <select id="bankWithdrawalSource" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <option value="">Seleccionar cuenta...</option>',
            bankAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha *</label>',
            '            <input type="date" id="bankWithdrawalDate" value="' + today + '" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '        </div>',
            '    </div>',
            '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuenta Destino *</label>',
            '            <select id="bankWithdrawalTarget" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '                <optgroup label="Caja / Efectivo">',
            cashAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '                <optgroup label="Otras Cuentas Bancarias">',
            otherAccounts.map(acc => '<option value="' + acc.code + '">' + acc.code + ' - ' + acc.name + '</option>').join(''),
            '                </optgroup>',
            '            </select>',
            '        </div>',
            '        <div>',
            '            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Importe *</label>',
            '            <input type="number" id="bankWithdrawalAmount" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right">',
            '        </div>',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Concepto *</label>',
            '        <input type="text" id="bankWithdrawalConcept" placeholder="Descripción del reintegro..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '    <div>',
            '        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Referencia / Documento</label>',
            '        <input type="text" id="bankWithdrawalRef" placeholder="Nº comprobante..." class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm">',
            '    </div>',
            '</div>'
        ].join(''),
        footer: [
            '<div class="flex justify-end gap-2">',
            '    <button onclick="ui.closeModal()" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>',
            '    <button onclick="ui.accountingSaveBankWithdrawal()" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white">Guardar Reintegro</button>',
            '</div>'
        ].join('')
    });
};

/**
 * Guarda un reintegro de banco
 */
proto.accountingSaveBankWithdrawal = function() {
    const sourceAccount = document.getElementById('bankWithdrawalSource')?.value;
    const date = document.getElementById('bankWithdrawalDate')?.value;
    const targetAccount = document.getElementById('bankWithdrawalTarget')?.value;
    const amount = parseFloat(document.getElementById('bankWithdrawalAmount')?.value) || 0;
    const concept = document.getElementById('bankWithdrawalConcept')?.value?.trim();
    const documentRef = document.getElementById('bankWithdrawalRef')?.value?.trim();
    
    if (!sourceAccount || !targetAccount || !date || !concept || amount <= 0) {
        this.showToast('Complete todos los campos obligatorios', 'error');
        return;
    }
    
    if (sourceAccount === targetAccount) {
        this.showToast('La cuenta origen y destino deben ser diferentes', 'error');
        return;
    }
    
    if (this.accountingIsPeriodLocked(date)) {
        this.showToast('El periodo contable está bloqueado', 'error');
        return;
    }
    
    const lines = [
        { accountCode: targetAccount, description: 'Reintegro - ' + concept, debe: amount, haber: 0 },
        { accountCode: sourceAccount, description: 'Reintegro bancario - ' + concept, debe: 0, haber: amount }
    ];
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: date,
        documentDate: date,
        concept: 'Reintegro: ' + concept,
        documentRef: documentRef || '',
        lines: lines,
        totalDebe: amount,
        totalHaber: amount,
        status: 'posted',
        source: 'bank-withdrawal'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.closeModal();
    this.showToast('Reintegro registrado correctamente', 'success');
    this.accountingRenderTab('banks', document.getElementById('accountingContent'));
};

/**
 * Marca/desmarca conciliación (persistencia real)
 */

proto.accountingToggleReconciliation = function(movementId) {
    const parts = movementId.split('|');
    if (parts.length !== 3) return;
    const [entryId, lineIdxStr] = parts;
    const lineIdx = parseInt(lineIdxStr);
    
    const entries = store.get('accountingEntries');
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.lines || !entry.lines[lineIdx]) return;
    
    entry.lines[lineIdx].reconciled = !entry.lines[lineIdx].reconciled;
    entry.lines[lineIdx].reconciledAt = entry.lines[lineIdx].reconciled ? new Date().toISOString() : null;
    store.save('accountingEntries', entries);
    
    this.showToast('Estado de conciliación actualizado', 'success');
    this.accountingRenderReconciliation(document.getElementById('accountingContent'));
};

/**
 * Importa extracto bancario
 */

proto.accountingImportBankStatement = function() {
    let fileInput = document.getElementById('bankStatementInput');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'bankStatementInput';
        fileInput.accept = '.csv,.xlsx,.xls';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.accountingProcessBankStatement(file);
            }
        });
        document.body.appendChild(fileInput);
    }
    fileInput.click();
};

/**
 * Procesa el archivo de extracto bancario
 */

proto.accountingProcessBankStatement = function(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            const lines = content.split('\n');
            const transactions = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length >= 3) {
                    const amount = parseFloat(cols[2]) || 0;
                    transactions.push({
                        date: cols[0].trim(),
                        concept: cols[1].trim(),
                        amount: amount,
                        raw: line
                    });
                }
            }
            
            this._currentBankStatement = transactions;
            this.showToast('Extracto importado: ' + transactions.length + ' transacciones', 'success');
            this.accountingRenderReconciliation(document.getElementById('accountingContent'));
        } catch (err) {
            this.showToast('Error al procesar el archivo', 'error');
        }
    };
    reader.readAsText(file);
};

/**
 * Exporta el Plan de Cuentas a Excel
 */


// ==================== MÉTODOS DE EXPORTACIÓN ====================

proto.accountingExportPGC = async function() {
    const XLSX = await window.LibraryLoader.ensureXLSX().catch(() => null);
    if (!XLSX) {
        this.showToast('No se pudo cargar el exportador Excel', 'error');
        return;
    }

    const accounts = store.get('accountingAccounts');
    accounts.sort((a, b) => a.code.localeCompare(b.code));
    
    const data = accounts.map(acc => ({
        'Clase': acc.class,
        'Código': acc.code,
        'Nombre': acc.name,
        'Tipo': acc.type,
        'Naturaleza': acc.nature === 'debtor' ? 'Deudor' : acc.nature === 'creditor' ? 'Acreedor' : 'Variable',
        'Descripción': acc.description || '',
        'Saldo': acc.balance || 0,
        'Activo': acc.active ? 'Sí' : 'No'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan de Cuentas SYSCOHADA');
    
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, 'PGC_SYSCOHADA_' + now + '.xlsx');
    
    this.showToast('Plan de Cuentas exportado', 'success');
};

/**
 * Exporta los asientos contables a Excel
 */

proto.accountingExportEntries = async function() {
    const XLSX = await window.LibraryLoader.ensureXLSX().catch(() => null);
    if (!XLSX) {
        this.showToast('No se pudo cargar el exportador Excel', 'error');
        return;
    }

    const entries = store.get('accountingEntries');
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Flatten entries with lines
    const data = [];
    entries.forEach(entry => {
        (entry.lines || []).forEach(line => {
            data.push({
                'N° Asiento': entry.number,
                'Fecha': entry.date,
                'Fecha Documento': entry.documentDate || entry.date,
                'Concepto': entry.concept,
                'Referencia': entry.documentRef || '',
                'Cuenta': line.accountCode,
                'Descripción Línea': line.description || '',
                'Debe': line.debe || 0,
                'Haber': line.haber || 0
            });
        });
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario');
    
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, 'Libro_Diario_' + now + '.xlsx');
    
    this.showToast('Libro Diario exportado', 'success');
};

/**
 * Exporta el Libro Mayor a Excel
 */

proto.accountingExportLedger = async function() {
    const XLSX = await window.LibraryLoader.ensureXLSX().catch(() => null);
    if (!XLSX) {
        this.showToast('No se pudo cargar el exportador Excel', 'error');
        return;
    }

    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    
    const wb = XLSX.utils.book_new();
    
    accounts.filter(a => a.active).forEach(account => {
        // Filtrar movimientos para esta cuenta
        const movements = [];
        entries.forEach(entry => {
            (entry.lines || []).forEach(line => {
                if (line.accountCode === account.code) {
                    movements.push({
                        'Fecha': entry.date,
                        'Asiento': entry.number,
                        'Concepto': entry.concept,
                        'Documento': entry.documentRef || '',
                        'Debe': line.debe || 0,
                        'Haber': line.haber || 0
                    });
                }
            });
        });
        
        if (movements.length > 0) {
            movements.sort((a, b) => new Date(a.Fecha) - new Date(b.Fecha));
            
            // Calcular saldo acumulado
            let balance = 0;
            movements.forEach(m => {
                if (account.nature === 'debtor') {
                    balance += m.Debe - m.Haber;
                } else {
                    balance += m.Haber - m.Debe;
                }
                m.Saldo = balance;
            });
            
            const ws = XLSX.utils.json_to_sheet(movements);
            const sheetName = (account.code + ' ' + account.name).substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });
    
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, 'Libro_Mayor_' + now + '.xlsx');
    
    this.showToast('Libro Mayor exportado', 'success');
};

/**
 * Exporta los Balances a Excel
 */

proto.accountingExportBalances = async function() {
    const XLSX = await window.LibraryLoader.ensureXLSX().catch(() => null);
    if (!XLSX) {
        this.showToast('No se pudo cargar el exportador Excel', 'error');
        return;
    }

    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    
    // Calcular balances
    const accountBalances = {};
    entries.forEach(entry => {
        (entry.lines || []).forEach(line => {
            if (!line.accountCode) return;
            if (!accountBalances[line.accountCode]) {
                accountBalances[line.accountCode] = { sumDebe: 0, sumHaber: 0 };
            }
            accountBalances[line.accountCode].sumDebe += line.debe || 0;
            accountBalances[line.accountCode].sumHaber += line.haber || 0;
        });
    });
    
    // Calcular saldos deudores/acreedores
    Object.keys(accountBalances).forEach(code => {
        const bal = accountBalances[code];
        const account = accounts.find(a => a.code === code);
        const net = bal.sumDebe - bal.sumHaber;
        
        if (account?.nature === 'debtor') {
            bal.saldoDeudor = net > 0 ? net : 0;
            bal.saldoAcreedor = net < 0 ? Math.abs(net) : 0;
        } else {
            bal.saldoDeudor = net < 0 ? Math.abs(net) : 0;
            bal.saldoAcreedor = net > 0 ? net : 0;
        }
    });
    
    // Hoja 1: Balance de Sumas y Saldos
    const sumasSaldosData = Object.keys(accountBalances).sort().map(code => {
        const bal = accountBalances[code];
        const acc = accounts.find(a => a.code === code);
        return {
            'Código': code,
            'Cuenta': acc?.name || '',
            'Suma Debe': bal.sumDebe,
            'Suma Haber': bal.sumHaber,
            'Saldo Deudor': bal.saldoDeudor,
            'Saldo Acreedor': bal.saldoAcreedor
        };
    });
    
    // Hoja 2: Balance de Situación SYSCOHADA
    const activoNoCorriente = this.accountingGetGroupBalance(accounts, accountBalances, [2]);
    const activoCorrienteStocks = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [3], ['debtor']);
    const activoCorrienteTerceros = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [4], ['debtor']);
    const activoCorrienteTesoreria = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [5], ['debtor']);
    const activoCorriente = activoCorrienteStocks + activoCorrienteTerceros + activoCorrienteTesoreria;
    const patrimonio = this.accountingGetGroupBalance(accounts, accountBalances, [1]);
    const pasivoNoCorriente = 0; // Simplificado
    const pasivoTerceros = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [4], ['creditor']);
    const pasivoTesoreria = this.accountingGetGroupBalanceByNature(accounts, accountBalances, [5], ['creditor']);
    const pasivoCorriente = pasivoTerceros + pasivoTesoreria;
    
    const situacionData = [
        { 'Concepto': 'ACTIVO', 'Monto': '' },
        { 'Concepto': '  Activo No Corriente (Clase 2)', 'Monto': activoNoCorriente },
        { 'Concepto': '  Activo Corriente — Stocks (Clase 3)', 'Monto': activoCorrienteStocks },
        { 'Concepto': '  Activo Corriente — Terceros Deudores (Clase 4)', 'Monto': activoCorrienteTerceros },
        { 'Concepto': '  Activo Corriente — Tesorería (Clase 5)', 'Monto': activoCorrienteTesoreria },
        { 'Concepto': 'TOTAL ACTIVO', 'Monto': activoNoCorriente + activoCorriente },
        { 'Concepto': '', 'Monto': '' },
        { 'Concepto': 'PATRIMONIO Y PASIVO', 'Monto': '' },
        { 'Concepto': '  Patrimonio Neto (Clase 1)', 'Monto': patrimonio },
        { 'Concepto': '  Pasivo No Corriente', 'Monto': pasivoNoCorriente },
        { 'Concepto': '  Pasivo — Terceros Acreedores (Clase 4)', 'Monto': pasivoTerceros },
        { 'Concepto': '  Pasivo — Tesorería (Clase 5) / Descubiertos', 'Monto': pasivoTesoreria },
        { 'Concepto': 'TOTAL PATRIMONIO Y PASIVO', 'Monto': patrimonio + pasivoNoCorriente + pasivoCorriente }
    ];
    
    // Hoja 3: Cuenta de Resultados
    const ingresos = accounts.filter(a => a.class === 7).reduce((s, a) => {
        const bal = accountBalances[a.code];
        return s + (bal ? bal.sumHaber - bal.sumDebe : 0);
    }, 0);
    const gastos = accounts.filter(a => a.class === 6).reduce((s, a) => {
        const bal = accountBalances[a.code];
        return s + (bal ? bal.sumDebe - bal.sumHaber : 0);
    }, 0);
    const resultado = ingresos - gastos;
    
    const resultadosData = [
        { 'Concepto': 'INGRESOS (Clase 7)', 'Monto': ingresos },
        { 'Concepto': 'GASTOS (Clase 6)', 'Monto': gastos },
        { 'Concepto': '', 'Monto': '' },
        { 'Concepto': resultado >= 0 ? 'BENEFICIO' : 'PÉRDIDA', 'Monto': Math.abs(resultado) }
    ];
    
    const wb = XLSX.utils.book_new();
    
    const ws1 = XLSX.utils.json_to_sheet(sumasSaldosData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Sumas y Saldos');
    
    const ws2 = XLSX.utils.json_to_sheet(situacionData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Balance Situacion');
    
    const ws3 = XLSX.utils.json_to_sheet(resultadosData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Cuenta Resultados');
    
    const now = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, 'Balances_OHADA_' + now + '.xlsx');
    
    this.showToast('Balances exportados', 'success');
};

/**
 * Exporta al formato FEC (Fichier des Écritures Comptables)
 * Estándar DGFiP para transmisión electrónica de datos contables
 */
proto.accountingExportFEC = function() {
    if (!confirm('¿Exportar el Libro Diario en formato FEC (CSV) para la DGFiP?')) return;
    
    const entries = store.get('accountingAccounts');
    const accountsMap = {};
    (entries || []).forEach(a => { accountsMap[a.code] = a.name; });
    
    const allEntries = store.get('accountingEntries');
    const now = new Date();
    const rows = [];
    
    allEntries.sort((a, b) => {
        const da = new Date(a.date), db = new Date(b.date);
        if (da - db !== 0) return da - db;
        return (a.number || '').localeCompare(b.number || '');
    }).forEach(entry => {
        const journalCode = entry.source === 'imported' ? 'VENTE' :
            entry.source === 'imported-purchase' ? 'ACHAT' :
            entry.source === 'bank-payment' ? 'BANQUE' :
            entry.source === 'bank-income' ? 'BANQUE' :
            entry.source === 'bank-withdrawal' ? 'BANQUE' :
            entry.source === 'vat-liquidation' ? 'TVA' :
            entry.source === 'closing' ? 'CLOTURE' :
            entry.source === 'opening' ? 'OUVERTURE' :
            entry.source === 'reversal' ? 'ANNULE' : 'DIVERS';
        
        const journalLib = entry.source === 'imported' ? 'Ventes' :
            entry.source === 'imported-purchase' ? 'Achats' :
            entry.source === 'bank-payment' ? 'Banque' :
            entry.source === 'bank-income' ? 'Banque' :
            entry.source === 'bank-withdrawal' ? 'Banque' :
            entry.source === 'vat-liquidation' ? 'TVA' :
            entry.source === 'closing' ? 'Clôture' :
            entry.source === 'opening' ? 'Ouverture' :
            entry.source === 'reversal' ? 'Annulation' : 'Divers';
        
        (entry.lines || []).forEach(line => {
            if (!line.accountCode) return;
            rows.push([
                this.escapeCsvField(journalCode),
                this.escapeCsvField(journalLib),
                this.escapeCsvField(entry.number || ''),
                entry.date,
                line.accountCode,
                this.escapeCsvField(accountsMap[line.accountCode] || ''),
                '',
                '',
                this.escapeCsvField(entry.documentRef || ''),
                entry.documentDate || entry.date,
                this.escapeCsvField(line.description || entry.concept),
                (line.debe || 0).toFixed(2),
                (line.haber || 0).toFixed(2),
                '',
                '',
                now.toISOString().split('T')[0],
                '0',
                'XAF'
            ]);
        });
    });
    
    const header = [
        'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
        'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
        'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
        'EcritureLet', 'DateLet', 'ValidDate', 'MontantDevise', 'IbanDevise'
    ];
    
    const csvContent = [header.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = now.toISOString().split('T')[0];
    a.download = 'FEC_' + dateStr + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('Exportación FEC completada: ' + rows.length + ' líneas', 'success');
};

/**
 * Escapa un campo para CSV (formato FEC)
 */
proto.escapeCsvField = function(val) {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
};

/**
 * Obtiene la clase SYSCOHADA (1-8) según el código de cuenta
 */

// ==================== MÉTODOS UTILITARIOS ====================

proto.accountingGetClassFromCode = function(code) {
    if (!code || code.length === 0) return null;
    const firstChar = code.charAt(0);
    const classNum = parseInt(firstChar);
    if (classNum >= 1 && classNum <= 8) {
        return classNum;
    }
    return null;
};

/**
 * Retorna el color para el tipo de cuenta
 */

proto.accountingTypeClass = function(type) {
    const colors = {
        'asset': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'contra-asset': 'bg-blue-50 text-blue-600 dark:bg-blue-800 dark:text-blue-300',
        'liability': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
        'equity': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        'expense': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        'revenue': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'result': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[type] || colors['result'];
};

/**
 * Obtiene el nombre de la clase SYSCOHADA
 */

proto.accountingGetClassName = function(classNum) {
    const names = {
        1: 'Recursos Propios',
        2: 'Activo Inmovilizado',
        3: 'Activo Circulante',
        4: 'Terceros',
        5: 'Caja y Bancos',
        6: 'Gastos',
        7: 'Ingresos',
        8: 'Cuentas de Resultado'
    };
    return names[classNum] || 'Desconocida';
};

/**
 * Obtiene la cuenta por defecto para un tipo de operación
 */

proto.accountingGetDefaultAccount = function(operationType) {
    const defaults = {
        'cash': '5211',
        'bank': '5311',
        'clients': '411',
        'suppliers': '401',
        'sales': '701',
        'purchases': '601',
        'expenses': '613'
    };
    return defaults[operationType] || null;
};

/**
 * Genera un asiento automático simple
 */

proto.accountingGenerateEntry = function(concept, lines) {
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        documentDate: new Date().toISOString().split('T')[0],
        concept: concept,
        documentRef: '',
        lines: lines.map(l => ({
            accountCode: l.account,
            description: l.description || concept,
            debe: l.debe || 0,
            haber: l.haber || 0
        })),
        status: 'posted',
        source: 'auto'
    };
    
    const totalDebe = entry.lines.reduce((s, l) => s + l.debe, 0);
    const totalHaber = entry.lines.reduce((s, l) => s + l.haber, 0);
    
    if (Math.abs(totalDebe - totalHaber) > 0.01) {
        this.showToast('El asiento no está cuadrado', 'error');
        return null;
    }
    
    entry.totalDebe = totalDebe;
    entry.totalHaber = totalHaber;
    
    const savedEntry = this.accountingCreateEntry(entry);
    
    // Incrementar número
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    return savedEntry;
};

/**
 * Obtiene el saldo de una cuenta específica
 */

proto.accountingGetAccountBalance = function(accountCode) {
    const accounts = store.get('accountingAccounts');
    const account = accounts.find(a => a.code === accountCode);
    return account ? (account.balance || 0) : 0;
};

/**
 * Actualiza el saldo de una cuenta manualmente
 */

proto.accountingUpdateAccountBalance = function(accountCode, newBalance) {
    const accounts = store.get('accountingAccounts');
    const index = accounts.findIndex(a => a.code === accountCode);
    if (index >= 0) {
        accounts[index].balance = newBalance;
        accounts[index].updatedAt = new Date().toISOString();
        store.save('accountingAccounts', accounts);
        return true;
    }
    return false;
};

/**
 * Busca cuentas por texto
 */

proto.accountingSearchAccounts = function(query) {
    const accounts = store.get('accountingAccounts');
    const q = query.toLowerCase();
    return accounts.filter(a => 
        a.code.toLowerCase().includes(q) || 
        a.name.toLowerCase().includes(q) ||
        (a.description && a.description.toLowerCase().includes(q))
    );
};

/**
 * Obtiene estadísticas contables
 */

proto.accountingGetStats = function() {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    
    const activo = accounts
        .filter(a => [2, 3, 4, 5].includes(a.class))
        .reduce((s, a) => s + (a.balance || 0), 0);
    
    const patrimonio = accounts
        .filter(a => a.class === 1 && a.nature === 'creditor')
        .reduce((s, a) => s + (a.balance || 0), 0);
    
    const pasivo = accounts
        .filter(a => a.class === 4 && a.nature === 'creditor')
        .reduce((s, a) => s + (a.balance || 0), 0);
    
    return {
        totalAccounts: accounts.length,
        totalEntries: entries.length,
        activo,
        patrimonio,
        pasivo,
        patrimonioNeto: activo - pasivo
    };
};

/**
 * Reinicia el plan de cuentas (precaución)
 */

proto.accountingResetPGC = function() {
    if (!confirm('ADVERTENCIA: Esto eliminará TODO el plan de cuentas y los asientos. ¿Continuar?')) {
        return;
    }
    if (!confirm('¿Está COMPLETAMENTE SEGURO? Esta acción no se puede deshacer.')) {
        return;
    }
    
    store.save('accountingAccounts', []);
    store.save('accountingEntries', []);
    store.save('accountingConfigs', {});
    
    this.showToast('Plan de cuentas reiniciado', 'warning');
    this.accountingInitSYSCOHADA();
    this.accountingRenderTab('pgc', document.getElementById('accountingContent'));
};

/**
 * Copia de seguridad de contabilidad
 */

proto.accountingBackup = function() {
    const data = {
        accounts: store.get('accountingAccounts'),
        entries: store.get('accountingEntries'),
        configs: store.get('accountingConfigs'),
        backupDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup_contabilidad_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('Copia de seguridad descargada', 'success');
};

/**
 * Restaura copia de seguridad
 */

proto.accountingRestore = function(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.accounts) store.save('accountingAccounts', data.accounts);
            if (data.entries) store.save('accountingEntries', data.entries);
            if (data.configs) store.save('accountingConfigs', data.configs);
            
            this.showToast('Copia de seguridad restaurada', 'success');
            this.accountingRenderTab('pgc', document.getElementById('accountingContent'));
        } catch (err) {
            this.showToast('Error al restaurar: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
};


// ==================== NUEVAS FUNCIONALIDADES ALTA PRIORIDAD ====================

/**
 * Renderiza la configuración contable
 */
proto.accountingRenderConfig = function(contentEl) {
    const configs = store.get('accountingConfigs') || {};
    const company = configs.companyInfo || {};
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Configuración Contable OHADA</h3>',
        '    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">',
        '        <div class="space-y-4">',
        '            <h4 class="font-medium dark:text-white">Ejercicio Fiscal</h4>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Inicio</label><input type="date" id="cfgFiscalStart" value="' + (configs.fiscalYearStart || '') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Fin</label><input type="date" id="cfgFiscalEnd" value="' + (configs.fiscalYearEnd || '') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Moneda por defecto</label><input type="text" id="cfgCurrency" value="' + (configs.defaultCurrency || 'XAF') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Método</label><select id="cfgMethod" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"><option value="accrual"' + (configs.accountingMethod === 'accrual' ? ' selected' : '') + '>Devengo</option><option value="cash"' + (configs.accountingMethod === 'cash' ? ' selected' : '') + '>Efectivo</option></select></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Próximo N° Asiento</label><input type="number" id="cfgNextEntry" value="' + (configs.nextEntryNumber || 1) + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '        </div>',
        '        <div class="space-y-4">',
        '            <h4 class="font-medium dark:text-white">Empresa</h4>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Razón Social</label><input type="text" id="cfgCompanyName" value="' + this.escapeHtml(company.name || '') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">NIF / Contribuyente</label><input type="text" id="cfgTaxId" value="' + this.escapeHtml(company.taxId || '') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Dirección</label><input type="text" id="cfgAddress" value="' + this.escapeHtml(company.address || '') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">País (código)</label><input type="text" id="cfgCountry" value="' + this.escapeHtml(company.country || 'GQ') + '" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"></div>',
        '            <div><label class="block text-sm text-slate-600 dark:text-slate-400 mb-1">Régimen</label><select id="cfgRegime" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"><option value="normal"' + (company.regime === 'normal' ? ' selected' : '') + '>Normal</option><option value="simplified"' + (company.regime === 'simplified' ? ' selected' : '') + '>Simplificado</option></select></div>',
        '        </div>',
        '    </div>',
        '    <div class="border-t dark:border-slate-700 pt-4">',
        '        <h4 class="font-medium dark:text-white mb-3">Bloqueo de Periodos</h4>',
        '        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2" id="periodLocksContainer">',
        this.accountingRenderPeriodLocks(configs.lockedPeriods || []),
        '        </div>',
        '        <p class="text-xs text-gray-500 mt-2">Haz clic en un periodo para bloquearlo/desbloquearlo. Los asientos en periodos bloqueados no se pueden crear ni eliminar.</p>',
        '    </div>',
        '    <div class="flex justify-end">',
        '        <button onclick="ui.accountingSaveConfig()" class="px-6 py-2 rounded-xl btn-primary-gradient text-white">Guardar Configuración</button>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingRenderPeriodLocks = function(lockedPeriods) {
    const months = [];
    const now = new Date();
    for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
        for (let m = 1; m <= 12; m++) {
            const period = y + '-' + String(m).padStart(2, '0');
            const isLocked = lockedPeriods.includes(period);
            months.push([
                '<button onclick="ui.accountingTogglePeriodLock(\'' + period + '\')" class="px-2 py-2 rounded-lg text-xs font-medium border transition ' + (isLocked ? 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200' : 'bg-white border-slate-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200') + '">',
                period,
                '</button>'
            ].join(''));
        }
    }
    return months.join('');
};

proto.accountingTogglePeriodLock = function(period) {
    const configs = store.get('accountingConfigs') || {};
    const locked = new Set(configs.lockedPeriods || []);
    if (locked.has(period)) locked.delete(period); else locked.add(period);
    configs.lockedPeriods = Array.from(locked).sort();
    store.save('accountingConfigs', configs);
    this.accountingRenderConfig(document.getElementById('accountingContent'));
};

proto.accountingIsPeriodLocked = function(dateString) {
    const configs = store.get('accountingConfigs') || {};
    const locked = configs.lockedPeriods || [];
    if (!dateString) return false;
    const d = new Date(dateString);
    const period = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return locked.includes(period);
};

proto.accountingSaveConfig = function() {
    const configs = store.get('accountingConfigs') || {};
    configs.fiscalYearStart = document.getElementById('cfgFiscalStart')?.value || configs.fiscalYearStart;
    configs.fiscalYearEnd = document.getElementById('cfgFiscalEnd')?.value || configs.fiscalYearEnd;
    configs.defaultCurrency = document.getElementById('cfgCurrency')?.value || 'XAF';
    configs.accountingMethod = document.getElementById('cfgMethod')?.value || 'accrual';
    configs.nextEntryNumber = parseInt(document.getElementById('cfgNextEntry')?.value) || configs.nextEntryNumber || 1;
    configs.companyInfo = {
        name: document.getElementById('cfgCompanyName')?.value || '',
        taxId: document.getElementById('cfgTaxId')?.value || '',
        address: document.getElementById('cfgAddress')?.value || '',
        country: document.getElementById('cfgCountry')?.value || 'GQ',
        regime: document.getElementById('cfgRegime')?.value || 'normal'
    };
    store.save('accountingConfigs', configs);
    this.showToast('Configuración guardada', 'success');
};

/**
 * Renderiza la importación de compras
 */
proto.accountingRenderImportPurchases = function(contentEl) {
    const purchases = store.get('purchases');
    const entries = store.get('accountingEntries');
    const defaultVatRate = this.accountingGetDefaultVatRate();
    
    const unaccountedPurchases = purchases.filter(p => 
        (p.status === 'sent' || p.status === 'received') && 
        !p.isMaster &&
        !entries.some(e => e.purchaseId === p.id || e.documentRef === p.orderNumber)
    );
    
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
    
    contentEl.innerHTML = [
        '<div class="space-y-4">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <div>',
        '            <h3 class="text-lg font-bold dark:text-white">Compras pendientes de contabilizar</h3>',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">' + unaccountedPurchases.length + ' compras encontradas</p>',
        '        </div>',
        '        <div class="flex gap-2 items-center">',
        '            <label class="text-sm dark:text-white">IVA %:</label>',
        '            <input type="number" id="purchaseVatRate" value="' + defaultVatRate + '" step="0.01" min="0" max="100"',
        '                class="w-20 px-2 py-2 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm text-right">',
        '            <button onclick="ui.accountingImportAllPurchases()" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm">',
        '                <i class="fas fa-magic mr-2"></i>Contabilizar Todas',
        '            </button>',
        '        </div>',
        '    </div>',
        unaccountedPurchases.length === 0 ? [
        '    <div class="text-center py-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">',
        '        <i class="fas fa-check-circle text-4xl text-emerald-500 mb-4"></i>',
        '        <p class="text-emerald-700 dark:text-emerald-400 font-medium">Todas las compras están contabilizadas</p>',
        '    </div>'
        ].join('') : [
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Fecha</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Orden</th>',
        '                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Proveedor</th>',
        '                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">Total</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Asiento Previsto</th>',
        '                    <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">Acciones</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        unaccountedPurchases.map(p => {
            const hasDocumentTax = (p.tax || 0) > 0;
            const base = hasDocumentTax ? Math.max(0, (p.total || 0) - (p.tax || 0)) : (p.total || 0);
            const tax = hasDocumentTax ? (p.tax || 0) : 0;
            
            const products = store.get('products') || [];
            const purchaseItems = p.items || [];
            const accountCodes = {};
            purchaseItems.forEach(item => {
                const product = products.find(pr => pr.id === item.productId);
                if (product) {
                    const code = product.purchaseAccountCode || '601';
                    accountCodes[code] = (accountCodes[code] || 0) + 1;
                }
            });
            const defaultPurchaseCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '601';
            
            return [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + formatDate(p.date || p.createdAt) + '</td>',
        '                    <td class="px-4 py-3 font-mono dark:text-white">' + this.escapeHtml(p.orderNumber || '-') + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + this.escapeHtml(p.supplierName || 'Proveedor') + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(p.total) + '</td>',
        '                    <td class="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">',
        '                        <div>' + defaultPurchaseCode + ': ' + this.formatMoney(base) + '</div>',
        '                        <div>4457: ' + this.formatMoney(tax) + '</div>',
        '                        <div>401: ' + this.formatMoney(p.total) + ' (Haber)</div>',
        '                    </td>',
        '                    <td class="px-4 py-3 text-center">',
        '                        <button onclick="ui.accountingImportPurchase(\'' + p.id + '\')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-700">',
        '                            <i class="fas fa-check mr-1"></i>Contabilizar',
        '                        </button>',
        '                    </td>',
        '                </tr>'
            ].join('');
        }).join(''),
        '            </tbody>',
        '        </table>',
        '    </div>'
        ].join(''),
        '</div>'
    ].join('');
};

proto.accountingGetDefaultVatRate = function() {
    try {
        const tax = store.getDefaultTax ? store.getDefaultTax() : null;
        if (tax && tax.rate) return tax.rate;
    } catch(e) {}
    return 15;
};

proto.accountingImportPurchase = function(purchaseId) {
    const purchase = store.getById('purchases', purchaseId);
    if (!purchase) {
        this.showToast('Compra no encontrada', 'error');
        return;
    }
    if (purchase.isMaster) {
        this.showToast('No se pueden contabilizar órdenes maestras. Contabilice cada sub-orden individualmente.', 'warning');
        return;
    }
    const hasDocumentTax = (purchase.tax || 0) > 0;
    const base = hasDocumentTax
        ? Math.round(Math.max(0, (purchase.total || 0) - (purchase.tax || 0)) * 100) / 100
        : Math.round((purchase.total || 0) * 100) / 100;
    const tax = hasDocumentTax ? Math.round((purchase.tax || 0) * 100) / 100 : 0;
    
    // Determine purchase account code from products (default 601)
    const products = store.get('products') || [];
    const purchaseItems = purchase.items || [];
    const accountCodes = {};
    purchaseItems.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
            const code = product.purchaseAccountCode || '601';
            accountCodes[code] = (accountCodes[code] || 0) + 1;
        }
    });
    const defaultPurchaseCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '601';
    
    const lines = [
        { accountCode: defaultPurchaseCode, description: 'Compra - ' + purchase.orderNumber, debe: base, haber: 0 },
        { accountCode: '4457', description: 'TVA récupérable - ' + purchase.orderNumber, debe: tax, haber: 0 },
        { accountCode: '401', description: 'Proveedor - ' + purchase.orderNumber, debe: 0, haber: purchase.total }
    ];
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: new Date(purchase.date || purchase.createdAt).toISOString().split('T')[0],
        documentDate: new Date(purchase.date || purchase.createdAt).toISOString().split('T')[0],
        concept: 'Compra ' + (purchase.orderNumber || purchaseId),
        documentRef: purchase.orderNumber || purchaseId,
        purchaseId: purchase.id,
        lines: lines,
        totalDebe: purchase.total,
        totalHaber: purchase.total,
        status: 'posted',
        source: 'imported-purchase'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.showToast('Compra contabilizada correctamente', 'success');
    this.accountingRenderTab('purchases', document.getElementById('accountingContent'));
};

proto.accountingImportAllPurchases = function() {
    const purchases = store.get('purchases');
    const entries = store.get('accountingEntries');
    const unaccounted = purchases.filter(p => 
        (p.status === 'sent' || p.status === 'received') && 
        !p.isMaster &&
        !entries.some(e => e.purchaseId === p.id || e.documentRef === p.orderNumber)
    );
    if (unaccounted.length === 0) {
        this.showToast('No hay compras pendientes', 'info');
        return;
    }
    if (!confirm('¿Contabilizar ' + unaccounted.length + ' compras?')) return;
    
    const savepoint = this.accountingCreateSavepoint();
    let imported = 0;
    let batchError = false;
    
    unaccounted.forEach(purchase => {
        if (batchError) return;
        try {
            const hasDocumentTax = (purchase.tax || 0) > 0;
            const base = hasDocumentTax
                ? Math.round(Math.max(0, (purchase.total || 0) - (purchase.tax || 0)) * 100) / 100
                : Math.round((purchase.total || 0) * 100) / 100;
            const tax = hasDocumentTax ? Math.round((purchase.tax || 0) * 100) / 100 : 0;
            
            const products = store.get('products') || [];
            const purchaseItems = purchase.items || [];
            const accountCodes = {};
            purchaseItems.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const code = product.purchaseAccountCode || '601';
                    accountCodes[code] = (accountCodes[code] || 0) + 1;
                }
            });
            const defaultPurchaseCode = Object.keys(accountCodes).length === 1 ? Object.keys(accountCodes)[0] : '601';
            
            const entry = {
                number: this.accountingGetNextEntryNumber(),
                date: new Date(purchase.date || purchase.createdAt).toISOString().split('T')[0],
                documentDate: new Date(purchase.date || purchase.createdAt).toISOString().split('T')[0],
                concept: 'Compra ' + (purchase.orderNumber || purchase.id),
                documentRef: purchase.orderNumber || purchase.id,
                purchaseId: purchase.id,
                lines: [
                    { accountCode: defaultPurchaseCode, description: 'Compra', debe: base, haber: 0 },
                    { accountCode: '4457', description: 'TVA récupérable', debe: tax, haber: 0 },
                    { accountCode: '401', description: 'Proveedor', debe: 0, haber: purchase.total }
                ],
                totalDebe: purchase.total,
                totalHaber: purchase.total,
                status: 'posted',
                source: 'imported-purchase'
            };
            this.accountingCreateEntry(entry);
            
            const configs = store.get('accountingConfigs') || {};
            configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
            store.save('accountingConfigs', configs);
            imported++;
        } catch(e) {
            console.error('Error importando compra', purchase.id, e);
            batchError = true;
        }
    });
    
    if (batchError) {
        this.accountingRestoreSavepoint(savepoint);
        this.showToast('Error en batch de compras. Se ha revertido la operación.', 'error');
    } else {
        this.showToast(imported + ' compras contabilizadas correctamente', 'success');
    }
    this.accountingRenderTab('purchases', document.getElementById('accountingContent'));
};

/**
 * Renderiza la liquidación de IVA/TVA
 */
proto.accountingRenderVAT = function(contentEl) {
    const now = new Date();
    const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const selectedPeriod = this._vatPeriod || currentMonth;
    const vatRate = this.accountingGetDefaultVatRate();
    
    const sales = store.get('sales').filter(s => {
        const d = new Date(s.date || s.createdAt);
        return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === selectedPeriod;
    });
    const purchases = store.get('purchases').filter(p => {
        const d = new Date(p.date || p.createdAt);
        return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === selectedPeriod;
    });
    
    let totalVentas = 0, totalTaxVentas = 0;
    sales.forEach(s => {
        totalVentas += (s.total || 0);
        totalTaxVentas += (s.tax || 0);
    });
    if (totalTaxVentas === 0 && totalVentas > 0) {
        const base = totalVentas / (1 + vatRate/100);
        totalTaxVentas = totalVentas - base;
    }
    
    let totalCompras = 0, totalTaxCompras = 0;
    purchases.forEach(p => {
        totalCompras += (p.total || 0);
    });
    const baseCompras = totalCompras / (1 + vatRate/100);
    totalTaxCompras = totalCompras - baseCompras;
    
    const saldo = totalTaxVentas - totalTaxCompras;
    
    const periodOptions = [];
    for (let y = now.getFullYear() - 1; y <= now.getFullYear(); y++) {
        for (let m = 1; m <= 12; m++) {
            const p = y + '-' + String(m).padStart(2, '0');
            periodOptions.push('<option value="' + p + '"' + (p === selectedPeriod ? ' selected' : '') + '>' + p + '</option>');
        }
    }
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <h3 class="text-lg font-bold dark:text-white">Liquidación IVA/TVA - ' + selectedPeriod + '</h3>',
        '        <select onchange="ui.accountingSetVATPeriod(this.value)" class="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white">',
        periodOptions.join(''),
        '        </select>',
        '    </div>',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">TVA FACTURADA (Ventas)</p>',
        '            <p class="text-2xl font-bold text-blue-700 dark:text-blue-400">' + this.formatMoney(totalTaxVentas) + '</p>',
        '            <p class="text-xs text-gray-400">Base: ' + this.formatMoney(totalVentas - totalTaxVentas) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">TVA RÉCUPÉRABLE (Compras)</p>',
        '            <p class="text-2xl font-bold text-amber-700 dark:text-amber-400">' + this.formatMoney(totalTaxCompras) + '</p>',
        '            <p class="text-xs text-gray-400">Base: ' + this.formatMoney(totalCompras - totalTaxCompras) + '</p>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400 mb-1">SALDO A PAGAR/CREDITAR</p>',
        '            <p class="text-2xl font-bold ' + (saldo >= 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400') + '">' + this.formatMoney(Math.abs(saldo)) + '</p>',
        '            <p class="text-xs ' + (saldo >= 0 ? 'text-red-600' : 'text-emerald-600') + '">' + (saldo >= 0 ? 'A PAGAR A TRÉSOR' : 'CRÉDITO DE TVA') + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="flex justify-end">',
        '        <button onclick="ui.accountingGenerateVATEntry(\'' + selectedPeriod + '\')" class="px-4 py-2 rounded-xl btn-primary-gradient text-white text-sm">',
        '            <i class="fas fa-file-invoice mr-2"></i>Generar Asiento de Liquidación',
        '        </button>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingSetVATPeriod = function(period) {
    this._vatPeriod = period;
    this.accountingRenderVAT(document.getElementById('accountingContent'));
};

proto.accountingGenerateVATEntry = function(period) {
    const configs = store.get('accountingConfigs') || {};
    if (this.accountingIsPeriodLocked(period + '-01')) {
        this.showToast('Periodo bloqueado', 'error');
        return;
    }
    
    const vatRate = this.accountingGetDefaultVatRate();
    const sales = store.get('sales').filter(s => {
        const d = new Date(s.date || s.createdAt);
        return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === period;
    });
    const purchases = store.get('purchases').filter(p => {
        const d = new Date(p.date || p.createdAt);
        return (d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')) === period;
    });
    
    let totalTaxVentas = 0;
    sales.forEach(s => totalTaxVentas += (s.tax || 0));
    if (totalTaxVentas === 0) {
        const totalVentas = sales.reduce((sum, s) => sum + (s.total || 0), 0);
        totalTaxVentas = totalVentas - (totalVentas / (1 + vatRate/100));
    }
    
    const totalCompras = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalTaxCompras = totalCompras - (totalCompras / (1 + vatRate/100));
    
    const saldo = totalTaxVentas - totalTaxCompras;
    const lines = [];
    
    if (totalTaxVentas > 0.01) {
        lines.push({ accountCode: '443', description: 'TVA facturée ' + period, debe: totalTaxVentas, haber: 0 });
    }
    if (totalTaxCompras > 0.01) {
        lines.push({ accountCode: '4457', description: 'TVA récupérable ' + period, debe: 0, haber: totalTaxCompras });
    }
    if (Math.abs(saldo) > 0.01) {
        if (saldo > 0) {
            lines.push({ accountCode: '444', description: 'TVA due ' + period, debe: 0, haber: saldo });
        } else {
            lines.push({ accountCode: '444', description: 'Crédit TVA ' + period, debe: Math.abs(saldo), haber: 0 });
        }
    }
    
    const totalDebe = lines.reduce((s, l) => s + l.debe, 0);
    const totalHaber = lines.reduce((s, l) => s + l.haber, 0);
    
    if (lines.length === 0) {
        this.showToast('No hay datos de IVA para liquidar', 'warning');
        return;
    }
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        documentDate: new Date().toISOString().split('T')[0],
        concept: 'Liquidación IVA/TVA ' + period,
        documentRef: 'LIQ-IVA-' + period,
        lines,
        totalDebe,
        totalHaber,
        status: 'posted',
        source: 'vat-liquidation'
    };
    
    this.accountingCreateEntry(entry);
    
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.showToast('Liquidación IVA generada: ' + entry.number, 'success');
    this.accountingRenderTab('vat', document.getElementById('accountingContent'));
};

/**
 * Renderiza el cierre y apertura del ejercicio
 */
proto.accountingRenderClosing = function(contentEl) {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    const configs = store.get('accountingConfigs') || {};
    
    let ingresos = 0, gastos = 0;
    entries.forEach(e => {
        (e.lines || []).forEach(l => {
            const acc = accounts.find(a => a.code === l.accountCode);
            if (!acc) return;
            if (acc.class === 7) ingresos += (l.haber || 0) - (l.debe || 0);
            if (acc.class === 6) gastos += (l.debe || 0) - (l.haber || 0);
        });
    });
    const resultado = ingresos - gastos;
    const nextYear = parseInt((configs.fiscalYearEnd || new Date().getFullYear() + '-12-31').split('-')[0]) + 1;
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Cierre y Apertura del Ejercicio</h3>',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">INGRESOS (Clase 7)</p>',
        '            <p class="text-xl font-bold text-green-700 dark:text-green-400">' + this.formatMoney(ingresos) + '</p>',
        '        </div>',
        '        <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">GASTOS (Clase 6)</p>',
        '            <p class="text-xl font-bold text-red-700 dark:text-red-400">' + this.formatMoney(gastos) + '</p>',
        '        </div>',
        '        <div class="' + (resultado >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20') + ' rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">RESULTADO DEL EJERCICIO</p>',
        '            <p class="text-xl font-bold ' + (resultado >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400') + '">' + (resultado >= 0 ? '+' : '') + this.formatMoney(resultado) + '</p>',
        '            <p class="text-xs ' + (resultado >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + (resultado >= 0 ? 'BENEFICIO' : 'PÉRDIDA') + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '            <h4 class="font-bold dark:text-white">1. Asiento de Regularización</h4>',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">Cierra las cuentas de gestión (Clase 6 y 7) contra el resultado del ejercicio (121/129).</p>',
        '            <button onclick="ui.accountingGenerateRegularizationEntry()" class="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm">Generar Regularización</button>',
        '        </div>',
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '            <h4 class="font-bold dark:text-white">2. Asiento de Apertura</h4>',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">Genera el asiento de apertura para el ejercicio ' + nextYear + ' con los saldos de balance actuales.</p>',
        '            <button onclick="ui.accountingGenerateOpeningEntry()" class="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Generar Apertura ' + nextYear + '</button>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingGenerateRegularizationEntry = function() {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    
    let totalIngresos = 0, totalGastos = 0;
    const lines = [];
    
    accounts.filter(a => a.class === 7 && a.active).forEach(a => {
        const saldo = entries.reduce((sum, e) => {
            return sum + (e.lines || []).reduce((s, l) => {
                if (l.accountCode === a.code) return s + (l.haber || 0) - (l.debe || 0);
                return s;
            }, 0);
        }, 0);
        if (saldo > 0.01) {
            lines.push({ accountCode: a.code, description: 'Cierre ' + a.name, debe: saldo, haber: 0 });
            totalIngresos += saldo;
        }
    });
    
    accounts.filter(a => a.class === 6 && a.active).forEach(a => {
        const saldo = entries.reduce((sum, e) => {
            return sum + (e.lines || []).reduce((s, l) => {
                if (l.accountCode === a.code) return s + (l.debe || 0) - (l.haber || 0);
                return s;
            }, 0);
        }, 0);
        if (saldo > 0.01) {
            lines.push({ accountCode: a.code, description: 'Cierre ' + a.name, debe: 0, haber: saldo });
            totalGastos += saldo;
        }
    });
    
    const resultado = totalIngresos - totalGastos;
    if (Math.abs(resultado) > 0.01) {
        if (resultado > 0) {
            lines.push({ accountCode: '121', description: 'Résultat net bénéfice', debe: 0, haber: resultado });
        } else {
            lines.push({ accountCode: '129', description: 'Résultat net perte', debe: Math.abs(resultado), haber: 0 });
        }
    }
    
    const totalDebe = lines.reduce((s, l) => s + l.debe, 0);
    const totalHaber = lines.reduce((s, l) => s + l.haber, 0);
    
    if (lines.length === 0) {
        this.showToast('No hay saldos para regularizar', 'warning');
        return;
    }
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        documentDate: new Date().toISOString().split('T')[0],
        concept: 'Asiento de Regularización - Cierre de Gestión',
        documentRef: 'REG-' + new Date().getFullYear(),
        lines,
        totalDebe,
        totalHaber,
        status: 'posted',
        source: 'closing'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.showToast('Regularización generada: ' + entry.number, 'success');
    this.accountingRenderTab('closing', document.getElementById('accountingContent'));
};

proto.accountingGenerateOpeningEntry = function() {
    const accounts = store.get('accountingAccounts');
    const nextYear = new Date().getFullYear() + 1;
    
    const lines = [];
    let totalDebe = 0, totalHaber = 0;
    let resultadoBalance = 0;
    
    // Calcular saldo de 121 (beneficio) y 129 (pérdida) para transferir a 107
    const cuenta121 = accounts.find(a => a.code === '121');
    const cuenta129 = accounts.find(a => a.code === '129');
    const saldo121 = cuenta121 ? (cuenta121.balance || 0) : 0;
    const saldo129 = cuenta129 ? (cuenta129.balance || 0) : 0;
    resultadoBalance = saldo121 - saldo129;
    
    accounts.filter(a => a.active && [1,2,3,4,5].includes(a.class)).forEach(a => {
        // Saltar 121/129 - se transferirán a 107 explícitamente
        if (a.code === '121' || a.code === '129') return;
        const balance = a.balance || 0;
        if (Math.abs(balance) < 0.01) return;
        
        if (a.nature === 'debtor') {
            if (balance > 0) {
                lines.push({ accountCode: a.code, description: 'Apertura ' + a.name, debe: balance, haber: 0 });
                totalDebe += balance;
            } else {
                lines.push({ accountCode: a.code, description: 'Apertura ' + a.name, debe: 0, haber: Math.abs(balance) });
                totalHaber += Math.abs(balance);
            }
        } else if (a.nature === 'creditor') {
            if (balance > 0) {
                lines.push({ accountCode: a.code, description: 'Apertura ' + a.name, debe: 0, haber: balance });
                totalHaber += balance;
            } else {
                lines.push({ accountCode: a.code, description: 'Apertura ' + a.name, debe: Math.abs(balance), haber: 0 });
                totalDebe += Math.abs(balance);
            }
        }
    });
    
    // Transferir resultado del ejercicio (121/129) a 107 (Report à nouveau)
    if (Math.abs(resultadoBalance) > 0.01) {
        if (resultadoBalance > 0) {
            // Beneficio: 121 (debe) → 107 (haber)
            lines.push({ accountCode: '121', description: 'Transferencia resultado a Report à nouveau', debe: resultadoBalance, haber: 0 });
            lines.push({ accountCode: '107', description: 'Report à nouveau (resultado ejercicio anterior)', debe: 0, haber: resultadoBalance });
            totalDebe += resultadoBalance;
            totalHaber += resultadoBalance;
        } else {
            // Pérdida: 107 (debe) → 129 (haber) 
            lines.push({ accountCode: '107', description: 'Report à nouveau (resultado ejercicio anterior)', debe: Math.abs(resultadoBalance), haber: 0 });
            lines.push({ accountCode: '129', description: 'Transferencia pérdida a Report à nouveau', debe: 0, haber: Math.abs(resultadoBalance) });
            totalDebe += Math.abs(resultadoBalance);
            totalHaber += Math.abs(resultadoBalance);
        }
    }
    
    if (lines.length === 0) {
        this.showToast('No hay saldos para la apertura', 'warning');
        return;
    }
    
    const diff = totalDebe - totalHaber;
    if (Math.abs(diff) > 0.01) {
        if (diff > 0) {
            lines.push({ accountCode: '107', description: 'Report à nouveau (ajuste apertura)', debe: 0, haber: diff });
            totalHaber += diff;
        } else {
            lines.push({ accountCode: '107', description: 'Report à nouveau (ajuste apertura)', debe: Math.abs(diff), haber: 0 });
            totalDebe += Math.abs(diff);
        }
    }
    
    const entry = {
        number: this.accountingGetNextEntryNumber(),
        date: nextYear + '-01-01',
        documentDate: nextYear + '-01-01',
        concept: 'Asiento de Apertura - Ejercicio ' + nextYear,
        documentRef: 'AP-' + nextYear,
        lines,
        totalDebe,
        totalHaber,
        status: 'posted',
        source: 'opening'
    };
    
    this.accountingCreateEntry(entry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.showToast('Asiento de apertura generado: ' + entry.number, 'success');
    this.accountingRenderTab('closing', document.getElementById('accountingContent'));
};


// ==================== FUNCIONALIDADES PRIORIDAD MEDIA ====================

/**
 * Anula un asiento generando asiento de reversión
 */
proto.accountingCancelEntry = function(entryId) {
    const entry = store.getById('accountingEntries', entryId);
    if (!entry) {
        this.showToast('Asiento no encontrado', 'error');
        return;
    }
    if (this.accountingIsPeriodLocked(entry.date)) {
        this.showToast('El periodo está bloqueado. No se puede anular.', 'error');
        return;
    }
    if (entry.source === 'reversal') {
        this.showToast('No se puede anular un asiento de reversión.', 'error');
        return;
    }
    if (!confirm('¿Anular este asiento? Se generará un asiento de reversión con fecha actual.')) return;
    
    const reversalLines = (entry.lines || []).map(l => ({
        accountCode: l.accountCode,
        description: 'Anulación: ' + (l.description || entry.concept),
        debe: l.haber || 0,
        haber: l.debe || 0
    }));
    
    const totalDebe = reversalLines.reduce((s, l) => s + l.debe, 0);
    const totalHaber = reversalLines.reduce((s, l) => s + l.haber, 0);
    
    const reversalEntry = {
        number: this.accountingGetNextEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        documentDate: new Date().toISOString().split('T')[0],
        concept: 'Anulación de asiento ' + (entry.number || entryId),
        documentRef: 'ANUL-' + (entry.number || entryId),
        reversedEntryId: entry.id,
        lines: reversalLines,
        totalDebe,
        totalHaber,
        status: 'posted',
        source: 'reversal'
    };
    
    this.accountingCreateEntry(reversalEntry);
    
    const configs = store.get('accountingConfigs') || {};
    configs.nextEntryNumber = (configs.nextEntryNumber || 1) + 1;
    store.save('accountingConfigs', configs);
    
    this.showToast('Asiento anulado correctamente: ' + reversalEntry.number, 'success');
    this.accountingRenderTab('journal', document.getElementById('accountingContent'));
};

/**
 * Renderiza el Estado de Flujo de Efectivo (método directo)
 */
proto.accountingRenderCashFlow = function(contentEl) {
    const entries = store.get('accountingEntries');
    const accounts = store.get('accountingAccounts');
    
    const treasuryAccounts = accounts.filter(a => a.class === 5 && a.active).map(a => a.code);
    
    const cashFlows = {
        operating: { in: 0, out: 0, items: [] },
        investing: { in: 0, out: 0, items: [] },
        financing: { in: 0, out: 0, items: [] }
    };
    
    entries.forEach(entry => {
        (entry.lines || []).forEach(line => {
            if (!treasuryAccounts.includes(line.accountCode)) return;
            const amount = line.debe > 0 ? line.debe : -line.haber;
            
            const counterpart = (entry.lines || []).find(l => l.accountCode !== line.accountCode && (l.debe > 0 || l.haber > 0));
            if (!counterpart) return;
            
            const counterAcc = accounts.find(a => a.code === counterpart.accountCode);
            const counterClass = counterAcc ? counterAcc.class : 0;
            const counterCode = counterpart.accountCode;
            
            let category = 'operating';
            if ([2].includes(counterClass)) category = 'investing';
            else if (counterCode.startsWith('16') || counterCode.startsWith('17')) category = 'financing';
            else if (['101','102','103','106','121','129'].some(p => counterCode.startsWith(p))) category = 'financing';
            else if ([6, 7].includes(counterClass)) category = 'operating';
            
            const isInflow = line.debe > 0;
            if (isInflow) {
                cashFlows[category].in += Math.abs(amount);
            } else {
                cashFlows[category].out += Math.abs(amount);
            }
            
            cashFlows[category].items.push({
                date: entry.date,
                concept: entry.concept,
                amount: isInflow ? Math.abs(amount) : -Math.abs(amount)
            });
        });
    });
    
    const operatingNet = cashFlows.operating.in - cashFlows.operating.out;
    const investingNet = cashFlows.investing.in - cashFlows.investing.out;
    const financingNet = cashFlows.financing.in - cashFlows.financing.out;
    const totalNet = operatingNet + investingNet + financingNet;
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Estado de Flujo de Efectivo</h3>',
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">Actividades de Operación</p>',
        '            <p class="text-xl font-bold text-blue-700 dark:text-blue-400">' + this.formatMoney(operatingNet) + '</p>',
        '            <p class="text-xs text-gray-400">Entradas: ' + this.formatMoney(cashFlows.operating.in) + ' | Salidas: ' + this.formatMoney(cashFlows.operating.out) + '</p>',
        '        </div>',
        '        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">Actividades de Inversión</p>',
        '            <p class="text-xl font-bold text-purple-700 dark:text-purple-400">' + this.formatMoney(investingNet) + '</p>',
        '            <p class="text-xs text-gray-400">Entradas: ' + this.formatMoney(cashFlows.investing.in) + ' | Salidas: ' + this.formatMoney(cashFlows.investing.out) + '</p>',
        '        </div>',
        '        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">Actividades de Financiación</p>',
        '            <p class="text-xl font-bold text-amber-700 dark:text-amber-400">' + this.formatMoney(financingNet) + '</p>',
        '            <p class="text-xs text-gray-400">Entradas: ' + this.formatMoney(cashFlows.financing.in) + ' | Salidas: ' + this.formatMoney(cashFlows.financing.out) + '</p>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 text-center">',
        '        <p class="text-sm text-slate-500 dark:text-slate-400">VARIACIÓN NETA DE EFECTIVO</p>',
        '        <p class="text-3xl font-bold ' + (totalNet >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400') + '">' + (totalNet >= 0 ? '+' : '') + this.formatMoney(totalNet) + '</p>',
        '    </div>',
        '</div>'
    ].join('');
};

/**
 * Renderiza la antigüedad de saldos (Clientes y Proveedores)
 */
proto.accountingRenderAging = function(contentEl) {
    const entries = store.get('accountingEntries');
    const now = new Date();
    
    const agingBuckets = (accountCode) => {
        const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 };
        const docMap = {};
        
        entries.forEach(entry => {
            (entry.lines || []).forEach(line => {
                if (line.accountCode !== accountCode) return;
                const key = entry.documentRef || entry.concept;
                if (!docMap[key]) docMap[key] = { date: entry.date, balance: 0, ref: key, concept: entry.concept };
                const net = (line.debe || 0) - (line.haber || 0);
                docMap[key].balance += net;
            });
        });
        
        Object.values(docMap).forEach(doc => {
            if (Math.abs(doc.balance) < 0.01) return;
            const days = Math.floor((now - new Date(doc.date)) / (1000 * 60 * 60 * 24));
            const amount = Math.abs(doc.balance);
            buckets.total += amount;
            if (days <= 0) buckets.current += amount;
            else if (days <= 30) buckets.d30 += amount;
            else if (days <= 60) buckets.d60 += amount;
            else if (days <= 90) buckets.d90 += amount;
            else buckets.d90plus += amount;
        });
        
        return { buckets, docs: Object.values(docMap).filter(d => Math.abs(d.balance) >= 0.01) };
    };
    
    const clientAging = agingBuckets('411');
    const supplierAging = agingBuckets('401');
    
    const renderAgingTable = (title, data) => {
        const { buckets, docs } = data;
        return [
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '        <h4 class="font-bold dark:text-white">' + title + '</h4>',
        '        <div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">',
        '            <div class="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg"><p class="text-xs text-gray-500">Corriente</p><p class="font-mono font-bold dark:text-white">' + this.formatMoney(buckets.current) + '</p></div>',
        '            <div class="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"><p class="text-xs text-gray-500">1-30 días</p><p class="font-mono font-bold dark:text-white">' + this.formatMoney(buckets.d30) + '</p></div>',
        '            <div class="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg"><p class="text-xs text-gray-500">31-60 días</p><p class="font-mono font-bold dark:text-white">' + this.formatMoney(buckets.d60) + '</p></div>',
        '            <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"><p class="text-xs text-gray-500">61-90 días</p><p class="font-mono font-bold dark:text-white">' + this.formatMoney(buckets.d90) + '</p></div>',
        '            <div class="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg"><p class="text-xs text-gray-500">+90 días</p><p class="font-mono font-bold text-red-700 dark:text-red-400">' + this.formatMoney(buckets.d90plus) + '</p></div>',
        '        </div>',
        '        <div class="rw-table-scroll max-h-64">',
        '            <table class="w-full text-sm">',
        '                <thead class="bg-slate-50 dark:bg-slate-700 text-xs"><tr><th class="px-2 py-2 text-left">Documento</th><th class="px-2 py-2 text-left">Fecha</th><th class="px-2 py-2 text-right">Saldo</th></tr></thead>',
        '                <tbody class="divide-y dark:divide-gray-700">',
        docs.map(d => [
        '                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                        <td class="px-2 py-2 dark:text-gray-200 max-w-xs truncate">' + this.escapeHtml(d.ref || d.concept) + '</td>',
        '                        <td class="px-2 py-2 dark:text-gray-200">' + new Date(d.date).toLocaleDateString('es-ES') + '</td>',
        '                        <td class="px-2 py-2 text-right font-mono ' + (d.balance >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + this.formatMoney(Math.abs(d.balance)) + '</td>',
        '                    </tr>'
        ].join('')).join(''),
        docs.length === 0 ? '<tr><td colspan="3" class="px-2 py-4 text-center text-gray-500">Sin saldos pendientes</td></tr>' : '',
        '                </tbody>',
        '            </table>',
        '        </div>',
        '    </div>'
        ].join('');
    };
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Antigüedad de Saldos</h3>',
        renderAgingTable('Clientes (Cuenta 411)', clientAging),
        renderAgingTable('Proveedores (Cuenta 401)', supplierAging),
        '</div>'
    ].join('');
};


// ==================== FUNCIONALIDADES PRIORIDAD BAJA ====================

/**
 * Renderiza ratios financieros
 */
proto.accountingRenderRatios = function(contentEl) {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    const sales = store.get('sales');
    
    let activoCorriente = 0, pasivoCorriente = 0, inventarios = 0;
    let activoTotal = 0, pasivoTotal = 0, patrimonio = 0;
    let resultado = 0, ventas = 0;
    
    entries.forEach(e => {
        (e.lines || []).forEach(l => {
            const acc = accounts.find(a => a.code === l.accountCode);
            if (!acc) return;
            if (acc.class === 7) resultado += (l.haber || 0) - (l.debe || 0);
            if (acc.class === 6) resultado -= (l.debe || 0) - (l.haber || 0);
        });
    });
    
    ventas = sales.reduce((s, sale) => s + (sale.total || 0), 0);
    
    accounts.forEach(a => {
        const bal = a.balance || 0;
        if ([2,3,4,5].includes(a.class) && a.nature === 'debtor') activoTotal += bal;
        if ([1,4,5].includes(a.class) && a.nature === 'creditor') pasivoTotal += bal;
        if ([1].includes(a.class) && a.nature === 'creditor') patrimonio += bal;
        if ([3,4,5].includes(a.class) && a.nature === 'debtor') activoCorriente += bal;
        if ([4,5].includes(a.class) && a.nature === 'creditor') pasivoCorriente += bal;
        if ([3].includes(a.class)) inventarios += bal;
    });
    
    const safeDiv = (a, b) => b !== 0 ? a / b : 0;
    
    const ratios = [
        { name: 'Liquidez Corriente', value: safeDiv(activoCorriente, pasivoCorriente), formula: 'Activo Corriente / Pasivo Corriente', benchmark: 1.5 },
        { name: 'Prueba Ácida', value: safeDiv(activoCorriente - inventarios, pasivoCorriente), formula: '(Activo Corriente - Inventarios) / Pasivo Corriente', benchmark: 1.0 },
        { name: 'Endeudamiento', value: safeDiv(pasivoTotal, patrimonio), formula: 'Pasivo Total / Patrimonio', benchmark: 1.0 },
        { name: 'ROA', value: safeDiv(resultado, activoTotal) * 100, formula: 'Resultado / Activo Total', unit: '%', benchmark: 5 },
        { name: 'ROE', value: safeDiv(resultado, patrimonio) * 100, formula: 'Resultado / Patrimonio', unit: '%', benchmark: 10 },
        { name: 'Margen Neto', value: safeDiv(resultado, ventas) * 100, formula: 'Resultado / Ventas', unit: '%', benchmark: 5 },
        { name: 'Rotación Activos', value: safeDiv(ventas, activoTotal), formula: 'Ventas / Activo Total', benchmark: 1.5 }
    ];
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Ratios Financieros</h3>',
        '    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">',
        ratios.map(r => {
            const isGood = r.benchmark ? (r.name.includes('Endeudamiento') ? r.value <= r.benchmark : r.value >= r.benchmark) : true;
            return [
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">' + r.name + '</p>',
        '            <p class="text-2xl font-bold ' + (isGood ? 'text-emerald-600' : 'text-amber-600') + '">' + (r.unit === '%' ? r.value.toFixed(2) + '%' : r.value.toFixed(2)) + '</p>',
        '            <p class="text-xs text-gray-400 mt-1">' + r.formula + '</p>',
        '            <p class="text-xs text-gray-400">Referencia: ' + (r.unit === '%' ? r.benchmark + '%' : r.benchmark) + '</p>',
        '        </div>'
            ].join('');
        }).join(''),
        '    </div>',
        '</div>'
    ].join('');
};

/**
 * Renderiza comparación interanual
 */
proto.accountingRenderComparison = function(contentEl) {
    const currentYear = new Date().getFullYear();
    const year1 = this._comparisonYear1 || (currentYear - 1);
    const year2 = this._comparisonYear2 || currentYear;
    
    const bal1 = this.accountingGetYearBalances(year1);
    const bal2 = this.accountingGetYearBalances(year2);
    
    const items = [
        { label: 'Activo Total', key: 'activo' },
        { label: 'Pasivo Total', key: 'pasivo' },
        { label: 'Patrimonio Neto', key: 'patrimonio' },
        { label: 'Ingresos', key: 'ingresos' },
        { label: 'Gastos', key: 'gastos' },
        { label: 'Resultado Neto', key: 'resultado' }
    ];
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <div class="flex flex-col sm:flex-row gap-4 items-center justify-between">',
        '        <h3 class="text-lg font-bold dark:text-white">Comparación Interanual</h3>',
        '        <div class="flex gap-2">',
        '            <select onchange="ui.accountingSetComparisonYear1(this.value)" class="px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm">',
        Array.from({length: 5}, (_, i) => currentYear - 4 + i).map(y => '<option value="' + y + '"' + (y == year1 ? ' selected' : '') + '>' + y + '</option>').join(''),
        '            </select>',
        '            <span class="self-center dark:text-white">vs</span>',
        '            <select onchange="ui.accountingSetComparisonYear2(this.value)" class="px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm">',
        Array.from({length: 5}, (_, i) => currentYear - 4 + i).map(y => '<option value="' + y + '"' + (y == year2 ? ' selected' : '') + '>' + y + '</option>').join(''),
        '            </select>',
        '        </div>',
        '    </div>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700 text-xs">',
        '                <tr>',
        '                    <th class="px-4 py-3 text-left">Concepto</th>',
        '                    <th class="px-4 py-3 text-right">' + year1 + '</th>',
        '                    <th class="px-4 py-3 text-right">' + year2 + '</th>',
        '                    <th class="px-4 py-3 text-right">Variación</th>',
        '                    <th class="px-4 py-3 text-right">%</th>',
        '                </tr>',
        '            </thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        items.map(item => {
            const v1 = bal1[item.key] || 0;
            const v2 = bal2[item.key] || 0;
            const diff = v2 - v1;
            const pct = v1 !== 0 ? ((diff / Math.abs(v1)) * 100) : 0;
            return [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3 font-medium dark:text-white">' + item.label + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(v1) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(v2) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono ' + (diff >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + (diff >= 0 ? '+' : '') + this.formatMoney(diff) + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono ' + (pct >= 0 ? 'text-emerald-600' : 'text-red-600') + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%</td>',
        '                </tr>'
            ].join('');
        }).join(''),
        '            </tbody>',
        '        </table>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingSetComparisonYear1 = function(year) {
    this._comparisonYear1 = parseInt(year);
    this.accountingRenderComparison(document.getElementById('accountingContent'));
};

proto.accountingSetComparisonYear2 = function(year) {
    this._comparisonYear2 = parseInt(year);
    this.accountingRenderComparison(document.getElementById('accountingContent'));
};

proto.accountingGetYearBalances = function(year) {
    const accounts = store.get('accountingAccounts');
    const entries = store.get('accountingEntries');
    const yearEnd = year + '-12-31';
    
    const balances = { activo: 0, pasivo: 0, patrimonio: 0, ingresos: 0, gastos: 0, resultado: 0 };
    
    entries.filter(e => e.date <= yearEnd).forEach(e => {
        (e.lines || []).forEach(l => {
            const acc = accounts.find(a => a.code === l.accountCode);
            if (!acc) return;
            if (acc.class === 7) balances.ingresos += (l.haber || 0) - (l.debe || 0);
            if (acc.class === 6) balances.gastos += (l.debe || 0) - (l.haber || 0);
        });
    });
    
    accounts.forEach(a => {
        const bal = a.balance || 0;
        const prefix = a.code ? String(a.code).substring(0, 2) : '';
        
        // ACTIVO: Inmovilizado (2), Inventario (3), Terceros deudores (4D), Tesorería (5D)
        if ([2,3,4,5].includes(a.class) && a.nature === 'debtor') balances.activo += bal;
        
        // PASIVO: Terceros acreedores (4C), Tesorería acreedora/descubierto (5C), Deudas financieras y provisions (1: 15-19)
        if ((a.class === 4 || a.class === 5) && a.nature === 'creditor') balances.pasivo += bal;
        if (a.class === 1 && ['15','16','17','18','19'].includes(prefix)) balances.pasivo += bal;
        
        // PATRIMONIO NETO: Capital, reservas, resultado, subvenciones, écarts (1: 10-14)
        if (a.class === 1 && ['10','11','12','13','14'].includes(prefix)) balances.patrimonio += bal;
    });
    
    balances.resultado = balances.ingresos - balances.gastos;
    return balances;
};

/**
 * Renderiza centros de costo
 */
proto.accountingRenderCostCenters = function(contentEl) {
    const configs = store.get('accountingConfigs') || {};
    const costCenters = configs.costCenters || ['General'];
    const entries = store.get('accountingEntries');
    const accounts = store.get('accountingAccounts');
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Centros de Costo</h3>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '        <h4 class="font-medium dark:text-white">Configurar Centros</h4>',
        '        <div class="flex gap-2">',
        '            <input type="text" id="newCostCenter" placeholder="Nuevo centro de costo..." class="flex-1 px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm">',
        '            <button onclick="ui.accountingAddCostCenter()" class="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm">Agregar</button>',
        '        </div>',
        '        <div class="flex flex-wrap gap-2">',
        costCenters.map(cc => [
        '            <span class="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-sm dark:text-white flex items-center gap-2">',
        '                ' + this.escapeHtml(cc),
        '                <button onclick="ui.accountingRemoveCostCenter(\'' + cc + '\')" class="text-red-500 hover:text-red-700"><i class="fas fa-times"></i></button>',
        '            </span>'
        ].join('')).join(''),
        '        </div>',
        '    </div>',
        '    <h4 class="font-bold dark:text-white">Gastos por Centro de Costo</h4>',
        '    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">',
        costCenters.map(cc => {
            let total = 0;
            entries.forEach(e => {
                (e.lines || []).forEach(l => {
                    if (l.costCenter === cc) {
                        const acc = accounts.find(a => a.code === l.accountCode);
                        if (acc && acc.class === 6) total += (l.debe || 0) - (l.haber || 0);
                    }
                });
            });
            return [
        '        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 elevation-1 text-center">',
        '            <p class="text-sm text-slate-500 dark:text-slate-400">' + this.escapeHtml(cc) + '</p>',
        '            <p class="text-xl font-bold text-red-700 dark:text-red-400">' + this.formatMoney(total) + '</p>',
        '        </div>'
            ].join('');
        }).join(''),
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingAddCostCenter = function() {
    const input = document.getElementById('newCostCenter');
    const name = (input?.value || '').trim();
    if (!name) return;
    const configs = store.get('accountingConfigs') || {};
    const centers = new Set(configs.costCenters || []);
    centers.add(name);
    configs.costCenters = Array.from(centers);
    store.save('accountingConfigs', configs);
    this.accountingRenderCostCenters(document.getElementById('accountingContent'));
};

proto.accountingRemoveCostCenter = function(name) {
    const configs = store.get('accountingConfigs') || {};
    configs.costCenters = (configs.costCenters || []).filter(c => c !== name);
    store.save('accountingConfigs', configs);
    this.accountingRenderCostCenters(document.getElementById('accountingContent'));
};

/**
 * Renderiza subcuentas auxiliares
 */
proto.accountingRenderSubaccounts = function(contentEl) {
    const accounts = store.get('accountingAccounts');
    const parentCode = this._subaccountParent || '';
    const parents = accounts.filter(a => a.active && a.code.length <= 3).sort((a, b) => a.code.localeCompare(b.code));
    
    const subaccounts = parentCode ? accounts.filter(a => a.active && a.code.startsWith(parentCode) && a.code !== parentCode && a.code.length > 3).sort((a, b) => a.code.localeCompare(b.code)) : [];
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Subcuentas Auxiliares</h3>',
        '    <div class="flex flex-col sm:flex-row gap-4">',
        '        <select onchange="ui.accountingSetSubaccountParent(this.value)" class="px-4 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white">',
        '            <option value="">Seleccionar cuenta principal...</option>',
        parents.map(p => '<option value="' + p.code + '"' + (p.code === parentCode ? ' selected' : '') + '>' + p.code + ' - ' + p.name + '</option>').join(''),
        '        </select>',
        '    </div>',
        parentCode ? [
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '        <h4 class="font-medium dark:text-white">Crear Subcuenta bajo ' + parentCode + '</h4>',
        '        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">',
        '            <div><label class="block text-xs text-gray-500 mb-1">Código</label><input type="text" id="subCode" placeholder="' + parentCode + '01" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"></div>',
        '            <div><label class="block text-xs text-gray-500 mb-1">Nombre</label><input type="text" id="subName" placeholder="Nombre subcuenta" class="w-full px-3 py-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"></div>',
        '            <div class="flex items-end"><button onclick="ui.accountingSaveSubaccount()" class="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm">Crear Subcuenta</button></div>',
        '        </div>',
        '    </div>',
        '    <div class="rw-table-scroll">',
        '        <table class="w-full">',
        '            <thead class="bg-slate-50 dark:bg-slate-700 text-xs"><tr><th class="px-4 py-3 text-left">Código</th><th class="px-4 py-3 text-left">Nombre</th><th class="px-4 py-3 text-left">Tipo</th><th class="px-4 py-3 text-right">Saldo</th><th class="px-4 py-3 text-center">Acciones</th></tr></thead>',
        '            <tbody class="divide-y dark:divide-gray-700">',
        subaccounts.length === 0 ? '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">No hay subcuentas</td></tr>' :
        subaccounts.map(s => [
        '                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">',
        '                    <td class="px-4 py-3 font-mono dark:text-white">' + s.code + '</td>',
        '                    <td class="px-4 py-3 dark:text-gray-200">' + this.escapeHtml(s.name) + '</td>',
        '                    <td class="px-4 py-3 text-xs dark:text-gray-400">' + s.type + '</td>',
        '                    <td class="px-4 py-3 text-right font-mono dark:text-white">' + this.formatMoney(s.balance || 0) + '</td>',
        '                    <td class="px-4 py-3 text-center"><button onclick="ui.accountingDeleteSubaccount(\'' + s.code + '\')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button></td>',
        '                </tr>'
        ].join('')).join(''),
        '            </tbody>',
        '        </table>',
        '    </div>'
        ].join('') : '<p class="text-slate-500 dark:text-slate-400">Seleccione una cuenta principal para gestionar sus subcuentas.</p>',
        '</div>'
    ].join('');
};

proto.accountingSetSubaccountParent = function(code) {
    this._subaccountParent = code;
    this.accountingRenderSubaccounts(document.getElementById('accountingContent'));
};

proto.accountingSaveSubaccount = function() {
    const code = document.getElementById('subCode')?.value?.trim();
    const name = document.getElementById('subName')?.value?.trim();
    const parent = this._subaccountParent;
    
    if (!code || !name || !parent) {
        this.showToast('Código y nombre son obligatorios', 'error');
        return;
    }
    if (!code.startsWith(parent)) {
        this.showToast('El código debe comenzar con ' + parent, 'error');
        return;
    }
    
    const accounts = store.get('accountingAccounts');
    if (accounts.some(a => a.code === code)) {
        this.showToast('Ya existe una cuenta con ese código', 'error');
        return;
    }
    
    const parentAcc = accounts.find(a => a.code === parent);
    accounts.push({
        code,
        name,
        type: parentAcc?.type || 'asset',
        nature: parentAcc?.nature || 'debtor',
        class: parentAcc?.class || 4,
        description: 'Subcuenta de ' + parent,
        balance: 0,
        active: true
    });
    
    accounts.sort((a, b) => a.code.localeCompare(b.code));
    store.save('accountingAccounts', accounts);
    this.showToast('Subcuenta creada', 'success');
    this.accountingRenderSubaccounts(document.getElementById('accountingContent'));
};

proto.accountingDeleteSubaccount = function(code) {
    if (!confirm('¿Eliminar esta subcuenta?')) return;
    let accounts = store.get('accountingAccounts');
    accounts = accounts.filter(a => a.code !== code);
    store.save('accountingAccounts', accounts);
    this.showToast('Subcuenta eliminada', 'success');
    this.accountingRenderSubaccounts(document.getElementById('accountingContent'));
};

/**
 * Renderiza memoria y notas
 */
proto.accountingRenderNotes = function(contentEl) {
    const configs = store.get('accountingConfigs') || {};
    const notes = configs.notes || '';
    
    contentEl.innerHTML = [
        '<div class="space-y-6">',
        '    <h3 class="text-lg font-bold dark:text-white border-b dark:border-slate-700 pb-2">Memoria y Notas a los Estados Financieros</h3>',
        '    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 elevation-1 space-y-4">',
        '        <p class="text-sm text-slate-500 dark:text-slate-400">Utilice este espacio para documentar políticas contables, eventos posteriores, contingencias u otra información relevante para la interpretación de los estados financieros.</p>',
        '        <textarea id="accountingNotesText" rows="12" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white text-sm" placeholder="Escriba aquí la memoria...">' + this.escapeHtml(notes) + '</textarea>',
        '        <div class="flex justify-end">',
        '            <button onclick="ui.accountingSaveNotes()" class="px-6 py-2 rounded-xl btn-primary-gradient text-white">Guardar Memoria</button>',
        '        </div>',
        '    </div>',
        '</div>'
    ].join('');
};

proto.accountingSaveNotes = function() {
    const configs = store.get('accountingConfigs') || {};
    configs.notes = document.getElementById('accountingNotesText')?.value || '';
    store.save('accountingConfigs', configs);
    this.showToast('Memoria guardada', 'success');
};
