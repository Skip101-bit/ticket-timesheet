export const USER_COLORS = [
  { bg: "#ccfbf1", fg: "#115e59" },
  { bg: "#dbeafe", fg: "#1e40af" },
  { bg: "#fef3c7", fg: "#92400e" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#dcfce7", fg: "#166534" },
  { bg: "#ffedd5", fg: "#9a3412" },
  { bg: "#cffafe", fg: "#0e7490" },
  { bg: "#fae8ff", fg: "#a21caf" },
  { bg: "#e0e7ff", fg: "#3730a3" },
] as const

export type UserColor = (typeof USER_COLORS)[number]

export function colorForUserIndex(index: number): UserColor {
  return USER_COLORS[index % USER_COLORS.length] ?? USER_COLORS[0]
}
