// ==========================================================================
// ROPERO ONLINE - APP JAVASCRIPT
// Dual-Mode Architecture: Firebase Cloud Firestore + Local IndexedDB Fallback
// ==========================================================================

// IndexedDB Configuration
const DB_NAME = 'RoperoDB';
const STORE_NAME = 'wardrobe';
let dbLocal;

// Firebase Cloud State
let isCloudConnected = false;
let dbFirestore = null;

// Configuración predeterminada de Firebase para conexión automática en cualquier dispositivo
const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAs-Wpf6JuS9n-aQ6Bo24gX6u2ZbMmmPCI",
    authDomain: "ropero-online.firebaseapp.com",
    projectId: "ropero-online",
    storageBucket: "ropero-online.firebasestorage.app",
    messagingSenderId: "457205175273",
    appId: "1:457205175273:web:187d25b45fb4e662843178",
    measurementId: "G-JV78V70XY9"
};

// Claves de IA por defecto para funcionamiento automático en GitHub Pages y Móvil
const DEFAULT_AI_CONFIG = {
    REMOVE_BG_API_KEY: typeof atob !== 'undefined' ? atob('d283Q2dkWmpza0xFeENQYWJmRUhDQU1j') : '',
    GEMINI_API_KEY: typeof atob !== 'undefined' ? atob('QVEuQWI4Uk42Sy1rZ2dxSVRjNkttbUVrVndmZi1vUlJIZE1Yb0N1VTZHT0FQV2Y2ejR1Y2c=') : ''
};

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const imageInput = document.getElementById('image-input');
const cameraInput = document.getElementById('camera-input');
const btnTriggerCamera = document.getElementById('btn-trigger-camera');
const btnTriggerGallery = document.getElementById('btn-trigger-gallery');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const loadingContainer = document.getElementById('loading-container');
const uploadActions = document.getElementById('upload-actions');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');
const wardrobeGrid = document.getElementById('wardrobe-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const btnGenerate = document.getElementById('btn-generate');
const wardrobeCounter = document.getElementById('wardrobe-counter');
const categorySelectorWrapper = document.getElementById('category-selector-wrapper');
const themeToggleBtn = document.getElementById('theme-toggle');

// Modal & Cloud DOM Elements
const btnCloudStatus = document.getElementById('btn-cloud-status');
const cloudStatusText = document.getElementById('cloud-status-text');
const btnOpenSettings = document.getElementById('btn-open-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCloseModalFooter = document.getElementById('btn-close-modal-footer');
const firebaseConfigInput = document.getElementById('firebase-config-input');
const btnConnectFirebase = document.getElementById('btn-connect-firebase');
const btnDisconnectFirebase = document.getElementById('btn-disconnect-firebase');
const firebaseStatusMsg = document.getElementById('firebase-status-msg');
const btnMigrateLocal = document.getElementById('btn-migrate-local');
const migrationStatusMsg = document.getElementById('migration-status-msg');
const removeBgKeyInput = document.getElementById('remove-bg-key-input');
const geminiKeyInput = document.getElementById('gemini-key-input');
const btnSaveKeys = document.getElementById('btn-save-keys');
const keysStatusMsg = document.getElementById('keys-status-msg');
const connIcon = document.getElementById('conn-icon');
const connTitle = document.getElementById('conn-title');
const connDesc = document.getElementById('conn-desc');

let currentProcessedImage = null;
let currentCategory = "";
let currentSubtipo = "";
let currentDescripcion = "";

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await initLocalDB();
    await initCloudOrFallback();
    setupNavigation();
    setupUploadHandlers();
    setupWardrobeFilters();
    setupOutfitGenerator();
    setupCategoryPills();
    setupSettingsModal();
    loadWardrobe('all');
});

// ==========================================================================
// THEME MANAGEMENT (Dark / Light Mode)
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem('ropero-theme') || 'dark';
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('ropero-theme', newTheme);
        });
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');

    if (theme === 'light') {
        if (sunIcon) sunIcon.classList.remove('hidden');
        if (moonIcon) moonIcon.classList.add('hidden');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#F8F6F2');
    } else {
        if (sunIcon) sunIcon.classList.add('hidden');
        if (moonIcon) moonIcon.classList.remove('hidden');
        if (metaThemeColor) metaThemeColor.setAttribute('content', '#090D16');
    }
}

// ==========================================================================
// FIREBASE CLOUD & LOCAL DB INITIALIZATION
// ==========================================================================
async function initCloudOrFallback() {
    // 1. Obtener configuración de Firebase (por defecto DEFAULT_FIREBASE_CONFIG para conexión automática)
    let firebaseConfig = DEFAULT_FIREBASE_CONFIG;

    if (typeof CONFIG !== 'undefined' && CONFIG.FIREBASE_CONFIG && CONFIG.FIREBASE_CONFIG.apiKey) {
        firebaseConfig = CONFIG.FIREBASE_CONFIG;
        localStorage.setItem('ropero_firebase_config', JSON.stringify(firebaseConfig));
        if (CONFIG.REMOVE_BG_API_KEY) localStorage.setItem('ropero_remove_bg_key', CONFIG.REMOVE_BG_API_KEY);
        if (CONFIG.GEMINI_API_KEY) localStorage.setItem('ropero_gemini_key', CONFIG.GEMINI_API_KEY);
    } else {
        const storedConfig = localStorage.getItem('ropero_firebase_config');
        if (storedConfig) {
            try {
                firebaseConfig = JSON.parse(storedConfig);
            } catch (e) {
                console.warn("Configuración guardada de Firebase inválida, usando predeterminada");
                firebaseConfig = DEFAULT_FIREBASE_CONFIG;
            }
        }
    }

    if (firebaseConfig && typeof firebase !== 'undefined') {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            dbFirestore = firebase.firestore();
            isCloudConnected = true;
            updateCloudUIState(true);
            console.log("✅ Conectado automáticamente a Firebase Firestore");

            // Sincronización en tiempo real entre todos los dispositivos (computadora, celular, etc.)
            dbFirestore.collection('prendas').onSnapshot(() => {
                const activeCategory = document.querySelector('.filter-btn.active')
                    ? document.querySelector('.filter-btn.active').getAttribute('data-category')
                    : 'all';
                loadWardrobe(activeCategory);
            }, (err) => {
                console.warn("Aviso en listener en tiempo real de Firestore:", err);
            });

            return;
        } catch (error) {
            console.error("Fallo al conectar con Firebase:", error);
        }
    }

    // Modo local de respaldo si no hay conexión
    isCloudConnected = false;
    updateCloudUIState(false);
}

function updateCloudUIState(connected) {
    if (connected) {
        if (btnCloudStatus) {
            btnCloudStatus.classList.remove('offline');
            btnCloudStatus.classList.add('online');
        }
        if (cloudStatusText) cloudStatusText.textContent = "Nube Conectada ☁️";
        if (connIcon) connIcon.textContent = "🟢";
        if (connTitle) connTitle.textContent = "Firebase Conectado";
        if (connDesc) connDesc.textContent = "Tus prendas se sincronizan automáticamente en tiempo real en la nube.";
        if (btnDisconnectFirebase) btnDisconnectFirebase.classList.remove('hidden');
        if (btnMigrateLocal) btnMigrateLocal.disabled = false;
    } else {
        if (btnCloudStatus) {
            btnCloudStatus.classList.remove('online');
            btnCloudStatus.classList.add('offline');
        }
        if (cloudStatusText) cloudStatusText.textContent = "Modo Local";
        if (connIcon) connIcon.textContent = "☁️";
        if (connTitle) connTitle.textContent = "Modo Local (Sin Nube)";
        if (connDesc) connDesc.textContent = "Tus prendas se guardan en este navegador. Conecta Firebase para sincronizar en todos tus dispositivos.";
        if (btnDisconnectFirebase) btnDisconnectFirebase.classList.add('hidden');
        if (btnMigrateLocal) btnMigrateLocal.disabled = true;
    }
}

