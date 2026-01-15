/**
 * NeonChart - Premium Chart Components with Neon Effects
 * Control Room 2077 Design System
 *
 * Wrapper components for recharts with cyberpunk styling
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import './NeonChart.css';

// ============================================
// TYPES
// ============================================

export type ChartVariant = 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'blue';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface NeonAreaChartProps {
  data: ChartDataPoint[];
  dataKey?: string;
  variant?: ChartVariant;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  gradientIntensity?: 'low' | 'medium' | 'high';
  animate?: boolean;
  title?: string;
  subtitle?: string;
}

export interface NeonBarChartProps {
  data: ChartDataPoint[];
  dataKey?: string;
  variant?: ChartVariant;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
  horizontal?: boolean;
  title?: string;
  subtitle?: string;
  barColors?: string[];
}

export interface NeonPieChartProps {
  data: ChartDataPoint[];
  variant?: ChartVariant;
  height?: number;
  showTooltip?: boolean;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  title?: string;
  subtitle?: string;
  colors?: string[];
}

// ============================================
// COLOR CONFIGURATIONS
// ============================================

const variantColors: Record<ChartVariant, { main: string; glow: string; gradient: [string, string] }> = {
  cyan: {
    main: '#00fff2',
    glow: 'rgba(0, 255, 242, 0.6)',
    gradient: ['rgba(0, 255, 242, 0.4)', 'rgba(0, 255, 242, 0)'],
  },
  green: {
    main: '#22ff66',
    glow: 'rgba(34, 255, 102, 0.6)',
    gradient: ['rgba(34, 255, 102, 0.4)', 'rgba(34, 255, 102, 0)'],
  },
  amber: {
    main: '#ffb800',
    glow: 'rgba(255, 184, 0, 0.6)',
    gradient: ['rgba(255, 184, 0, 0.4)', 'rgba(255, 184, 0, 0)'],
  },
  red: {
    main: '#ff3366',
    glow: 'rgba(255, 51, 102, 0.6)',
    gradient: ['rgba(255, 51, 102, 0.4)', 'rgba(255, 51, 102, 0)'],
  },
  purple: {
    main: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.6)',
    gradient: ['rgba(168, 85, 247, 0.4)', 'rgba(168, 85, 247, 0)'],
  },
  blue: {
    main: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.6)',
    gradient: ['rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0)'],
  },
};

const pieColors = [
  '#00fff2', // cyan
  '#22ff66', // green
  '#ffb800', // amber
  '#a855f7', // purple
  '#3b82f6', // blue
  '#ff3366', // red
];

// ============================================
// CUSTOM TOOLTIP
// ============================================

interface NeonTooltipProps {
  active?: boolean;
  payload?: Array<{
    value?: number;
    name?: string;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  variant: ChartVariant;
}

const CustomTooltip: React.FC<NeonTooltipProps> = ({ active, payload, label, variant }) => {
  if (!active || !payload || !payload.length) return null;

  const color = variantColors[variant].main;

  return (
    <div className="neon-chart-tooltip" style={{ borderColor: color }}>
      <p className="neon-chart-tooltip__label">{label}</p>
      {payload.map((entry, index: number) => (
        <p
          key={index}
          className="neon-chart-tooltip__value"
          style={{ color: entry.color || color }}
        >
          {entry.name}: <strong>{entry.value?.toLocaleString('es-AR')}</strong>
        </p>
      ))}
    </div>
  );
};

// ============================================
// NEON AREA CHART
// ============================================

export const NeonAreaChart: React.FC<NeonAreaChartProps> = ({
  data,
  dataKey = 'value',
  variant = 'cyan',
  height = 200,
  showGrid = true,
  showTooltip = true,
  gradientIntensity = 'medium',
  animate = true,
  title,
  subtitle,
}) => {
  const colors = variantColors[variant];
  const gradientId = `gradient-${variant}-${Math.random().toString(36).substr(2, 9)}`;

  const intensityOpacity = {
    low: { start: 0.2, end: 0 },
    medium: { start: 0.4, end: 0 },
    high: { start: 0.6, end: 0.1 },
  };

  return (
    <motion.div
      className="neon-chart-container"
      initial={animate ? { opacity: 0, y: 20 } : undefined}
      animate={animate ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5 }}
    >
      {(title || subtitle) && (
        <div className="neon-chart-header">
          {title && <h4 className="neon-chart-title">{title}</h4>}
          {subtitle && <p className="neon-chart-subtitle">{subtitle}</p>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={colors.main}
                stopOpacity={intensityOpacity[gradientIntensity].start}
              />
              <stop
                offset="95%"
                stopColor={colors.main}
                stopOpacity={intensityOpacity[gradientIntensity].end}
              />
            </linearGradient>
            <filter id={`glow-${gradientId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={colors.main} floodOpacity="0.5" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={false}
            />
          )}
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 11 }}
          />
          {showTooltip && (
            <Tooltip content={<CustomTooltip variant={variant} />} />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={colors.main}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            filter={`url(#glow-${gradientId})`}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// ============================================
// NEON BAR CHART
// ============================================

export const NeonBarChart: React.FC<NeonBarChartProps> = ({
  data,
  dataKey = 'value',
  variant = 'cyan',
  height = 200,
  showGrid = true,
  showTooltip = true,
  horizontal = false,
  title,
  subtitle,
  barColors,
}) => {
  const colors = variantColors[variant];
  const gradientId = `bar-gradient-${Math.random().toString(36).substr(2, 9)}`;

  const CustomBar = (props: any) => {
    const { x, y, width, height, index } = props;
    const color = barColors ? barColors[index % barColors.length] : colors.main;

    return (
      <g>
        <defs>
          <linearGradient id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={`url(#${gradientId}-${index})`}
          rx={4}
          ry={4}
          style={{
            filter: `drop-shadow(0 0 6px ${color}80)`,
          }}
        />
      </g>
    );
  };

  return (
    <motion.div
      className="neon-chart-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {(title || subtitle) && (
        <div className="neon-chart-header">
          {title && <h4 className="neon-chart-title">{title}</h4>}
          {subtitle && <p className="neon-chart-subtitle">{subtitle}</p>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={!horizontal}
              horizontal={horizontal}
            />
          )}
          {horizontal ? (
            <>
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
            </>
          )}
          {showTooltip && (
            <Tooltip content={<CustomTooltip variant={variant} />} />
          )}
          <Bar
            dataKey={dataKey}
            shape={<CustomBar />}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// ============================================
// NEON PIE CHART
// ============================================

export const NeonPieChart: React.FC<NeonPieChartProps> = ({
  data,
  height = 200,
  showTooltip = true,
  showLegend = true,
  innerRadius = 0,
  outerRadius = 70,
  title,
  subtitle,
  colors = pieColors,
}) => {
  return (
    <motion.div
      className="neon-chart-container"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {(title || subtitle) && (
        <div className="neon-chart-header">
          {title && <h4 className="neon-chart-title">{title}</h4>}
          {subtitle && <p className="neon-chart-subtitle">{subtitle}</p>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          {showTooltip && (
            <Tooltip content={<CustomTooltip variant="cyan" />} />
          )}
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => (
                <span style={{ color: '#94a3b8' }}>{value}</span>
              )}
            />
          )}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
                stroke="transparent"
                style={{
                  filter: `drop-shadow(0 0 8px ${colors[index % colors.length]}80)`,
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// ============================================
// EXPORTS
// ============================================

export default NeonAreaChart;
