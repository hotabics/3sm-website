type Team = "black" | "white" | "flexible" | null;

type Props = {
  team: Team;
  size?: number;
  className?: string;
};

/**
 * Mazs futbola krekliņš — vizuāli rāda spēlētāja fiksēto komandu.
 * Melns krekliņš = Melnā, balts krekliņš = Baltā.
 * Ja `team` ir null vai "flexible" — atgriež null (nekas nav fiksēts).
 */
export function Jersey({ team, size = 18, className = "" }: Props) {
  if (team !== "black" && team !== "white") return null;

  const fill = team === "black" ? "#0a0a0a" : "#f5f5f5";
  const stroke = team === "black" ? "#525252" : "#171717";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={team === "black" ? "Melnā komanda" : "Baltā komanda"}
      className={className}
    >
      <title>{team === "black" ? "Melnā komanda" : "Baltā komanda"}</title>
      <path
        d="M10 4 L7 5 L4 9 L7 13 L10 12 L10 27 L22 27 L22 12 L25 13 L28 9 L25 5 L22 4 L20 5 Q16 8 12 5 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
