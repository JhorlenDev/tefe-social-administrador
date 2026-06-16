export function formatPhone(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (!digits) return "-"

  const phone = digits.length > 11 ? digits.slice(-11) : digits

  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`
  }

  if (phone.length === 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`
  }

  return value || "-"
}

export function formatDateBR(value?: string | null) {
  if (!value) return "-"

  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Manaus",
  }).format(date)
}