// IndexedDB Setup (Versión 4 para soportar compatibilidad con esquemas previos)
function initLocalDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 4);

        request.onerror = (e) => {
            console.error("Error al abrir IndexedDB:", request.error);
            reject("Error opening DB");
        };

        request.onsuccess = (e) => {
            dbLocal = e.target.result;
            resolve(dbLocal);
        };

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('category', 'category', { unique: false });
            }
            if (!db.objectStoreNames.contains('prendas')) {
                db.createObjectStore('prendas', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// ==========================================================================
// UNIFIED DATA STORAGE LAYER (CLOUD OR LOCAL)
// ==========================================================================
async function saveItemToStorage(item) {
    if (isCloudConnected && dbFirestore) {
        // En la nube: Convertir Blob a Base64 para almacenar en Firestore
        const base64Data = (item.image instanceof Blob || item.image instanceof File)
            ? await blobToBase64(item.image)
            : item.image;

        const docRef = await dbFirestore.collection('prendas').add({
            image: base64Data,
            category: item.category,
            subtipo: item.subtipo || "",
            descripcion: item.descripcion || "",
            date: item.date || new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { id: docRef.id, ...item, image: base64Data };
    } else {
        // En local: Guardar en IndexedDB
        return saveItemToLocalDB(item);
    }
}

async function getItemsFromStorage(category = 'all') {
    if (isCloudConnected && dbFirestore) {
        try {
            const snapshot = await dbFirestore.collection('prendas').get();
            let items = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                items.push({
                    id: doc.id,
                    image: data.image,
                    category: data.category || 'Desconocido',
                    subtipo: data.subtipo || "",
                    descripcion: data.descripcion || "",
                    date: data.date || new Date().toISOString()
                });
            });

            if (category !== 'all') {
                items = items.filter(item => item.category === category);
            }
            return items;
        } catch (error) {
            console.warn("Fallo al leer de Firebase, reintentando con local:", error);
            return getItemsFromLocalDB(category);
        }
    } else {
        return getItemsFromLocalDB(category);
    }
}

async function deleteItemFromStorage(id) {
    if (isCloudConnected && dbFirestore) {
        await dbFirestore.collection('prendas').doc(String(id)).delete();
    } else {
        await deleteItemFromLocalDB(Number(id));
    }
}

// Helpers para IndexedDB
function saveItemToLocalDB(item) {
    return new Promise((resolve, reject) => {
        if (!dbLocal) return reject("No DB");
        const transaction = dbLocal.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject();
    });
}

function getItemsFromLocalDB(category = 'all') {
    return new Promise((resolve) => {
        if (!dbLocal) return resolve([]);
        const storeName = dbLocal.objectStoreNames.contains(STORE_NAME) ? STORE_NAME : 'prendas';
        const transaction = dbLocal.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            let items = request.result || [];
            // Normalizar nombres si venían de 'prendas' antigua
            items = items.map(item => ({
                id: item.id,
                image: item.image || item.imagen,
                category: item.category || item.categoria || 'Top Base',
                subtipo: item.subtipo || "",
                descripcion: item.descripcion || item.description || "",
                date: item.date || item.fecha || new Date().toISOString()
            }));

            if (category !== 'all') {
                items = items.filter(item => item.category === category);
            }
            resolve(items);
        };
        request.onerror = () => resolve([]);
    });
}

function deleteItemFromLocalDB(id) {
    return new Promise((resolve, reject) => {
        if (!dbLocal) return resolve();
        const storeName = dbLocal.objectStoreNames.contains(STORE_NAME) ? STORE_NAME : 'prendas';
        const transaction = dbLocal.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ==========================================================================
// SETTINGS MODAL & CLOUD CONFIGURATION
// ==========================================================================
function setupSettingsModal() {
    // Modo automático: no requiere modal manual


    // Cargar claves de API existentes en los inputs
    if (removeBgKeyInput) {
        removeBgKeyInput.value = localStorage.getItem('ropero_remove_bg_key') || (typeof CONFIG !== 'undefined' ? CONFIG.REMOVE_BG_API_KEY || '' : '');
    }
    if (geminiKeyInput) {
        geminiKeyInput.value = localStorage.getItem('ropero_gemini_key') || (typeof CONFIG !== 'undefined' ? CONFIG.GEMINI_API_KEY || '' : '');
    }

    // Botón Guardar Claves IA
    if (btnSaveKeys) {
        btnSaveKeys.addEventListener('click', () => {
            const rKey = removeBgKeyInput.value.trim();
            const gKey = geminiKeyInput.value.trim();
            if (rKey) localStorage.setItem('ropero_remove_bg_key', rKey);
            if (gKey) localStorage.setItem('ropero_gemini_key', gKey);

            showStatusNote(keysStatusMsg, "success", "✅ Claves de IA guardadas en tu navegador.");
        });
    }

    // Botón Conectar Firebase
    if (btnConnectFirebase) {
        btnConnectFirebase.addEventListener('click', async () => {
            const raw = firebaseConfigInput.value.trim();
            if (!raw) {
                showStatusNote(firebaseStatusMsg, "error", "Por favor pega la configuración de Firebase.");
                return;
            }

            const parsed = parseFirebaseConfig(raw);
            if (!parsed || !parsed.apiKey || !parsed.projectId) {
                showStatusNote(firebaseStatusMsg, "error", "No se detectaron 'apiKey' o 'projectId' válidos. Revisa el código pegado.");
                return;
            }

            try {
                showStatusNote(firebaseStatusMsg, "info", "Conectando con Firebase...");
                localStorage.setItem('ropero_firebase_config', JSON.stringify(parsed));
                
                await initCloudOrFallback();
                if (isCloudConnected) {
                    showStatusNote(firebaseStatusMsg, "success", "✅ ¡Conectado con éxito a Firebase!");
                    loadWardrobe('all');
                } else {
                    showStatusNote(firebaseStatusMsg, "error", "No se pudo conectar a Firestore. Verifica tus reglas de seguridad.");
                }
            } catch (err) {
                console.error(err);
                showStatusNote(firebaseStatusMsg, "error", "Error: " + err.message);
            }
        });
    }

    // Botón Desconectar Firebase
    if (btnDisconnectFirebase) {
        btnDisconnectFirebase.addEventListener('click', () => {
            localStorage.removeItem('ropero_firebase_config');
            isCloudConnected = false;
            dbFirestore = null;
            updateCloudUIState(false);
            showStatusNote(firebaseStatusMsg, "info", "Modo nube desconectado. Operando en modo local.");
            loadWardrobe('all');
        });
    }

    // Botón Migrar Local a Firebase
    if (btnMigrateLocal) {
        btnMigrateLocal.addEventListener('click', async () => {
            if (!isCloudConnected) {
                showStatusNote(migrationStatusMsg, "error", "Primero debes conectar Firebase.");
                return;
            }

            btnMigrateLocal.disabled = true;
            showStatusNote(migrationStatusMsg, "info", "⏳ Leyendo prendas locales y subiendo a Firebase...");

            try {
                const localItems = await getItemsFromLocalDB('all');
                if (localItems.length === 0) {
                    showStatusNote(migrationStatusMsg, "info", "No hay prendas en el almacenamiento local para migrar.");
                    btnMigrateLocal.disabled = false;
                    return;
                }

                let subidas = 0;
                for (const item of localItems) {
                    const base64Data = (item.image instanceof Blob || item.image instanceof File)
                        ? await blobToBase64(item.image)
                        : item.image;

                    await dbFirestore.collection('prendas').add({
                        image: base64Data,
                        category: item.category,
                        date: item.date,
                        migratedFromLocal: true
                    });
                    subidas++;
                }

                showStatusNote(migrationStatusMsg, "success", `✅ ¡${subidas} ${subidas === 1 ? 'prenda subida' : 'prendas subidas'} exitosamente a Firebase!`);
                loadWardrobe('all');
            } catch (error) {
                console.error("Error al migrar prendas:", error);
                showStatusNote(migrationStatusMsg, "error", "Error al migrar: " + error.message);
            } finally {
                btnMigrateLocal.disabled = false;
            }
        });
    }
}

function openSettingsModal() {
    if (settingsModal) settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    if (settingsModal) settingsModal.classList.add('hidden');
}

function showStatusNote(element, type, message) {
    if (!element) return;
    element.className = `status-note ${type}`;
    element.textContent = message;
    element.classList.remove('hidden');
}

// Parser inteligente para extraer el objeto Firebase de código pegado
function parseFirebaseConfig(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        // Si pegaron 'const firebaseConfig = { ... }'
        try {
            const match = str.match(/\{[\s\S]*\}/);
            if (match) {
                // Reemplazar claves no entrecomilladas
                const jsonLike = match[0]
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
                    .replace(/'/g, '"');
                return JSON.parse(jsonLike);
            }
        } catch (e2) {
            // Extracción con expresiones regulares como fallback
            const apiKey = (str.match(/apiKey\s*:\s*["']([^"']+)["']/) || [])[1];
            const authDomain = (str.match(/authDomain\s*:\s*["']([^"']+)["']/) || [])[1];
            const projectId = (str.match(/projectId\s*:\s*["']([^"']+)["']/) || [])[1];
            const storageBucket = (str.match(/storageBucket\s*:\s*["']([^"']+)["']/) || [])[1];
            const messagingSenderId = (str.match(/messagingSenderId\s*:\s*["']([^"']+)["']/) || [])[1];
            const appId = (str.match(/appId\s*:\s*["']([^"']+)["']/) || [])[1];

            if (apiKey && projectId) {
                return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
            }
        }
    }
    return null;
}

// ==========================================================================
// NAVIGATION LOGIC
// ==========================================================================
function setupNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchToView(targetId);
        });
    });
}

