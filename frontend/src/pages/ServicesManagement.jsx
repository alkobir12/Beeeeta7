import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ServicesManagement = () => {
  const { t, i18n } = useTranslation();
  const [services, setServices] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [form, setForm] = useState({ name: '', category: '', price: 0, duration: 30 });

  const load = async () => {
    const res = await axios.get(`${API_URL}/services`);
    setServices(res.data || []);
  };

  useEffect(() => { load(); }, []);

  const addService = async (e) => {
    e.preventDefault();
    await axios.post(`${API_URL}/services`, { ...form });
    setForm({ name: '', category: '', price: 0, duration: 30 });
    await load();
  };

  const remove = async (id) => {
    await axios.delete(`${API_URL}/services/${id}`);
    await load();
  };

  const categories = ['all', ...new Set(services.map(s => s.category))];
  const filtered = services.filter(s => (category === 'all' || s.category === category) && s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout>
      <div className="min-h-screen" dir={i18n.dir()}>
        <div className="container mx-auto p-6 max-w-5xl">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">{t('nav.inventory')}</h1>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{t('services.addTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={addService} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder={t('common.name')} value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} required />
                <Input placeholder={t('common.category')} value={form.category} onChange={e=>setForm({ ...form, category: e.target.value })} required />
                <Input type="number" placeholder={t('common.price')} value={form.price} onChange={e=>setForm({ ...form, price: e.target.value })} />
                <Input type="number" placeholder={t('services.duration')} value={form.duration} onChange={e=>setForm({ ...form, duration: e.target.value })} />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">{t('common.save')}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('services.listTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-3">
                <Input placeholder={t('common.search')} value={search} onChange={e=>setSearch(e.target.value)} />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c === 'all' ? t('common.all') : c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 max-h-[480px] overflow-auto">
                {filtered.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded border">
                    <div>
                      <div className="font-bold">{s.name}</div>
                      <div className="text-sm text-slate-500">{s.category} • {Number(s.price).toFixed(2)} {t('common.currency')} • {s.duration} {t('common.minute')}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={()=>remove(s.id)}>{t('common.delete')}</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ServicesManagement;
