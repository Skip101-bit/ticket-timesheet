"use client"

import { useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api/client"
import type { MasterLineItem } from "@/lib/catalog/types"
import { formatMoney, parseMoney } from "@/lib/money"

export function MasterLineItemsPage() {
  const [items, setItems] = useState<MasterLineItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")

  async function reload() {
    setLoading(true)
    try {
      setItems(await api.listLineItems())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load line items.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function handleAdd() {
    try {
      await api.createLineItem(description, parseMoney(price))
      setDescription("")
      setPrice("")
      await reload()
    } catch (addError) {
      toast.error(addError instanceof Error ? addError.message : "Could not add that line item.")
    }
  }

  async function handleSave(item: MasterLineItem, nextDescription: string, nextPrice: string) {
    try {
      await api.updateLineItem(item.id, nextDescription, parseMoney(nextPrice))
      await reload()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save that line item.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteLineItem(id)
      await reload()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not remove that line item.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Line items</h1>
        <p className="text-sm text-muted-foreground">
          Prices live here. On a ticket you pick the item and change qty.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a line item</CardTitle>
          <CardDescription>Description and unit price. Qty is set on the ticket.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="master-description">Description</Label>
            <Input
              id="master-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Call-out fee"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="master-price">Unit price</Label>
            <Input
              id="master-price"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <Button type="button" onClick={() => void handleAdd()}>
            Add
          </Button>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading line items…</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load line items</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!loading && items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No line items yet</CardTitle>
            <CardDescription>Add the parts and labour you bill.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <MasterLineItemRow
            key={item.id}
            item={item}
            onSave={handleSave}
            onDelete={() => void handleDelete(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

function MasterLineItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: MasterLineItem
  onSave: (item: MasterLineItem, description: string, price: string) => Promise<void>
  onDelete: () => void
}) {
  const [description, setDescription] = useState(item.description)
  const [price, setPrice] = useState(String(item.price))

  return (
    <Card>
      <CardContent className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-center">
        <Input
          value={description}
          aria-label="Description"
          onChange={(event) => setDescription(event.target.value)}
        />
        <Input
          value={price}
          inputMode="decimal"
          aria-label={`Price for ${item.description}`}
          onChange={(event) => setPrice(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">{formatMoney(item.price)}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void onSave(item, description, price)}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove line item" onClick={onDelete}>
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