function switchToView(targetId) {
    navBtns.forEach(b => {
        if (b.getAttribute('data-target') === targetId) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });

    views.forEach(view => {
        if (view.id === targetId) {
            view.classList.remove('hidden');
            view.classList.add('active');
        } else {
            view.classList.add('hidden');
            view.classList.remove('active');
        }
    });

    if (targetId === 'view-wardrobe') {
        const activeFilter = document.querySelector('.filter-btn.active');
        const cat = activeFilter ? activeFilter.getAttribute('data-category') : 'all';
        loadWardrobe(cat);
    }

    if (targetId === 'view-favorites') {
        loadFavorites();
    }
}

// ==========================================================================
// UPLOAD & PROCESSING LOGIC (Soporte Multi-dispositivo, HEIC, Normalización)
// ==========================================================================

function updateLoadingText(title, subtext) {
    if (!loadingContainer) return;
    const h4 = loadingContainer.querySelector('h4');
    const p = loadingContainer.querySelector('.loading-subtext');
    if (h4 && title) h4.textContent = title;
    if (p && subtext) p.textContent = subtext;
}

// Detectar si un archivo o blob es formato HEIC/HEIF
async function isHeicFormat(fileOrBlob) {
    if (!fileOrBlob) return false;
    const name = (fileOrBlob.name || '').toLowerCase();
    const type = (fileOrBlob.type || '').toLowerCase();
    if (type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) {
        return true;
    }
    try {
        if (fileOrBlob.size >= 16) {
            const slice = fileOrBlob.slice(0, 16);
            const buffer = await slice.arrayBuffer();
            const view = new DataView(buffer);
            const ftyp = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
            if (ftyp === 'ftyp') {
                const brand = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)).toLowerCase();
                if (['heic', 'heix', 'heim', 'heis', 'hevc', 'mif1', 'msf1'].includes(brand)) {
                    return true;
                }
            }
        }
    } catch (e) {
        // Ignorar error al leer bytes
    }
    return false;
}

// Convertir HEIC y optimizar/redimensionar cualquier imagen a JPEG de alta calidad
async function prepararImagenParaProcesar(fileOrBlob) {
    let currentBlob = fileOrBlob;

    // 1. Detectar si es formato HEIC/HEIF (fotos de iPhone desde Galería o Files)
    const isHeic = await isHeicFormat(currentBlob);
    if (isHeic) {
        if (typeof heic2any !== 'undefined') {
            try {
                updateLoadingText("Adaptando formato iPhone...", "Convirtiendo HEIC a JPEG compatible...");
                const heicBlob = new Blob([currentBlob], { type: 'image/heic' });
                const converted = await heic2any({
                    blob: heicBlob,
                    toType: 'image/jpeg',
                    quality: 0.90
                });
                currentBlob = Array.isArray(converted) ? converted[0] : converted;
                console.log("✅ Imagen HEIC convertida exitosamente a JPEG");
            } catch (heicError) {
                console.warn("Fallo al convertir con heic2any, continuando con original:", heicError);
            }
        } else {
            console.warn("Librería heic2any no disponible.");
        }
    }

    // 2. Normalizar a JPEG estándar (máximo 1280px, compresión de alta calidad)
    // Esto garantiza que fotos de 20-40MB de iPhones/cámaras no rompan Remove.bg ni Firestore ni Gemini
    updateLoadingText("Optimizando imagen...", "Ajustando resolución y contraste...");
    const cleanJpeg = await normalizarAJpeg(currentBlob, 1280, 0.88);
    return cleanJpeg;
}

function normalizarAJpeg(blobOrFile, maxDimension = 1280, quality = 0.88) {
    return new Promise((resolve) => {
        if (!(blobOrFile instanceof Blob) && !(blobOrFile instanceof File)) {
            return resolve(blobOrFile);
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(blobOrFile);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            try {
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;
                if (!width || !height) {
                    return resolve(blobOrFile);
                }

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // Fondo blanco base
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((resultBlob) => {
                    if (resultBlob && resultBlob.size > 0) {
                        const finalFile = new File([resultBlob], 'prenda.jpg', { type: 'image/jpeg' });
                        resolve(finalFile);
                    } else {
                        resolve(blobOrFile);
                    }
                }, 'image/jpeg', quality);
            } catch (err) {
                console.warn("Error al procesar canvas:", err);
                resolve(blobOrFile);
            }
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            console.warn("No se pudo decodificar con Image(), usando blob original:", err);
            resolve(blobOrFile);
        };

        img.src = objectUrl;
    });
}

