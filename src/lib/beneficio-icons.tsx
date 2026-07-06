import {
  Baby,
  BriefcaseBusiness,
  Bus,
  GraduationCap,
  HandCoins,
  HandHeart,
  HeartPulse,
  Home,
  Utensils,
  UsersRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

export const BENEFICIO_ICON_DEFAULT = "VOLUNTEER_ACTIVISM"

export const BENEFICIO_ICON_OPTIONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "VOLUNTEER_ACTIVISM", label: "Ajuda social", icon: HandHeart },
  { key: "RESTAURANT", label: "Alimentação", icon: Utensils },
  { key: "SCHOOL", label: "Educação", icon: GraduationCap },
  { key: "MEDICAL_SERVICES", label: "Saúde", icon: HeartPulse },
  { key: "HOME", label: "Moradia", icon: Home },
  { key: "PAYMENTS", label: "Financeiro", icon: HandCoins },
  { key: "CHILD_CARE", label: "Infância", icon: Baby },
  { key: "FAMILY_RESTROOM", label: "Família", icon: UsersRound },
  { key: "DIRECTIONS_BUS", label: "Transporte", icon: Bus },
  { key: "WORK", label: "Trabalho", icon: BriefcaseBusiness },
]

export function getBeneficioIconOption(key?: string | null) {
  const normalized = (key || BENEFICIO_ICON_DEFAULT).trim().toUpperCase()
  return (
    BENEFICIO_ICON_OPTIONS.find((option) => option.key === normalized) ??
    BENEFICIO_ICON_OPTIONS[0]
  )
}

export function BeneficioIcon({ value, className }: { value?: string | null; className?: string }) {
  const option = getBeneficioIconOption(value)
  const Icon = option.icon
  return <Icon className={className} />
}
