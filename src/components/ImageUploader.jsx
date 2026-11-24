import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
    ACCEPTED_IMAGE_EXTENSIONS,
    compressImageFile,
    estimateDataUrlBytes,
    validateImageFile
} from '../utils/imageUtils';

// ========================================================
// ImageUploader.jsx — Selector de imagen con vista previa
// --------------------------------------------------------
// Reemplaza la antigua "ruta de imagen" de texto por un
// selector real desde el dispositivo. Maneja: elegir archivo,
// validar formato/tamaño, comprimir, previsualizar, cambiar y
// eliminar. Devuelve el resultado (dataURL) vía onChange.
// Se reutiliza tanto en el panel de administrador como en el
// formulario de publicación del cliente.
// ========================================================

export function ImageUploader({
    value = '',
    onChange,
    label = 'Imagen del vehículo',
    hint = 'JPG, JPEG, PNG o WEBP · máximo 5 MB',
    fallback = '/fotos/1.jpg'
}) {
    const inputRef = useRef(null);
    const [status, setStatus] = useState('idle'); // idle | loading
    const [error, setError] = useState('');

    const hasImage = Boolean(value);

    const openPicker = () => {
        setError('');
        inputRef.current?.click();
    };

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        // Permitir volver a elegir el mismo archivo más adelante.
        event.target.value = '';
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.ok) {
            setError(validation.message);
            return;
        }

        setStatus('loading');
        setError('');
        try {
            const dataUrl = await compressImageFile(file);
            onChange?.(dataUrl);
        } catch (processError) {
            setError(processError.message || 'No se pudo procesar la imagen.');
        } finally {
            setStatus('idle');
        }
    };

    const removeImage = () => {
        setError('');
        onChange?.('');
    };

    const sizeKb = hasImage ? Math.round(estimateDataUrlBytes(value) / 1024) : 0;

    return (
        <div className="image-uploader">
            <span className="image-uploader-label">{label}</span>

            <div className="image-uploader-body">
                <div className="image-uploader-preview">
                    {hasImage ? (
                        <img src={value} alt="Vista previa del vehículo" />
                    ) : (
                        <div className="image-uploader-placeholder">
                            <ImagePlus size={26} aria-hidden="true" />
                            <span>Sin imagen</span>
                        </div>
                    )}
                    {status === 'loading' && (
                        <div className="image-uploader-loading">
                            <Loader2 size={22} className="is-spinning" aria-hidden="true" />
                            <span>Procesando…</span>
                        </div>
                    )}
                </div>

                <div className="image-uploader-actions">
                    <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={openPicker}
                        disabled={status === 'loading'}
                    >
                        {hasImage ? <RefreshCw size={15} /> : <ImagePlus size={15} />}
                        {hasImage ? 'Cambiar imagen' : 'Seleccionar imagen'}
                    </button>

                    <button
                        type="button"
                        className="admin-btn admin-btn-ghost"
                        onClick={removeImage}
                        disabled={!hasImage || status === 'loading'}
                    >
                        <Trash2 size={15} /> Eliminar
                    </button>

                    <p className="image-uploader-hint">{hint}</p>
                    {hasImage && sizeKb > 0 && (
                        <p className="image-uploader-meta">
                            Imagen lista · {sizeKb} KB
                            {value.startsWith('/fotos/') ? ' (foto de catálogo)' : ''}
                        </p>
                    )}
                    {!hasImage && (
                        <p className="image-uploader-meta">
                            Se usará la imagen por defecto si no eliges ninguna.
                            {' '}<span className="image-uploader-meta-muted">({fallback})</span>
                        </p>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_EXTENSIONS.join(',') + ',' + 'image/jpeg,image/png,image/webp'}
                    className="image-uploader-input"
                    onChange={handleFile}
                />
            </div>

            {error && (
                <p className="image-uploader-error" role="alert">
                    <AlertTriangle size={14} aria-hidden="true" /> {error}
                </p>
            )}
        </div>
    );
}