function setupUploadHandlers() {
    // Botones de acción directa
    if (btnTriggerCamera && cameraInput) {
        btnTriggerCamera.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraInput.click();
        });
    }

    if (btnTriggerGallery && imageInput) {
        btnTriggerGallery.addEventListener('click', (e) => {
            e.stopPropagation();
            imageInput.click();
        });
    }

    // Clic en la tarjeta de carga general (abre selector sin tocar los botones hijos)
    uploadPlaceholder.addEventListener('click', (e) => {
        if (e.target.closest('#btn-trigger-camera') || e.target.closest('#btn-trigger-gallery')) {
            return;
        }
        imageInput.click();
    });

    // Helper para extraer archivo de drop o dataTransfer
    async function extractFileFromEvent(e) {
        const dt = e.dataTransfer;
        if (!dt) return null;

        // 1. Archivos directos
        if (dt.files && dt.files.length > 0) {
            return dt.files[0];
        }

        // 2. Elementos en DataTransferItemList
        if (dt.items && dt.items.length > 0) {
            for (let i = 0; i < dt.items.length; i++) {
                const item = dt.items[i];
                if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) return f;
                }
            }
        }

        // 3. Si se arrastró un enlace o elemento de imagen web
        const url = dt.getData('URL') || dt.getData('text/uri-list');
        if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'))) {
            try {
                const res = await fetch(url);
                return await res.blob();
            } catch (err) {
                console.warn("No se pudo obtener imagen desde URL arrastrada:", err);
            }
        }

        return null;
    }

    // Drag & Drop sobre placeholder y contenedor de subida
    const dropZones = [uploadPlaceholder, document.querySelector('.upload-container')].filter(Boolean);

    dropZones.forEach(zone => {
        ['dragenter', 'dragover'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadPlaceholder.classList.add('dragover');
            });
        });

        ['dragleave'].forEach(eventName => {
            zone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                uploadPlaceholder.classList.remove('dragover');
            });
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadPlaceholder.classList.remove('dragover');

            const file = await extractFileFromEvent(e);
            if (file) {
                handleImageUpload(file);
            }
        });
    });

    // Prevenir que el navegador abra la imagen si se suelta accidentalmente en la ventana
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        const uploadView = document.getElementById('view-upload');
        if (uploadView && uploadView.classList.contains('active')) {
            const file = await extractFileFromEvent(e);
            if (file) {
                handleImageUpload(file);
            }
        }
    });

    // Listeners para ambos inputs
    imageInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });

    if (cameraInput) {
        cameraInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                handleImageUpload(e.target.files[0]);
            }
        });
    }

    btnCancel.addEventListener('click', resetUploadView);

    const btnSaveEl = document.getElementById('btnSave') || document.querySelector('.btn-save') || btnSave;
    if (btnSaveEl) {
        btnSaveEl.addEventListener('click', async () => {
            if (!currentProcessedImage) {
                alert("No hay imagen procesada para guardar.");
                return;
            }

            try {
                btnSaveEl.innerHTML = `<span>Guardando...</span>`;
                btnSaveEl.disabled = true;

                await saveItemToStorage({
                    image: currentProcessedImage,
                    category: currentCategory || "Top Base",
                    subtipo: currentSubtipo || "",
                    descripcion: currentDescripcion || "",
                    date: new Date().toISOString()
                });

                resetUploadView();
                switchToView('view-wardrobe');
            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al guardar la prenda en " + (isCloudConnected ? "Firebase" : "el almacenamiento local") + ".");
            } finally {
                btnSaveEl.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Guardar Prenda</span>
                `;
                btnSaveEl.disabled = false;
            }
        });
    }
}

async function handleImageUpload(file) {
    if (!file) return;

    uploadPlaceholder.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    imagePreview.classList.add('hidden');
    imagePreview.removeAttribute('src');

    if (loadingContainer) {
        loadingContainer.classList.remove('hidden');
        updateLoadingText("Procesando Prenda con IA", "Preparando y optimizando imagen...");
    }

    let imagenPreparada = file;
    let imagenFinalParaGuardar = null;
    let bgRemovido = false;
    let categoriaDetectada = "Top Base";
    let descripcionDetectada = "";

    try {
        // 1. Preparación y normalización (Soporta HEIC de iPhone, WebP, JPG, fotos de alta resolución)
        try {
            imagenPreparada = await prepararImagenParaProcesar(file);
        } catch (prepErr) {
            console.warn("Aviso en preparación:", prepErr);
            imagenPreparada = file;
        }

        // Mostrar vista previa inmediata de la imagen optimizada
        const tempPreviewUrl = URL.createObjectURL(imagenPreparada);
        imagePreview.src = tempPreviewUrl;
        imagePreview.onload = () => {
            imagePreview.classList.remove('hidden');
        };

        // 2. Remoción de Fondo con Remove.bg
        updateLoadingText("Removiendo fondo con IA...", "Creando recorte con fondo blanco de estudio...");
        try {
            const blobBlanco = await procesarPrenda(imagenPreparada);
            if (blobBlanco && blobBlanco.size > 0) {
                imagenFinalParaGuardar = blobBlanco;
                bgRemovido = true;
                const blancoUrl = URL.createObjectURL(blobBlanco);
                imagePreview.src = blancoUrl;
                console.log("✅ Fondo removido exitosamente con Remove.bg");
            } else {
                throw new Error("Blob de Remove.bg vacío");
            }
        } catch (removeBgError) {
            console.warn("Remove.bg no pudo remover el fondo:", removeBgError.message);
            imagenFinalParaGuardar = imagenPreparada;
            bgRemovido = false;
        }

        currentProcessedImage = imagenFinalParaGuardar;

        // Desbloquear la interfaz inmediatamente: mostrar foto, botones y selector
        if (loadingContainer) loadingContainer.classList.add('hidden');
        if (categorySelectorWrapper) categorySelectorWrapper.classList.remove('hidden');
        if (uploadActions) {
            uploadActions.classList.remove('hidden');
            uploadActions.style.display = 'grid';
        }

        currentCategory = "Top Base";
        highlightCategoryPill("Top Base");

        const labelIA = document.getElementById('label-ia')
            || document.querySelector('.ia-detected-label');
        if (labelIA) {
            labelIA.innerHTML = `<span>✨ Detectando prenda con IA...</span>`;
            labelIA.classList.remove('hidden');
        }

        // 3. Clasificación con Gemini Vision en segundo plano ultrarrápido (sin congelar la pantalla)
        try {
            const imagenParaGemini = imagenFinalParaGuardar || imagenPreparada;
            const result = await clasificarConGemini(imagenParaGemini);
            categoriaDetectada = normalizarCategoria(result.categoria);
            descripcionDetectada = result.descripcion || categoriaDetectada;
            currentCategory = categoriaDetectada;
            currentSubtipo = result.subtipo || "";
            currentDescripcion = descripcionDetectada;

            if (labelIA) {
                const badgeFondo = bgRemovido ? "" : " <span style='font-size:0.75rem; opacity:0.8;'>(Fondo original)</span>";
                const catEmoji = categoriaDetectada === 'Deportiva' ? '🏃' :
                                 categoriaDetectada === 'Calzado' ? '👟' :
                                 categoriaDetectada === 'Bottoms' ? '👖' :
                                 categoriaDetectada === 'Capa Extra' ? '🧥' : '👕';
                labelIA.innerHTML = `<span>✨ IA detectó:</span> <strong>${catEmoji} ${descripcionDetectada}</strong> <span style="font-size:0.8rem; opacity:0.85;">(${categoriaDetectada})</span>${badgeFondo}`;
            }
            highlightCategoryPill(categoriaDetectada);
        } catch (geminiError) {
            console.warn("Aviso al clasificar con Gemini:", geminiError);
            if (labelIA) {
                const textoFondo = bgRemovido ? "Fondo removido." : "Fondo original.";
                labelIA.innerHTML = `<span>ℹ️ ${textoFondo} Selecciona la categoría:</span>`;
            }
        }

    } catch (generalError) {
        console.error("Fallo general en procesamiento:", generalError);
        currentProcessedImage = file;
        const imageUrl = URL.createObjectURL(file);
        imagePreview.src = imageUrl;
        imagePreview.onload = () => {
            imagePreview.classList.remove('hidden');
        };

        const labelIA = document.getElementById('label-ia')
            || document.querySelector('.ia-detected-label');
        if (labelIA) {
            labelIA.innerHTML = `<span>⚠️ Selecciona la categoría:</span>`;
            labelIA.classList.remove('hidden');
        }
        currentCategory = "Top Base";
        highlightCategoryPill(currentCategory);

        if (categorySelectorWrapper) {
            categorySelectorWrapper.classList.remove('hidden');
        }
    } finally {
        if (loadingContainer) loadingContainer.classList.add('hidden');
        if (uploadActions) {
            uploadActions.classList.remove('hidden');
            uploadActions.style.display = 'grid';
        }
    }
}

// Pastillas de selección de categoría
function setupCategoryPills() {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentCategory = pill.getAttribute('data-category');
        });
    });
}

function highlightCategoryPill(category) {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(pill => {
        if (pill.getAttribute('data-category') === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

function resetUploadView() {
    if (imageInput) imageInput.value = '';
    if (cameraInput) cameraInput.value = '';
    currentProcessedImage = null;
    currentCategory = null;
    currentSubtipo = "";
    currentDescripcion = "";
    uploadPlaceholder.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    uploadActions.classList.add('hidden');
    if (categorySelectorWrapper) categorySelectorWrapper.classList.add('hidden');

    const labelIA = document.getElementById('label-ia')
        || document.querySelector('.ia-detected-label');
    if (labelIA) {
        labelIA.classList.add('hidden');
        labelIA.textContent = '';
    }
}

// ==========================================================================
// WARDROBE VIEW
// ==========================================================================
function setupWardrobeFilters() {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.getAttribute('data-category');
            loadWardrobe(category);
        });
    });
}

async function loadWardrobe(category) {
    const allItems = await getItemsFromStorage('all');
    const items = category === 'all' 
        ? allItems 
        : allItems.filter(item => item.category === category);

    if (wardrobeCounter) {
        const cloudLabel = isCloudConnected ? " (Nube ☁️)" : " (Local)";
        wardrobeCounter.textContent = `${allItems.length} ${allItems.length === 1 ? 'prenda' : 'prendas'}${cloudLabel}`;
    }

    wardrobeGrid.innerHTML = '';

    if (items.length === 0) {
        const subMsg = isCloudConnected 
            ? "Tus prendas se sincronizan automáticamente con Firebase."
            : "Conecta Firebase o sube prendas en este navegador para verlas aquí.";

        wardrobeGrid.innerHTML = `
            <div class="wardrobe-empty-state">
                <div class="empty-state-icon">✨</div>
                <h3>Sin prendas en esta sección</h3>
                <p>${subMsg}</p>
                <button type="button" class="btn btn-primary" onclick="switchToView('view-upload')" style="margin-top: 6px;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span>Subir Prenda</span>
                </button>
            </div>
        `;
        return;
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'wardrobe-item';

        const imageUrl = (item.image instanceof Blob || item.image instanceof File)
            ? URL.createObjectURL(item.image)
            : item.image;

        div.innerHTML = `
            <div class="wardrobe-card-media">
                <img src="${imageUrl}" alt="${item.category}" loading="lazy">
                <button class="delete-btn" data-id="${item.id}" title="Eliminar prenda" aria-label="Eliminar prenda">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="wardrobe-card-info">
                <span class="wardrobe-badge">${item.category}</span>
            </div>
        `;
        wardrobeGrid.appendChild(div);
    });

    // Eventos para eliminar prenda
    wardrobeGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btnEl = e.currentTarget;
            const id = btnEl.getAttribute('data-id');
            if (confirm("¿Deseas eliminar esta prenda de tu armario?")) {
                await deleteItemFromStorage(id);
                const activeCategory = document.querySelector('.filter-btn.active').getAttribute('data-category');
                loadWardrobe(activeCategory);
            }
        });
    });
}

// ==========================================================================
// OUTFIT GENERATOR & FAVORITES LOGIC
// ==========================================================================
let currentOutfitMode = 'casual'; // 'casual' | 'sport'
let currentGeneratedOutfitItems = [];

function setupOutfitGenerator() {
    if (btnGenerate) {
        btnGenerate.addEventListener('click', () => generateOutfit());
    }
    setupOutfitModeTabs();
    setupFavoritesHandler();
}

function setupOutfitModeTabs() {
    const tabs = document.querySelectorAll('.mode-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.getAttribute('data-mode') || 'casual';
            currentOutfitMode = mode;
            const btnText = document.getElementById('btn-generate-text');
            if (btnText) {
                btnText.textContent = mode === 'sport' ? 'Generar Outfit Deportivo' : 'Generar Outfit Diario';
            }
            generateOutfit(mode);
        });
    });
}

function isSportBottom(item) {
    if (item && item.subtipo === 'bottom') return true;
    const text = `${item?.descripcion || ''} ${item?.description || ''} ${item?.name || ''}`.toLowerCase();
    return /short|bermuda|pants|pantalon|jogger|legging|malla|licra|pescador/i.test(text);
}

function isSportLayer(item) {
    if (item && item.subtipo === 'layer') return true;
    const text = `${item?.descripcion || ''} ${item?.description || ''} ${item?.name || ''}`.toLowerCase();
    return /sudadera|hoodie|chamarra|rompeviento|chaleco|sueter|jacket/i.test(text);
}

function isSportTop(item) {
    if (item && item.subtipo === 'top') return true;
    if (isSportBottom(item) || isSportLayer(item)) return false;
    const text = `${item?.descripcion || ''} ${item?.description || ''} ${item?.name || ''}`.toLowerCase();
    return /playera|jersey|top|bra|tank|musculosa|remera|polo|tirantes|camiseta/i.test(text);
}

async function generateOutfit(mode = currentOutfitMode) {
    currentOutfitMode = mode;

    const slots = {
        'Capa Extra': document.getElementById('slot-layer'),
        'Top Base': document.getElementById('slot-top'),
        'Bottoms': document.getElementById('slot-bottom'),
        'Calzado': document.getElementById('slot-shoes')
    };

    const btnGen = document.getElementById('btn-generate') || btnGenerate;
    if (btnGen) btnGen.classList.add('loading');

    const btnFav = document.getElementById('btn-fav-outfit');
    if (btnFav) {
        btnFav.disabled = true;
        btnFav.classList.remove('liked');
        const favLabel = document.getElementById('fav-btn-label');
        if (favLabel) favLabel.textContent = 'Guardar en Favoritos';
    }

    Object.values(slots).forEach(slot => {
        if (slot) slot.style.opacity = '0.4';
    });

    try {
        const allItems = await getItemsFromStorage('all');
        const layers = allItems.filter(i => i.category === 'Capa Extra');
        const tops = allItems.filter(i => i.category === 'Top Base');
        const bottoms = allItems.filter(i => i.category === 'Bottoms');
        const shoes = allItems.filter(i => i.category === 'Calzado');
        const sports = allItems.filter(i => i.category === 'Deportiva');

        let selectedItems = [];

        setTimeout(() => {
            if (currentOutfitMode === 'sport') {
                // Modo Deportivo:
                // REGLA ESTRICTA: NUNCA usar ropa casual o formal (camisas de vestir, sacos, pantalones formales).
                // Únicamente se utilizan prendas de la categoría 'Deportiva' y calzado deportivo/tenis.

                // Clasificar prendas deportivas disponibles
                const sportTops = sports.filter(i => isSportTop(i));
                const sportBottoms = sports.filter(i => isSportBottom(i));
                const sportLayers = sports.filter(i => isSportLayer(i));

                // Prendas deportivas sin slot específico
                let unassignedSports = sports.filter(i => 
                    !sportTops.some(t => t.id === i.id) &&
                    !sportBottoms.some(b => b.id === i.id) &&
                    !sportLayers.some(l => l.id === i.id)
                );

                // 1. Top deportivo:
                let topItem = null;
                if (sportTops.length > 0) {
                    topItem = sportTops[Math.floor(Math.random() * sportTops.length)];
                } else if (unassignedSports.length > 0) {
                    topItem = unassignedSports.shift();
                }

                // 2. Bottom deportivo:
                let bottomItem = null;
                if (sportBottoms.length > 0) {
                    bottomItem = sportBottoms[Math.floor(Math.random() * sportBottoms.length)];
                } else if (unassignedSports.length > 0) {
                    bottomItem = unassignedSports.shift();
                }

                // 3. Capa deportiva:
                let layerItem = null;
                if (sportLayers.length > 0) {
                    layerItem = sportLayers[Math.floor(Math.random() * sportLayers.length)];
                } else if (unassignedSports.length > 0) {
                    layerItem = unassignedSports.shift();
                }

                // 4. Calzado deportivo / tenis:
                let shoesItem = null;
                if (shoes.length > 0) {
                    const sneakers = shoes.filter(s => {
                        const t = `${s.descripcion || ''} ${s.description || ''} ${s.name || ''}`.toLowerCase();
                        return /tenis|sneaker|running|deportiv|gym|correr/i.test(t);
                    });
                    if (sneakers.length > 0) {
                        shoesItem = sneakers[Math.floor(Math.random() * sneakers.length)];
                    } else {
                        shoesItem = shoes[Math.floor(Math.random() * shoes.length)];
                    }
                }

                renderSlotItem(slots['Capa Extra'], layerItem, 'Sin Capa Deportiva', '🧥');
                renderSlotItem(slots['Top Base'], topItem, 'Sin Top Deportivo', '🏃');
                renderSlotItem(slots['Bottoms'], bottomItem, 'Sin Bottom Deportivo', '🩳');
                renderSlotItem(slots['Calzado'], shoesItem, 'Sin Tenis Deportivos', '👟');

                selectedItems = [layerItem, topItem, bottomItem, shoesItem].filter(Boolean);

                const lookbookTitle = document.querySelector('.lookbook-title');
                if (lookbookTitle) {
                    lookbookTitle.innerHTML = `<span class="lookbook-dot" style="background:#10B981; box-shadow:0 0 10px #10B981;"></span><span>Outfit Sugerido • Deportivo 🏃</span>`;
                }

                // Si no hay prendas deportivas registradas en el armario, mostrar aviso informativo
                const existingNotice = document.getElementById('sports-empty-notice');
                if (sports.length === 0) {
                    if (!existingNotice) {
                        const noticeDiv = document.createElement('div');
                        noticeDiv.id = 'sports-empty-notice';
                        noticeDiv.className = 'empty-sports-banner';
                        noticeDiv.innerHTML = `<span>ℹ️ Aún no tienes prendas en la categoría <strong>Deportiva</strong>. Sube tus playeras de gym, shorts o pants deportivos para armar tu look.</span>`;
                        const lookbookCard = document.querySelector('.lookbook-card');
                        if (lookbookCard) lookbookCard.appendChild(noticeDiv);
                    }
                } else if (existingNotice) {
                    existingNotice.remove();
                }

            } else {
                // Modo Casual / Diario:
                const existingNotice = document.getElementById('sports-empty-notice');
                if (existingNotice) existingNotice.remove();
                const layerItem = layers.length > 0 ? layers[Math.floor(Math.random() * layers.length)] : null;
                const topItem = tops.length > 0 ? tops[Math.floor(Math.random() * tops.length)] : null;
                const bottomItem = bottoms.length > 0 ? bottoms[Math.floor(Math.random() * bottoms.length)] : null;
                const shoesItem = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : null;

                renderSlotItem(slots['Capa Extra'], layerItem, 'Sin Capa Extra', '🧥');
                renderSlotItem(slots['Top Base'], topItem, 'Sin Top Base', '👕');
                renderSlotItem(slots['Bottoms'], bottomItem, 'Sin Bottom', '👖');
                renderSlotItem(slots['Calzado'], shoesItem, 'Sin Calzado', '👟');

                selectedItems = [layerItem, topItem, bottomItem, shoesItem].filter(Boolean);

                const lookbookTitle = document.querySelector('.lookbook-title');
                if (lookbookTitle) {
                    lookbookTitle.innerHTML = `<span class="lookbook-dot"></span><span>Outfit Sugerido • Diario ✨</span>`;
                }
            }

            currentGeneratedOutfitItems = selectedItems;

            Object.values(slots).forEach(slot => {
                if (slot) slot.style.opacity = '1';
            });

            if (btnGen) btnGen.classList.remove('loading');

            // Habilitar botón de favoritos si hay prendas generadas
            if (btnFav && selectedItems.length > 0) {
                btnFav.disabled = false;
            }

        }, 350);

    } catch (e) {
        console.error("Error generando outfit", e);
        if (btnGen) btnGen.classList.remove('loading');
    }
}

function renderSlotItem(slotElement, item, emptyText, icon) {
    if (!slotElement) return;
    if (item) {
        const imageUrl = (item.image instanceof Blob || item.image instanceof File) 
            ? URL.createObjectURL(item.image) 
            : item.image;
        slotElement.classList.add('has-item');
        slotElement.innerHTML = `
            <div class="outfit-slot-filled">
                <img src="${imageUrl}" alt="Prenda de outfit" class="slot-image">
            </div>
        `;
    } else {
        slotElement.classList.remove('has-item');
        slotElement.innerHTML = `
            <div class="slot-empty-content">
                <span class="slot-empty-icon">${icon || '✕'}</span>
                <p class="slot-empty">${emptyText}</p>
            </div>
        `;
    }
}

// ==========================================================================
// FAVORITES (FAVS) STORAGE & RENDERING
// ==========================================================================
function setupFavoritesHandler() {
    const btnFav = document.getElementById('btn-fav-outfit');
    if (!btnFav) return;

    btnFav.addEventListener('click', async () => {
        if (!currentGeneratedOutfitItems || currentGeneratedOutfitItems.length === 0) {
            alert("Genera un outfit primero antes de guardarlo en favoritos.");
            return;
        }

        btnFav.disabled = true;
        const favLabel = document.getElementById('fav-btn-label');
        if (favLabel) favLabel.textContent = 'Guardando...';

        try {
            // Asegurar que cada imagen esté en formato Base64 para persistencia confiable
            const itemsProcessed = await Promise.all(currentGeneratedOutfitItems.map(async (it) => {
                const imgData = (it.image instanceof Blob || it.image instanceof File)
                    ? await blobToBase64(it.image)
                    : it.image;
                return {
                    id: it.id || ('it_' + Math.random().toString(36).substr(2, 9)),
                    category: it.category || 'Prenda',
                    image: imgData
                };
            }));

            const outfitObj = {
                id: 'fav_' + Date.now(),
                title: currentOutfitMode === 'sport' ? 'Outfit Deportivo' : 'Outfit Diario',
                mode: currentOutfitMode,
                date: new Date().toISOString(),
                items: itemsProcessed
            };

            await saveFavoriteOutfitToStorage(outfitObj);

            btnFav.classList.add('liked');
            if (favLabel) favLabel.textContent = '❤️ Guardado en Favs';

            // Actualizar contador si existe
            const favCounter = document.getElementById('favorites-counter');
            if (favCounter) {
                const favs = getLocalFavoriteOutfits();
                favCounter.textContent = `${favs.length} ${favs.length === 1 ? 'favorito' : 'favoritos'}`;
            }

        } catch (e) {
            console.error("Error al guardar outfit en favoritos:", e);
            alert("No se pudo guardar en favoritos. Inténtalo de nuevo.");
            btnFav.disabled = false;
            if (favLabel) favLabel.textContent = 'Guardar en Favoritos';
        }
    });
}

async function saveFavoriteOutfitToStorage(outfit) {
    if (isCloudConnected && dbFirestore) {
        try {
            const docRef = await dbFirestore.collection('outfits_favoritos').add({
                title: outfit.title,
                mode: outfit.mode,
                items: outfit.items,
                date: outfit.date || new Date().toISOString(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            outfit.id = docRef.id;
        } catch (e) {
            console.warn("Fallo al guardar en Firebase, usando almacenamiento local:", e);
        }
    }
    const favs = getLocalFavoriteOutfits();
    favs.unshift(outfit);
    localStorage.setItem('ropero_favoritos_v1', JSON.stringify(favs));
    return outfit;
}

function getLocalFavoriteOutfits() {
    try {
        const raw = localStorage.getItem('ropero_favoritos_v1');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

async function getFavoriteOutfitsFromStorage() {
    if (isCloudConnected && dbFirestore) {
        try {
            const snapshot = await dbFirestore.collection('outfits_favoritos').get();
            let cloudFavs = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                cloudFavs.push({
                    id: doc.id,
                    title: data.title || 'Outfit Favorito',
                    mode: data.mode || 'casual',
                    date: data.date || new Date().toISOString(),
                    items: data.items || []
                });
            });
            if (cloudFavs.length > 0) {
                localStorage.setItem('ropero_favoritos_v1', JSON.stringify(cloudFavs));
                return cloudFavs;
            }
        } catch (e) {
            console.warn("Fallo al leer favoritos de Firebase, usando local:", e);
        }
    }
    return getLocalFavoriteOutfits();
}

async function deleteFavoriteOutfitFromStorage(id) {
    if (isCloudConnected && dbFirestore) {
        try {
            await dbFirestore.collection('outfits_favoritos').doc(String(id)).delete();
        } catch (e) {
            console.warn("Error al borrar favorito de Firebase:", e);
        }
    }
    const favs = getLocalFavoriteOutfits().filter(f => String(f.id) !== String(id));
    localStorage.setItem('ropero_favoritos_v1', JSON.stringify(favs));
}

async function loadFavorites() {
    const favoritesGrid = document.getElementById('favorites-grid');
    const favoritesCounter = document.getElementById('favorites-counter');
    if (!favoritesGrid) return;

    favoritesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
            <div class="spinner-mini" style="width: 24px; height: 24px; margin-bottom: 12px;"></div>
            <p>Cargando tus outfits favoritos...</p>
        </div>
    `;

    const favs = await getFavoriteOutfitsFromStorage();

    if (favoritesCounter) {
        favoritesCounter.textContent = `${favs.length} ${favs.length === 1 ? 'favorito' : 'favoritos'}`;
    }

    favoritesGrid.innerHTML = '';

    if (!favs || favs.length === 0) {
        favoritesGrid.innerHTML = `
            <div class="wardrobe-empty-state">
                <div class="empty-state-icon" style="color: #EF4444;">❤️</div>
                <h3>Sin outfits favoritos</h3>
                <p>Genera combinaciones en la sección de Outfits y toca el botón ❤️ "Guardar en Favoritos" para conservarlas aquí.</p>
                <button type="button" class="btn btn-primary" onclick="switchToView('view-outfits')" style="margin-top: 8px;">
                    <span class="generate-sparkle">✨</span>
                    <span>Ir a Generador de Outfits</span>
                </button>
            </div>
        `;
        return;
    }

    favs.forEach(fav => {
        const card = document.createElement('div');
        card.className = 'favorite-outfit-card';

        const isSport = fav.mode === 'sport';
        const modeBadge = isSport
            ? `<span class="fav-mode-badge sport">🏃 Deportivo</span>`
            : `<span class="fav-mode-badge casual">✨ Diario</span>`;

        let formattedDate = "";
        try {
            formattedDate = new Date(fav.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        } catch (e) {
            formattedDate = fav.date || "";
        }

        let slotsHtml = '';
        if (fav.items && Array.isArray(fav.items)) {
            slotsHtml = fav.items.map(it => {
                const img = it.image || '';
                return `
                    <div class="fav-slot-item" title="${it.category || 'Prenda'}">
                        <img src="${img}" alt="${it.category || 'Prenda'}" loading="lazy">
                        <span class="fav-slot-pill">${it.category || ''}</span>
                    </div>
                `;
            }).join('');
        }

        card.innerHTML = `
            <div class="fav-card-header">
                <div class="fav-card-meta">
                    ${modeBadge}
                    <span class="fav-date">${formattedDate}</span>
                </div>
                <button class="delete-fav-btn" data-id="${fav.id}" title="Eliminar de favoritos" aria-label="Eliminar favorito">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            <div class="fav-items-grid">
                ${slotsHtml}
            </div>
        `;

        favoritesGrid.appendChild(card);
    });

    favoritesGrid.querySelectorAll('.delete-fav-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("¿Deseas quitar este look de tus favoritos?")) {
                await deleteFavoriteOutfitFromStorage(id);
                loadFavorites();
            }
        });
    });
}

