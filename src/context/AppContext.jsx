import { useEffect, useState } from 'react';
import { initialCars } from '../data/initialCars';
import { appContext as AppContext } from './contextStore';
import {
    clearSession,
    ensureSeedUsers,
    findUserByEmail,
    getSession,
    setSession
} from '../services/auth';
import {
    HISTORY_KEY,
    MOVEMENT_ACTIONS,
    buildVehicleMovement
} from '../utils/history';

const DEFAULT_USER_EMAIL = 'usuario@santalucia.com';
const CATALOG_VERSION_KEY = 'santa_lucia_catalog_version';
const CATALOG_VERSION = '2';
const DEFAULT_BRANCH = {
    id: 'santa-lucia-soyapango',
    name: 'Alquiler SantaLucía',
    latitude: 13.703628,
    longitude: -89.150161,
    address: 'Av. Principal 123, Centro, Santa Lucia, Soyapango.',
    hours: 'Lun-Sáb: 08:00 - 20:00',
    phone: '+503 7577-2971'
};

function readStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function getProfileStorageKey(email) {
    return `user_data_${btoa(unescape(encodeURIComponent(email || ''))).replace(/=/g, '')}`;
}

function getSavedVehiclesKey(email) {
    return `santalucia_saved_vehicles_${getProfileStorageKey(email)}`;
}

// --------------------------------------------------------
// Normalización del modelo de vehículo
// --------------------------------------------------------
// Deduce la marca desde el nombre cuando no viene definida.
function inferMarca(nombre = '') {
    const first = String(nombre).trim().split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Sin marca';
}

// Garantiza que TODOS los vehículos tengan el modelo completo,
// aunque provengan de datos antiguos guardados en localStorage.
function normalizeCar(car = {}) {
    const publicado = car.publicado ?? true;
    const kilometraje = car.kilometraje === null || car.kilometraje === undefined || car.kilometraje === ''
        ? null
        : Number(car.kilometraje);
    return {
        ...car,
        marca: car.marca || inferMarca(car.nombre),
        modelo: car.modelo || '',
        anio: car.anio === null || car.anio === undefined || car.anio === ''
            ? null
            : Number(car.anio),
        combustible: car.combustible || null,
        kilometraje: Number.isFinite(kilometraje) ? kilometraje : null,
        descripcion: car.descripcion || '',
        publicado,
        estadoPublicacion: car.estadoPublicacion || (publicado ? 'Publicado' : 'Pendiente'),
        vistas: Number(car.vistas) || 0,
        fechaRegistro: car.fechaRegistro ?? null,
        creadoPor: car.creadoPor ?? 'sistema'
    };
}

// --------------------------------------------------------
// Migración de datos DEMO
// --------------------------------------------------------
// Los datos de ejemplo generados por el sistema llevan id con
// un rango fijo. Esta firma permite marcarlos como DEMO sin
// confundirlos con los registros reales que crea el usuario.
function isSeedReservationId(id) {
    const match = /^RES-(\d+)$/.exec(String(id || ''));
    if (!match) return false;
    const value = Number(match[1]);
    return value >= 1001 && value <= 1022;
}

function isSeedMovementId(id) {
    const match = /^MOV-(\d+)$/.exec(String(id || ''));
    if (!match) return false;
    const value = Number(match[1]);
    return value >= 2001 && value < 3000;
}

// La sesión se lee desde el servicio auth (incluye el rol).
// Si no hay sesión activa, devuelve null (nadie entra como admin por defecto).
// Se enriquece con teléfono/avatar guardados en el perfil.
function loadCurrentUser() {
    const session = getSession();
    if (!session) return null;

    const registered = findUserByEmail(session.email) || {};
    const savedProfile = readStorage(getProfileStorageKey(session.email), {});

    return {
        ...registered,
        ...savedProfile,
        email: session.email,
        name: savedProfile.name || registered.name || session.name,
        phone: savedProfile.phone || registered.phone || '',
        avatar: savedProfile.avatar || registered.avatar || '',
        role: session.role
    };
}

function loadSavedVehicles(email) {
    const ids = readStorage(getSavedVehiclesKey(email), []);
    return Array.isArray(ids) ? ids.map(String) : [];
}

