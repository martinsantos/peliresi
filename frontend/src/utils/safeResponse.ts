/**
 * Utilidades para manejo seguro de respuestas de API
 * Previene errores de runtime por estructuras undefined
 */

/**
 * Garantiza que el valor sea un array
 */
export function safeArray<T>(data: T[] | undefined | null): T[] {
    return Array.isArray(data) ? data : [];
}

/**
 * Garantiza que el valor sea un objeto con valor por defecto
 */
export function safeObject<T extends object>(data: T | undefined | null, defaultValue: T): T {
    return data ?? defaultValue;
}

/**
 * Extrae datos de respuestas API con estructura variable
 * Maneja: { data: { data: T } } o { data: T } o T
 */
export function extractResponse<T>(response: any): T | undefined {
    if (!response) return undefined;

    // Estructura: { data: { data: T } }
    if (response.data?.data !== undefined) {
        return response.data.data as T;
    }

    // Estructura: { data: T }
    if (response.data !== undefined) {
        return response.data as T;
    }

    // Estructura directa: T
    return response as T;
}

/**
 * Extrae datos de respuesta con fallback
 */
export function extractResponseWithDefault<T>(response: any, defaultValue: T): T {
    const extracted = extractResponse<T>(response);
    return extracted ?? defaultValue;
}

/**
 * Wrapper para llamadas de API con try/catch y fallback
 */
export async function safeApiCall<T>(
    apiCall: () => Promise<T>,
    defaultValue: T,
    errorMessage?: string
): Promise<T> {
    try {
        const result = await apiCall();
        return result ?? defaultValue;
    } catch (error) {
        if (errorMessage) {
            console.error(errorMessage, error);
        }
        return defaultValue;
    }
}

/**
 * Valores por defecto para estructuras comunes
 */
export const defaults = {
    pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 1
    },
    emptyList: [],
    emptyStats: {
        total: 0,
        activos: 0,
        inactivos: 0,
        porRol: {} as Record<string, number>
    },
    emptyResponse: {
        success: false,
        data: null,
        error: 'Error de conexión'
    }
};

/**
 * Type guard para verificar si un valor es un array no vacío
 */
export function isNonEmptyArray<T>(value: T[] | undefined | null): value is T[] {
    return Array.isArray(value) && value.length > 0;
}

/**
 * Acceso seguro a propiedades anidadas
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }

    return (result ?? defaultValue) as T;
}
