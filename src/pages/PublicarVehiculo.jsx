import { useState } from 'react';
import { useApp } from '../context/useApp';
import { ImageUploader } from '../components/ImageUploader';
import { Car, CheckCircle2, AlertTriangle, Info, Send } from 'lucide-react';

// ========================================================
// PublicarVehiculo.jsx — Formulario de publicación del cliente
// --------------------------------------------------------
// Permite que un usuario autenticado registre un vehículo que
// quiere publicar en la plataforma. El vehículo se guarda en la
// MISMA fuente de datos que ve el administrador (AppContext →
// localStorage), pero entra con "estadoPublicacion = Pendiente"
// para que el admin lo revise y lo apruebe o rechace. Una vez
// aprobado, aparece automáticamente en el catálogo público.
// ========================================================

const CATEGORIAS = ['Sedán', 'SUV', 'Lujo', 'Vans', 'Pickup'];
const TRANSMISIONES = ['Automática', 'Manual'];
const COMBUSTIBLES = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico'];

// Deduce la marca si el cliente no la escribe.
const inferMarca = (nombre = '') => {
    const first = String(nombre).trim().split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Sin marca';
};

const EMPTY_FORM = {
    nombre: '',
    marca: '',
    modelo: '',
    anio: '',
    categoria: 'Sedán',
    categoriaLabel: '',
    transmision: 'Automática',
    combustible: 'Gasolina',
    pasajeros: 5,
    maletas: 2,
    kilometraje: '',
    precioDia: '',
    descripcion: '',
    imagen: ''
};

