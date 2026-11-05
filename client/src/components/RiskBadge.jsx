export default function RiskBadge({ level }) {
  return <span className={`badge badge-${String(level).toLowerCase()}`}>{level}</span>;
}
