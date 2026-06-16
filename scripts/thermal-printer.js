/**
 * ThermalPrinter - Módulo universal ESC/POS para impresoras térmicas USB
 * Web Serial API (Chrome/Edge/Opera) - Sin drivers necesarios
 * Compatibilidad universal: cualquier impresora ESC/POS vía USB-Serial
 * Soporta 58mm (32 cols) y 80mm (48 cols) con detección automática
 * Codificación CP437 para caracteres españoles correctos
 * D-WALL S.L. - 2026
 */
class ThermalPrinter {
    constructor() {
        this.port = null;
        this.writer = null;
        this.usbDevice = null;
        this.usbEndpoint = null;
        this.connected = false;
        this.connectionMode = null; // 'serial' | 'usb' | null
        this.width = 48; // default 80mm (48 cols)
        this.paperWidthMm = 80; // ancho físico en mm para CSS/HTML
        this.settingsKey = 'thermal_printer_settings_v2';
        this.printerType = 'auto'; // 'auto' | 'thermal' | 'browser-thermal' | 'a4'
        this.codePage = 'cp437'; // 'cp437' | 'cp850' | 'utf8'
        this.lastError = null;
        this._reconnecting = false;
        this.loadSettings();
    }

    loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(this.settingsKey) || '{}');
            this.paperWidthMm = s.width === 58 ? 58 : s.width === 80 ? 80 : 80;
            this.width = this.paperWidthMm === 58 ? 30 : 48;
            this.autoOpenDrawer = s.autoOpenDrawer !== false;
            this.autoPrintSale = s.autoPrintSale !== false;
            this.printerType = s.printerType || 'auto';
            this.codePage = s.codePage || 'cp437';
        } catch (e) {
            this.width = 48;
            this.paperWidthMm = 80;
            this.autoOpenDrawer = true;
            this.autoPrintSale = true;
            this.printerType = 'auto';
            this.codePage = 'cp437';
        }
    }

    saveSettings() {
        this.paperWidthMm = this.paperWidthMm === 58 || this.width <= 32 ? 58 : 80;
        localStorage.setItem(this.settingsKey, JSON.stringify({
            width: this.paperWidthMm,
            autoOpenDrawer: this.autoOpenDrawer,
            autoPrintSale: this.autoPrintSale,
            printerType: this.printerType,
            codePage: this.codePage
        }));
    }

    setWidth(mm) {
        this.paperWidthMm = mm === 58 ? 58 : 80;
        this.width = this.paperWidthMm === 58 ? 30 : 48;
        this.saveSettings();
    }

    setPrinterType(type) {
        this.printerType = ['auto', 'thermal', 'browser-thermal', 'a4'].includes(type) ? type : 'auto';
        this.saveSettings();
    }

    setCodePage(cp) {
        this.codePage = ['cp437', 'cp850', 'utf8'].includes(cp) ? cp : 'cp437';
        this.saveSettings();
    }

    shouldUseThermal() {
        if (this.printerType === 'thermal') return true;
        if (this.printerType === 'a4' || this.printerType === 'browser-thermal') return false;
        return this.isConnected();
    }

    shouldUseBrowserThermal() {
        if (this.printerType === 'browser-thermal') return true;
        if (this.printerType === 'thermal' || this.printerType === 'a4') return false;
        // auto: usar browser-thermal si no hay térmica USB conectada
        return !this.isConnected();
    }

    shouldUseA4() {
        if (this.printerType === 'a4') return true;
        if (this.printerType === 'thermal' || this.printerType === 'browser-thermal') return false;
        return false;
    }

    isConnected() {
        if (!this.connected) return false;
        if (this.connectionMode === 'serial') {
            try {
                return !!(this.port && this.writer);
            } catch (e) { return false; }
        }
        if (this.connectionMode === 'usb') {
            try {
                return !!(this.usbDevice && this.usbDevice.opened);
            } catch (e) { return false; }
        }
        return false;
    }

    async autoConnect() {
        if (this.isConnected()) return true;
        // Intentar USB primero (si Zadig está instalado)
        if (this._supportsUSB()) {
            try {
                const devices = await navigator.usb.getDevices();
                console.log('[ThermalPrinter] Dispositivos USB autorizados previamente:', devices.length);
                if (devices.length === 0) {
                    console.log('[ThermalPrinter] No hay dispositivos autorizados para este dominio. Intentando requestDevice...');
                    // Si no hay dispositivos previos para este dominio, pedir uno nuevo
                    try {
                        const device = await navigator.usb.requestDevice({ filters: [] });
                        if (device) {
                            await this._openUSBDevice(device);
                            console.log('[ThermalPrinter] Auto-conectado vía WebUSB (nuevo dispositivo)');
                            return true;
                        }
                    } catch (reqErr) {
                        console.warn('[ThermalPrinter] requestDevice cancelado o falló:', reqErr.message);
                    }
                }
                for (const dev of devices) {
                    try {
                        await this._openUSBDevice(dev);
                        console.log('[ThermalPrinter] Auto-conectado vía WebUSB');
                        return true;
                    } catch (usbErr) {
                        console.warn('[ThermalPrinter] USB falló:', usbErr.message);
                    }
                }
            } catch (e) {
                console.warn('[ThermalPrinter] Error en autoConnect USB:', e.message);
            }
        }
        // Fallback a Serial
        if (this._supportsSerial()) {
            try {
                const ports = await navigator.serial.getPorts();
                for (const port of ports) {
                    try {
                        this.port = port;
                        await this._openPort(port);
                        console.log('[ThermalPrinter] Auto-conectado vía Web Serial API');
                        return true;
                    } catch (portErr) {
                        console.warn('[ThermalPrinter] Puerto falló:', portErr.message);
                        try { await port.close(); } catch (e) {}
                    }
                }
            } catch (e) {
                console.warn('[ThermalPrinter] Auto-connect falló:', e);
                this.lastError = e.message;
            }
        }
        this._resetConnection();
        return false;
    }

    _resetConnection() {
        this.port = null;
        this.writer = null;
        this.usbDevice = null;
        this.usbEndpoint = null;
        this.connected = false;
        this.connectionMode = null;
    }

    async connect() {
        // Intentar Serial primero
        if (this._supportsSerial()) {
            try {
                this.port = await navigator.serial.requestPort({ filters: [] });
                await this._openPort(this.port);
                this.saveSettings();
                return true;
            } catch (e) {
                // Si falla, no lanzar error todavía
            }
        }
        // Fallback a USB
        if (this._supportsUSB()) {
            try {
                const device = await navigator.usb.requestDevice({ filters: [] });
                await this._openUSBDevice(device);
                this.saveSettings();
                return true;
            } catch (usbErr) {
                throw new Error('No se pudo conectar por Serial ni por USB. ' + (usbErr.message || ''));
            }
        }
        throw new Error('Web Serial API y WebUSB no soportadas. Usa Chrome/Edge en escritorio.');
    }

    async connectUSB() {
        if (!this._supportsUSB()) {
            throw new Error('WebUSB no soportada. Usa Chrome/Edge en escritorio.');
        }
        try {
            const device = await navigator.usb.requestDevice({ filters: [] });
            await this._openUSBDevice(device);
            this.saveSettings();
            return true;
        } catch (e) {
            this._resetConnection();
            this.lastError = e.message;
            throw e;
        }
    }

    async connectWithFilters() {
        if (!this._supportsSerial()) {
            throw new Error('Web Serial API no soportada. Usa Chrome, Edge u Opera en escritorio.');
        }
        try {
            this.port = await navigator.serial.requestPort({
                filters: [
                    { usbVendorId: 0x04b8 }, // Epson
                    { usbVendorId: 0x0fe6 }, // Xprinter / POS-58
                    { usbVendorId: 0x1a86 }, // CH340 (Xprinter común)
                    { usbVendorId: 0x0483 }, // STMicro (algunas Bematech)
                    { usbVendorId: 0x0403 }, // FTDI
                    { usbVendorId: 0x067b }, // Prolific
                    { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
                    { usbVendorId: 0x0525 }, // Netchip (algunas genéricas)
                ]
            });
            await this._openPort(this.port);
            this.saveSettings();
            return true;
        } catch (e) {
            this._resetConnection();
            this.lastError = e.message;
            throw e;
        }
    }

    async _openPort(port) {
        await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
        this.writer = port.writable.getWriter();
        this.connected = true;
        this.connectionMode = 'serial';
        this.lastError = null;
        await this.init();
    }

    async _openUSBDevice(device) {
        await device.open();
        console.log('[ThermalPrinter] USB device opened:', device.productName, 'VID:', device.vendorId, 'PID:', device.productId);

        // Si no hay configuración seleccionada, usar la primera
        if (device.configuration === null) {
            if (device.configurations && device.configurations.length > 0) {
                await device.selectConfiguration(device.configurations[0].configurationValue);
            } else {
                throw new Error('El dispositivo USB no tiene configuraciones disponibles.');
            }
        }

        const config = device.configuration;
        console.log('[ThermalPrinter] Configuración:', config.configurationValue, 'Interfaces:', config.interfaces.length);

        // Buscar endpoint OUT (bulk o interrupt) en cualquier interfaz
        let claimedInterfaceNumber = null;
        let outEndpoint = null;

        for (const iface of config.interfaces) {
            const alternates = iface.alternates || [iface.alternate];
            for (const alt of alternates) {
                if (!alt) continue;
                console.log(`[ThermalPrinter] Interfaz ${iface.interfaceNumber} alt ${alt.alternateSetting}:`, alt.endpoints.map(e => `ep${e.endpointNumber} ${e.direction} ${e.type}`).join(', '));

                // Buscar endpoint OUT: primero bulk, luego interrupt
                let epOut = alt.endpoints.find(ep => ep.direction === 'out' && ep.type === 'bulk');
                if (!epOut) {
                    epOut = alt.endpoints.find(ep => ep.direction === 'out' && ep.type === 'interrupt');
                }
                if (epOut) {
                    let claimed = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await device.claimInterface(iface.interfaceNumber);
                            claimed = true;
                            break;
                        } catch (e) {
                            console.warn(`[ThermalPrinter] Intento ${attempt}/3: No se pudo reclamar interfaz ${iface.interfaceNumber}:`, e.message);
                            if (attempt < 3) await this.delay(500);
                        }
                    }
                    if (claimed) {
                        claimedInterfaceNumber = iface.interfaceNumber;
                        outEndpoint = epOut;
                        console.log(`[ThermalPrinter] Interfaz ${iface.interfaceNumber} reclamada. Endpoint OUT: ${epOut.endpointNumber} (${epOut.type})`);
                        // Autodetectar ancho de papel por nombre de dispositivo
                        const pname = (device.productName || '').toLowerCase();
                        if (pname.includes('58') || pname.includes('pos58')) {
                            if (this.paperWidthMm !== 58) {
                                console.log('[ThermalPrinter] Auto-detectado: impresora 58mm por nombre USB');
                                this.paperWidthMm = 58;
                                this.width = 30;
                            }
                        }
                        break;
                    } else {
                        console.warn(`[ThermalPrinter] No se pudo reclamar interfaz ${iface.interfaceNumber} tras 3 intentos. Otro programa (spooler de Windows) puede estar usando la impresora.`);
                        continue;
                    }
                }
            }
            if (outEndpoint) break;
        }

        if (!outEndpoint) {
            try { await device.close(); } catch (e) {}
            throw new Error('No se encontró endpoint OUT en la impresora USB. Causas posibles: 1) Necesitas autorizar la impresora en ESTE dominio (pulsa Conectar USB y seleccionala). 2) Zadig/WinUSB no está instalado correctamente. 3) La impresora usa otro protocolo.');
        }

        this.usbDevice = device;
        this.usbEndpoint = outEndpoint;
        this.usbInterfaceNumber = claimedInterfaceNumber;
        this.connected = true;
        this.connectionMode = 'usb';
        this.lastError = null;
        await this.init();
    }

    async disconnect() {
        this.connected = false;
        this.connectionMode = null;
        if (this.writer) {
            try { this.writer.releaseLock(); } catch (e) {}
            this.writer = null;
        }
        if (this.port) {
            try { await this.port.close(); } catch (e) {}
            this.port = null;
        }
        if (this.usbDevice) {
            if (this.usbInterfaceNumber !== null && this.usbInterfaceNumber !== undefined) {
                try { await this.usbDevice.releaseInterface(this.usbInterfaceNumber); } catch (e) {}
            }
            try { await this.usbDevice.close(); } catch (e) {}
            this.usbDevice = null;
            this.usbEndpoint = null;
            this.usbInterfaceNumber = null;
        }
    }

    async ensureConnected() {
        if (this.isConnected()) return true;
        return this.autoConnect();
    }

    _supportsSerial() {
        return 'serial' in navigator && typeof navigator.serial.requestPort === 'function';
    }

    _supportsUSB() {
        const hasAPI = 'usb' in navigator && typeof navigator.usb.requestDevice === 'function';
        if (!hasAPI) return false;
        // Verificar si está bloqueado por Feature Policy
        try {
            const allowed = document.featurePolicy?.allowsFeature('usb');
            if (allowed === false) {
                console.warn('[ThermalPrinter] WebUSB bloqueado por Feature Policy del sitio');
                return false;
            }
        } catch (e) {}
        return true;
    }

    // ==================== ESC/POS COMANDOS ====================

    get cmds() {
        return {
            INIT: new Uint8Array([0x1B, 0x40]),
            LF: new Uint8Array([0x0A]),
            CR: new Uint8Array([0x0D]),
            BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]),
            BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
            UNDERLINE_ON: new Uint8Array([0x1B, 0x2D, 0x01]),
            UNDERLINE_OFF: new Uint8Array([0x1B, 0x2D, 0x00]),
            CENTER: new Uint8Array([0x1B, 0x61, 0x01]),
            LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
            RIGHT: new Uint8Array([0x1B, 0x61, 0x02]),
            DOUBLE_WIDTH: new Uint8Array([0x1D, 0x21, 0x10]),
            DOUBLE_HEIGHT: new Uint8Array([0x1D, 0x21, 0x01]),
            DOUBLE_BOTH: new Uint8Array([0x1D, 0x21, 0x11]),
            NORMAL: new Uint8Array([0x1D, 0x21, 0x00]),
            CUT_PARTIAL: new Uint8Array([0x1D, 0x56, 0x01]),
            CUT_FULL: new Uint8Array([0x1D, 0x56, 0x00]),
            FEED_LINES: (n) => new Uint8Array([0x1B, 0x64, n]),
            DRAWER: new Uint8Array([0x1B, 0x70, 0x00, 0x3C, 0xFA]),
            DRAWER2: new Uint8Array([0x1B, 0x70, 0x01, 0x3C, 0xFA]),
            CODEPAGE_437: new Uint8Array([0x1B, 0x74, 0x00]), // PC437 (USA)
            CODEPAGE_850: new Uint8Array([0x1B, 0x74, 0x02]), // PC850 (Multilingual)
        };
    }

    // ==================== CODIFICACIÓN ROBUSTA ====================

    // Mapeo UTF-8 → CP437 para caracteres españoles y símbolos comunes
    _cp437Map() {
        return {
            'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85,
            'å': 0x86, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8A, 'ï': 0x8B,
            'î': 0x8C, 'ì': 0x8D, 'Ä': 0x8E, 'Å': 0x8F, 'É': 0x90, 'æ': 0x91,
            'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x98,
            'ÿ': 0x99, 'Ö': 0x9A, 'Ü': 0x9B, '¢': 0x9C, '£': 0x9D, '¥': 0x9E,
            '₧': 0x9F, 'á': 0xA0, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3, 'ñ': 0xA4,
            'Ñ': 0xA5, 'ª': 0xA6, 'º': 0xA7, '¿': 0xA8, '⌐': 0xA9, '¬': 0xAA,
            '½': 0xAB, '¼': 0xAC, '¡': 0xAD, '«': 0xAE, '»': 0xAF,
            '░': 0xB0, '▒': 0xB1, '▓': 0xB2, '│': 0xB3, '┤': 0xB4, 'Á': 0xB5,
            'Â': 0xB6, 'À': 0xB7, '©': 0xB8, '╣': 0xB9, '║': 0xBA, '╗': 0xBB,
            '╝': 0xBC, '¢': 0xBD, '¥': 0xBE, '┐': 0xBF, '└': 0xC0, '┴': 0xC1,
            '┬': 0xC2, '├': 0xC3, '─': 0xC4, '┼': 0xC5, 'ã': 0xC6, 'Ã': 0xC7,
            '╚': 0xC8, '╔': 0xC9, '╩': 0xCA, '╦': 0xCB, '╠': 0xCC, '═': 0xCD,
            '╬': 0xCE, '¤': 0xCF, 'ð': 0xD0, 'Ð': 0xD1, 'Ê': 0xD2, 'Ë': 0xD3,
            'È': 0xD4, 'ı': 0xD5, 'Í': 0xD6, 'Î': 0xD7, 'Ï': 0xD8, '┘': 0xD9,
            '┌': 0xDA, '█': 0xDB, '▄': 0xDC, '¦': 0xDD, 'Ì': 0xDE, '▀': 0xDF,
            'Ó': 0xE0, 'ß': 0xE1, 'Ô': 0xE2, 'Ò': 0xE3, 'õ': 0xE4, 'Õ': 0xE5,
            'µ': 0xE6, 'þ': 0xE7, 'Þ': 0xE8, 'Ú': 0xE9, 'Û': 0xEA, 'Ù': 0xEB,
            'ý': 0xEC, 'Ý': 0xED, '¯': 0xEE, '´': 0xEF, '≡': 0xF0, '±': 0xF1,
            '‗': 0xF2, '¾': 0xF3, '¶': 0xF4, '§': 0xF5, '÷': 0xF6, '¸': 0xF7,
            '°': 0xF8, '¨': 0xF9, '·': 0xFA, '¹': 0xFB, '³': 0xFC, '²': 0xFD,
            '■': 0xFE, ' ': 0x20,
            // Aproximaciones comunes
            '€': 0x80, // Algunas impresoras lo mapean a Ç o a 0x80
            '’': 0x27, "'": 0x27,
            '“': 0x22, '”': 0x22, '"': 0x22,
        };
    }

    _cp850Map() {
        // Subconjunto de CP850 para español (diferencias con CP437)
        const map = { ...this._cp437Map() };
        // CP850 tiene algunas diferencias; para español básico son muy similares
        // Los principales caracteres españoles están en las mismas posiciones
        return map;
    }

    _normalizeChar(char) {
        // Si el carácter no está en el mapa, intentar quitarle el acento
        const normalizations = {
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
            'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
            'ñ': 'n', 'Ñ': 'N',
            'ü': 'u', 'Ü': 'U',
            'à': 'a', 'è': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
            'À': 'A', 'È': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U',
            'â': 'a', 'ê': 'e', 'î': 'i', 'ô': 'o', 'û': 'u',
            'Â': 'A', 'Ê': 'E', 'Î': 'I', 'Ô': 'O', 'Û': 'U',
            'ã': 'a', 'õ': 'o', 'Ã': 'A', 'Õ': 'O',
            'ç': 'c', 'Ç': 'C',
            'ö': 'o', 'Ö': 'O', 'ä': 'a', 'Ä': 'A',
            'ß': 'ss', 'ÿ': 'y', 'ý': 'y', 'Ý': 'Y',
        };
        return normalizations[char] || char;
    }

    encodeToEscPos(text) {
        if (this.codePage === 'utf8') {
            return new TextEncoder().encode(text);
        }
        const map = this.codePage === 'cp850' ? this._cp850Map() : this._cp437Map();
        const bytes = [];
        for (const char of text) {
            const code = char.charCodeAt(0);
            if (code < 128) {
                bytes.push(code);
            } else if (map[char] !== undefined) {
                bytes.push(map[char]);
            } else {
                // Intentar normalizar (quitar acento)
                const normalized = this._normalizeChar(char);
                if (normalized.length === 1 && normalized.charCodeAt(0) < 128) {
                    bytes.push(normalized.charCodeAt(0));
                } else {
                    // Si es un string de varios caracteres, añadir cada uno
                    for (const c of normalized) {
                        bytes.push(c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 0x3F); // 0x3F = '?'
                    }
                }
            }
        }
        return new Uint8Array(bytes);
    }

    async write(data) {
        if (!this.isConnected()) throw new Error('Impresora no conectada. Conecta la impresora desde Ajustes > Impresora Térmica.');
        const payload = typeof data === 'string' ? this.encodeToEscPos(data) : data;
        try {
            if (this.connectionMode === 'usb') {
                await this.usbDevice.transferOut(this.usbEndpoint.endpointNumber, payload);
            } else if (this.connectionMode === 'serial') {
                await this.writer.write(payload);
            } else {
                throw new Error('Modo de conexión desconocido');
            }
        } catch (e) {
            if (e.message?.includes('break') || e.message?.includes('close') || e.message?.includes('disconnected') || e.name === 'NetworkError' || e.name === 'NotFoundError') {
                this._resetConnection();
            }
            throw e;
        }
    }

    async writeLine(text = '') {
        await this.write(text);
        await this.write(this.cmds.LF);
    }

    async init() {
        await this.write(this.cmds.INIT);
        await this.write(this.cmds.LEFT);
        await this.write(this.cmds.NORMAL);
        await this.write(this.cmds.BOLD_OFF);
        // Seleccionar página de código
        if (this.codePage === 'cp850') {
            await this.write(this.cmds.CODEPAGE_850);
        } else {
            await this.write(this.cmds.CODEPAGE_437);
        }
    }

    async cut() {
        try {
            await this.write(this.cmds.CUT_PARTIAL);
        } catch (e) {
            // Fallback: algunas impresoras muy básicas no soportan corte
            console.warn('[ThermalPrinter] Corte no soportado o falló:', e);
        }
    }

    async feedLines(n = 3) {
        await this.write(this.cmds.FEED_LINES(n));
    }

    async openDrawer() {
        if (!this.isConnected()) return false;
        try {
            await this.write(this.cmds.DRAWER);
            await this.delay(100);
            await this.write(this.cmds.DRAWER2);
            return true;
        } catch (e) {
            console.error('[ThermalPrinter] Error abriendo cajón:', e);
            return false;
        }
    }

    async printQR(data) {
        if (!data) return;
        try {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            const len = bytes.length + 3;
            const pL = len & 0xFF;
            const pH = (len >> 8) & 0xFF;

            await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));
            await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]));
            await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30]));
            await this.write(new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]));
            await this.write(bytes);
            await this.write(new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]));
        } catch (e) {
            console.warn('[ThermalPrinter] QR no soportado o falló:', e);
        }
    }

    async printLogo(base64OrUrl, maxWidthPx = 384) {
        if (!base64OrUrl || !this.isConnected()) return false;
        try {
            const img = await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = base64OrUrl;
            });

            let w = img.width;
            let h = img.height;
            if (w > maxWidthPx) {
                h = Math.round(h * (maxWidthPx / w));
                w = maxWidthPx;
            }
            const targetW = Math.ceil(w / 8) * 8;

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, targetW, h);

            const imageData = ctx.getImageData(0, 0, targetW, h);
            const data = imageData.data;
            const bands = Math.ceil(h / 8);
            const columns = targetW;

            for (let band = 0; band < bands; band++) {
                const bandY = band * 8;
                const bandBytes = new Uint8Array(columns);
                for (let x = 0; x < columns; x++) {
                    let byte = 0;
                    for (let dy = 0; dy < 8; dy++) {
                        const y = bandY + dy;
                        if (y >= h) continue;
                        const idx = (y * targetW + x) * 4;
                        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                        if (gray < 128) {
                            byte |= (1 << (7 - dy));
                        }
                    }
                    bandBytes[x] = byte;
                }
                const nL = columns & 0xFF;
                const nH = (columns >> 8) & 0xFF;
                // ESC * 0 nL nH d1...dk (8-dot single density, column format)
                const header = new Uint8Array([0x1B, 0x2A, 0x00, nL, nH]);
                const payload = new Uint8Array(header.length + bandBytes.length);
                payload.set(header, 0);
                payload.set(bandBytes, header.length);
                await this.write(payload);
                await this.write(this.cmds.LF);
            }
            console.log('[ThermalPrinter] Logo ESC* enviado:', targetW, 'x', h);
            return true;
        } catch (e) {
            console.warn('[ThermalPrinter] Error logo:', e);
            return false;
        }
    }

    async printTextLogo(text, width) {
        if (!text || !this.isConnected()) return;
        const t = String(text).substring(0, width);
        await this.write(this.cmds.CENTER);
        await this.write(new Uint8Array([0x1D, 0x21, 0x11])); // GS ! double width + height
        await this.writeLine(t);
        await this.write(new Uint8Array([0x1D, 0x21, 0x00])); // restore normal
    }

    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ==================== UTILIDADES DE FORMATO ====================

    _strWidth(str) {
        // Para ESC/POS estándar, todos los caracteres = 1 columna
        // (asumiendo fuente normal, no ancha)
        let len = 0;
        for (const ch of String(str)) {
            const code = ch.charCodeAt(0);
            if (code >= 0x80) {
                // Caracteres extendidos en ESC/POS generalmente ocupan 1 columna también
                len += 1;
            } else {
                len += 1;
            }
        }
        return len;
    }

    padCenter(text, width) {
        const s = String(text);
        const pad = Math.max(0, width - this._strWidth(s));
        const left = Math.floor(pad / 2);
        const right = pad - left;
        return ' '.repeat(left) + s + ' '.repeat(right);
    }

    padLeft(text, width) {
        const s = String(text);
        const w = this._strWidth(s);
        return w >= width ? s : ' '.repeat(width - w) + s;
    }

    padRight(text, width) {
        const s = String(text);
        const w = this._strWidth(s);
        return w >= width ? s.slice(0, width) : s + ' '.repeat(width - w);
    }

    line(char = '-') {
        return char.repeat(this.width);
    }

    twoColumns(left, right) {
        const lw = this.width - this._strWidth(right);
        return this.padRight(left, lw) + right;
    }

    threeColumns(a, b, c) {
        const cw = Math.floor(this.width / 3);
        return this.padRight(a, cw) + this.padRight(b, cw) + this.padLeft(c, cw);
    }

    // ==================== TICKET COMPLETO ====================

    async printTicket(data) {
        if (!this.isConnected()) {
            throw new Error('Impresora no conectada. Conecta la impresora desde Ajustes > Impresora Térmica.');
        }

        const settings = data.settings || {};
        const sale = data.sale || data;
        // Forzar autodetección de ancho si hay USB conectado
        if (this.usbDevice) {
            const pname = (this.usbDevice.productName || '').toLowerCase();
            if ((pname.includes('58') || pname.includes('pos58')) && this.width > 32) {
                console.log('[ThermalPrinter] Forzando 58mm por USB device en printTicket');
                this.paperWidthMm = 58;
                this.width = 30;
            }
        }

        const w = this.width;
        const is58 = w <= 32;

        console.log('[ThermalPrinter] printTicket START - width=' + w + ' mode=' + this.connectionMode);

        await this.init();

        // Header centrado
        await this.write(this.cmds.CENTER);
        await this.write(this.cmds.BOLD_ON);
        await this.writeLine((settings.businessName || 'D-WALL').substring(0, w));
        await this.write(this.cmds.BOLD_OFF);

        if (settings.taxId) {
            await this.writeLine(`NIF: ${settings.taxId}`.substring(0, w));
        }
        if (settings.address) {
            await this.writeLine(settings.address.substring(0, w));
        }
        if (settings.phone) {
            await this.writeLine(`Tel: ${settings.phone}`.substring(0, w));
        }
        await this.writeLine();

        // Linea separadora
        await this.write(this.cmds.LEFT);
        await this.writeLine(this.line('-'));

        // Info del ticket
        const issuedAt = sale.date ? new Date(sale.date) : new Date();
        const dateCompact = `${issuedAt.getDate().toString().padStart(2,'0')}/${(issuedAt.getMonth()+1).toString().padStart(2,'0')}/${issuedAt.getFullYear().toString().slice(-2)} ${issuedAt.getHours().toString().padStart(2,'0')}:${issuedAt.getMinutes().toString().padStart(2,'0')}`;

        await this.write(this.cmds.BOLD_ON);
        await this.writeLine(this.padCenter('TICKET RIVER-WALL', w));
        await this.write(this.cmds.BOLD_OFF);

        const _line = async (text) => {
            const t = text.substring(0, w);
            console.log('[TP] ' + JSON.stringify(t) + ' len=' + t.length);
            await this.writeLine(t);
        };

        await _line(this.twoColumns('Fecha:', dateCompact));
        await _line(this.twoColumns('Ticket:', `#${sale.ticket || sale.number || ''}`));
        await _line(this.twoColumns('Cliente:', (sale.clientName || 'General').substring(0, w - 10)));
        if (sale.seller) {
            await _line(this.twoColumns('Vendedor:', sale.seller.substring(0, w - 12)));
        }
        await _line(this.line('-'));

        // Items
        const items = sale.items || [];
        for (const item of items) {
            const qty = Number(item.qty || item.quantity || 1);
            const price = Number(item.price || 0);
            const total = price * qty;
            const totalStr = this.formatMoney(total);
            const qtyStr = `${qty}x`;

            // Nombre truncado para que quepa: qtyStr + espacio + name + espacios + totalStr <= w
            const maxNameLen = Math.max(6, w - totalStr.length - qtyStr.length - 2);
            const name = (item.name || 'Producto').substring(0, maxNameLen);
            const left = `${qtyStr} ${name}`;
            const maxLeft = w - totalStr.length;
            const lineText = this.padRight(left, maxLeft).substring(0, maxLeft) + totalStr;
            await _line(lineText);

            if (!is58) {
                const priceStr = this.formatMoney(price);
                await _line(`   ${priceStr} c/u`);
            }

            if (item.discount && item.discount > 0) {
                await _line(this.twoColumns('   Desc:', `-${this.formatMoney(item.discount)}`));
            }
        }

        await _line(this.line('-'));

        // Totales
        const subtotal = Number(sale.subtotal || sale.totalBeforeTax || 0);
        const discount = Number(sale.discount || 0);
        const tax = Number(sale.tax || 0);
        const total = Number(sale.total || 0);

        await _line(this.twoColumns('SUBTOTAL:', this.formatMoney(subtotal)));
        if (discount > 0) {
            await _line(this.twoColumns('DESC:', `-${this.formatMoney(discount)}`));
        }
        if (tax > 0) {
            await _line(this.twoColumns(`IVA(${settings.taxRate || 15}%):`, this.formatMoney(tax)));
        }

        await this.write(this.cmds.BOLD_ON);
        await _line(this.twoColumns('TOTAL:', this.formatMoney(total)));
        await this.write(this.cmds.BOLD_OFF);

        // Pago
        if (sale.paymentMethod) {
            await _line(this.line('-'));
            await _line(this.twoColumns('Metodo:', this.formatPaymentMethod(sale.paymentMethod)));
            if (sale.cashReceived) {
                await _line(this.twoColumns('Recibido:', this.formatMoney(sale.cashReceived)));
                const change = Number(sale.cashReceived) - total;
                if (change > 0) {
                    await _line(this.twoColumns('Cambio:', this.formatMoney(change)));
                }
            }
        }

        await _line(this.line('-'));

        // Footer
        await this.write(this.cmds.CENTER);
        await this.writeLine();
        const footerText = settings.receiptFooter || 'Gracias por su visita!';
        await this.writeLine(footerText.substring(0, w));
        if (settings.receiptQR && sale.id) {
            await this.writeLine();
            await this.printQR(`https://dwall-db.web.app/track.html?id=${sale.id}`);
        }
        await this.writeLine();
        await this.writeLine();

        // Cajon
        if (this.autoOpenDrawer && data.openDrawer !== false) {
            await this.openDrawer();
            await this.delay(300);
        }

        await this.feedLines(3);
        await this.cut();
        console.log('[ThermalPrinter] printTicket END');
    }

    async printKitchenTicket(data) {
        if (!this.isConnected()) return;
        const w = this.width;
        await this.init();
        await this.write(this.cmds.CENTER);
        await this.write(this.cmds.DOUBLE_BOTH);
        await this.writeLine('COCINA');
        await this.write(this.cmds.NORMAL);
        await this.write(this.cmds.LEFT);
        await this.writeLine(this.line('='));
        await this.writeLine(`Mesa: ${data.table || 'BAR'} | ${new Date().toLocaleTimeString('es-ES')}`);
        await this.writeLine(this.line('-'));

        for (const item of (data.items || [])) {
            await this.write(this.cmds.BOLD_ON);
            await this.writeLine(`${item.qty}x ${(item.name || '').substring(0, w - 4)}`);
            await this.write(this.cmds.BOLD_OFF);
            if (item.notes) await this.writeLine(`  >> ${item.notes}`);
            if (item.modifiers?.length) await this.writeLine(`  >> ${item.modifiers.join(', ')}`);
        }
        await this.writeLine(this.line('='));
        await this.writeLine();
        await this.feedLines(2);
        await this.cut();
    }

    // ==================== PÁGINA DE PRUEBA ====================

    async printTestPage() {
        if (!this.isConnected()) {
            throw new Error('Impresora no conectada');
        }
        const w = this.width;
        await this.init();

        await this.write(this.cmds.CENTER);
        await this.write(this.cmds.BOLD_ON);
        await this.writeLine('=== PRUEBA DE IMPRESION ===');
        await this.write(this.cmds.BOLD_OFF);
        await this.writeLine('RIVER-WALL ERP V.5.0');
        await this.writeLine();

        await this.write(this.cmds.LEFT);
        await this.writeLine('Ancho de papel: ' + (w === 32 ? '58mm' : '80mm'));
        await this.writeLine('Pagina de codigo: ' + this.codePage.toUpperCase());
        await this.writeLine();

        await this.writeLine('--- Caracteres basicos ---');
        await this.writeLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
        await this.writeLine('abcdefghijklmnopqrstuvwxyz');
        await this.writeLine('0123456789 !@#$%^&*()_+-=[]');
        await this.writeLine();

        await this.writeLine('--- Caracteres especiales ---');
        await this.writeLine('á é í ó ú ñ Ñ ü Ü');
        await this.writeLine('Á É Í Ó Ó Ú ¿ ¡');
        await this.writeLine('€ £ ¢ ¥ º ª © ®');
        await this.writeLine();

        await this.writeLine('--- Alineacion ---');
        await this.write(this.cmds.LEFT);
        await this.writeLine('Izquierda');
        await this.write(this.cmds.CENTER);
        await this.writeLine('Centro');
        await this.write(this.cmds.RIGHT);
        await this.writeLine('Derecha');
        await this.write(this.cmds.LEFT);
        await this.writeLine();

        await this.writeLine('--- Estilos ---');
        await this.write(this.cmds.BOLD_ON);
        await this.writeLine('Texto en negrita');
        await this.write(this.cmds.BOLD_OFF);
        await this.write(this.cmds.UNDERLINE_ON);
        await this.writeLine('Texto subrayado');
        await this.write(this.cmds.UNDERLINE_OFF);
        await this.write(this.cmds.DOUBLE_HEIGHT);
        await this.writeLine('DOBLE ALTURA');
        await this.write(this.cmds.NORMAL);
        await this.writeLine();

        await this.writeLine('--- Formato de columnas ---');
        await this.writeLine(this.twoColumns('Producto largo de prueba', '1.234 FCFA'));
        await this.writeLine(this.threeColumns('Cant', 'Desc', 'Total'));
        await this.writeLine(this.threeColumns('2', 'Item demo', '500 FCFA'));
        await this.writeLine();

        await this.write(this.cmds.CENTER);
        await this.writeLine('Si ves este texto correctamente,');
        await this.writeLine('la impresora funciona perfecto.');
        await this.writeLine();
        await this.writeLine('== FIN DE PRUEBA ==');
        await this.writeLine();

        await this.feedLines(3);
        await this.cut();
    }

    formatMoney(amount) {
        const val = Number(amount || 0);
        return val.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' FCFA';
    }

    formatPaymentMethod(method) {
        const map = {
            cash: 'Efectivo',
            card: 'Tarjeta',
            transfer: 'Transferencia',
            mobile: 'Movil',
            split: 'Divisado',
            credit: 'Credito',
            free: 'Gratis'
        };
        return map[method] || method;
    }

    // ==================== DIAGNOSTICO ====================

    async diagnose() {
        const results = [];
        const ok = (msg) => results.push({ type: 'ok', text: msg });
        const warn = (msg) => results.push({ type: 'warn', text: msg });
        const err = (msg) => results.push({ type: 'error', text: msg });

        // 1. Navegador
        const ua = navigator.userAgent;
        const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(ua);
        const isOpera = /OPR/.test(ua);
        if (isChrome || isEdge || isOpera) {
            ok(`Navegador compatible: ${isEdge ? 'Edge' : isOpera ? 'Opera' : 'Chrome'}`);
        } else {
            err('Navegador NO compatible. Usa Chrome, Edge u Opera en escritorio.');
        }

        // 2. Web Serial API
        if ('serial' in navigator) {
            ok('Web Serial API disponible');
        } else {
            err('Web Serial API NO disponible en este navegador.');
        }

        // 2.5 WebUSB
        if ('usb' in navigator) {
            ok('WebUSB disponible');
            try {
                const usbDevices = await navigator.usb.getDevices();
                if (usbDevices.length > 0) {
                    ok(`Dispositivos USB autorizados: ${usbDevices.length}`);
                    for (const d of usbDevices) {
                        ok(`  - ${d.productName || 'Desconocido'} (VID: 0x${d.vendorId.toString(16).toUpperCase()}, PID: 0x${d.productId.toString(16).toUpperCase()})`);
                    }
                } else {
                    warn('No hay dispositivos USB autorizados previamente.');
                }
            } catch (e) {
                err('Error al consultar USB: ' + e.message);
            }
        } else {
            warn('WebUSB NO disponible en este navegador.');
        }

        // 3. Protocolo (debe ser https o localhost)
        if (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            ok(`Entorno seguro: ${location.protocol}//${location.hostname}`);
        } else {
            warn('No estas en HTTPS ni localhost. Web Serial API requiere un contexto seguro.');
        }

        // 4. Puertos previamente autorizados
        if ('serial' in navigator) {
            try {
                const ports = await navigator.serial.getPorts();
                if (ports.length > 0) {
                    ok(`Puertos autorizados previamente: ${ports.length}`);
                    for (const p of ports) {
                        const info = p.getInfo ? p.getInfo() : {};
                        ok(`  - USB VendorID: ${info.usbVendorId ? '0x' + info.usbVendorId.toString(16).toUpperCase() : 'N/A'}, ProductID: ${info.usbProductId ? '0x' + info.usbProductId.toString(16).toUpperCase() : 'N/A'}`);
                    }
                } else {
                    warn('No hay puertos serial previamente autorizados.');
                }
            } catch (e) {
                err('Error al consultar puertos: ' + e.message);
            }
        }

        // 5. Estado actual
        if (this.isConnected()) {
            ok('Impresora conectada actualmente');
        } else {
            warn('Impresora NO conectada actualmente');
        }

        // 6. Consejos según SO
        const isWindows = navigator.platform.indexOf('Win') > -1;
        const isMac = navigator.platform.indexOf('Mac') > -1;
        if (isWindows) {
            results.push({ type: 'info', text: 'Windows: Abre Administrador de Dispositivos → Puertos (COM y LPT). Debes ver un puerto COM nuevo al enchufar la impresora. Si aparece con signo amarillo, necesitas drivers del chip (CH340, FTDI, Prolific o Silicon Labs).' });
        } else if (isMac) {
            results.push({ type: 'info', text: 'macOS: Abre Terminal y ejecuta: ls /dev/tty.*  Debes ver un dispositivo nuevo como /dev/tty.usbserial-XXXX al conectar la impresora.' });
        }

        results.push({ type: 'info', text: 'Consejo: Si la impresora aparece en Windows como "Impresora" y no como "Puerto COM", significa que usa modo "USB Printer" (no serial) y NO es compatible con esta web. Necesitaria un driver especifico del fabricante.' });

        return results;
    }
}

// Instancia global
window.ThermalPrinter = new ThermalPrinter();

// Auto-conectar al cargar la pagina (si hay dispositivo previamente autorizado)
setTimeout(() => {
    if (!window.ThermalPrinter.isConnected()) {
        window.ThermalPrinter.autoConnect().then(ok => {
            if (ok) console.log('[ThermalPrinter] Auto-conectado al iniciar la app');
        }).catch(() => {});
    }
}, 600);
