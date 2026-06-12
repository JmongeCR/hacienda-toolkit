export function Skeleton({ h = 16, w = "100%", rounded = false }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: rounded ? 999 : 4, display: "block" }} />
}