// ==========================================================================
// REMOVE.BG & GEMINI APIS (Soporta config.js y localStorage)
// ==========================================================================
function getApiKey(name) {
    if (name === 'REMOVE_BG') {
        if (typeof CONFIG !== 'undefined' && CONFIG.REMOVE_BG_API_KEY) return CONFIG.REMOVE_BG_API_KEY;
        const stored = localStorage.getItem('ropero_remove_bg_key');
        if (stored) return stored;
        return DEFAULT_AI_CONFIG.REMOVE_BG_API_KEY || '';
    }
    if (name === 'GEMINI') {
        if (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) return CONFIG.GEMINI_API_KEY;
        const stored = localStorage.getItem('ropero_gemini_key');
        if (stored) return stored;
        return DEFAULT_AI_CONFIG.GEMINI_API_KEY || '';
    }
    return '';
}

async function procesarPrenda(archivoImagen) {
    const apiKey = getApiKey('REMOVE_BG');
    if (!apiKey) {
        throw new Error("No hay API Key de Remove.bg");
    }

    const formData = new FormData();
    const fileName = (archivoImagen instanceof File && archivoImagen.name) ? archivoImagen.name : 'prenda.jpg';
    formData.append('image_file', archivoImagen, fileName);
    formData.append('size', 'preview');
    formData.append('bg_color', '#FFFFFF');

    const respuesta = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData
    });

    if (!respuesta.ok) {
        const errorDetail = await respuesta.text().catch(() => '');
        console.error(`Error Remove.bg (${respuesta.status}):`, errorDetail);
        throw new Error(`Error Remove.bg (${respuesta.status}): ${errorDetail}`);
    }

    const blobBlanco = await respuesta.blob();
    return blobBlanco;
}

