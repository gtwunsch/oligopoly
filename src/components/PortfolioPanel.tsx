import { useGameStore } from '../store/gameStore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line,
} from 'recharts';

const ASSET_COLORS: Record<string, string> = {
  sovereign_bonds: '#4e79a7',
  equities: '#59a14f',
  gold: '#edc949',
  cash: '#9c755f',
  fx_short: '#e15759',
  irs: '#b07aa1',
};

const ASSET_LABELS: Record<string, string> = {
  sovereign_bonds: 'Bonds',
  equities: 'Equities',
  gold: 'Gold',
  cash: 'Cash',
  fx_short: 'FX Short',
  irs: 'IRS',
};

const ALLOCATION_CHART_HEIGHT = 110;
const PNL_CHART_HEIGHT = 92;

export function PortfolioPanel() {
  const { portfolio } = useGameStore();

  const grouped: Record<string, number> = {};
  for (const a of portfolio.allocations) {
    const key = a.asset;
    grouped[key] = (grouped[key] || 0) + a.weight;
  }
  const totalAllocated = Object.values(grouped).reduce((s, v) => s + v, 0);
  const cashWeight = Math.max(0, 1 - totalAllocated);
  if (cashWeight > 0.001) grouped['cash'] = cashWeight;

  const allocData = Object.entries(grouped).map(([asset, weight]) => ({
    name: ASSET_LABELS[asset] || asset,
    value: +(weight * 100).toFixed(1),
    color: ASSET_COLORS[asset] || '#76b7b2',
  }));

  const pnlData = portfolio.pnlHistory.map((v, i) => ({
    turn: i,
    pnl: +v.toFixed(2),
  }));

  return (
    <div className="portfolio-panel">
      <h3>Portfolio Allocation</h3>
      {allocData.length > 0 && (
        <ResponsiveContainer width="100%" height={ALLOCATION_CHART_HEIGHT}>
          <BarChart data={allocData} layout="vertical" margin={{ left: 10, right: 10 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
            <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value: number | undefined) => `${(value ?? 0).toFixed(1)}%`} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {allocData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <h3>P&L History ($B)</h3>
      <ResponsiveContainer width="100%" height={PNL_CHART_HEIGHT}>
        <LineChart data={pnlData} margin={{ left: 0, right: 10 }}>
          <XAxis dataKey="turn" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="#4e79a7"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
