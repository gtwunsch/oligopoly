import { useGameStore } from '../store/gameStore';

export function RiskMeter() {
  const risk = useGameStore((s) => s.portfolio.riskScore);
  const liquidity = useGameStore((s) => s.portfolio.liquidity);

  const riskColor = risk > 60 ? '#e15759' : risk > 35 ? '#edc949' : '#59a14f';
  const liqColor = liquidity < 30 ? '#e15759' : liquidity < 60 ? '#edc949' : '#59a14f';

  return (
    <div className="risk-meter">
      <h3>Risk & Liquidity</h3>
      <div className="meter-row">
        <span className="meter-label">Risk</span>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${risk}%`, background: riskColor }}
          />
        </div>
        <span className="meter-value" style={{ color: riskColor }}>
          {risk}
        </span>
      </div>
      <div className="meter-row">
        <span className="meter-label">Liquidity</span>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${liquidity}%`, background: liqColor }}
          />
        </div>
        <span className="meter-value" style={{ color: liqColor }}>
          {liquidity}
        </span>
      </div>
    </div>
  );
}