function loadCars() {
    const savedCars = readStorage('santa_lucia_cars', null);
    if (!Array.isArray(savedCars)) {
        return initialCars.map(normalizeCar);
    }

    if (localStorage.getItem(CATALOG_VERSION_KEY) === CATALOG_VERSION) {
        return savedCars.map(normalizeCar);
    }

    const savedById = new Map(savedCars.map((car) => [String(car.id), car]));
    const catalogIds = new Set(initialCars.map((car) => String(car.id)));
    const updatedCatalog = initialCars.map((catalogCar) => {
        const savedCar = savedById.get(String(catalogCar.id));
        if (!savedCar) return normalizeCar(catalogCar);

        return normalizeCar({
            ...savedCar,
            ...catalogCar,
            status: savedCar.status ?? catalogCar.status,
            disponible: savedCar.disponible ?? catalogCar.disponible,
            publicado: savedCar.publicado ?? catalogCar.publicado,
            estadoPublicacion: savedCar.estadoPublicacion ?? catalogCar.estadoPublicacion,
            vistas: savedCar.vistas ?? catalogCar.vistas,
            fechaRegistro: savedCar.fechaRegistro ?? catalogCar.fechaRegistro,
            creadoPor: savedCar.creadoPor ?? catalogCar.creadoPor
        });
    });
    const customCars = savedCars
        .filter((car) => !catalogIds.has(String(car.id)))
        .map(normalizeCar);

    return [...updatedCatalog, ...customCars];
}

// ========================================================
// GENERACIÓN DE DATOS REALES DE EJEMPLO
// --------------------------------------------------------
// Crea un historial creíble de reservas y movimientos de la
// flota en los ÚLTIMOS 3 MESES para que las estadísticas
// (gráficas, métricas) se vean llenas y funcionales.
// ========================================================

// Cache de las reservas semilla para que el historial de actividad y la
// lista de reservas usen SIEMPRE el mismo conjunto de datos (no se generan
// dos lotes distintos con valores aleatorios diferentes).
let seedReservationsCache = null;

function generateSeedReservations() {
    if (seedReservationsCache) return seedReservationsCache;
    const now = new Date();
    const usuarios = [
        { email: 'usuario@santalucia.com', nombre: 'Carlos Mendoza' },
        { email: 'maria.gomez@gmail.com', nombre: 'María Gómez' },
        { email: 'juan.perez@hotmail.com', nombre: 'Juan Pérez' },
        { email: 'ana.lozano@outlook.com', nombre: 'Ana Lozano' }
    ];
    const estados = ['Aprobada', 'Aprobada', 'Aprobada', 'Completada', 'Completada', 'Completada', 'Pendiente', 'Rechazada', 'Activa'];
    const lugares = [
        'San Salvador - Oficina Central',
        'Santa Ana - Sucursal Norte',
        'San Miguel - Sucursal Este',
        'Aeropuerto Internacional'
    ];
    const reservations = [];

    // Generamos 22 reservas distribuidas en los últimos 90 días
    for (let i = 0; i < 22; i++) {
        const car = initialCars[Math.floor(Math.random() * initialCars.length)];
        const usuario = usuarios[Math.floor(Math.random() * usuarios.length)];
        const diasAtras = Math.floor(Math.random() * 88) + 1; // 1 a 88 días atrás
        const fechaInicio = new Date(now);
        fechaInicio.setDate(fechaInicio.getDate() - diasAtras);
        const dias = Math.floor(Math.random() * 6) + 1; // 1 a 6 días
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + dias);
        const estado = estados[Math.floor(Math.random() * estados.length)];
        const monto = parseFloat((car.precioDia * dias).toFixed(2));

        reservations.push({
            id: `RES-${1001 + i}`,
            usuario: usuario.email,
            clienteNombre: usuario.nombre,
            carId: car.id,
            autoNombre: car.nombre,
            autoImagen: car.imagen,
            categoria: car.categoriaLabel,
            fechaInicio: fechaInicio.toISOString().split('T')[0],
            fechaFin: fechaFin.toISOString().split('T')[0],
            dias,
            lugar: lugares[Math.floor(Math.random() * lugares.length)],
            monto,
            estado,
            date: fechaInicio.toISOString(),
            demo: true
        });
    }

    // Ordenamos por fecha descendente y cacheamos para reutilizar el mismo lote.
    seedReservationsCache = reservations.sort((a, b) => new Date(b.date) - new Date(a.date));
    return seedReservationsCache;
}

