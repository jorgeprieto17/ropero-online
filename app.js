// ==========================================================================
// ROPERO ONLINE - APP JAVASCRIPT
// ==========================================================================

// Database configuration
const DB_NAME = 'RoperoDB';
const STORE_NAME = 'wardrobe';
let db;

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

let currentProcessedImage = null;
let currentCategory = "";

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await initDB();
    setupNavigation();
    setupUploadHandlers();
    setupWardrobeFilters();
    setupOutfitGenerator();
    setupCategoryPills();
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
// INDEXEDDB SETUP
// ==========================================================================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject("Error opening DB");

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('category', 'category', { unique: false });
            }
        };
    });
}

function saveItemToDB(item) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
}

function getItemsFromDB(category = 'all') {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            let items = request.result;
            if (category !== 'all') {
                items = items.filter(item => item.category === category);
            }
            resolve(items);
        };
        request.onerror = () => reject();
    });
}

function deleteItemFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject();
    });
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
    // Click to select
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

                await saveItemToDB({
                    image: currentProcessedImage,
                    category: currentCategory || "Top Base",
                    date: new Date().toISOString()
                });

                resetUploadView();
                switchToView('view-wardrobe');
            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al guardar la prenda.");
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
            categoria = result.categoria || "Desconocido";
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
                labelIA.innerHTML = `<span>⚠️ Fallo en IA.</span> <button type="button" onclick="retryClassification()" style="margin-left: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600; background: var(--accent-gradient); color: white; border: none; border-radius: 999px; cursor: pointer;">↻ Reintentar</button>`;
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
        const labelIA = document.getElementById('label-ia')
            || document.querySelector('.ia-detected-label');
        if (labelIA) {
            labelIA.textContent = "Error al procesar la imagen.";
            labelIA.classList.remove('hidden');
        }
    } finally {
        if (loadingContainer) loadingContainer.classList.add('hidden');
        if (uploadActions) {
            uploadActions.classList.remove('hidden');
            uploadActions.style.display = 'grid';
        }
    }
}

// Category selection pills in upload view
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
    const allItems = await getItemsFromDB('all');
    const items = category === 'all' 
        ? allItems 
        : allItems.filter(item => item.category === category);

    if (wardrobeCounter) {
        wardrobeCounter.textContent = `${allItems.length} ${allItems.length === 1 ? 'prenda' : 'prendas'}`;
    }

    wardrobeGrid.innerHTML = '';

    if (items.length === 0) {
        wardrobeGrid.innerHTML = `
            <div class="wardrobe-empty-state">
                <div class="empty-state-icon">✨</div>
                <h3>Sin prendas en esta sección</h3>
                <p>Añade tus prendas para empezar a crear combinaciones automáticas con IA.</p>
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

    // Eventos para eliminar
    wardrobeGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btnEl = e.currentTarget;
            const id = Number(btnEl.getAttribute('data-id'));
            if (confirm("¿Deseas eliminar esta prenda de tu armario?")) {
                await deleteItemFromDB(id);
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

    // Efecto visual de generación
    btnGenerate.classList.add('loading');
    Object.values(slots).forEach(slot => {
        if (slot) slot.style.opacity = '0.4';
    });

    try {
        const layers = await getItemsFromDB('Capa Extra');
        const tops = await getItemsFromDB('Top Base');
        const bottoms = await getItemsFromDB('Bottoms');
        const shoes = await getItemsFromDB('Calzado');

        setTimeout(() => {
            if (slots['Capa Extra']) updateSlot(slots['Capa Extra'], layers, 'Sin Capa Extra', '🧥');
            if (slots['Top Base']) updateSlot(slots['Top Base'], tops, 'Sin Top Base', '👕');
            if (slots['Bottoms']) updateSlot(slots['Bottoms'], bottoms, 'Sin Bottom', '👖');
            if (slots['Calzado']) updateSlot(slots['Calzado'], shoes, 'Sin Calzado', '👟');

            Object.values(slots).forEach(slot => {
                if (slot) {
                    slot.style.opacity = '1';
                }
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
// REMOVE.BG & GEMINI APIS
// ==========================================================================
async function procesarPrenda(archivoImagen) {
    const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.REMOVE_BG_API_KEY) ? CONFIG.REMOVE_BG_API_KEY : '';
    const formData = new FormData();

    formData.append('image_file', archivoImagen);
    formData.append('size', 'auto');
    formData.append('bg_color', '#FFFFFF');

    try {
        const respuesta = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: { 'X-Api-Key': apiKey },
            body: formData
        });

        if (!respuesta.ok) throw new Error('Error de conexión con la API de Remove.bg');

        const blobBlanco = await respuesta.blob();
        return blobBlanco;

    } catch (error) {
        console.error('Fallo en el procesamiento:', error);
        alert('Error al remover el fondo. Verifica tu conexión o API Key de Remove.bg.');
        return null;
    }
}

async function clasificarConGemini(blobImagen) {
    const geminiApiKey = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) ? CONFIG.GEMINI_API_KEY : '';

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
            labelIA.innerHTML = `<span>⚠️ Fallo en IA.</span> <button type="button" onclick="retryClassification()" style="margin-left: 8px; padding: 4px 10px; font-size: 0.8rem; font-weight: 600; background: var(--accent-gradient); color: white; border: none; border-radius: 999px; cursor: pointer;">↻ Reintentar</button>`;
        }
    } finally {
        if (loadingContainer) loadingContainer.classList.add('hidden');
    }
};

window.switchToView = switchToView;