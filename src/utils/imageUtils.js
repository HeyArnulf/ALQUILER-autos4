// ========================================================
// imageUtils.js — Validación y compresión de imágenes
// --------------------------------------------------------
// Se ejecuta en el navegador (frontend). Antes de guardar
// cualquier imagen se valida el formato y el peso, y luego se
// comprime/redimensiona en un <canvas> para obtener un dataURL
// ligero que pueda persistirse en localStorage sin agotar la
// cuota (~5 MB) del navegador.
// ========================================================

// Formatos aceptados tanto por extensión como por MIME type.
export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const ACCEPTED_IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Límites usados por las validaciones (frontend).
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;   // 5 MB: peso máximo del archivo original
export const MAX_DIMENSION = 1280;                 // lado mayor tras redimensionar
export const COMPRESSION_QUALITY = 0.82;           // calidad de la compresión JPEG/WEBP
export const MAX_STORED_BYTES = 700 * 1024;        // ~700 KB: peso objetivo del dataURL final

// Devuelve la extensión (en minúsculas) del nombre de un archivo.
export function getFileExtension(fileName = '') {
    const match = /\.([a-z0-9]+)$/i.exec(String(fileName));
    return match ? `.${match[1].toLowerCase()}` : '';
}

// Valida un archivo de imagen. Devuelve { ok, message }.
export function validateImageFile(file) {
    if (!file) {
        return { ok: false, message: 'No se seleccionó ningún archivo.' };
    }

    const extension = getFileExtension(file.name);
    const typeOk = ACCEPTED_IMAGE_MIMES.includes((file.type || '').toLowerCase());
    const extensionOk = ACCEPTED_IMAGE_EXTENSIONS.includes(extension);

    if (!typeOk && !extensionOk) {
        return { ok: false, message: 'Formato no permitido. Usa JPG, JPEG, PNG o WEBP.' };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, message: 'La imagen supera los 5 MB permitidos.' };
    }
    return { ok: true, message: '' };
}

// Comprueba si el navegador soporta exportar a WEBP desde canvas.
function supportsWebp() {
    try {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
        return false;
    }
}

// Redimensiona una imagen (Image) conservando proporción.
function fitInside(width, height, maxDimension) {
    if (width <= maxDimension && height <= maxDimension) {
        return { width, height };
    }
    const ratio = width > height ? maxDimension / width : maxDimension / height;
    return {
        width: Math.round(width * ratio),
        height: Math.round(height * ratio)
    };
}

// Lee un File como dataURL (base) para poder dibujarlo en un canvas.
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.readAsDataURL(file);
    });
}

// Carga un dataURL en un objeto Image resuelto.
function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
        image.src = dataUrl;
    });
}

// Convierte un archivo en un dataURL comprimido y redimensionado.
// Devuelve el string listo para guardar (o lanza un Error controlado).
export async function compressImageFile(file, options = {}) {
    const validation = validateImageFile(file);
    if (!validation.ok) {
        throw new Error(validation.message);
    }

    const maxDimension = options.maxDimension || MAX_DIMENSION;
    const quality = options.quality ?? COMPRESSION_QUALITY;

    const originalDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(originalDataUrl);
    const { width, height } = fitInside(image.naturalWidth, image.naturalHeight, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    // Fondo blanco para imágenes con transparencia que pasen a JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const useWebp = supportsWebp();
    const format = useWebp ? 'image/webp' : 'image/jpeg';

    let dataUrl = canvas.toDataURL(format, quality);

    // Si aún pesa demasiado, reintentamos con más compresión y menos resolución.
    if (dataUrl.length * 0.75 > MAX_STORED_BYTES) {
        const smaller = fitInside(width, height, Math.round(maxDimension * 0.7));
        canvas.width = smaller.width;
        canvas.height = smaller.height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, smaller.width, smaller.height);
        ctx.drawImage(image, 0, 0, smaller.width, smaller.height);
        dataUrl = canvas.toDataURL(format, Math.max(0.5, quality - 0.15));
    }

    return dataUrl;
}

// Estima el peso aproximado (bytes) de un dataURL.
export function estimateDataUrlBytes(dataUrl = '') {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0) return 0;
    const base64 = dataUrl.slice(commaIndex + 1);
    return Math.round((base64.length * 3) / 4);
}
