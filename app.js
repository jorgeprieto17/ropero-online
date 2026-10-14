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

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const imageInput = document.getElementById('image-input');
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
    // Abrir modal
    if (btnCloudStatus) btnCloudStatus.addEventListener('click', openSettingsModal);
    if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsModal);

    // Cerrar modal
    if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettingsModal);
    if (btnCloseModalFooter) btnCloseModalFooter.addEventListener('click', closeSettingsModal);

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }

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
}

// ==========================================================================
// UPLOAD & PROCESSING LOGIC
// ==========================================================================
function setupUploadHandlers() {
    uploadPlaceholder.addEventListener('click', () => {
        imageInput.click();
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadPlaceholder.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadPlaceholder.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadPlaceholder.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadPlaceholder.classList.remove('dragover');
        });
    });

    uploadPlaceholder.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files[0]) {
            handleImageUpload(files[0]);
        }
    });

    imageInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });

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
    uploadPlaceholder.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    imagePreview.classList.add('hidden');
    imagePreview.removeAttribute('src');

    if (loadingContainer) loadingContainer.classList.remove('hidden');

    let categoria = "Desconocido";

    try {
        const blobBlanco = await procesarPrenda(file);
        if (!blobBlanco) throw new Error("Fallo al remover fondo");

        currentProcessedImage = blobBlanco;

        // Clasificar con Gemini
        try {
            const result = await clasificarConGemini(blobBlanco);
            categoria = result.categoria || "Top Base";
            const descripcion = result.descripcion || categoria;
            currentCategory = categoria;

            const labelIA = document.getElementById('label-ia')
                || document.querySelector('.ia-detected-label');
            if (labelIA) {
                labelIA.innerHTML = `<span>✨ IA detectó:</span> <strong>${descripcion}</strong>`;
                labelIA.classList.remove('hidden');
            }
            highlightCategoryPill(categoria);
        } catch (geminiError) {
            console.warn("Fallo al clasificar con Gemini:", geminiError);
            categoria = "Top Base";
            currentCategory = categoria;

            const labelIA = document.getElementById('label-ia')
                || document.querySelector('.ia-detected-label');
            if (labelIA) {
                labelIA.innerHTML = `<span>⚠️ Selección manual.</span> <button type="button" onclick="retryClassification()" style="margin-left: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600; background: var(--accent-gradient); color: white; border: none; border-radius: 999px; cursor: pointer;">↻ Reintentar</button>`;
                labelIA.classList.remove('hidden');
            }
            highlightCategoryPill(categoria);
        }

        // Mostrar imagen procesada
        const imageUrl = URL.createObjectURL(blobBlanco);
        imagePreview.src = imageUrl;
        imagePreview.onload = () => {
            imagePreview.classList.remove('hidden');
        };

        if (categorySelectorWrapper) {
            categorySelectorWrapper.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Fallo general en procesamiento:", error);
        // Fallback: Si Remove.bg falla, permitir usar la foto original directamente
        currentProcessedImage = file;
        const imageUrl = URL.createObjectURL(file);
        imagePreview.src = imageUrl;
        imagePreview.onload = () => {
            imagePreview.classList.remove('hidden');
        };

        const labelIA = document.getElementById('label-ia')
            || document.querySelector('.ia-detected-label');
        if (labelIA) {
            labelIA.innerHTML = `<span>⚠️ Sin remoción de fondo (Modo foto original). Selecciona su categoría:</span>`;
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
    imageInput.value = '';
    currentProcessedImage = null;
    currentCategory = null;
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
// OUTFIT GENERATOR LOGIC
// ==========================================================================
function setupOutfitGenerator() {
    btnGenerate.addEventListener('click', generateOutfit);
}

async function generateOutfit() {
    const slots = {
        'Capa Extra': document.getElementById('slot-layer'),
        'Top Base': document.getElementById('slot-top'),
        'Bottoms': document.getElementById('slot-bottom'),
        'Calzado': document.getElementById('slot-shoes')
    };

    btnGenerate.classList.add('loading');
    Object.values(slots).forEach(slot => {
        if (slot) slot.style.opacity = '0.4';
    });

    try {
        const layers = await getItemsFromStorage('Capa Extra');
        const tops = await getItemsFromStorage('Top Base');
        const bottoms = await getItemsFromStorage('Bottoms');
        const shoes = await getItemsFromStorage('Calzado');

        setTimeout(() => {
            if (slots['Capa Extra']) updateSlot(slots['Capa Extra'], layers, 'Sin Capa Extra', '🧥');
            if (slots['Top Base']) updateSlot(slots['Top Base'], tops, 'Sin Top Base', '👕');
            if (slots['Bottoms']) updateSlot(slots['Bottoms'], bottoms, 'Sin Bottom', '👖');
            if (slots['Calzado']) updateSlot(slots['Calzado'], shoes, 'Sin Calzado', '👟');

            Object.values(slots).forEach(slot => {
                if (slot) slot.style.opacity = '1';
            });

            btnGenerate.classList.remove('loading');
        }, 400);

    } catch (e) {
        console.error("Error generando outfit", e);
        btnGenerate.classList.remove('loading');
    }
}

function updateSlot(slotElement, itemsArray, emptyText, icon) {
    if (itemsArray.length > 0) {
        const randomItem = itemsArray[Math.floor(Math.random() * itemsArray.length)];
        const imageUrl = (randomItem.image instanceof Blob || randomItem.image instanceof File) 
            ? URL.createObjectURL(randomItem.image) 
            : randomItem.image;
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
// REMOVE.BG & GEMINI APIS (Soporta config.js y localStorage)
// ==========================================================================
function getApiKey(name) {
    if (name === 'REMOVE_BG') {
        if (typeof CONFIG !== 'undefined' && CONFIG.REMOVE_BG_API_KEY) return CONFIG.REMOVE_BG_API_KEY;
        return localStorage.getItem('ropero_remove_bg_key') || '';
    }
    if (name === 'GEMINI') {
        if (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) return CONFIG.GEMINI_API_KEY;
        return localStorage.getItem('ropero_gemini_key') || '';
    }
    return '';
}

async function procesarPrenda(archivoImagen) {
    const apiKey = getApiKey('REMOVE_BG');
    if (!apiKey) {
        throw new Error("No hay API Key de Remove.bg");
    }

    const formData = new FormData();
    formData.append('image_file', archivoImagen);
    formData.append('size', 'auto');
    formData.append('bg_color', '#FFFFFF');

    const respuesta = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': apiKey },
        body: formData
    });

    if (!respuesta.ok) throw new Error('Error al conectar con Remove.bg (Status: ' + respuesta.status + ')');

    const blobBlanco = await respuesta.blob();
    return blobBlanco;
}

async function clasificarConGemini(blobImagen) {
    const geminiApiKey = getApiKey('GEMINI');
    if (!geminiApiKey) {
        throw new Error("No hay API Key de Gemini");
    }

    const base64Image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 600;
            let width = img.width;
            let height = img.height;

            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error("Fallo al comprimir imagen"));
        img.src = URL.createObjectURL(blobImagen);
    });

    const payload = {
        contents: [{
            parts: [
                { text: "Clasifica la prenda de esta imagen. Responde SOLO con un JSON válido exacto: {\"categoria\": \"Bottoms\", \"descripcion\": \"Pantalón de mezclilla\"}. Las opciones válidas para 'categoria' son: 'Top Base' (playeras, camisas, blusas), 'Capa Extra' (chamarras, suéteres, sudaderas, abrigos), 'Bottoms' (pantalones, shorts, faldas), 'Calzado' o 'Accesorio'. La 'descripcion' debe ser un nombre natural y corto de la prenda." },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    const urlAPI = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiApiKey.trim()}`;

    const response = await fetch(urlAPI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error Gemini HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let textoRespuesta = data.candidates[0].content.parts[0].text;
    textoRespuesta = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(textoRespuesta);
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
        currentCategory = result.categoria || "Top Base";
        const descripcion = result.descripcion || currentCategory;
        if (labelIA) {
            labelIA.innerHTML = `<span>✨ IA detectó:</span> <strong>${descripcion}</strong>`;
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