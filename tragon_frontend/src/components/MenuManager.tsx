import { useState, useEffect, useCallback, type FormEvent } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

// ----- Types -----

interface Category {
  id: number;
  name: string;
  is_active: boolean;
}

interface Product {
  id: number;
  name: string;
  description: string;
  base_price: string;
  photo_url: string | null;
  is_active: boolean;
  label: string | null;
  category: number | null;
}

interface Topping {
  id: number;
  name: string;
  extra_price: string;
  is_active: boolean;
  product: number;
}

// ----- Main Component -----

export default function MenuManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: number; name: string } | null>(null);

  // ----- Category CRUD -----

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiGet("/catalog/categories/");
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : data.results ?? []);
      }
    } catch {
      setError("Error al cargar categorías.");
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  async function handleCategorySubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (editingCategory) {
      const res = await apiPatch(`/catalog/categories/${editingCategory.id}/`, { name: categoryName });
      if (!res.ok) {
        const data = await res.json();
        setError(data.details?.name?.[0] ?? data.message ?? data.detail ?? "Error al actualizar categoría.");
        return;
      }
    } else {
      const res = await apiPost("/catalog/categories/", { name: categoryName });
      if (!res.ok) {
        const data = await res.json();
        setError(data.details?.name?.[0] ?? data.message ?? data.detail ?? "Error al crear categoría.");
        return;
      }
    }
    setCategoryName("");
    setShowCategoryForm(false);
    setEditingCategory(null);
    fetchCategories();
  }

  async function deleteCategory(id: number) {
    await apiDelete(`/catalog/categories/${id}/`);
    if (selectedCategory?.id === id) {
      setSelectedCategory(null);
      setProducts([]);
    }
    fetchCategories();
    setConfirmDelete(null);
  }

  // ----- Product CRUD -----

  const fetchProducts = useCallback(async (categoryId: number) => {
    setLoading(true);
    try {
      const res = await apiGet(`/catalog/products/?category_id=${categoryId}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : data.results ?? []);
      }
    } catch {
      setError("Error al cargar productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  function selectCategory(cat: Category) {
    setSelectedCategory(cat);
    fetchProducts(cat.id);
  }

  async function deleteProduct(id: number) {
    await apiDelete(`/catalog/products/${id}/`);
    if (selectedCategory) fetchProducts(selectedCategory.id);
    setConfirmDelete(null);
  }

  // ----- Render -----

  return (
    <div className="flex gap-6 min-h-[70vh]">
      {/* Left panel: Categories */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Categorías</h2>
            <button
              onClick={() => { setShowCategoryForm(true); setEditingCategory(null); setCategoryName(""); }}
              className="text-sm bg-orange-600 text-white px-3 py-1 rounded-md hover:bg-orange-700"
            >
              + Nueva
            </button>
          </div>

          {showCategoryForm && (
            <form onSubmit={handleCategorySubmit} className="mb-4 space-y-2">
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Nombre de la categoría"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <button type="submit" className="text-sm bg-orange-600 text-white px-3 py-1 rounded-md hover:bg-orange-700">
                  {editingCategory ? "Guardar" : "Crear"}
                </button>
                <button type="button" onClick={() => { setShowCategoryForm(false); setEditingCategory(null); }} className="text-sm text-gray-600 hover:text-gray-900">
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <ul className="space-y-1">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm ${
                  selectedCategory?.id === cat.id ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span onClick={() => selectCategory(cat)} className="flex-1 truncate">
                  {cat.name}
                </span>
                <span className="flex gap-1 ml-2">
                  <button
                    onClick={() => { setEditingCategory(cat); setCategoryName(cat.name); setShowCategoryForm(true); }}
                    className="text-gray-400 hover:text-orange-600"
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: "category", id: cat.id, name: cat.name })}
                    className="text-gray-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {categories.length === 0 && (
              <li className="text-sm text-gray-400 px-3 py-2">Sin categorías</li>
            )}
          </ul>
        </div>
      </div>

      {/* Right panel: Products */}
      <div className="flex-1">
        {selectedCategory ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Productos — {selectedCategory.name}
              </h2>
              <button
                onClick={() => { setShowProductForm(true); setEditingProduct(null); }}
                className="text-sm bg-orange-600 text-white px-3 py-1 rounded-md hover:bg-orange-700"
              >
                + Nuevo producto
              </button>
            </div>

            {showProductForm && (
              <ProductForm
                product={editingProduct}
                categoryId={selectedCategory.id}
                onClose={() => { setShowProductForm(false); setEditingProduct(null); }}
                onSaved={() => { setShowProductForm(false); setEditingProduct(null); fetchProducts(selectedCategory.id); }}
              />
            )}

            {loading ? (
              <p className="text-sm text-gray-500">Cargando productos...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-400">Sin productos en esta categoría.</p>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => { setEditingProduct(product); setShowProductForm(true); }}
                    onDelete={() => setConfirmDelete({ type: "product", id: product.id, name: product.name })}
                    onLabelChange={() => { if (selectedCategory) fetchProducts(selectedCategory.id); }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Selecciona una categoría para ver sus productos</p>
          </div>
        )}
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm z-50">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar eliminación</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Estás seguro de eliminar <strong>{confirmDelete.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "category") deleteCategory(confirmDelete.id);
                  else if (confirmDelete.type === "product") deleteProduct(confirmDelete.id);
                  else if (confirmDelete.type === "topping") deleteTopping(confirmDelete.id);
                }}
                className="text-sm px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Top-level topping delete helper (used from confirmation modal)
  async function deleteTopping(id: number) {
    await apiDelete(`/catalog/toppings/${id}/`);
    if (selectedCategory) fetchProducts(selectedCategory.id);
    setConfirmDelete(null);
  }
}


// ----- Product Form Component -----

function ProductForm({
  product,
  categoryId,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categoryId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(product?.base_price ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      let res: Response;
      const body = { name, description, base_price: basePrice, category: categoryId };

      if (product) {
        res = await apiPatch(`/catalog/products/${product.id}/`, body);
      } else {
        res = await apiPost("/catalog/products/", body);
      }

      if (!res.ok) {
        const data = await res.json();
        // Extract field-level errors from our custom error format
        if (data.details && typeof data.details === "object" && Object.keys(data.details).length > 0) {
          const messages: string[] = [];
          for (const [field, msgs] of Object.entries(data.details)) {
            const fieldMsgs = Array.isArray(msgs) ? msgs : [String(msgs)];
            messages.push(`${field}: ${fieldMsgs.join(", ")}`);
          }
          setError(messages.join(" | "));
        } else if (data.message) {
          setError(data.message);
        } else if (data.detail) {
          setError(data.detail);
        } else {
          setError("Error al guardar producto.");
        }
        return;
      }

      // Upload photo if selected
      if (photo) {
        const savedProduct = await res.json();
        const productId = product?.id ?? savedProduct.id;
        const formData = new FormData();
        formData.append("photo", photo);
        await apiPost(`/catalog/products/${productId}/upload-photo/`, formData);
      }

      onSaved();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {product ? "Editar producto" : "Nuevo producto"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Precio base</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Foto</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="text-sm bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ----- Product Card Component -----

function ProductCard({
  product,
  onEdit,
  onDelete,
  onLabelChange,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onLabelChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loadingToppings, setLoadingToppings] = useState(false);
  const [labelInput, setLabelInput] = useState(product.label ?? "");
  const [showLabelForm, setShowLabelForm] = useState(false);

  // Topping form
  const [showToppingForm, setShowToppingForm] = useState(false);
  const [editingTopping, setEditingTopping] = useState<Topping | null>(null);

  async function fetchToppings() {
    setLoadingToppings(true);
    try {
      const res = await apiGet(`/catalog/products/${product.id}/toppings/`);
      if (res.ok) {
        const data = await res.json();
        setToppings(Array.isArray(data) ? data : data.results ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingToppings(false);
    }
  }

  function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) fetchToppings();
  }

  async function handleLabelSave() {
    const body = { label: labelInput.trim() || null };
    const res = await apiPatch(`/catalog/products/${product.id}/label/`, body);
    if (res.ok) {
      setShowLabelForm(false);
      onLabelChange();
    }
  }

  async function handleDeleteTopping(id: number) {
    await apiDelete(`/catalog/toppings/${id}/`);
    fetchToppings();
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Product header */}
      <div className="flex items-center gap-3 p-3 bg-white">
        {product.photo_url && (
          <img src={product.photo_url} alt={product.name} className="w-12 h-12 rounded-md object-cover" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">{product.name}</span>
            {product.label && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                {product.label}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{product.description}</p>
        </div>
        <span className="text-sm font-semibold text-gray-700">${product.base_price}</span>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setShowLabelForm(!showLabelForm)} className="text-gray-400 hover:text-orange-600 text-xs px-1" title="Etiqueta">
            🏷
          </button>
          <button onClick={onEdit} className="text-gray-400 hover:text-orange-600 text-sm" title="Editar">
            ✎
          </button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600 text-sm" title="Eliminar">
            ✕
          </button>
          <button onClick={toggleExpand} className="text-gray-400 hover:text-gray-700 text-sm ml-1" title="Toppings">
            {expanded ? "▾" : "▸"}
          </button>
        </div>
      </div>

      {/* Label inline form */}
      {showLabelForm && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="Ej: Más vendido, Nuevo"
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button onClick={handleLabelSave} className="text-xs bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700">
            Guardar
          </button>
          <button onClick={() => setShowLabelForm(false)} className="text-xs text-gray-500 hover:text-gray-700">
            Cancelar
          </button>
        </div>
      )}

      {/* Toppings section */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-600 uppercase">Toppings</h4>
            <button
              onClick={() => { setShowToppingForm(true); setEditingTopping(null); }}
              className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
            >
              + Agregar
            </button>
          </div>

          {showToppingForm && (
            <ToppingForm
              topping={editingTopping}
              productId={product.id}
              onClose={() => { setShowToppingForm(false); setEditingTopping(null); }}
              onSaved={() => { setShowToppingForm(false); setEditingTopping(null); fetchToppings(); }}
            />
          )}

          {loadingToppings ? (
            <p className="text-xs text-gray-400">Cargando...</p>
          ) : toppings.length === 0 ? (
            <p className="text-xs text-gray-400">Sin toppings.</p>
          ) : (
            <ul className="space-y-1">
              {toppings.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-xs bg-white px-2 py-1.5 rounded border border-gray-100">
                  <span className="text-gray-700">{t.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">+${t.extra_price}</span>
                    <button
                      onClick={() => { setEditingTopping(t); setShowToppingForm(true); }}
                      className="text-gray-400 hover:text-orange-600"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteTopping(t.id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Topping Form Component -----

function ToppingForm({
  topping,
  productId,
  onClose,
  onSaved,
}: {
  topping: Topping | null;
  productId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(topping?.name ?? "");
  const [extraPrice, setExtraPrice] = useState(topping?.extra_price ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      let res: Response;
      if (topping) {
        res = await apiPatch(`/catalog/toppings/${topping.id}/`, { name, extra_price: extraPrice });
      } else {
        res = await apiPost(`/catalog/products/${productId}/toppings/`, { name, extra_price: extraPrice });
      }

      if (!res.ok) {
        const data = await res.json();
        if (data.details && typeof data.details === "object" && Object.keys(data.details).length > 0) {
          const messages: string[] = [];
          for (const [field, msgs] of Object.entries(data.details)) {
            const fieldMsgs = Array.isArray(msgs) ? msgs : [String(msgs)];
            messages.push(`${field}: ${fieldMsgs.join(", ")}`);
          }
          setError(messages.join(" | "));
        } else if (data.message) {
          setError(data.message);
        } else if (data.detail) {
          setError(data.detail);
        } else {
          setError("Error al guardar.");
        }
        return;
      }

      onSaved();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-2 p-2 bg-white border border-gray-200 rounded space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del topping"
          required
          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={extraPrice}
          onChange={(e) => setExtraPrice(e.target.value)}
          placeholder="Precio extra"
          required
          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 disabled:opacity-50">
          {saving ? "..." : topping ? "Guardar" : "Crear"}
        </button>
        <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">
          Cancelar
        </button>
      </div>
    </form>
  );
}
