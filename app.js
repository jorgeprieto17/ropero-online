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
const processingOverlay = document.getElementById('processing-overlay');
const uploadActions = document.getElementById('upload-actions');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');
const wardrobeGrid = document.getElementById('wardrobe-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const btnGenerate = document.getElementById('btn-generate');

let currentProcessedImage = null;
let currentCategory = "";

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    setupNavigation();
    setupUploadHandlers();
    setupWardrobeFilters();
    setupOutfitGenerator();
    loadWardrobe('all');
});

// IndexedDB Setup
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = (e) => reject("Error opening DB");

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

// Navigation Logic
function setupNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show target view
            const targetId = btn.getAttribute('data-target');
            views.forEach(view => {
                if (view.id === targetId) {
                    view.classList.remove('hidden');
                    view.classList.add('active');
                } else {
                    view.classList.add('hidden');
                    view.classList.remove('active');
                }
            });

            // Refresh wardrobe if navigating to it
            if (targetId === 'view-wardrobe') loadWardrobe('all');
        });
    });
}

// Upload & Processing Logic
function setupUploadHandlers() {
    uploadPlaceholder.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Preparar UI
            uploadPlaceholder.classList.add('hidden');
            previewContainer.classList.remove('hidden');

            // Ocultar img e iniciar carga
            imagePreview.classList.add('hidden');
            imagePreview.removeAttribute('src');

            const loadingContainer = document.getElementById('loading-container') || document.getElementById('processing-overlay');
            if (loadingContainer) loadingContainer.classList.remove('hidden');

            let categoria = "Desconocido";

            try {
                const blobBlanco = await procesarPrenda(file);
                if (!blobBlanco) throw new Error("Fallo al remover fondo");

                currentProcessedImage = blobBlanco;

                // Intentar clasificación (Falla amigable si no está lista o configurada)
                try {
                    const result = await clasificarConGemini(blobBlanco);
                    categoria = result.categoria || "Desconocido";
                    const descripcion = result.descripcion || categoria;

                    currentCategory = categoria;

                    // Actualizar texto de la IA (búsqueda flexible)
                    const labelIA = document.getElementById('label-ia')
                        || document.querySelector('.ia-detected-label')
                        || document.querySelector('[id*="ia"]');
                    if (labelIA) {
                        labelIA.textContent = `IA detectó: ${descripcion}`;
                        labelIA.classList.remove('hidden');
                    }
                } catch (geminiError) {
                    console.warn("Fallo al clasificar con Gemini, se usará manual:", geminiError);
                    categoria = "Desconocido";
                    currentCategory = categoria;

                    const labelIA = document.getElementById('label-ia')
                        || document.querySelector('.ia-detected-label')
                        || document.querySelector('[id*="ia"]');
                    if (labelIA) {
                        labelIA.innerHTML = `Fallo en IA. <button onclick="retryClassification()" style="margin-left: 10px; padding: 6px 12px; font-size: 0.85rem; font-weight: bold; background: var(--accent-color, #E27B58); color: white; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">↻ Reintentar IA</button>`;
                        labelIA.classList.remove('hidden');
                    }
                }

                // AHORA SÍ, mostramos la imagen ya que la IA terminó
                const imageUrl = URL.createObjectURL(blobBlanco);
                imagePreview.src = imageUrl;
                imagePreview.onload = () => {
                    imagePreview.classList.remove('hidden');
                };

            } catch (error) {
                console.error("Fallo general en procesamiento:", error);
                const labelIA = document.getElementById('label-ia')
                    || document.querySelector('.ia-detected-label')
                    || document.querySelector('[id*="ia"]');
                if (labelIA) labelIA.textContent = "Error al procesar. Selección manual.";
            } finally {
                if (loadingContainer) loadingContainer.classList.add('hidden');
                // --- MOSTRAR BOTONES (FALLBACK ABSOLUTO) ---
                // Intentar mostrar botones individuales
                const btnSave = document.getElementById('btnSave') || document.querySelector('.btn-save') || document.getElementById('btn-save');
                const btnCancel = document.getElementById('btnCancel') || document.querySelector('.btn-cancel') || document.getElementById('btn-cancel');
                if (btnSave) btnSave.style.display = 'block';
                if (btnCancel) btnCancel.style.display = 'block';

                // Intentar mostrar contenedores comunes
                const actionButtons = document.getElementById('action-buttons')
                    || document.querySelector('.action-buttons')
                    || document.querySelector('.buttons-container')
                    || document.querySelector('.upload-actions')
                    || document.getElementById('upload-actions');

                if (actionButtons) {
                    actionButtons.classList.remove('hidden');
                    actionButtons.style.display = 'flex'; // Forzar visibilidad
                }
            }
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
                // Cambiar estado del botón
                btnSaveEl.textContent = "Guardando...";
                btnSaveEl.disabled = true;

                // Lógica de IndexedDB (Reemplazar con tu función real si ya existe)
                await saveItemToDB({
                    image: currentProcessedImage,
                    category: currentCategory || "Desconocido",
                    date: new Date().toISOString()
                });

                // Reiniciar vista
                if (typeof resetUploadView === 'function') resetUploadView();
                else window.location.reload(); // Fallback si no existe la función

            } catch (error) {
                console.error("Error al guardar:", error);
                alert("Hubo un error al guardar la prenda.");
            } finally {
                btnSaveEl.textContent = "Guardar Prenda";
                btnSaveEl.disabled = false;
            }
        });
    }
}

