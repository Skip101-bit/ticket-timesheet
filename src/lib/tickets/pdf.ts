import { PRODUCT_NAME } from "@/lib/branding"
import { formatHours } from "@/lib/datetime"
import { formatMoney } from "@/lib/money"
import { lineItemTotal, ticketGrandTotal, type Ticket } from "@/lib/tickets/types"

function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?")
}

function wrapLine(text: string, width = 90): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function checklistLines(ticket: Ticket): string[] {
  if (ticket.status !== "processed") return []
  const ticked = [
    ticket.paid ? "Paid" : null,
    ticket.quotePaid ? "Quote sent out" : null,
  ].filter(Boolean)
  return ["", `Checklist: ${ticked.length > 0 ? ticked.join(", ") : "None ticked"}`]
}

export function workOrderPdfLines(ticket: Ticket): string[] {
  const lines = [
    PRODUCT_NAME.toUpperCase(),
    "WORK ORDER",
    "",
    `Ticket number: ${ticket.ticketNumber}`,
    `Reference: ${ticket.reference}`,
    `Ticket issuer: ${ticket.nameSurname || "-"}`,
    `Category: ${ticket.categoryName || "-"}`,
    `Client: ${ticket.client || "-"}`,
    `Client email: ${ticket.clientEmail || "-"}`,
    `Site: ${ticket.site || "-"}`,
    `Job number: ${ticket.jobNumber || "-"}`,
    `Status: ${ticket.status}`,
    ticket.assignedToFinance ? "Assigned to finance" : "Not assigned to finance",
    "",
    "Work requested:",
    ...wrapLine(ticket.clientWorkDescription.trim() || "-"),
    "",
    `Start: ${ticket.startTime || "-"}    End: ${ticket.endTime || "-"}`,
    `Hours: ${ticket.hoursSpent && ticket.hoursSpent > 0 ? formatHours(ticket.hoursSpent) : "-"}`,
    `Overtime: ${ticket.overtimeHours > 0 ? formatHours(ticket.overtimeHours) : "0"} h`,
    "",
    "Actual work done:",
    ...wrapLine(ticket.actualWorkDone.trim() || "-"),
    "",
    "Line items:",
  ]
  if (ticket.lineItems.length === 0) {
    lines.push("None")
  } else {
    for (const item of ticket.lineItems) {
      lines.push(
        ...wrapLine(
          `${item.description || "Item"}  qty ${item.quantity}  ${formatMoney(item.price)}  ${formatMoney(lineItemTotal(item))}`
        )
      )
    }
  }
  lines.push(`Discount: ${formatMoney(ticket.discount)}`)
  lines.push(`Grand total: ${formatMoney(ticketGrandTotal(ticket.lineItems, ticket.discount))}`)
  lines.push(...checklistLines(ticket))
  return lines
}

export function buildPdf(lines: string[]): Uint8Array {
  const pageSize = 46
  const pages: string[][] = []
  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize))
  }
  if (pages.length === 0) pages.push([PRODUCT_NAME])

  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const fontId = 3 + pages.length * 2
  const pageIds: number[] = []
  add("<< /Type /Catalog /Pages 2 0 R >>")
  add("")

  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2
    const contentId = pageId + 1
    pageIds.push(pageId)
    const commands = ["BT", "/F1 11 Tf", "14 TL", "48 760 Td"]
    for (const line of pageLines) {
      commands.push(`(${pdfEscape(line)}) Tj`)
      commands.push("T*")
    }
    commands.push("ET")
    const stream = `${commands.join("\n")}\n`
    const streamBytes = new TextEncoder().encode(stream)
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    objects[contentId - 1] = `<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream`
  })

  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(new TextEncoder().encode(pdf).length)
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefStart = new TextEncoder().encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

export function buildWorkOrderPdf(ticket: Ticket): Uint8Array {
  return buildPdf(workOrderPdfLines(ticket))
}
