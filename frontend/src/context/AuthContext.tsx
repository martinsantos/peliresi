import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Usuario } from '../types';
import { authService } from '../services/auth.service';
import { demoService, type DemoProfile } from '../services/demo.service';

// Helper para obtener label de rol
const getRolLabel = (rol: string | undefined): string => {
    switch (rol) {
        case 'ADMIN': return 'Administrador SITREP';
        case 'ADMIN_TRANSPORTISTAS': return 'Admin Transportistas';
        case 'ADMIN_OPERADORES': return 'Admin Operadores';
        case 'ADMIN_GENERADORES': return 'Admin Generadores';
        case 'GENERADOR': return 'Generador de Residuos';
        case 'TRANSPORTISTA': return 'Transportista';
        case 'OPERADOR': return 'Operador de Tratamiento';
        default: return rol || '';
    }
};

interface AuthContextType {
    user: Usuario | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
    // Demo profile support
    demoProfile: DemoProfile | null;
    effectiveRole: string | undefined;
    effectiveRoleName: string | undefined;
    effectiveUserName: string | undefined;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);

    // Demo profile state - lectura inicial solo una vez
    const [demoProfile, setDemoProfile] = useState<DemoProfile | null>(() => {
        try {
            return demoService.getActiveProfile();
        } catch {
            return null;
        }
    });

    useEffect(() => {
        // Verificar si hay un usuario guardado al cargar
        const storedUser = authService.getStoredUser();
        if (storedUser && authService.isAuthenticated()) {
            setUser(storedUser);
        }
        setLoading(false);
    }, []);

    // Escuchar cambios de perfil demo (evento disparado por demoService)
    useEffect(() => {
        const handleProfileChange = (event: Event) => {
            const customEvent = event as CustomEvent<DemoProfile | null>;
            setDemoProfile(customEvent.detail ?? null);
        };

        window.addEventListener('demoProfileChanged', handleProfileChange);
        return () => {
            window.removeEventListener('demoProfileChanged', handleProfileChange);
        };
    }, []);

    // Calcular rol efectivo con useMemo para estabilidad
    const effectiveRole = useMemo(() => {
        return demoProfile?.role ?? user?.rol;
    }, [demoProfile?.role, user?.rol]);

    const effectiveRoleName = useMemo(() => {
        return demoProfile?.roleName ?? getRolLabel(user?.rol);
    }, [demoProfile?.roleName, user?.rol]);

    // Nombre efectivo: usa el nombre del actor demo si está activo
    const effectiveUserName = useMemo(() => {
        if (demoProfile?.actorName) return demoProfile.actorName;
        const fullName = `${user?.nombre || ''} ${user?.apellido || ''}`.trim();
        return fullName || user?.nombre;
    }, [demoProfile?.actorName, user?.nombre, user?.apellido]);

    // Estabilizar funciones con useCallback
    const login = useCallback(async (email: string, password: string) => {
        const response = await authService.login(email, password);
        setUser(response.user);
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(null);
        // Limpiar demo profile al logout
        demoService.clearProfile();
    }, []);

    // Memorizar el valor del context para evitar re-renders innecesarios
    const contextValue = useMemo<AuthContextType>(() => ({
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        demoProfile,
        effectiveRole,
        effectiveRoleName,
        effectiveUserName,
    }), [user, loading, login, logout, demoProfile, effectiveRole, effectiveRoleName, effectiveUserName]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
};
