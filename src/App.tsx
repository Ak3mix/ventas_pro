import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Package, 
  ClipboardList, 
  Plus, 
  Minus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle2, 
  XCircle, 
  FileSpreadsheet,
  Trash2,
  DollarSign,
  CreditCard,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  initial_stock: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface Movement {
  id: number;
  product_id: number;
  product_name: string;
  type: 'entry' | 'waste' | 'sale';
  quantity: number;
  reason: string;
  timestamp: string;
}

interface Sale {
  id: number;
  total: number;
  payment_method: 'cash' | 'transfer';
  timestamp: string;
}

interface Session {
  id: number;
  start_time: string;
  end_time: string | null;
  is_closed: number;
}

// Components
function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 transition-all relative",
        active ? "text-emerald-600" : "text-stone-400"
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -top-2 w-8 h-1 bg-emerald-600 rounded-full"
        />
      )}
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function InventoryTab({ products, onUpdate }: { products: Product[], onUpdate: () => void }) {
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showEditProduct, setShowEditProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Product | null>(null);
  const [showMoveModal, setShowMoveModal] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [moveType, setMoveType] = useState<'entry' | 'waste'>('entry');
  const [moveQty, setMoveQty] = useState(1);
  const [moveReason, setMoveReason] = useState('');

  // Form states
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');

  useEffect(() => {
    if (showEditProduct) {
      setFormName(showEditProduct.name);
      setFormPrice(showEditProduct.price.toString());
      setFormStock(showEditProduct.stock.toString());
    } else if (showAddProduct) {
      setFormName('');
      setFormPrice('');
      setFormStock('');
    }
  }, [showEditProduct, showAddProduct]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleAddProduct: Start");
    if (isSaving) {
      console.log("handleAddProduct: Already saving, skipping");
      return;
    }
    
    const price = parseFloat(formPrice);
    const stock = parseInt(formStock);

    if (isNaN(price) || isNaN(stock)) {
      console.log("handleAddProduct: Validation failed (NaN)");
      alert("Por favor ingresa valores numéricos válidos (Precio y Stock)");
      return;
    }

    if (!formName.trim()) {
      console.log("handleAddProduct: Validation failed (empty name)");
      alert("El nombre del producto es obligatorio");
      return;
    }

    const data = {
      name: formName.trim(),
      price,
      initial_stock: stock
    };

    console.log("handleAddProduct: Sending data:", data);
    setIsSaving(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("handleAddProduct: Request timeout reached");
        controller.abort();
      }, 10000);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log("handleAddProduct: Response received, status:", res.status);
      if (res.ok) {
        console.log("handleAddProduct: Success, closing modal and updating");
        setShowAddProduct(false);
        onUpdate();
        setTimeout(() => alert("¡Producto guardado con éxito!"), 100);
      } else {
        const err = await res.json();
        console.error("handleAddProduct: Server error:", err);
        alert("Error del servidor: " + (err.error || "Desconocido"));
      }
    } catch (error: any) {
      console.error("handleAddProduct: Catch error:", error);
      if (error.name === 'AbortError') {
        alert("La solicitud tardó demasiado. Revisa tu conexión.");
      } else {
        alert("Error de red: No se pudo conectar con el servidor");
      }
    } finally {
      console.log("handleAddProduct: Finally block reached");
      setIsSaving(false);
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("handleEditProduct: Start");
    if (!showEditProduct || isSaving) {
      console.log("handleEditProduct: Not editing or already saving, skipping");
      return;
    }

    const price = parseFloat(formPrice);
    const stock = parseInt(formStock);

    if (isNaN(price) || isNaN(stock)) {
      console.log("handleEditProduct: Validation failed (NaN)");
      alert("Por favor ingresa valores numéricos válidos");
      return;
    }

    const data = {
      name: formName.trim(),
      price,
      stock
    };

    console.log("handleEditProduct: Sending data to /api/products/" + showEditProduct.id, data);
    setIsSaving(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log("handleEditProduct: Request timeout reached");
        controller.abort();
      }, 10000);

      const res = await fetch(`/api/products/${showEditProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log("handleEditProduct: Response received, status:", res.status);
      if (res.ok) {
        console.log("handleEditProduct: Success, closing modal and updating");
        setShowEditProduct(null);
        onUpdate();
        setTimeout(() => alert("¡Producto actualizado con éxito!"), 100);
      } else {
        const err = await res.json();
        console.error("handleEditProduct: Server error:", err);
        alert("Error del servidor: " + (err.error || "Desconocido"));
      }
    } catch (error: any) {
      console.error("handleEditProduct: Catch error:", error);
      if (error.name === 'AbortError') {
        alert("La solicitud tardó demasiado. Revisa tu conexión.");
      } else {
        alert("Error de red: No se pudo conectar con el servidor");
      }
    } finally {
      console.log("handleEditProduct: Finally block reached");
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!showDeleteConfirm || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${showDeleteConfirm.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setShowDeleteConfirm(null);
        onUpdate();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'No se pudo eliminar el producto'}`);
      }
    } catch (error) {
      alert("Error de conexión al eliminar producto");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = async () => {
    if (!showMoveModal) return;
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: showMoveModal.id,
          type: moveType,
          quantity: moveQty,
          reason: moveReason || (moveType === 'entry' ? 'Reabastecimiento' : 'Merma')
        })
      });
      const data = await res.json();
      if (res.ok) {
        setShowMoveModal(null);
        setMoveQty(1);
        setMoveReason('');
        onUpdate();
      } else {
        alert(data.error || "Error en el movimiento");
      }
    } catch (error) {
      alert("Error de conexión");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-stone-900">Inventario</h2>
        <button 
          onClick={() => { setShowAddProduct(true); }}
          className="bg-stone-900 text-white p-2 rounded-xl shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="space-y-3">
        {products.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1">
                <div className="font-black text-stone-900 text-lg leading-tight">{product.name}</div>
                <div className="text-xs text-stone-400 mt-1">
                  Stock: <span className="font-bold text-stone-600">{product.stock}</span> • 
                  Precio: <span className="font-bold text-emerald-600">${product.price.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-1.5 justify-end">
              <button 
                onClick={() => { setShowMoveModal(product); setMoveType('entry'); }}
                className="bg-blue-50 text-blue-600 p-2.5 sm:p-2 rounded-xl hover:bg-blue-100 transition-colors flex-1 sm:flex-none flex justify-center"
                title="Reabastecer"
              >
                <ArrowUpCircle size={20} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button 
                onClick={() => { setShowMoveModal(product); setMoveType('waste'); }}
                className="bg-rose-50 text-rose-600 p-2.5 sm:p-2 rounded-xl hover:bg-rose-100 transition-colors flex-1 sm:flex-none flex justify-center"
                title="Merma"
              >
                <ArrowDownCircle size={20} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button 
                onClick={() => { setShowEditProduct(product); }}
                className="bg-stone-50 text-stone-600 p-2.5 sm:p-2 rounded-xl hover:bg-stone-100 transition-colors flex-1 sm:flex-none flex justify-center"
                title="Editar"
              >
                <Edit size={20} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(product)}
                className="bg-stone-50 text-rose-400 p-2.5 sm:p-2 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors flex-1 sm:flex-none flex justify-center"
                title="Eliminar"
              >
                <Trash2 size={20} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals for Inventory */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            >
              <form onSubmit={handleAddProduct}>
                <h3 className="text-xl font-black mb-6">Nuevo Producto</h3>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Nombre</label>
                    <input 
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      required 
                      className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900 font-bold" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Precio</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        required 
                        className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Stock Inicial</label>
                      <input 
                        type="number" 
                        value={formStock}
                        onChange={e => setFormStock(e.target.value)}
                        required 
                        className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 py-3 font-bold text-stone-500">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-stone-900 text-white rounded-xl font-bold disabled:opacity-50">
                    {isSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEditProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            >
              <form onSubmit={handleEditProduct}>
                <h3 className="text-xl font-black mb-6">Editar Producto</h3>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Nombre</label>
                    <input 
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      required 
                      className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900 font-bold" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Precio</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        value={formPrice}
                        onChange={e => setFormPrice(e.target.value)}
                        required 
                        className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Stock</label>
                      <input 
                        type="number" 
                        value={formStock}
                        onChange={e => setFormStock(e.target.value)}
                        required 
                        className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowEditProduct(null)} className="flex-1 py-3 font-bold text-stone-500">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">
                    {isSaving ? "Actualizando..." : "Actualizar"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">¿Eliminar Producto?</h3>
              <p className="text-stone-500 text-sm mb-8">
                ¿Estás seguro de eliminar <span className="font-bold text-stone-800">{showDeleteConfirm.name}</span>? Esta acción no se puede deshacer.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  disabled={isDeleting}
                  onClick={handleDeleteProduct}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-100 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isDeleting ? "Eliminando..." : "Sí, Eliminar"}
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full py-4 text-stone-500 font-bold active:scale-95 transition-transform disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMoveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl"
            >
              <h3 className="text-xl font-black mb-2">
                {moveType === 'entry' ? 'Reabastecer' : 'Registrar Merma'}
              </h3>
              <p className="text-stone-500 text-sm mb-6">{showMoveModal.name}</p>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Cantidad</label>
                  <input 
                    type="number" 
                    value={moveQty} 
                    onChange={e => setMoveQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                  />
                </div>
                {moveType === 'waste' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-400 mb-1 block">Motivo (Opcional)</label>
                    <input 
                      placeholder="Ej: Caducidad, Daño..."
                      value={moveReason}
                      onChange={e => setMoveReason(e.target.value)}
                      className="w-full bg-stone-50 border-none rounded-xl p-3 focus:ring-2 ring-stone-900" 
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowMoveModal(null)} className="flex-1 py-3 font-bold text-stone-500">Cancelar</button>
                <button 
                  onClick={handleMove}
                  className={cn(
                    "flex-1 py-3 text-white rounded-xl font-bold",
                    moveType === 'entry' ? "bg-blue-600" : "bg-rose-600"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportsTab({ products, onSessionClose }: { products: Product[], onSessionClose: () => void }) {
  const [reportData, setReportData] = useState<{ sales: Sale[], movements: Movement[], session: Session } | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const fetchReport = async () => {
    try {
      const res = await fetch('/api/reports/current');
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      console.error("Error fetching report", e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/sessions/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("Error fetching history", e);
    }
  };

  useEffect(() => {
    fetchReport();
    fetchHistory();
  }, []);

  const handleCloseDay = async () => {
    setShowConfirmClose(false);
    setIsClosing(true);
    try {
      const res = await fetch('/api/sessions/close', { method: 'POST' });
      if (res.ok) {
        await fetchReport();
        await fetchHistory();
        onSessionClose();
        alert("Jornada cerrada correctamente. Se ha iniciado una nueva.");
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'No se pudo cerrar la jornada'}`);
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setIsClosing(false);
    }
  };

  const exportSessionExcel = async (sessionId: number, sessionDate: string) => {
    try {
      const res = await fetch(`/api/reports/session/${sessionId}`);
      const data = await res.json();
      
      const totals = data.sales.reduce((acc: any, s: any) => {
        if (s.payment_method === 'cash') acc.cash += s.total;
        else acc.transfer += s.total;
        acc.total += s.total;
        return acc;
      }, { cash: 0, transfer: 0, total: 0 });

      // Prepare consolidated data for a single sheet
      const combinedData: any[] = [
        { 'Col1': 'RESUMEN DE JORNADA', 'Col2': `#${sessionId}` },
        { 'Col1': 'Fecha', 'Col2': sessionDate },
        { 'Col1': 'Total Efectivo', 'Col2': totals.cash },
        { 'Col1': 'Total Transferencia', 'Col2': totals.transfer },
        { 'Col1': 'TOTAL VENDIDO', 'Col2': totals.total },
        { 'Col1': '', 'Col2': '' }, // Separator
        { 'Col1': 'DETALLE DE VENTAS POR PRODUCTO', 'Col2': '' },
        { 'Col1': 'Producto', 'Col2': 'Cant. Vendida', 'Col3': 'Precio Unit.', 'Col4': 'Subtotal', 'Col5': 'Stock Restante' }
      ];

      const productInfo = data.movements.reduce((acc: any, m: any) => {
        if (!acc[m.product_id]) {
          acc[m.product_id] = {
            name: m.product_name,
            sold: 0,
            price: 0, // We'll try to find this from sales or current products if possible
            stock: 0  // This is tricky for historical reports, maybe just show '-' or current stock
          };
        }
        if (m.type === 'sale') {
          acc[m.product_id].sold += m.quantity;
        }
        return acc;
      }, {});

      // Try to get prices from current products for those that still exist
      products.forEach(p => {
        if (productInfo[p.id]) {
          productInfo[p.id].price = p.price;
          productInfo[p.id].stock = p.stock;
        }
      });

      Object.values(productInfo).forEach((p: any) => {
        combinedData.push({
          'Col1': p.name,
          'Col2': p.sold,
          'Col3': p.price || '-',
          'Col4': p.price ? p.sold * p.price : '-',
          'Col5': p.stock || '-'
        });
      });

      combinedData.push({ 'Col1': '', 'Col2': '' }); // Separator
      combinedData.push({ 'Col1': 'DETALLE DE MERMAS Y BAJAS', 'Col2': '' });
      combinedData.push({ 'Col1': 'Producto', 'Col2': 'Cant. Perdida', 'Col3': 'Motivo', 'Col4': 'Fecha/Hora' });

      data.movements
        .filter((m: any) => m.type === 'waste')
        .forEach((m: any) => {
          combinedData.push({
            'Col1': m.product_name,
            'Col2': m.quantity,
            'Col3': m.reason,
            'Col4': format(new Date(m.timestamp), 'dd/MM/yyyy HH:mm')
          });
        });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(combinedData, { skipHeader: true });
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Completo");

      XLSX.writeFile(wb, `Reporte_VentasPro_Jornada_${sessionId}_${sessionDate}.xlsx`);
    } catch (e) {
      alert("Error al exportar Excel");
    }
  };

  const totals = reportData?.sales.reduce((acc, s) => {
    if (s.payment_method === 'cash') acc.cash += s.total;
    else acc.transfer += s.total;
    acc.total += s.total;
    return acc;
  }, { cash: 0, transfer: 0, total: 0 }) || { cash: 0, transfer: 0, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black">Cierre de Jornada</h2>
        <span className="text-[10px] font-bold bg-stone-200 px-2 py-1 rounded-full uppercase">
          ID: {reportData?.session.id}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 flex flex-col justify-center">
          <div className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Efectivo</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-900 leading-none">${totals.cash.toFixed(2)}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 flex flex-col justify-center">
          <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">Transferencia</div>
          <div className="text-xl sm:text-2xl font-black text-blue-900 leading-none">${totals.transfer.toFixed(2)}</div>
        </div>
        <div className="col-span-2 bg-stone-900 p-6 rounded-3xl text-white shadow-xl">
          <div className="text-[10px] uppercase font-bold text-stone-400 mb-1">Total Actual</div>
          <div className="text-3xl sm:text-4xl font-black">${totals.total.toFixed(2)}</div>
        </div>
      </div>

      <div className="space-y-3">
        <button 
          disabled={isClosing}
          onClick={() => setShowConfirmClose(true)}
          className={cn(
            "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all",
            "bg-rose-600 text-white shadow-lg shadow-rose-100 active:scale-95 disabled:opacity-50"
          )}
        >
          <XCircle size={20} />
          {isClosing ? "Cerrando..." : "Cerrar Jornada Actual"}
        </button>

        <button 
          onClick={() => reportData && exportSessionExcel(reportData.session.id, format(new Date(), 'yyyy-MM-dd'))}
          className="w-full py-4 rounded-2xl font-bold bg-white border-2 border-stone-200 text-stone-700 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <FileSpreadsheet size={20} />
          Excel Jornada Actual
        </button>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmClose && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">¿Cerrar Jornada?</h3>
              <p className="text-stone-500 text-sm mb-8">
                Esta acción bloqueará las ventas actuales y reiniciará los totales para una nueva jornada.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleCloseDay}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-bold shadow-lg shadow-rose-100 active:scale-95 transition-transform"
                >
                  Sí, Cerrar Jornada
                </button>
                <button 
                  onClick={() => setShowConfirmClose(false)}
                  className="w-full py-4 text-stone-500 font-bold active:scale-95 transition-transform"
                >
                  No, Continuar Vendiendo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="pt-8 border-t border-stone-200">
        <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Historial de Jornadas</h3>
        <div className="space-y-3">
          {history.map(session => (
            <div key={session.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-stone-800">Jornada #{session.id}</div>
                <div className="text-[10px] text-stone-400">
                  Cerrada: {session.end_time ? format(new Date(session.end_time), 'dd/MM/yyyy HH:mm') : 'N/A'}
                </div>
              </div>
              <button 
                onClick={() => exportSessionExcel(session.id, format(new Date(session.end_time || ''), 'yyyy-MM-dd'))}
                className="text-emerald-600 p-2 bg-emerald-50 rounded-xl active:scale-90 transition-transform"
              >
                <FileSpreadsheet size={20} />
              </button>
            </div>
          ))}
          {history.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm italic">Aún no hay jornadas cerradas</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'vender' | 'inventario' | 'reportes'>('vender');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(data);
    } catch (e) { console.error(e); }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/sessions/current');
      const data = await res.json();
      setCurrentSession(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchProducts();
    fetchSession();
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, Math.min(item.quantity + delta, item.stock));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleProcessSale = async () => {
    if (!paymentMethod) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart,
          payment_method: paymentMethod,
          total: cartTotal
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCart([]);
        setShowPaymentModal(false);
        setPaymentMethod(null);
        await fetchProducts();
        alert("¡Venta realizada con éxito!");
      } else {
        alert(`Error: ${data.error || 'Desconocido'}`);
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900 pb-24">
      <header className="bg-white border-b border-stone-200 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight text-stone-800">VentasPro</h1>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-3 h-3 rounded-full",
              activeTab === 'vender' ? "bg-emerald-500" : "bg-stone-300"
            )} />
            <span className="text-xs font-medium uppercase tracking-widest text-stone-500">
              {activeTab}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'vender' && (
            <motion.div
              key="vender"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={cn(
                      "p-3 sm:p-4 rounded-3xl border text-left transition-all active:scale-95 flex flex-col justify-between min-h-[120px]",
                      product.stock > 0 
                        ? "bg-white border-stone-200 shadow-sm hover:border-emerald-200" 
                        : "bg-stone-50 border-stone-100 opacity-60 grayscale"
                    )}
                  >
                    <div>
                      <div className="font-black text-stone-900 text-sm leading-tight mb-1 line-clamp-2">{product.name}</div>
                      <div className="text-emerald-600 font-black text-base">${product.price.toFixed(2)}</div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-[8px] uppercase font-black text-stone-400">
                        Stock: {product.stock}
                      </div>
                      {product.stock <= 5 && product.stock > 0 && (
                        <div className="bg-amber-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full uppercase">
                          Low
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Empty state */}
              {products.length === 0 && (
                <div className="text-center py-20 text-stone-400">
                  <Package className="mx-auto mb-4 opacity-20" size={48} />
                  <p className="font-medium">No hay productos registrados</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'inventario' && (
            <InventoryTab products={products} onUpdate={fetchProducts} />
          )}

          {activeTab === 'reportes' && (
            <ReportsTab products={products} onSessionClose={() => { fetchSession(); fetchProducts(); }} />
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-2 pb-6 flex justify-around items-center z-40">
        <NavButton active={activeTab === 'vender'} onClick={() => setActiveTab('vender')} icon={<ShoppingCart size={20} />} label="Vender" />
        <NavButton active={activeTab === 'inventario'} onClick={() => setActiveTab('inventario')} icon={<Package size={20} />} label="Inventario" />
        <NavButton active={activeTab === 'reportes'} onClick={() => setActiveTab('reportes')} icon={<ClipboardList size={20} />} label="Cierre" />
      </nav>

      {/* Sticky Cart Summary */}
      <AnimatePresence>
        {activeTab === 'vender' && cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-[84px] left-0 right-0 p-4 z-30 pointer-events-none"
          >
            <div className="max-w-md mx-auto pointer-events-auto">
              <button 
                onClick={() => setShowCartModal(true)}
                className="w-full bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex justify-between items-center active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </div>
                  <span className="font-bold">Ver Carrito</span>
                </div>
                <div className="text-xl font-black">${cartTotal.toFixed(2)}</div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {/* Cart Modal */}
        {showCartModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              className="bg-white w-full max-w-md rounded-t-[40px] p-6 pb-8 shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mb-6 shrink-0" />
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-2xl font-black">Tu Carrito</h3>
                <button onClick={() => setShowCartModal(false)} className="text-stone-400 p-2"><XCircle size={24} /></button>
              </div>
              
              <div className="overflow-y-auto flex-1 space-y-3 mb-6 pr-1">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl">
                    <div className="flex-1">
                      <div className="font-bold text-stone-800">{item.name}</div>
                      <div className="text-xs text-stone-500">${item.price.toFixed(2)} c/u</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white rounded-xl border border-stone-200 p-1">
                        <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1 text-stone-400 hover:text-stone-600">
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1 text-stone-400 hover:text-stone-600">
                          <Plus size={16} />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-rose-400 p-1">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t border-stone-100 shrink-0">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-stone-500 font-bold uppercase text-xs tracking-widest">Total a pagar</span>
                  <span className="text-3xl font-black text-stone-900">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={() => { setShowCartModal(false); setShowPaymentModal(true); }}
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 active:scale-95 transition-transform"
                >
                  Continuar al Pago
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-[40px] p-8 shadow-2xl">
              <div className="w-12 h-1.5 bg-stone-200 rounded-full mx-auto mb-8" />
              <h3 className="text-2xl font-black text-center mb-2">Método de Pago</h3>
              <p className="text-stone-500 text-center mb-8">Selecciona cómo pagará el cliente</p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button onClick={() => setPaymentMethod('cash')} className={cn("flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all", paymentMethod === 'cash' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-stone-100 bg-stone-50 text-stone-500")}>
                  <DollarSign size={32} />
                  <span className="font-bold">Efectivo</span>
                </button>
                <button onClick={() => setPaymentMethod('transfer')} className={cn("flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all", paymentMethod === 'transfer' ? "border-blue-500 bg-blue-50 text-blue-700" : "border-stone-100 bg-stone-50 text-stone-500")}>
                  <CreditCard size={32} />
                  <span className="font-bold">Transferencia</span>
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-stone-500 bg-stone-100">Cancelar</button>
                <button disabled={!paymentMethod || loading} onClick={handleProcessSale} className="flex-[2] py-4 rounded-2xl font-bold text-white bg-emerald-600 shadow-lg shadow-emerald-100 disabled:opacity-50">
                  {loading ? "Procesando..." : "Confirmar Venta"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
