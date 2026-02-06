import React, { useState, useEffect } from 'react';
import { Car, Search, Calendar, User, Phone, FileText, MoreVertical, Wrench, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { vehicleAPI } from '../services/api';
import { getStatusLabel, getStatusColor } from '../mock/data';

const VehicleArchive = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('delivered'); // Default to delivered

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const response = await vehicleAPI.getAll();
      setVehicles(response.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleDelete = async (vehicleId) => {
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await vehicleAPI.delete(vehicleId);
      toast({ title: "تم الحذف", description: "تم حذف المركبة من الأرشيف" });
      fetchVehicles();
    } catch (error) { toast({ title: "خطأ", variant: "destructive" }); }
  };

  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = !searchQuery || 
      vehicle.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">أرشيف المركبات</h1>
            <p className="text-gray-500 mt-1">سجل كامل لجميع المركبات والصيانات السابقة</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="apple-card p-5 flex items-center justify-between">
            <div><p className="text-sm text-gray-500 mb-1">إجمالي المركبات</p><p className="text-2xl font-bold text-blue-600">{vehicles.length}</p></div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Car size={20} /></div>
          </div>
          <div className="apple-card p-5 flex items-center justify-between">
            <div><p className="text-sm text-gray-500 mb-1">تم التسليم</p><p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.status === 'delivered').length}</p></div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><FileText size={20} /></div>
          </div>
          <div className="apple-card p-5 flex items-center justify-between">
            <div><p className="text-sm text-gray-500 mb-1">قيد العمل</p><p className="text-2xl font-bold text-orange-600">{vehicles.filter(v => v.status !== 'delivered' && v.status !== 'ready').length}</p></div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600"><Wrench size={20} /></div>
          </div>
        </div>

        <div className="apple-card p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input className="apple-input pr-10" placeholder="بحث برقم اللوحة أو اسم العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {['all', 'diagnosis', 'quotation', 'repair', 'ready', 'delivered'].map(status => (
              <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {status === 'all' ? 'الكل' : getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              لا توجد مركبات في هذا التصنيف
            </div>
          ) : (
            filteredVehicles.map(vehicle => (
              <div key={vehicle.id} onClick={() => navigate(`/vehicle/${vehicle.id}`)} className="apple-card p-5 hover:shadow-md transition-all cursor-pointer group">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg">
                      {vehicle.brand?.[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-gray-900 text-lg">{vehicle.plateNumber}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(vehicle.status)} text-white`}>{getStatusLabel(vehicle.status)}</span>
                      </div>
                      <p className="text-gray-500 text-sm">{vehicle.brand} {vehicle.model} - {vehicle.year}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><User size={14} /> {vehicle.customerName}</span>
                        <span className="flex items-center gap-1"><Phone size={14} /> {vehicle.customerPhone}</span>
                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(vehicle.entryDate).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity self-start md:self-center">
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(vehicle.id); }} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    <button className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors"><MoreVertical size={18} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    
  );
};

export default VehicleArchive;
