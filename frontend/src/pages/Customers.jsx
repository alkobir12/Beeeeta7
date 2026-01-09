import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Phone, Mail, Plus, Edit, Trash2, Car, MapPin } from 'lucide-react';
import { customerAPI } from '../services/api';
import { useToast } from '../hooks/use-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Customers = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', address: '',
    vehicleBrand: '', vehiclePlate: '', vehicleKm: 0
  });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll(searchQuery);
      setCustomers(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await customerAPI.update(editingCustomer.id, formData);
        toast({ title: t('common.success'), description: t('messages.success_updated') });
      } else {
        await customerAPI.create(formData);
        toast({ title: t('common.success'), description: t('messages.success_saved') });
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', address: '', vehicleBrand: '', vehiclePlate: '', vehicleKm: 0 });
      fetchCustomers();
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    try {
      await customerAPI.delete(id);
      toast({ title: t('common.success'), description: t('messages.success_deleted') });
      fetchCustomers();
    } catch (error) {
      toast({ title: t('common.error'), description: t('messages.error_occurred'), variant: "destructive" });
    }
  };

  const openModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        vehicleBrand: '', vehiclePlate: '', vehicleKm: 0
      });
    } else {
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', email: '', address: '', vehicleBrand: '', vehiclePlate: '', vehicleKm: 0 });
    }
    setShowModal(true);
  };

  return (
    <div className={`max-w-7xl mx-auto space-y-6 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('customers.customers')}</h1>
            <p className="text-gray-500 mt-1">{t('customers.customer_profile')}</p>
          </div>
          <button 
            onClick={() => openModal()}
            className="apple-button flex items-center gap-2"
          >
            <Plus size={18} />
            <span>{t('customers.add_customer')}</span>
          </button>
        </div>

        {/* Search */}
        <div className="apple-card p-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              placeholder={"Search by name or phone..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="apple-input pr-10"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map(customer => (
              <div key={customer.id} className="apple-card p-5 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg group-hover:bg-blue-500/10 group-hover:text-blue-400 transition-colors">
                      {customer.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{customer.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <Phone size={12} />
                        <span dir="ltr">{customer.phone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openModal(customer)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-gray-50">
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail size={14} className="text-gray-400" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-gray-400" />
                      <span>{customer.address}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Car size={14} className="text-gray-400" />
                    <span>{customer.totalVisits || 0} {"visits"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingCustomer ? "Edit" : "Add Customer"}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{"Name"}</label>
                    <input required className="apple-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{"Phone"}</label>
                    <input required className="apple-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{"Email"}</label>
                  <input type="email" className="apple-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{"Address"}</label>
                  <input className="apple-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>

                {!editingCustomer && (
                  <div className="bg-gray-50 p-4 rounded-xl space-y-4 mt-4">
                    <h3 className="font-medium text-gray-900 text-sm">{"Vehicle Info (optional)"}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <input placeholder={"Vehicle Brand"} className="apple-input bg-white" value={formData.vehicleBrand} onChange={e => setFormData({...formData, vehicleBrand: e.target.value})} />
                      <input placeholder={"Plate Number"} className="apple-input bg-white" value={formData.vehiclePlate} onChange={e => setFormData({...formData, vehiclePlate: e.target.value})} />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 apple-button-secondary">{"Cancel"}</button>
                  <button type="submit" className="flex-1 apple-button">{"Save"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
};

export default Customers;
