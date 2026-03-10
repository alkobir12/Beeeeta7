import React from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

export const PartsTransactionModal = ({
  open,
  onOpenChange,
  transactionType,
  saleMode,
  directAmount,
  directDescription,
  transactionVehicleId,
  selectedPartnerId,
  selectedAccountId,
  loadingVehicles,
  loadingPartners,
  loadingAccounts,
  loadingModalParts,
  vehicleOptions,
  customers,
  suppliers,
  accountOptions,
  partOptions,
  transactionItems,
  transactionTotal,
  setTransactionType,
  setSaleMode,
  setDirectAmount,
  setDirectDescription,
  setTransactionVehicleId,
  setSelectedPartnerId,
  setSelectedAccountId,
  updateTransactionItem,
  removeTransactionItem,
  addTransactionItem,
  submitTransaction,
  loadVehicles,
  loadAccounts,
  loadCustomers,
  loadSuppliers,
  loadModalParts,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <DialogHeader>
          <DialogTitle data-testid="transaction-modal-title">نقطة البيع والعمليات المباشرة</DialogTitle>
          <DialogDescription data-testid="transaction-modal-description">
            اختر الحساب من دليل الحسابات، وسيتم التوجيه المالي تلقائياً حسب تصنيف الحساب.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4" data-testid="transaction-modal-content">
          <div className="flex justify-end">
            <button
              type="button"
              className="px-3 py-1 rounded-lg bg-white/10 text-sm text-white"
              onClick={() => {
                loadVehicles();
                loadAccounts();
                if (transactionType === 'sale') {
                  loadCustomers();
                } else {
                  loadSuppliers();
                }
              }}
              data-testid="transaction-refresh-data"
            >
              تحديث القوائم
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card p-4 space-y-3" data-testid="transaction-type-card">
              <div>
                <label className="block text-sm mb-2" data-testid="transaction-type-label">نوع العملية</label>
                <select
                  className="apple-input"
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  data-testid="transaction-type-select"
                >
                  <option value="sale">بيع</option>
                  <option value="purchase">شراء</option>
                  <option value="direct">عملية مباشرة</option>
                </select>
              </div>

              {transactionType === 'direct' && (
                <>
                  <div>
                    <label className="block text-sm mb-2" data-testid="transaction-direct-amount-label">المبلغ</label>
                    <input
                      type="number"
                      className="apple-input"
                      value={directAmount}
                      onChange={(e) => setDirectAmount(e.target.value)}
                      data-testid="transaction-direct-amount-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" data-testid="transaction-direct-description-label">الوصف</label>
                    <input
                      type="text"
                      className="apple-input"
                      value={directDescription}
                      onChange={(e) => setDirectDescription(e.target.value)}
                      placeholder="مثال: مصروف بنزين / رسوم تشغيل"
                      data-testid="transaction-direct-description-input"
                    />
                  </div>
                </>
              )}

              {transactionType === 'sale' && (
                <div>
                  <label className="block text-sm mb-2" data-testid="transaction-sale-mode-label">نوع البيع</label>
                  <select
                    className="apple-input"
                    value={saleMode}
                    onChange={(e) => setSaleMode(e.target.value)}
                    data-testid="transaction-sale-mode"
                  >
                    <option value="instant">بيع فوري</option>
                    <option value="vehicle">مركبة</option>
                  </select>
                </div>
              )}

              {transactionType === 'sale' && saleMode === 'vehicle' && (
                <div>
                  <label className="block text-sm mb-2" data-testid="transaction-vehicle-label">المركبة المرتبطة</label>
                  <select
                    className="apple-input"
                    value={transactionVehicleId}
                    onChange={(e) => setTransactionVehicleId(e.target.value)}
                    onFocus={loadVehicles}
                    data-testid="transaction-vehicle-select"
                  >
                    <option value="">اختر مركبة</option>
                    {loadingVehicles && <option value="">جارٍ التحميل...</option>}
                    {vehicleOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber || vehicle.license_plate || vehicle.id}
                      </option>
                    ))}
                    {!loadingVehicles && vehicleOptions.length === 0 && (
                      <option value="">لا توجد مركبات</option>
                    )}
                  </select>
                </div>
              )}
            </div>

            <div className="glass-card p-4 space-y-3" data-testid="transaction-partner-card">
              {transactionType !== 'direct' && (
                <div>
                  <label className="block text-sm mb-2" data-testid="transaction-partner-label">{transactionType === 'sale' ? 'العميل' : 'المورد'}</label>
                  <select
                    className="apple-input"
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    onFocus={() => (transactionType === 'sale' ? loadCustomers() : loadSuppliers())}
                    data-testid="transaction-partner-select"
                  >
                    <option value="">اختر</option>
                    {loadingPartners && <option value="">جارٍ التحميل...</option>}
                    {(transactionType === 'sale' ? customers : suppliers).map((partner) => (
                      <option key={partner.id} value={partner.id}>{partner.name}</option>
                    ))}
                    {!loadingPartners && (transactionType === 'sale' ? customers : suppliers).length === 0 && (
                      <option value="">لا توجد بيانات</option>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm mb-2" data-testid="transaction-account-label">الحساب المحاسبي</label>
                <select
                  className="apple-input"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  onFocus={loadAccounts}
                  data-testid="transaction-account-select"
                >
                  <option value="">اختر الحساب</option>
                  {loadingAccounts && <option value="">جارٍ التحميل...</option>}
                  {accountOptions.map((acc) => (
                    <option key={acc.id || acc.code} value={acc.id || acc.code}>{acc.code} - {acc.name}</option>
                  ))}
                  {!loadingAccounts && accountOptions.length === 0 && (
                    <option value="">لا توجد حسابات</option>
                  )}
                </select>
              </div>

              <div className="text-sm text-slate-300" data-testid="transaction-total-wrapper">
                إجمالي العملية: <span className="font-semibold text-white" data-testid="transaction-total">{transactionTotal.toLocaleString()} ر.س</span>
              </div>
            </div>
          </div>

          {transactionType !== 'direct' && (
            <div className="space-y-3" data-testid="transaction-items-section">
              {transactionItems.map((item, index) => (
                <div key={`transaction-item-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end" data-testid={`transaction-item-row-${index}`}>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-2" data-testid={`transaction-item-part-label-${index}`}>القطعة</label>
                    <select
                      className="apple-input"
                      value={item.partId}
                      onChange={(e) => updateTransactionItem(index, 'partId', e.target.value)}
                      onFocus={loadModalParts}
                      data-testid={`transaction-item-part-${index}`}
                    >
                      <option value="">اختر قطعة</option>
                      {loadingModalParts && <option value="">جارٍ التحميل...</option>}
                      {partOptions.map((part) => (
                        <option key={part.id} value={part.id}>{part.name}</option>
                      ))}
                      {!loadingModalParts && partOptions.length === 0 && (
                        <option value="">لا توجد قطع</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-2" data-testid={`transaction-item-qty-label-${index}`}>الكمية</label>
                    <input
                      type="number"
                      className="apple-input"
                      value={item.quantity}
                      onChange={(e) => updateTransactionItem(index, 'quantity', Number(e.target.value))}
                      data-testid={`transaction-item-qty-${index}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2" data-testid={`transaction-item-price-label-${index}`}>السعر</label>
                    <input
                      type="number"
                      className="apple-input"
                      value={item.price}
                      onChange={(e) => updateTransactionItem(index, 'price', Number(e.target.value))}
                      data-testid={`transaction-item-price-${index}`}
                    />
                  </div>
                  {transactionItems.length > 1 && (
                    <button
                      className="text-sm text-red-500"
                      type="button"
                      onClick={() => removeTransactionItem(index)}
                      data-testid={`transaction-item-remove-${index}`}
                    >
                      حذف البند
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center" data-testid="transaction-footer-actions">
            {transactionType !== 'direct' ? (
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-white/10 text-white"
                onClick={addTransactionItem}
                data-testid="transaction-add-item"
              >
                + إضافة قطعة أخرى
              </button>
            ) : <div />}
            <Button onClick={submitTransaction} data-testid="transaction-submit">
              {transactionType === 'direct' ? 'حفظ العملية المباشرة' : 'حفظ العملية'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
