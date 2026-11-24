// ========================================================
// auth.js — Autenticación y sesión (lado React)
// --------------------------------------------------------
// Centraliza TODO lo relacionado con el inicio de sesión y el rol.
// El rol NUNCA se elige desde la interfaz: se obtiene del usuario
// registrado en localStorage ('usuarios_registrados') que coincide
// con la sesión activa ('usuario').
// ========================================================

export const USERS_KEY = 'usuarios_registrados';
export const SESSION_KEY = 'usuario';
export const SESSION_OBJECT_KEY = 'santa_lucia_session';

// Cuentas de prueba. El rol va "pegado" a las credenciales.
export const TEST_USERS = [
    {
        email: 'admin@santalucia.com',
        password: 'admin123',
        name: 'Administrador Santa Lucía',
        phone: '+34 900 123 456',
        role: 'admin',
        avatar: ''
    },
    {
        email: 'usuario@santalucia.com',
        password: 'user123',
        name: 'Carlos Mendoza',
        phone: '+34 612 345 678',
        role: 'usuario',
        avatar: ''
    }
];

// Normaliza cualquier rol heredado a los dos valores válidos del sistema.
export function normalizeRole(role) {
    return String(role || '').toLowerCase() === 'admin' ? 'admin' : 'usuario';
}

// Lee la lista de usuarios registrados (con tolerancia a datos corruptos).
export function getRegisteredUsers() {
    try {
        const raw = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
}

// Garantiza que las cuentas de prueba existan y unifica roles antiguos.
// Devuelve la lista final lista para usar.
export function ensureSeedUsers() {
    const users = getRegisteredUsers();
    let changed = false;

    // Migración: 'cliente' -> 'usuario'
    users.forEach((user) => {
        if (user.role === 'cliente') {
            user.role = 'usuario';
            changed = true;
        }
    });

    // Alta de cuentas semilla que falten (sin duplicar por email)
    TEST_USERS.forEach((seed) => {
        const exists = users.some(
            (user) => (user.email || '').toLowerCase().trim() === seed.email
        );
        if (!exists) {
            users.push({ ...seed });
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
}

// Busca un usuario registrado por correo.
export function findUserByEmail(email) {
    if (!email) return null;
    const normalized = email.toLowerCase().trim();
    return getRegisteredUsers().find(
        (user) => (user.email || '').toLowerCase().trim() === normalized
    ) || null;
}

// Valida credenciales y, si son correctas, abre la sesión.
// Devuelve { ok, user?, message? }.
export function authenticate(email, password) {
    const emailNorm = String(email || '').toLowerCase().trim();
    if (!emailNorm) {
        return { ok: false, message: 'Ingresa tu correo electrónico.' };
    }

    const user = findUserByEmail(emailNorm);
    if (!user) {
        return { ok: false, message: 'Este correo no está registrado en el sistema.' };
    }
    if (user.password !== password) {
        return { ok: false, message: 'Contraseña incorrecta. Verifica tus credenciales.' };
    }

    const sessionUser = { ...user, role: normalizeRole(user.role) };
    setSession(sessionUser);
    return { ok: true, user: sessionUser };
}

// Guarda la sesión (correo + copia con nombre y rol) en localStorage.
export function setSession(user) {
    if (!user?.email) return;
    const email = user.email.toLowerCase().trim();
    localStorage.setItem(SESSION_KEY, email);
    localStorage.setItem(SESSION_OBJECT_KEY, JSON.stringify({
        email,
        name: user.name || email.split('@')[0],
        role: normalizeRole(user.role)
    }));
}

// Devuelve la sesión activa como { email, name, role } o null si no hay.
export function getSession() {
    const email = localStorage.getItem(SESSION_KEY);
    const sessionCopy = readSessionCopy();

    // Fallback: si hay copia pero se perdió el correo base, se recupera de ella.
    if (!email && !sessionCopy) return null;

    const baseEmail = (email || sessionCopy.email || '').toLowerCase().trim();
    const registered = findUserByEmail(baseEmail) || {};

    return {
        email: baseEmail,
        name: registered.name || sessionCopy.name || baseEmail.split('@')[0],
        role: normalizeRole(registered.role || sessionCopy.role)
    };
}

function readSessionCopy() {
    try {
        const raw = JSON.parse(localStorage.getItem(SESSION_OBJECT_KEY) || '{}');
        return raw && raw.email ? raw : null;
    } catch {
        return null;
    }
}

// Cierra la sesión eliminando todas las marcas de sesión.
export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_OBJECT_KEY);
    sessionStorage.removeItem(SESSION_KEY);
}

// Atajos útiles para los componentes.
export function isAdminSession() {
    return getSession()?.role === 'admin';
}

// Ruta (pestaña del SPA) a la que debe ir cada rol tras iniciar sesión.
export function homeRouteForRole(role) {
    return normalizeRole(role) === 'admin' ? '/?tab=admin-dashboard' : '/?tab=home';
}