// Función base de IndexedDB (si no existe)
async function guardarEnIndexedDB(blob, categoria) {
    return new Promise((resolve, reject) => {
        // Forzamos versión 3 para obligar la actualización
        const request = indexedDB.open('RoperoDB', 3);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('prendas')) {
                db.createObjectStore('prendas', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('prendas')) {
                return reject(new Error("La tabla 'prendas' no se creó correctamente."));
            }
            try {
                const transaction = db.transaction(['prendas'], 'readwrite');
                const store = transaction.objectStore('prendas');
                const requestAdd = store.add({
                    imagen: blob,
                    categoria: categoria,
                    fecha: new Date().toISOString()
                });

                requestAdd.onsuccess = () => resolve();
                requestAdd.onerror = () => reject(requestAdd.error);
            } catch (err) {
                reject(err);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

function resetUploadView() {
    imageInput.value = '';
    currentProcessedImage = null;
    currentCategory = null;
    uploadPlaceholder.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    uploadActions.classList.add('hidden');

    // Ocultar y limpiar etiqueta de IA
    const labelIA = document.getElementById('label-ia')
        || document.querySelector('.ia-detected-label')
        || document.querySelector('[id*="ia"]');
    if (labelIA) {
        labelIA.classList.add('hidden');
        labelIA.textContent = '';
    }
}

// Mock Processing: Removes background (simulated) and categorizes (simulated)
function processImageMock(base64Image) {
    processingOverlay.classList.remove('hidden');
    uploadActions.classList.add('hidden');

    // Simulate API delay (e.g. Remove.bg + Vision API)
    setTimeout(() => {
        // En una app real, aquí enviaríamos la imagen a una API para quitar el fondo
        // y la reemplazaríamos por la imagen procesada sobre fondo blanco.
        // Para el mockup, simulamos que la imagen original ya es el resultado y le asignamos una clase
        currentProcessedImage = base64Image;

        // Simular IA para categorizar la prenda aleatoriamente
        const categories = ['Tops', 'Bottoms', 'Calzado'];
        currentCategory = categories[Math.floor(Math.random() * categories.length)];

        processingOverlay.classList.add('hidden');
        uploadActions.classList.remove('hidden');

        // Mostrar la categoría detectada en el UI
        const detectionLabel = document.createElement('p');
        detectionLabel.style.textAlign = 'center';
        detectionLabel.style.margin = '10px 0';
        detectionLabel.style.fontSize = '0.875rem';
        detectionLabel.style.color = 'var(--text-secondary)';
        detectionLabel.innerHTML = `IA detectó: <strong>${currentCategory}</strong>`;

        // Remover label anterior si existe
        const oldLabel = previewContainer.querySelector('p:not(.processing-overlay p)');
        if (oldLabel) oldLabel.remove();

        previewContainer.appendChild(detectionLabel);

    }, 2000);
}

// Wardrobe Logic
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
    const items = await getItemsFromDB(category);
    wardrobeGrid.innerHTML = '';

    if (items.length === 0) {
        wardrobeGrid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--text-secondary); margin-top: 20px;">No hay prendas en esta categoría.</p>`;
        return;
    }

    items.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'wardrobe-item';

        const imageUrl = (item.image instanceof Blob || item.image instanceof File)
            ? URL.createObjectURL(item.image)
            : item.image;

        div.style.position = 'relative'; // Para posicionar el botón de eliminar
        div.innerHTML = `
            <img src="${imageUrl}" alt="Prenda">
            <span>${item.category}</span>
            <button class="delete-btn" data-id="${item.id}" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; transition: background 0.2s;">✕</button>
        `;
        wardrobeGrid.appendChild(div);
    });

    // Agregar funcionalidad de eliminar
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = Number(e.target.getAttribute('data-id'));
            if (confirm("¿Estás seguro de que quieres eliminar esta prenda de tu armario?")) {
                await deleteItemFromDB(id);
                const activeCategory = document.querySelector('.filter-btn.active').getAttribute('data-category');
                loadWardrobe(activeCategory);
            }
        });
    });
}