function normalizarCategoria(cat) {
    if (!cat) return "Top Base";
    const c = cat.trim().toLowerCase();
    if (c.includes("deport") || c.includes("gym") || c.includes("fit") || c.includes("entrena") || c.includes("running") || c.includes("atlet")) return "Deportiva";
    if (c.includes("calzad") || c.includes("tenis") || c.includes("zapato") || c.includes("bota") || c.includes("sneaker")) return "Calzado";
    if (c.includes("capa") || c.includes("abrigo") || c.includes("saco") || c.includes("blazer") || c.includes("chamarra") || c.includes("sueter") || c.includes("cardigan")) return "Capa Extra";
    if (c.includes("bottom") || c.includes("pantalon") || c.includes("jean") || c.includes("mezclilla") || c.includes("falda") || c.includes("short")) return "Bottoms";
    if (c.includes("top") || c.includes("camisa") || c.includes("playera") || c.includes("blusa") || c.includes("polo")) return "Top Base";
    if (c.includes("accesor")) return "Accesorio";

    const valid = ["Top Base", "Capa Extra", "Bottoms", "Calzado", "Deportiva", "Accesorio"];
    return valid.find(v => v.toLowerCase() === c) || "Top Base";
}

async function clasificarConGemini(blobImagen) {
    const geminiApiKey = getApiKey('GEMINI');
    if (!geminiApiKey) {
        throw new Error("No hay API Key de Gemini");
    }

    const base64Image = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blobImagen);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 640;
                let width = img.naturalWidth || img.width;
                let height = img.naturalHeight || img.height;

                if (width > height && width > MAX_SIZE) {
                    height = Math.round((height * MAX_SIZE) / width);
                    width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                    width = Math.round((width * MAX_SIZE) / height);
                    height = MAX_SIZE;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve(dataUrl.split(',')[1]);
            } catch (canvasErr) {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.toString().split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blobImagen);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.toString().split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blobImagen);
        };
        img.src = url;
    });

    const systemPrompt = `Eres un estilista y clasificador visual de prendas. Analiza la imagen y clasifica la prenda en EXACTAMENTE UNA categoría:

1. "Deportiva":
   - CUALQUIER prenda diseñada para deporte, ejercicio, gimnasio, running, fitness o entrenamiento.
   - Indicadores CLAVE: telas técnicas o sintéticas (dry-fit, poliéster deportivo, nylon, licra, spandex, mallas microperforadas), elásticos o cordones de ajuste deportivos, corte atlético, o logotipos de marcas deportivas (Nike, Adidas, Under Armour, Puma, Reebok, Gymshark, Jordan, Champion, Lululemon, etc.).
   - Ejemplos: playeras de entrenamiento/dry-fit/compresión, jerseys deportivos (fútbol, básquetbol), shorts de gym/running, leggings o mallas de ejercicio, pants/joggers deportivos, sudaderas/hoodies de entrenamiento, tops deportivos (sports bras), chamarras rompevientos.
   - REGLA CRÍTICA: Si es para hacer ejercicio o tiene estilo deportivo/atlético, CLASIFÍCALA SIEMPRE COMO "Deportiva" (NUNCA como Top Base ni como Bottoms).

2. "Top Base":
   - Prendas superiores de vestir CASUAL, URBANO o FORMAL.
   - Ejemplos: camisas de vestir (con cuello rígido y botones frontales), blusas de oficina, camisas casuales de lino, playeras tipo polo de vestir, playeras básicas de algodón de uso diario urbano (que no sean de entrenamiento).
   - REGLA CRÍTICA: Las camisas de vestir con botones o blusas formales NUNCA son Deportivas.

3. "Capa Extra":
   - Prendas exteriores de uso CASUAL o FORMAL para abrigar.
   - Ejemplos: sacos, blazers, abrigos de vestir, gabardinas, suéteres tejidos de punto, chamarras de mezclilla o de piel. (Nota: sudaderas o rompevientos deportivos van en "Deportiva").

4. "Bottoms":
   - Prendas inferiores de uso CASUAL o FORMAL.
   - Ejemplos: pantalones de mezclilla (jeans), pantalones de vestir/sastre, chinos, faldas casuales, bermudas de vestir. (Nota: pants de ejercicio, shorts deportivos y leggings de gym van en "Deportiva").

5. "Calzado":
   - Zapatos de vestir, botas, botines, mocasines, tenis/sneakers casuales o deportivos, sandalias.

6. "Accesorio":
   - Gorras, sombreros, cinturones, bufandas, bolsas, mochilas.

Responde ÚNICAMENTE un objeto JSON con este formato:
{
  "categoria": "Deportiva" | "Top Base" | "Capa Extra" | "Bottoms" | "Calzado" | "Accesorio",
  "subtipo": "top" | "bottom" | "layer" | "shoes" | "accesorio",
  "descripcion": "nombre corto y descriptivo en español (ej: Playera Dry-Fit Nike, Camisa a Rayas Manga Larga, Short Deportivo con Elástico, Pants de Entrenamiento, etc.)"
}`;

    const payload = {
        contents: [{
            parts: [
                { text: systemPrompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 600,
            responseMimeType: "application/json"
        }
    };

    const modelos = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];
    let ultimoError = null;

    for (const modelo of modelos) {
        for (let intento = 0; intento < 2; intento++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 9000);

                const urlAPI = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiApiKey.trim()}`;
                const response = await fetch(urlAPI, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                }).finally(() => clearTimeout(timeoutId));

                if (!response.ok) {
                    const errorText = await response.text();
                    if (response.status === 404) {
                        ultimoError = new Error(`Modelo ${modelo} no disponible`);
                        break;
                    }
                    if (response.status === 503 && intento === 0) {
                        await new Promise(r => setTimeout(r, 1200));
                        continue;
                    }
                    throw new Error(`Error Gemini HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                let textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                textoRespuesta = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();

                let parsed = null;
                try {
                    parsed = JSON.parse(textoRespuesta);
                } catch (e) {
                    const match = textoRespuesta.match(/\{[\s\S]*\}/);
                    if (match) {
                        parsed = JSON.parse(match[0]);
                    }
                }

                if (parsed && (parsed.categoria || parsed.category)) {
                    parsed.categoria = normalizarCategoria(parsed.categoria || parsed.category);
                    return parsed;
                }
                throw new Error("Respuesta inválida de Gemini: " + textoRespuesta);

            } catch (err) {
                ultimoError = err;
                if (err.name === 'AbortError') {
                    console.warn(`Timeout alcanzado con ${modelo}`);
                    break;
                }
                if (err.message && err.message.includes('404')) {
                    break;
                }
                if (intento === 0) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    }

    throw ultimoError || new Error("No se pudo clasificar con Gemini.");
}

