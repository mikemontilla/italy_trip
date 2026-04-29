import { palette } from "@/lib/theme";

export default function ErrorBanner({ message, className = "" }) {
  if (!message) return null;
  return (
    <div
      className={`p-2 rounded small ${className}`}
      style={{ backgroundColor: "rgba(244,44,4,0.1)", color: palette.red }}
    >
      {message}
    </div>
  );
}
