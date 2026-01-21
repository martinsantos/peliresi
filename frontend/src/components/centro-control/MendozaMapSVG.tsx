/**
 * MendozaMapSVG - Schematic SVG map of Mendoza departments
 */

import React from 'react';
import type { DepartamentoStats } from './types';

interface MendozaMapSVGProps {
    departamentos: DepartamentoStats[];
    selectedDept: string | null;
    onSelect: (codigo: string) => void;
}

export const MendozaMapSVG: React.FC<MendozaMapSVGProps> = ({ departamentos, selectedDept, onSelect }) => {
    const getDeptByCode = (code: string) => departamentos.find(d => d.codigo === code);

    return (
        <svg viewBox="0 0 200 300" className="mendoza-map-svg">
            {/* Malargüe - Sur */}
            <path d="M20 220 L80 200 L100 280 L30 290 Z"
                className={`dept-path ${selectedDept === 'MG' ? 'selected' : ''}`}
                fill={getDeptByCode('MG')?.color || '#374151'}
                onClick={() => onSelect('MG')}
            />
            <text x="55" y="250" className="dept-label">MG</text>

            {/* San Rafael */}
            <path d="M80 140 L140 130 L150 200 L80 200 Z"
                className={`dept-path ${selectedDept === 'SR' ? 'selected' : ''}`}
                fill={getDeptByCode('SR')?.color || '#374151'}
                onClick={() => onSelect('SR')}
            />
            <text x="110" y="170" className="dept-label">SR</text>

            {/* General Alvear */}
            <path d="M140 130 L180 140 L180 200 L150 200 Z"
                className={`dept-path ${selectedDept === 'GA' ? 'selected' : ''}`}
                fill={getDeptByCode('GA')?.color || '#374151'}
                onClick={() => onSelect('GA')}
            />
            <text x="160" y="170" className="dept-label">GA</text>

            {/* San Carlos */}
            <path d="M60 100 L90 95 L90 130 L60 140 Z"
                className={`dept-path ${selectedDept === 'SC' ? 'selected' : ''}`}
                fill={getDeptByCode('SC')?.color || '#374151'}
                onClick={() => onSelect('SC')}
            />
            <text x="72" y="118" className="dept-label">SC</text>

            {/* Tunuyán */}
            <path d="M40 70 L70 65 L70 100 L40 100 Z"
                className={`dept-path ${selectedDept === 'TN' ? 'selected' : ''}`}
                fill={getDeptByCode('TN')?.color || '#374151'}
                onClick={() => onSelect('TN')}
            />
            <text x="52" y="85" className="dept-label">TN</text>

            {/* Tupungato */}
            <path d="M20 50 L50 45 L50 75 L20 80 Z"
                className={`dept-path ${selectedDept === 'TP' ? 'selected' : ''}`}
                fill={getDeptByCode('TP')?.color || '#374151'}
                onClick={() => onSelect('TP')}
            />
            <text x="32" y="65" className="dept-label">TP</text>

            {/* Luján de Cuyo */}
            <path d="M50 40 L80 35 L85 65 L55 70 Z"
                className={`dept-path ${selectedDept === 'LJ' ? 'selected' : ''}`}
                fill={getDeptByCode('LJ')?.color || '#374151'}
                onClick={() => onSelect('LJ')}
            />
            <text x="65" y="52" className="dept-label">LJ</text>

            {/* Maipú */}
            <path d="M80 30 L110 28 L115 55 L85 60 Z"
                className={`dept-path ${selectedDept === 'MP' ? 'selected' : ''}`}
                fill={getDeptByCode('MP')?.color || '#374151'}
                onClick={() => onSelect('MP')}
            />
            <text x="95" y="45" className="dept-label">MP</text>

            {/* Godoy Cruz */}
            <path d="M85 15 L105 12 L108 35 L88 38 Z"
                className={`dept-path ${selectedDept === 'GC' ? 'selected' : ''}`}
                fill={getDeptByCode('GC')?.color || '#374151'}
                onClick={() => onSelect('GC')}
            />
            <text x="94" y="26" className="dept-label">GC</text>

            {/* Ciudad */}
            <path d="M95 5 L115 3 L118 25 L98 28 Z"
                className={`dept-path ${selectedDept === 'CD' ? 'selected' : ''}`}
                fill={getDeptByCode('CD')?.color || '#374151'}
                onClick={() => onSelect('CD')}
            />
            <text x="105" y="16" className="dept-label">CD</text>

            {/* Guaymallén */}
            <path d="M110 5 L135 8 L138 40 L112 35 Z"
                className={`dept-path ${selectedDept === 'GY' ? 'selected' : ''}`}
                fill={getDeptByCode('GY')?.color || '#374151'}
                onClick={() => onSelect('GY')}
            />
            <text x="122" y="24" className="dept-label">GY</text>

            {/* Las Heras */}
            <path d="M70 5 L100 2 L100 20 L72 22 Z"
                className={`dept-path ${selectedDept === 'LH' ? 'selected' : ''}`}
                fill={getDeptByCode('LH')?.color || '#374151'}
                onClick={() => onSelect('LH')}
            />
            <text x="82" y="14" className="dept-label">LH</text>

            {/* Lavalle */}
            <path d="M130 5 L170 10 L175 60 L135 50 Z"
                className={`dept-path ${selectedDept === 'LV' ? 'selected' : ''}`}
                fill={getDeptByCode('LV')?.color || '#374151'}
                onClick={() => onSelect('LV')}
            />
            <text x="150" y="35" className="dept-label">LV</text>

            {/* San Martín */}
            <path d="M115 50 L150 45 L155 90 L120 95 Z"
                className={`dept-path ${selectedDept === 'SM' ? 'selected' : ''}`}
                fill={getDeptByCode('SM')?.color || '#374151'}
                onClick={() => onSelect('SM')}
            />
            <text x="132" y="72" className="dept-label">SM</text>

            {/* Rivadavia */}
            <path d="M150 45 L180 50 L185 95 L155 90 Z"
                className={`dept-path ${selectedDept === 'RV' ? 'selected' : ''}`}
                fill={getDeptByCode('RV')?.color || '#374151'}
                onClick={() => onSelect('RV')}
            />
            <text x="165" y="72" className="dept-label">RV</text>

            {/* Junín */}
            <path d="M120 90 L150 85 L155 120 L125 125 Z"
                className={`dept-path ${selectedDept === 'JN' ? 'selected' : ''}`}
                fill={getDeptByCode('JN')?.color || '#374151'}
                onClick={() => onSelect('JN')}
            />
            <text x="135" y="105" className="dept-label">JN</text>

            {/* Santa Rosa */}
            <path d="M150 85 L185 90 L190 130 L155 120 Z"
                className={`dept-path ${selectedDept === 'SRo' ? 'selected' : ''}`}
                fill={getDeptByCode('SRo')?.color || '#374151'}
                onClick={() => onSelect('SRo')}
            />
            <text x="168" y="108" className="dept-label">SRo</text>

            {/* La Paz */}
            <path d="M155 120 L190 125 L195 170 L160 160 Z"
                className={`dept-path ${selectedDept === 'LP' ? 'selected' : ''}`}
                fill={getDeptByCode('LP')?.color || '#374151'}
                onClick={() => onSelect('LP')}
            />
            <text x="172" y="145" className="dept-label">LP</text>
        </svg>
    );
};

export default MendozaMapSVG;