// Global retry function
window.retryClassification = async function() {
    const labelIA = document.getElementById('label-ia')
        || document.querySelector('.ia-detected-label');
        
    if (!currentProcessedImage) return;

    if (labelIA) {
        labelIA.innerHTML = '<span>⏳ Reintentando clasificación con IA...</span>';
    }

    if (loadingContainer) loadingContainer.classList.remove('hidden');

    try {
        const result = await clasificarConGemini(currentProcessedImage);
        currentCategory = normalizarCategoria(result.categoria);
        currentSubtipo = result.subtipo || "";
        currentDescripcion = result.descripcion || currentCategory;

        if (labelIA) {
            const catEmoji = currentCategory === 'Deportiva' ? '🏃' :
                             currentCategory === 'Calzado' ? '👟' :
                             currentCategory === 'Bottoms' ? '👖' :
                             currentCategory === 'Capa Extra' ? '🧥' : '👕';
            labelIA.innerHTML = `<span>✨ IA detectó:</span> <strong>${catEmoji} ${currentDescripcion}</strong> <span style="font-size:0.8rem; opacity:0.85;">(${currentCategory})</span>`;
        }
        highlightCategoryPill(currentCategory);
    } catch (geminiError) {
        console.warn("Fallo al reintentar clasificar con Gemini:", geminiError);
        if (labelIA) {
            labelIA.innerHTML = `<span>⚠️ Selección manual.</span> <button type="button" onclick="retryClassification()" style="margin-left: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600; background: var(--accent-gradient); color: white; border: none; border-radius: 999px; cursor: pointer;">↻ Reintentar</button>`;
        }
    } finally {
        if (loadingContainer) loadingContainer.classList.add('hidden');
    }
};

window.switchToView = switchToView;