// Genera un historial DEMO de movimientos de la flota en los últimos 3 meses.
// Todos los registros se marcan con demo: true para no mezclarlos con los
// registros reales ni afectar a las estadísticas oficiales.
function generateSeedMovements() {
    const now = new Date();
    const acciones = [
        { accion: 'update', detalle: 'Se actualizaron los datos del vehículo' },
        { accion: 'status_change', detalle: 'Cambio de disponibilidad' },
        { accion: 'price_change', detalle: 'Ajuste de precio por temporada' },
        { accion: 'image_update', detalle: 'Se actualizó la foto del vehículo' },
        { accion: 'maintenance', detalle: 'Mantenimiento preventivo registrado' }
    ];
    const movimientos = [];

    initialCars.forEach((car, index) => {
        const diasAlta = Math.floor(Math.random() * 60) + 20; // 20 a 79 días atrás
        const fechaAlta = new Date(now);
        fechaAlta.setDate(fechaAlta.getDate() - diasAlta);

        movimientos.push({
            id: `MOV-${2001 + index * 4}`,
            vehiculoId: car.id,
            vehiculoNombre: car.nombre,
            marca: car.marca,
            imagen: car.imagen,
            accion: 'create',
            detalle: `${car.nombre} (${car.categoria}) se registró en la flota`,
            fecha: fechaAlta.toISOString(),
            usuario: 'admin@santalucia.com',
            usuarioNombre: 'Administrador Santa Lucía',
            estadoAnterior: null,
            estadoNuevo: 'Disponible',
            demo: true
        });

        const cantidad = Math.floor(Math.random() * 3) + 2; // 2 a 4 movimientos extra
        for (let j = 0; j < cantidad; j++) {
            const base = acciones[Math.floor(Math.random() * acciones.length)];
            const diasAtras = Math.floor(Math.random() * (diasAlta - 1)) + 1;
            const fecha = new Date(now);
            fecha.setDate(fecha.getDate() - diasAtras);

            movimientos.push({
                id: `MOV-${2001 + index * 4 + j + 1}`,
                vehiculoId: car.id,
                vehiculoNombre: car.nombre,
                marca: car.marca,
                imagen: car.imagen,
                accion: base.accion,
                detalle: base.accion === 'status_change'
                    ? `Disponibilidad modificada a: ${car.status}`
                    : base.detalle,
                fecha: fecha.toISOString(),
                usuario: 'admin@santalucia.com',
                usuarioNombre: 'Administrador Santa Lucía',
                estadoAnterior: base.accion === 'status_change' ? 'Alquilado' : null,
                estadoNuevo: base.accion === 'status_change' ? car.status : null,
                demo: true
            });
        }
    });

    // --------------------------------------------------------
    // MOVIMIENTOS DE RESERVAS DEMO
    // --------------------------------------------------------
    // Cada reserva semilla genera su propio registro en el historial
    // para que el admin pueda ver la actividad de los clientes.
    // Se marca demo: true para no mezclarla con operaciones reales.
    movimientos.push(...generateSeedReservationMovements());

    return movimientos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

// Construye los movimientos de historial correspondientes a las reservas DEMO.
// Se extrae en una función aparte para poder reutilizarla en la migración
// de datos guardados antiguos (que no incluían movimientos de reservas).
function generateSeedReservationMovements() {
    return generateSeedReservations().map((reserva) => {
        const finalizada = reserva.estado === 'Completada';
        const confirmada = ['Aprobada', 'Activa'].includes(reserva.estado);
        return {
            id: `MOV-3${String(reserva.id).replace('RES-', '').padStart(4, '0')}`,
            vehiculoId: reserva.carId,
            vehiculoNombre: reserva.autoNombre,
            marca: initialCars.find((c) => String(c.id) === String(reserva.carId))?.marca || '',
            imagen: reserva.autoImagen,
            accion: finalizada || confirmada ? MOVEMENT_ACTIONS.RENTED : MOVEMENT_ACTIONS.RESERVED,
            detalle: finalizada
                ? `Reserva ${reserva.id} finalizada`
                : `Solicitud de reserva ${reserva.id} (${reserva.fechaInicio} → ${reserva.fechaFin}) por ${reserva.clienteNombre || reserva.usuario}`,
            fecha: reserva.date,
            usuario: reserva.usuario,
            usuarioNombre: reserva.clienteNombre || reserva.usuario,
            estadoAnterior: null,
            estadoNuevo: reserva.estado,
            demo: true
        };
    });
}

function loadReservations() {
    const savedReservations = readStorage('santa_lucia_reservations', null);
    // Si no hay reservas guardadas (o muy pocas), usamos el historial DEMO de 3 meses.
    if (Array.isArray(savedReservations) && savedReservations.length >= 3) {
        // Migración: los datos antiguos sin bandera demo se identifican por su firma.
        return savedReservations.map((reservation) => ({
            ...reservation,
            demo: reservation.demo ?? isSeedReservationId(reservation.id)
        }));
    }
    return generateSeedReservations();
}

function loadVehicleMovements() {
    const saved = readStorage(HISTORY_KEY, null);
    if (Array.isArray(saved) && saved.length > 0) {
        // Soportamos el formato antiguo (vehicleId/action/details/date).
        const migrated = saved.map((movement) => ({
            ...movement,
            vehiculoId: movement.vehiculoId ?? movement.vehicleId,
            vehiculoNombre: movement.vehiculoNombre ?? movement.vehicleName,
            accion: movement.accion ?? movement.action,
            detalle: movement.detalle ?? movement.details,
            fecha: movement.fecha ?? movement.date,
            demo: movement.demo ?? isSeedMovementId(movement.id)
        }));

        // Migración: si el historial guardado aún no contiene movimientos
        // de reservas (reservado/alquilado), inyectamos los DEMO de las
        // reservas semilla para que aparezcan en el registro del admin.
        const tieneMovimientosReserva = migrated.some(
            (m) => m.accion === MOVEMENT_ACTIONS.RESERVED || m.accion === MOVEMENT_ACTIONS.RENTED
        );
        if (!tieneMovimientosReserva) {
            return [...generateSeedReservationMovements(), ...migrated]
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        }
        return migrated;
    }
    return generateSeedMovements();
}

function updateCarRentalStatus(cars, reservations, carId) {
    const hasActiveRental = reservations.some(
        (reservation) =>
            String(reservation.carId) === String(carId)
            && isReservationBlocking(reservation)
    );

    return cars.map((car) => {
        if (String(car.id) !== String(carId)) return car;
        if (hasActiveRental) {
            return { ...car, status: 'Alquilado', disponible: false };
        }
        if (car.status === 'En Mantenimiento') return { ...car, disponible: false };
        return { ...car, status: 'Disponible', disponible: true };
    });
}

function isReservationBlocking(reservation) {
    return !['Pendiente', 'Cancelada', 'Completada'].includes(reservation.estado);
}

export function AppProvider({ children }) {
    const [language, setLanguage] = useState(() => (
        localStorage.getItem('preferredLang') === 'en' ? 'en' : 'es'
    ));
    const [currentUser, setCurrentUser] = useState(loadCurrentUser);
    // El correo y el rol se DERIVAN de la sesión: no son estados editables.
    const userEmail = currentUser?.email || '';
    const role = currentUser ? (currentUser.role === 'admin' ? 'ADMIN' : 'USUARIO') : null;
    const [clients, setClients] = useState(() => {
        const savedClients = readStorage('usuarios_registrados', []);
        return Array.isArray(savedClients) ? savedClients : [];
    });
    const [cars, setCars] = useState(loadCars);
    const [rentals, setRentals] = useState(loadReservations);
    const [favorites, setFavorites] = useState(() => loadSavedVehicles(currentUser?.email));
    const [selectedBranch, setSelectedBranch] = useState(DEFAULT_BRANCH.id);
    const [userLocation, setUserLocation] = useState(null);
    const [maintenances, setMaintenances] = useState(() => {
        const savedMaintenance = readStorage('santa_lucia_maintenance', []);
        return Array.isArray(savedMaintenance) ? savedMaintenance : [];
    });
    // Historial de movimientos de la flota (altas, cambios, mantenimientos)
    const [vehicleMovements, setVehicleMovements] = useState(loadVehicleMovements);

    // Al montar, aseguramos que existan las cuentas de prueba con su rol fijo.
    useEffect(() => {
        ensureSeedUsers();
    }, []);

    // ========================================================
    // SINCRONIZACIÓN EN TIEMPO REAL ENTRE PESTAÑAS
    // --------------------------------------------------------
    // Si el admin agrega/edita un carro en una pestaña, el usuario
    // en otra pestaña lo verá reflejado. Escuchamos el evento
    // 'storage' de localStorage y recargamos los datos afectados.
    // (Dentro de la misma SPA el contexto ya mantiene todo sincronizado.)
    // ========================================================
    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === 'santa_lucia_cars') {
                setCars(loadCars());
            } else if (event.key === 'santa_lucia_reservations') {
                setRentals(loadReservations());
            } else if (event.key === 'santa_lucia_maintenance') {
                setMaintenances(readStorage('santa_lucia_maintenance', []));
            } else if (event.key === HISTORY_KEY) {
                setVehicleMovements(loadVehicleMovements());
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        localStorage.setItem('preferredLang', language);
    }, [language]);

    useEffect(() => {
        localStorage.setItem('santa_lucia_cars', JSON.stringify(cars));
        localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION);
    }, [cars]);

    useEffect(() => {
        localStorage.setItem('santa_lucia_reservations', JSON.stringify(rentals));
    }, [rentals]);

    useEffect(() => {
        localStorage.setItem('santa_lucia_maintenance', JSON.stringify(maintenances));
    }, [maintenances]);

    // Persistimos el historial de actividad de vehículos.
    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(vehicleMovements));
    }, [vehicleMovements]);

    useEffect(() => {
        localStorage.setItem('usuarios_registrados', JSON.stringify(clients));
    }, [clients]);

    useEffect(() => {
        if (!currentUser?.email) return;
        localStorage.setItem(getProfileStorageKey(currentUser.email), JSON.stringify(currentUser));
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?.email) return;
        localStorage.setItem(getSavedVehiclesKey(currentUser.email), JSON.stringify(favorites));
    }, [favorites, currentUser?.email]);

    // ========================================================
    // HISTORIAL DE ACTIVIDAD
    // --------------------------------------------------------
    // Cada operación real sobre un vehículo genera un registro.
    // El autor se toma de la sesión activa. Los registros reales
    // siempre llevan demo: false.
    // ========================================================
    const recordVehicleMovement = (movement) => {
        const entry = buildVehicleMovement(movement, {
            email: currentUser?.email,
            name: currentUser?.name
        });
        setVehicleMovements((previousMovements) => [entry, ...previousMovements]);
        return entry;
    };

    // Crea un vehículo. Si options.pendingPublication es true, el
    // vehículo entra como solicitud de un cliente (pendiente de revisión).
    const addCar = (newCar, options = {}) => {
        const pendingPublication = Boolean(options.pendingPublication);
        const status = newCar.status || 'Disponible';
        const car = normalizeCar({
            ...newCar,
            id: newCar.id ?? Date.now(),
            status,
            disponible: newCar.disponible ?? status === 'Disponible',
            publicado: pendingPublication ? false : (newCar.publicado ?? true),
            estadoPublicacion: pendingPublication ? 'Pendiente' : 'Publicado',
            fechaRegistro: new Date().toISOString(),
            creadoPor: currentUser?.email || 'sistema',
            vistas: newCar.vistas ?? 0,
            imagen: newCar.imagen || '/fotos/1.jpg'
        });
        setCars((previousCars) => [...previousCars, car]);
        recordVehicleMovement({
            vehiculoId: car.id,
            vehiculoNombre: car.nombre,
            marca: car.marca,
            imagen: car.imagen,
            accion: pendingPublication ? MOVEMENT_ACTIONS.PUBLICATION_REQUEST : MOVEMENT_ACTIONS.CREATE,
            detalle: pendingPublication
                ? `${car.nombre} enviado por ${currentUser?.name || 'un cliente'} y pendiente de revisión`
                : `${car.nombre} (${car.categoria}) se registró en la flota`,
            estadoNuevo: car.estadoPublicacion
        });
        return car;
    };

    // Registra los cambios aplicados a un vehículo en el historial.
    const logCarChanges = (previous, updated) => {
        let registered = false;
        if (Number(previous.precioDia) !== Number(updated.precioDia)) {
            registered = true;
            recordVehicleMovement({
                vehiculoId: updated.id,
                vehiculoNombre: updated.nombre,
                marca: updated.marca,
                imagen: updated.imagen,
                accion: MOVEMENT_ACTIONS.PRICE_CHANGE,
                detalle: `Precio por día: $${Number(previous.precioDia).toFixed(2)} → $${Number(updated.precioDia).toFixed(2)}`,
                estadoAnterior: previous.status,
                estadoNuevo: updated.status
            });
        }
        if ((previous.imagen || '') !== (updated.imagen || '')) {
            registered = true;
            recordVehicleMovement({
                vehiculoId: updated.id,
                vehiculoNombre: updated.nombre,
                marca: updated.marca,
                imagen: updated.imagen,
                accion: MOVEMENT_ACTIONS.IMAGE_UPDATE,
                detalle: 'Imagen del vehículo actualizada'
            });
        }
        if ((previous.status || '') !== (updated.status || '')) {
            registered = true;
            recordVehicleMovement({
                vehiculoId: updated.id,
                vehiculoNombre: updated.nombre,
                marca: updated.marca,
                imagen: updated.imagen,
                accion: MOVEMENT_ACTIONS.STATUS_CHANGE,
                detalle: `Disponibilidad: ${previous.status} → ${updated.status}`,
                estadoAnterior: previous.status,
                estadoNuevo: updated.status
            });
        }

        // Si no hubo cambios de precio/imagen/estado pero sí de otros datos,
        // dejamos constancia como "modificación de información".
        if (!registered) {
            const tracked = ['nombre', 'marca', 'modelo', 'anio', 'categoria', 'categoriaLabel',
                'transmision', 'combustible', 'descripcion', 'kilometraje', 'pasajeros', 'maletas'];
            const changed = tracked.some(
                (field) => String(previous[field] ?? '') !== String(updated[field] ?? '')
            );
            if (changed) {
                recordVehicleMovement({
                    vehiculoId: updated.id,
                    vehiculoNombre: updated.nombre,
                    marca: updated.marca,
                    imagen: updated.imagen,
                    accion: MOVEMENT_ACTIONS.UPDATE,
                    detalle: `Se actualizó la información de ${updated.nombre}`
                });
            }
        }
    };

    const updateCar = (id, updatedData) => {
        const previous = cars.find((car) => String(car.id) === String(id));
        if (!previous) return;
        const updated = { ...previous, ...updatedData };
        setCars((previousCars) => previousCars.map(
            (car) => (String(car.id) === String(id) ? updated : car)
        ));
        logCarChanges(previous, updated);
    };

    const deleteCar = (id) => {
        const removed = cars.find((car) => String(car.id) === String(id));
        setCars((previousCars) => previousCars.filter((car) => String(car.id) !== String(id)));
        setFavorites((previousFavorites) => previousFavorites.filter((favoriteId) => favoriteId !== String(id)));
        if (removed) {
            recordVehicleMovement({
                vehiculoId: removed.id,
                vehiculoNombre: removed.nombre,
                marca: removed.marca,
                imagen: removed.imagen,
                accion: MOVEMENT_ACTIONS.DELETE,
                detalle: `${removed.nombre} fue eliminado de la flota`,
                estadoAnterior: removed.status,
                estadoNuevo: 'Eliminado'
            });
        }
    };

    // Aprueba o rechaza la publicación de un vehículo enviado por un cliente.
    const setCarPublicationStatus = (id, estadoPublicacion) => {
        const accepted = estadoPublicacion === 'Publicado';
        const previous = cars.find((car) => String(car.id) === String(id));
        if (!previous) return;
        const updated = {
            ...previous,
            publicado: accepted,
            estadoPublicacion,
            disponible: accepted ? (previous.status === 'Disponible') : false
        };
        setCars((previousCars) => previousCars.map(
            (car) => (String(car.id) === String(id) ? updated : car)
        ));
        recordVehicleMovement({
            vehiculoId: updated.id,
            vehiculoNombre: updated.nombre,
            marca: updated.marca,
            imagen: updated.imagen,
            accion: accepted ? MOVEMENT_ACTIONS.PUBLISHED : MOVEMENT_ACTIONS.REJECTED,
            detalle: accepted
                ? `${updated.nombre} aprobado y visible en el catálogo público`
                : `${updated.nombre} rechazado; no aparecerá en el catálogo`,
            estadoAnterior: previous.estadoPublicacion,
            estadoNuevo: estadoPublicacion
        });
    };

    // Incrementa el contador de visitas de un vehículo (sin generar
    // registros de historial: es una métrica, no una edición).
    const registerCarView = (id) => {
        setCars((previousCars) => previousCars.map(
            (car) => (String(car.id) === String(id) ? { ...car, vistas: (Number(car.vistas) || 0) + 1 } : car)
        ));
    };

    const toggleFavorite = (id) => {
        const favoriteId = String(id);
        setFavorites((previousFavorites) => (
            previousFavorites.includes(favoriteId)
                ? previousFavorites.filter((savedId) => savedId !== favoriteId)
                : [...previousFavorites, favoriteId]
        ));
    };

    const updateReservationStatus = (id, newStatus) => {
        const updatedRentals = rentals.map(
            (rental) => (rental.id === id
                ? {
                    ...rental,
                    estado: newStatus
                }
                : rental)
        );
        const changedRental = rentals.find((rental) => rental.id === id);
        setRentals(updatedRentals);
        if (changedRental) {
            setCars((previousCars) => updateCarRentalStatus(previousCars, updatedRentals, changedRental.carId));

            // Cualquier cambio de estado de reserva se registra en el historial
            // (aprobación, rechazo, cancelación, activación o finalización)
            // para que el admin tenga trazabilidad completa de la operación.
            if (changedRental.estado !== newStatus) {
                const car = cars.find((item) => String(item.id) === String(changedRental.carId));
                const finalizada = newStatus === 'Completada';
                const confirmada = ['Aprobada', 'Activa'].includes(newStatus);
                recordVehicleMovement({
                    vehiculoId: changedRental.carId,
                    vehiculoNombre: changedRental.autoNombre || car?.nombre || 'Vehículo',
                    marca: car?.marca || '',
                    imagen: changedRental.autoImagen || car?.imagen || '',
                    accion: finalizada || confirmada ? MOVEMENT_ACTIONS.RENTED : MOVEMENT_ACTIONS.RESERVED,
                    detalle: `Reserva ${changedRental.id}: ${changedRental.estado} → ${newStatus}`,
                    estadoAnterior: changedRental.estado,
                    estadoNuevo: newStatus
                });
            }
        }
    };

    const rentCar = (newRental) => {
        const rental = {
            ...newRental,
            id: newRental.id || `RES-${Math.floor(1000 + Math.random() * 9000)}`,
            usuario: newRental.usuario || userEmail || DEFAULT_USER_EMAIL,
            estado: newRental.estado || 'Pendiente',
            date: new Date().toISOString(),
            demo: false
        };
        setRentals((previousRentals) => [...previousRentals, rental]);
        setCars((previousCars) => updateCarRentalStatus(previousCars, [...rentals, rental], rental.carId));

        const car = cars.find((item) => String(item.id) === String(rental.carId));
        recordVehicleMovement({
            vehiculoId: rental.carId,
            vehiculoNombre: rental.autoNombre || car?.nombre || 'Vehículo',
            marca: car?.marca || '',
            imagen: rental.autoImagen || car?.imagen || '',
            accion: MOVEMENT_ACTIONS.RESERVED,
            detalle: `Solicitud de reserva ${rental.id} (${rental.fechaInicio} → ${rental.fechaFin}) por ${rental.clienteNombre || rental.usuario}`,
            estadoNuevo: rental.estado
        });
        return rental;
    };

    const returnCar = (rentalId) => {
        const updatedRentals = rentals.map(
            (rental) => (rental.id === rentalId ? { ...rental, estado: 'Completada' } : rental)
        );
        const returnedRental = rentals.find((rental) => rental.id === rentalId);
        setRentals(updatedRentals);
        if (returnedRental) {
            setCars((previousCars) => updateCarRentalStatus(previousCars, updatedRentals, returnedRental.carId));
        }
    };

    const deleteReservation = (id) => {
        const remainingRentals = rentals.filter((rental) => rental.id !== id);
        const deletedRental = rentals.find((rental) => rental.id === id);
        setRentals(remainingRentals);
        if (deletedRental) {
            setCars((previousCars) => updateCarRentalStatus(previousCars, remainingRentals, deletedRental.carId));
        }
    };

    // Abre la sesión de un usuario ya autenticado.
    // El rol viene del propio usuario: no se puede forzar desde aquí.
    const login = (user) => {
        if (!user?.email) return;
        const nextUser = { ...user, email: user.email.toLowerCase().trim() };
        setCurrentUser(nextUser);
        setFavorites(loadSavedVehicles(nextUser.email));
        setSession(nextUser);
        setClients((previousClients) => {
            const existingIndex = previousClients.findIndex(
                (client) => client.email?.toLowerCase() === nextUser.email.toLowerCase()
            );
            if (existingIndex < 0) return [...previousClients, nextUser];
            return previousClients.map((client, index) => (index === existingIndex ? { ...client, ...nextUser } : client));
        });
    };

    // Cierra la sesión por completo (correo y rol dejan de existir).
    const logout = () => {
        clearSession();
        setCurrentUser(null);
        setFavorites([]);
    };

    const updateCurrentUser = (updatedData) => {
        if (!currentUser) return;
        const updatedUser = { ...currentUser, ...updatedData };
        setCurrentUser(updatedUser);
        setClients((previousClients) => previousClients.map(
            (client) => (client.email?.toLowerCase() === currentUser.email.toLowerCase()
                ? { ...client, ...updatedData }
                : client)
        ));
    };

    const createMaintenance = (maintenanceData) => {
        const newMaintenance = {
            ...maintenanceData,
            id: `MNT-${Date.now()}`,
            estado: 'En curso'
        };
        setMaintenances((previousMaintenances) => [...previousMaintenances, newMaintenance]);
        setCars((previousCars) => previousCars.map((car) => (
            String(car.id) === String(maintenanceData.vehicleId)
                ? { ...car, status: 'En Mantenimiento', disponible: false }
                : car
        )));
        const car = cars.find((item) => String(item.id) === String(maintenanceData.vehicleId));
        recordVehicleMovement({
            vehiculoId: maintenanceData.vehicleId,
            vehiculoNombre: car?.nombre || 'Vehículo',
            marca: car?.marca || '',
            imagen: car?.imagen || '',
            accion: MOVEMENT_ACTIONS.MAINTENANCE,
            detalle: `${maintenanceData.tipo || 'Mantenimiento'} registrado (${newMaintenance.id})`,
            estadoAnterior: car?.status || null,
            estadoNuevo: 'En Mantenimiento'
        });
    };

    const completeMaintenance = (maintenanceId) => {
        const maintenance = maintenances.find((item) => item.id === maintenanceId);
        if (maintenance) {
            setCars((previousCars) => previousCars.map((car) => (
                String(car.id) === String(maintenance.vehicleId)
                    ? { ...car, status: 'Disponible', disponible: true }
                    : car
            )));
            const car = cars.find((item) => String(item.id) === String(maintenance.vehicleId));
            recordVehicleMovement({
                vehiculoId: maintenance.vehicleId,
                vehiculoNombre: car?.nombre || 'Vehículo',
                marca: car?.marca || '',
                imagen: car?.imagen || '',
                accion: MOVEMENT_ACTIONS.MAINTENANCE,
                detalle: `Mantenimiento ${maintenanceId} finalizado`,
                estadoAnterior: 'En Mantenimiento',
                estadoNuevo: 'Disponible'
            });
        }
        setMaintenances((previousMaintenances) => previousMaintenances.map((item) => (
            item.id === maintenanceId
                ? { ...item, estado: 'Finalizado', fechaFinalizacion: new Date().toLocaleDateString() }
                : item
        )));
    };

    const value = {
        language,
        setLanguage,
        role,
        isAuthenticated: Boolean(currentUser),
        userEmail,
        currentUser,
        clients,
        login,
        logout,
        updateCurrentUser,
        cars,
        addCar,
        updateCar,
        deleteCar,
        setCarPublicationStatus,
        registerCarView,
        favorites,
        toggleFavorite,
        selectedBranch,
        setSelectedBranch,
        userLocation,
        setUserLocation,
        rentals,
        reservations: rentals,
        rentCar,
        returnCar,
        addReservation: rentCar,
        updateReservationStatus,
        deleteReservation,
        maintenances,
        createMaintenance,
        completeMaintenance,
        vehicleMovements
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