// Outfit Generator Logic
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

    // Añadir efecto de carga
    Object.values(slots).forEach(slot => {
        if (slot) slot.style.opacity = '0.5';
    });

    try {
        const layers = await getItemsFromDB('Capa Extra');
        const tops = await getItemsFromDB('Top Base');
        const bottoms = await getItemsFromDB('Bottoms');
        const shoes = await getItemsFromDB('Calzado');

        setTimeout(() => {
            if (slots['Capa Extra']) updateSlot(slots['Capa Extra'], layers, 'Sin Capa Extra');
            if (slots['Top Base']) updateSlot(slots['Top Base'], tops, 'Sin Top Base');
            if (slots['Bottoms']) updateSlot(slots['Bottoms'], bottoms, 'Sin Bottom');
            if (slots['Calzado']) updateSlot(slots['Calzado'], shoes, 'Sin Calzado');

            Object.values(slots).forEach(slot => {
                if (slot) {
                    slot.style.opacity = '1';
                    slot.style.transition = 'opacity 0.3s ease';
                }
            });
        }, 500); // Simulando pequeño delay de "pensamiento de la IA"

    } catch (e) {
        console.error("Error generando outfit", e);
    }
}

function updateSlot(slotElement, itemsArray, emptyText) {
    if (itemsArray.length > 0) {
        const randomItem = itemsArray[Math.floor(Math.random() * itemsArray.length)];
        const imageUrl = (randomItem.image instanceof Blob || randomItem.image instanceof File) 
            ? URL.createObjectURL(randomItem.image) 
            : randomItem.image;
        slotElement.innerHTML = `<img src="${imageUrl}" alt="Outfit part" style="width: 100%; height: 100%; object-fit: cover; border-radius: 16px; display: block;">`;
    } else {
        slotElement.innerHTML = `<p class="slot-empty">${emptyText}</p>`;
    }
}


// Función para procesar la imagen con Remove.bg
async function procesarPrenda(archivoImagen) {
    // Obtiene la clave desde config.js
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

        if (!respuesta.ok) throw new Error('Error de conexión con la API');

        const blobBlanco = await respuesta.blob();
        return blobBlanco;

    } catch (error) {
        console.error('Fallo en el procesamiento:', error);
        alert('Error al remover el fondo. Verifica tu conexión o API Key.');
    }
}


async function clasificarConGemini(blobImagen) {
    // 1. Obtiene la clave de Gemini desde config.js
    const geminiApiKey = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) ? CONFIG.GEMINI_API_KEY : '';

    // 2. Redimensionar y comprimir imagen para mayor velocidad
    const base64Image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 600; // Resolución óptima para IA
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

            // Comprimir a JPEG con 80% de calidad reduce el peso en un 90%
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl.split(',')[1]);
        };
        img.onerror = () => reject(new Error("Fallo al comprimir imagen"));
        img.src = URL.createObjectURL(blobImagen);
    });

    // 3. Estructura estricta del Payload para Gemini 1.5
    const payload = {
        contents: [{
            parts: [
                { text: "Clasifica la prenda de esta imagen. Responde SOLO con un JSON válido exacto: {\"categoria\": \"Bottoms\", \"descripcion\": \"Pantalón de mezclilla\"}. Las opciones válidas para 'categoria' son: 'Top Base' (playeras, camisas, blusas), 'Capa Extra' (chamarras, suéteres, sudaderas, abrigos), 'Bottoms' (pantalones, shorts, faldas), 'Calzado' o 'Accesorio'. La 'descripcion' debe ser un nombre natural y corto de la prenda." },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    // 4. Petición limpia usando el modelo compatible
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

    // 5. Procesamiento de respuesta
    const data = await response.json();
    let textoRespuesta = data.candidates[0].content.parts[0].text;
    textoRespuesta = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(textoRespuesta);
}

// Global retry function
window.retryClassification = async function() {
    const labelIA = document.getElementById('label-ia')
        || document.querySelector('.ia-detected-label')
        || document.querySelector('[id*="ia"]');
        
    if (!currentProcessedImage) return;

    if (labelIA) {
        labelIA.innerHTML = 'Reintentando con IA...';
    }

    const loadingContainer = document.getElementById('loading-container') || document.getElementById('processing-overlay');
    if (loadingContainer) loadingContainer.classList.remove('hidden');

    try {
        const result = await clasificarConGemini(currentProcessedImage);
        currentCategory = result.categoria || "Desconocido";
        const descripcion = result.descripcion || currentCategory;
        if (labelIA) {
            labelIA.textContent = `IA detectó: ${descripcion}`;
        }
    } catch (geminiError) {
        console.warn("Fallo al reintentar clasificar con Gemini:", geminiError);
        if (labelIA) {
            labelIA.innerHTML = `Fallo en IA. <button onclick="retryClassification()" style="margin-left: 10px; padding: 6px 12px; font-size: 0.85rem; font-weight: bold; background: var(--accent-color, #E27B58); color: white; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">↻ Reintentar IA</button>`;
        }
    } finally {
        if (loadingContainer) loadingContainer.classList.add('hidden');
    }
}