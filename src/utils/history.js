// ========================================================
// history.js — Historial de actividad de vehículos
// --------------------------------------------------------
// Define el vocabulario de acciones del historial, sus
// etiquetas legibles y utilidades para construir, filtrar y
// separar los registros REALES de los de DEMOSTRACIÓN.
//
// Regla del sistema: los registros DEMO nunca se mezclan con
// los reales ni afectan a las estadísticas oficiales.
// ========================================================

export const HISTORY_KEY = 'santa_lucia_vehicle_movements';

// Ventana del historial pedida por el negocio (3 meses).
export const HISTORY_MONTHS = 3;

// Catálogo de acciones posibles en el historial de vehículos.
export const MOVEMENT_ACTIONS = {
    CREATE: 'create',
    PUBLICATION_REQUEST: 'publication_request',
    UPDATE: 'update',
    PRICE_CHANGE: 'price_change',
    STATUS_CHANGE: 'status_change',
    IMAGE_UPDATE: 'image_update',
    PUBLISHED: 'published',
    REJECTED: 'rejected',
    RESERVED: 'reserved',
    RENTED: 'rented',
    MAINTENANCE: 'maintenance',
    DELETE: 'delete'
};

// Metadatos por acción: etiqueta visible y tono de color del badge.
export const MOVEMENT_META = {
    [MOVEMENT_ACTIONS.CREATE]: { label: 'Vehículo registrado', tone: 'is-ok' },
    [MOVEMENT_ACTIONS.PUBLICATION_REQUEST]: { label: 'Solicitud de publicación', tone: 'is-warning' },
    [MOVEMENT_ACTIONS.UPDATE]: { label: 'Información actualizada', tone: 'is-info' },
    [MOVEMENT_ACTIONS.PRICE_CHANGE]: { label: 'Cambio de precio', tone: 'is-info' },
    [MOVEMENT_ACTIONS.STATUS_CHANGE]: { label: 'Cambio de disponibilidad', tone: 'is-warning' },
    [MOVEMENT_ACTIONS.IMAGE_UPDATE]: { label: 'Imagen actualizada', tone: 'is-info' },
    [MOVEMENT_ACTIONS.PUBLISHED]: { label: 'Vehículo publicado', tone: 'is-ok' },
    [MOVEMENT_ACTIONS.REJECTED]: { label: 'Publicación rechazada', tone: 'is-danger' },
    [MOVEMENT_ACTIONS.RESERVED]: { label: 'Vehículo reservado', tone: 'is-warning' },
    [MOVEMENT_ACTIONS.RENTED]: { label: 'Alquiler confirmado', tone: 'is-ok' },
    [MOVEMENT_ACTIONS.MAINTENANCE]: { label: 'Mantenimiento', tone: 'is-warning' },
    [MOVEMENT_ACTIONS.DELETE]: { label: 'Vehículo eliminado', tone: 'is-danger' }
};

export function getMovementMeta(action) {
    return MOVEMENT_META[action] || { label: 'Actividad', tone: 'is-neutral' };
}

// Construye un registro de historial real (demo = false).
export function buildVehicleMovement(partial, author = {}) {
    return {
        id: `MOV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        fecha: new Date().toISOString(),
        usuario: author.email || 'sistema',
        usuarioNombre: author.name || 'Sistema',
        estadoAnterior: null,
        estadoNuevo: null,
        demo: false,
        ...partial
    };
}

// ¿La fecha ISO cae dentro de los últimos N meses?
export function isWithinLastMonths(isoDate, months = HISTORY_MONTHS) {
    const time = new Date(isoDate || '').getTime();
    if (Number.isNaN(time)) return false;
    const limit = new Date();
    limit.setMonth(limit.getMonth() - months);
    return time >= limit.getTime();
}

// Devuelve los movimientos de los últimos N meses ordenados (recientes primero).
export function getRecentMovements(movements = [], months = HISTORY_MONTHS) {
    return movements
        .filter((movement) => isWithinLastMonths(movement.fecha, months))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}
