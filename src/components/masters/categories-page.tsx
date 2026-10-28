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
import type { Category } from "@/lib/catalog/types"

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")

  async function reload() {
    setLoading(true)
    try {
      setCategories(await api.listCategories())
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load categories.")
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
      await api.createCategory(name)
      setName("")
      await reload()
    } catch (addError) {
      toast.error(addError instanceof Error ? addError.message : "Could not add that category.")
    }
  }

  async function handleRename(category: Category, nextName: string) {
    try {
      await api.updateCategory(category.id, nextName)
      await reload()
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not rename that category.")
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCategory(id)
      await reload()
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Could not remove that category.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Job types for tickets. Quote, support, and development are already listed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a category</CardTitle>
          <CardDescription>Shows on the ticket and on the list.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Breakdown"
            />
          </div>
          <Button type="button" onClick={() => void handleAdd()}>
            Add
          </Button>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">Loading categories…</p> : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load categories</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3">
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onSave={handleRename}
            onDelete={() => void handleDelete(category.id)}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  onSave,
  onDelete,
}: {
  category: Category
  onSave: (category: Category, name: string) => Promise<void>
  onDelete: () => void
}) {
  const [name, setName] = useState(category.name)
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <Input value={name} aria-label="Category name" onChange={(event) => setName(event.target.value)} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void onSave(category, name)}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove category" onClick={onDelete}>
            <Trash2Icon />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
