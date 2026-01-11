/**
 * AppContext - FASE 3
 * Context para estado global de la app
 * Maneja: usuario, rol, conectividad, navegacion
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useConnectivity } from '../hooks/useConnectivity';
import type { UserRole, Screen } from '../types/mobile.types';

interface AppContextValue {
    // Usuario y rol
    role: UserRole | null;
    setRole: (role: UserRole | null) => void;
    roleName: string;

    // Navegacion
    currentScreen: Screen;
    setCurrentScreen: (screen: Screen) => void;
    goBack: () => void;

    // Conectividad
    isOnline: boolean;
    syncPending: boolean;

    // UI State
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    toggleMenu: () => void;

    // Toast
    showToast: (message: string) => void;
    toastMessage: string;
    toastVisible: boolean;

    // Actions
    handleChangeRole: () => void;
}

const ROLE_NAMES: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    GENERADOR: 'Generador',
    TRANSPORTISTA: 'Transportista',
    OPERADOR: 'Operador'
};

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
    children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    // Role management
    const getSavedRole = (): UserRole | null => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sitrep_mobile_role');
            if (saved && ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(saved)) {
                return saved as UserRole;
            }
        }
        return null;
    };

    const [role, setRoleState] = useState<UserRole | null>(getSavedRole);
    const [currentScreen, setCurrentScreen] = useState<Screen>('home');
    const [menuOpen, setMenuOpen] = useState(false);
    const [screenHistory, setScreenHistory] = useState<Screen[]>([]);

    // Toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Conectividad
    const { isOnline, syncPending } = useConnectivity();

    // Guardar rol en localStorage
    const setRole = useCallback((newRole: UserRole | null) => {
        setRoleState(newRole);
        if (newRole) {
            localStorage.setItem('sitrep_mobile_role', newRole);
        } else {
            localStorage.removeItem('sitrep_mobile_role');
        }
    }, []);

    // Navegacion con historial
    const navigateTo = useCallback((screen: Screen) => {
        setScreenHistory(prev => [...prev, currentScreen]);
        setCurrentScreen(screen);
    }, [currentScreen]);

    const goBack = useCallback(() => {
        if (screenHistory.length > 0) {
            const prevScreen = screenHistory[screenHistory.length - 1];
            setScreenHistory(prev => prev.slice(0, -1));
            setCurrentScreen(prevScreen);
        } else {
            setCurrentScreen('home');
        }
    }, [screenHistory]);

    // Toast
    const showToast = useCallback((message: string) => {
        setToastMessage(message);
        setToastVisible(true);
        setTimeout(() => setToastVisible(false), 3000);
    }, []);

    // Menu
    const toggleMenu = useCallback(() => {
        setMenuOpen(prev => !prev);
    }, []);

    // Cambiar rol
    const handleChangeRole = useCallback(() => {
        setRole(null);
        setCurrentScreen('home');
        setMenuOpen(false);
        setScreenHistory([]);
    }, [setRole]);

    const value: AppContextValue = {
        role,
        setRole,
        roleName: role ? ROLE_NAMES[role] : 'Usuario',
        currentScreen,
        setCurrentScreen: navigateTo,
        goBack,
        isOnline,
        syncPending,
        menuOpen,
        setMenuOpen,
        toggleMenu,
        showToast,
        toastMessage,
        toastVisible,
        handleChangeRole
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = (): AppContextValue => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

export default AppContext;