export const PublicarVehiculo = ({ onTabChange }) => {
    const { addCar, currentUser } = useApp();
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);
    const [sent, setSent] = useState(false);

    const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        window.setTimeout(() => setToast(null), 3200);
    };

    const submit = (event) => {
        event.preventDefault();
        const precio = parseFloat(form.precioDia);
        const pasajeros = parseInt(form.pasajeros, 10);
        const maletas = parseInt(form.maletas, 10);
        const anio = parseInt(form.anio, 10);
        const kilometraje = parseInt(form.kilometraje, 10);

        // ---- Validaciones del formulario (frontend) ----
        if (!form.nombre || form.nombre.trim().length < 3) {
            setError('El nombre del vehículo debe tener al menos 3 caracteres.');
            return;
        }
        if (isNaN(precio) || precio <= 0) {
            setError('El precio por día debe ser un número mayor que 0.');
            return;
        }
        if (isNaN(pasajeros) || pasajeros < 1) {
            setError('Indica al menos 1 pasajero.');
            return;
        }
        if (form.anio && (isNaN(anio) || anio < 1990 || anio > 2100)) {
            setError('El año debe ser un número válido (1990 - 2100).');
            return;
        }
        setError('');

        // ---- Construcción del vehículo ----
        const payload = {
            nombre: form.nombre.trim(),
            marca: form.marca.trim() || inferMarca(form.nombre),
            modelo: form.modelo.trim(),
            anio: isNaN(anio) ? null : anio,
            categoria: form.categoria,
            categoriaLabel: form.categoriaLabel.trim() || form.categoria,
            transmision: form.transmision,
            combustible: form.combustible,
            pasajeros,
            maletas: isNaN(maletas) ? 0 : maletas,
            kilometraje: isNaN(kilometraje) ? 0 : kilometraje,
            precioDia: precio,
            descripcion: form.descripcion.trim(),
            imagen: form.imagen || '/fotos/1.jpg',
            status: 'Disponible',
            disponible: true
        };

        // Se registra como solicitud pendiente de aprobación por el admin.
        addCar(payload, { pendingPublication: true });
        setSent(true);
        showToast('Vehículo enviado para revisión del administrador.', 'success');
        setForm(EMPTY_FORM);
    };

    return (
        <div className="admin-page publish-page">
            <header className="admin-page-head">
                <div>
                    <h1 className="admin-page-title">Publicar mi vehículo</h1>
                    <p className="admin-page-subtitle">
                        Registra tu vehículo con una foto. El administrador lo revisará y, al aprobarlo,
                        aparecerá en el catálogo de alquiler.
                    </p>
                </div>
            </header>

            {/* Aviso de flujo hacia el administrador */}
            <div className="publish-notice">
                <Info size={16} aria-hidden="true" />
                <span>
                    Tu solicitud quedará como <strong>Pendiente</strong> hasta que el administrador la apruebe.
                    Puedes consultar el estado en tu panel de reservas.
                </span>
            </div>

            {sent && (
                <div className="publish-success" role="status">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    <span>¡Listo! Tu vehículo fue enviado y está en revisión.</span>
                </div>
            )}

            <section className="admin-card">
                <div className="admin-toolbar">
                    <h2 className="admin-card-title no-margin">
                        <Car size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />
                        Datos del vehículo
                    </h2>
                    <span className="admin-page-chip">Publicado por {currentUser?.name || 'cliente'}</span>
                </div>

                <form className="admin-form" onSubmit={submit}>
                    <div className="admin-form-grid">
                        <label className="admin-form-field is-full">
                            <span>Nombre del vehículo</span>
                            <input
                                type="text"
                                value={form.nombre}
                                onChange={(e) => updateField('nombre', e.target.value)}
                                placeholder="Ej. Toyota Corolla"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Marca</span>
                            <input
                                type="text"
                                value={form.marca}
                                onChange={(e) => updateField('marca', e.target.value)}
                                placeholder="Ej. Toyota"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Modelo</span>
                            <input
                                type="text"
                                value={form.modelo}
                                onChange={(e) => updateField('modelo', e.target.value)}
                                placeholder="Ej. Corolla"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Año</span>
                            <input
                                type="number"
                                min="1990"
                                max="2100"
                                value={form.anio}
                                onChange={(e) => updateField('anio', e.target.value)}
                                placeholder="2023"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Categoría</span>
                            <select
                                value={form.categoria}
                                onChange={(e) => updateField('categoria', e.target.value)}
                            >
                                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label className="admin-form-field">
                            <span>Transmisión</span>
                            <select
                                value={form.transmision}
                                onChange={(e) => updateField('transmision', e.target.value)}
                            >
                                {TRANSMISIONES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </label>
                        <label className="admin-form-field">
                            <span>Combustible</span>
                            <select
                                value={form.combustible}
                                onChange={(e) => updateField('combustible', e.target.value)}
                            >
                                {COMBUSTIBLES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label className="admin-form-field">
                            <span>Precio por día ($)</span>
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={form.precioDia}
                                onChange={(e) => updateField('precioDia', e.target.value)}
                                placeholder="0.00"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Kilometraje</span>
                            <input
                                type="number"
                                min="0"
                                value={form.kilometraje}
                                onChange={(e) => updateField('kilometraje', e.target.value)}
                                placeholder="0"
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Pasajeros</span>
                            <input
                                type="number"
                                min="1"
                                value={form.pasajeros}
                                onChange={(e) => updateField('pasajeros', e.target.value)}
                            />
                        </label>
                        <label className="admin-form-field">
                            <span>Maletas</span>
                            <input
                                type="number"
                                min="0"
                                value={form.maletas}
                                onChange={(e) => updateField('maletas', e.target.value)}
                            />
                        </label>
                        <label className="admin-form-field is-full">
                            <span>Descripción</span>
                            <textarea
                                rows="3"
                                value={form.descripcion}
                                onChange={(e) => updateField('descripcion', e.target.value)}
                                placeholder="Describe el estado, extras y condiciones del vehículo"
                            />
                        </label>
                        <div className="admin-form-field is-full">
                            <ImageUploader
                                value={form.imagen}
                                onChange={(imagen) => updateField('imagen', imagen)}
                                label="Foto del vehículo"
                                hint="Sube una foto clara desde tu galería · JPG, JPEG, PNG o WEBP · máximo 5 MB"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="admin-form-error">
                            <AlertTriangle size={14} aria-hidden="true" /> {error}
                        </p>
                    )}

                    <div className="admin-modal-actions">
                        {onTabChange && (
                            <button
                                type="button"
                                className="admin-btn admin-btn-ghost"
                                onClick={() => onTabChange('fleet')}
                            >
                                Ver catálogo
                            </button>
                        )}
                        <button type="submit" className="admin-btn admin-btn-primary">
                            <Send size={15} /> Enviar para revisión
                        </button>
                    </div>
                </form>
            </section>

            {/* Toasts reutilizando el estilo del panel administrativo */}
            <div className="admin-toast-container" aria-live="polite">
                {toast && (
                    <div className={`admin-toast is-${toast.type}`}>
                        <span className="admin-toast-icon">
                            {toast.type === 'success' && <CheckCircle2 size={16} />}
                            {toast.type === 'error' && <AlertTriangle size={16} />}
                        </span>
                        {toast.message}
                    </div>
                )}
            </div>
        </div>
    );
};
