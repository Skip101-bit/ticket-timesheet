"use client"

import { PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MasterLineItem } from "@/lib/catalog/types"
import { formatMoney, parseMoney } from "@/lib/money"
import { lineItemTotal, ticketGrandTotal, type LineItem } from "@/lib/tickets/types"

type LineItemsEditorProps = {
  items: LineItem[]
  masters: MasterLineItem[]
  onChange: (items: LineItem[]) => void
  discount?: number
  onDiscountChange?: (discount: number) => void
  disabled?: boolean
}

const NO_LINE_ITEM = "none"

function lineItemSelectLabel(item: LineItem, masters: MasterLineItem[]): string {
  const master = item.masterLineItemId
    ? masters.find((candidate) => candidate.id === item.masterLineItemId)
    : undefined
  const description = item.description.trim() || master?.description.trim() || ""
  if (!description) {
    return "Choose line item"
  }
  if (master) {
    return `${description} · ${formatMoney(master.price)}`
  }
  return description
}

export function LineItemsEditor({
  items,
  masters,
  onChange,
  discount = 0,
  onDiscountChange,
  disabled = false,
}: LineItemsEditorProps) {
  const total = ticketGrandTotal(items, discount)

  function updateItem(id: string, patch: Partial<LineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function selectMaster(id: string, masterId: string) {
    const master = masters.find((item) => item.id === masterId)
    if (!master) return
    updateItem(id, {
      masterLineItemId: master.id,
      description: master.description,
      price: master.price,
    })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Line items</Label>
          <p className="text-xs text-muted-foreground">
            Pick an item. Only qty can change here.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="no-print"
          disabled={disabled || masters.length === 0}
          onClick={() =>
            onChange([
              ...items,
              {
                id: crypto.randomUUID(),
                masterLineItemId: null,
                description: "",
                quantity: 1,
                price: 0,
              },
            ])
          }
        >
          <PlusIcon />
          Add item
        </Button>
      </div>
      {masters.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No priced items yet. Add them under{" "}
          <Link href="/line-items" className="underline">
            Line items
          </Link>
          .
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Nothing billed on this ticket yet.
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7rem_6.5rem_auto] gap-2 text-xs text-muted-foreground sm:grid">
            <span>Line item</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {items.map((item) => {
            const known = masters.some((master) => master.id === item.masterLineItemId)
            const selectedId = item.masterLineItemId ?? NO_LINE_ITEM
            const selectedLabel = lineItemSelectLabel(item, masters)
            return (
              <div
                key={item.id}
                className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_6.5rem_auto]"
              >
                <Select
                  value={selectedId}
                  onValueChange={(value) => {
                    if (typeof value !== "string") return
                    if (value === NO_LINE_ITEM) {
                      updateItem(item.id, { masterLineItemId: null, description: "", price: 0 })
                      return
                    }
                    selectMaster(item.id, value)
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="col-span-2 w-full sm:col-span-1" aria-label="Line item">
                    <SelectValue placeholder="Line item">{selectedLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LINE_ITEM}>Choose line item</SelectItem>
                    {!known && item.masterLineItemId ? (
                      <SelectItem value={item.masterLineItemId}>{item.description || "Saved item"}</SelectItem>
                    ) : null}
                    {masters.map((master) => (
                      <SelectItem key={master.id} value={master.id}>
                        {master.description} · {formatMoney(master.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="decimal"
                  min={1}
                  step="1"
                  disabled={disabled}
                  value={item.quantity === 0 ? "" : String(item.quantity)}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    updateItem(item.id, {
                      quantity: Number.isFinite(value) && value > 0 ? value : 0,
                    })
                  }}
                  placeholder="Qty"
                  aria-label="Line item quantity"
                />
                <div className="flex h-8 items-center text-sm tabular-nums">{formatMoney(item.price)}</div>
                <div className="col-span-2 flex h-8 items-center justify-end text-sm font-medium tabular-nums sm:col-span-1">
                  {formatMoney(lineItemTotal(item))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="no-print col-span-2 justify-self-end sm:col-span-1"
                  aria-label="Remove line item"
                  disabled={disabled}
                  onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                >
                  <Trash2Icon />
                </Button>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex flex-col items-end gap-2 border-t pt-3">
        {onDiscountChange ? (
          <div className="flex items-center gap-3">
            <Label htmlFor="ticket-discount" className="text-sm font-normal text-muted-foreground">
              Discount
            </Label>
            <Input
              id="ticket-discount"
              className="w-28 text-right tabular-nums"
              inputMode="decimal"
              disabled={disabled}
              value={discount === 0 ? "" : String(discount)}
              placeholder="0.00"
              aria-label="Discount"
              onChange={(event) => onDiscountChange(parseMoney(event.target.value))}
            />
          </div>
        ) : null}
        <div className="flex items-baseline justify-end gap-3">
          <span className="text-sm text-muted-foreground">Grand total</span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  )
}
