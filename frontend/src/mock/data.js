// Mock data for Workshop Management System

export const vehicles = [
  {
    id: '1',
    plateNumber: 'أ ب ج 1234',
    brand: 'تويوتا',
    model: 'كامري',
    year: 2020,
    color: 'أبيض',
    customerId: '1',
    customerName: 'محمد أحمد',
    customerPhone: '0501234567',
    status: 'diagnosis',
    services: ['فحص شامل', 'تغيير زيت'],
    technicianId: '1',
    technicianName: 'أحمد علي',
    entryDate: '2025-01-15T10:30:00',
    estimatedCompletion: '2025-01-17T16:00:00',
    images: [],
    notes: 'صوت غريب من المحرك',
    trackingLink: 'TRK-001'
  },
  {
    id: '2',
    plateNumber: 'د ه و 5678',
    brand: 'هوندا',
    model: 'أكورد',
    year: 2019,
    color: 'أسود',
    customerId: '2',
    customerName: 'خالد سعيد',
    customerPhone: '0559876543',
    status: 'quotation',
    services: ['تبديل فرامل', 'ضبط عجلات'],
    technicianId: '2',
    technicianName: 'عمر حسن',
    entryDate: '2025-01-16T09:00:00',
    estimatedCompletion: '2025-01-18T14:00:00',
    images: [],
    notes: 'صوت احتكاك عند الفرملة',
    trackingLink: 'TRK-002'
  },
  {
    id: '3',
    plateNumber: 'ز ح ط 9012',
    brand: 'نيسان',
    model: 'التيما',
    year: 2021,
    color: 'فضي',
    customerId: '3',
    customerName: 'عبدالله محمد',
    customerPhone: '0501112233',
    status: 'repair',
    services: ['إصلاح تكييف', 'صيانة دورية'],
    technicianId: '1',
    technicianName: 'أحمد علي',
    entryDate: '2025-01-14T11:00:00',
    estimatedCompletion: '2025-01-16T17:00:00',
    images: [],
    notes: 'تكييف لا يبرد بشكل جيد',
    trackingLink: 'TRK-003'
  },
  {
    id: '4',
    plateNumber: 'ي ك ل 3456',
    brand: 'فورد',
    model: 'اكسبلورر',
    year: 2018,
    color: 'أزرق',
    customerId: '4',
    customerName: 'فهد العتيبي',
    customerPhone: '0554445566',
    status: 'ready',
    services: ['فحص كهرباء', 'تبديل بطارية'],
    technicianId: '3',
    technicianName: 'سعد الدوسري',
    entryDate: '2025-01-13T08:30:00',
    estimatedCompletion: '2025-01-15T12:00:00',
    completionDate: '2025-01-15T11:30:00',
    images: [],
    notes: 'تم تبديل البطارية بنجاح',
    trackingLink: 'TRK-004'
  }
];

export const customers = [
  {
    id: '1',
    name: 'محمد أحمد',
    phone: '0501234567',
    email: 'mohamed@example.com',
    vehicles: ['أ ب ج 1234'],
    totalVisits: 5,
    lastVisit: '2025-01-15T10:30:00'
  },
  {
    id: '2',
    name: 'خالد سعيد',
    phone: '0559876543',
    email: 'khaled@example.com',
    vehicles: ['د ه و 5678'],
    totalVisits: 3,
    lastVisit: '2025-01-16T09:00:00'
  },
  {
    id: '3',
    name: 'عبدالله محمد',
    phone: '0501112233',
    email: 'abdullah@example.com',
    vehicles: ['ز ح ط 9012'],
    totalVisits: 8,
    lastVisit: '2025-01-14T11:00:00'
  },
  {
    id: '4',
    name: 'فهد العتيبي',
    phone: '0554445566',
    email: 'fahad@example.com',
    vehicles: ['ي ك ل 3456'],
    totalVisits: 2,
    lastVisit: '2025-01-13T08:30:00'
  }
];

export const technicians = [
  {
    id: '1',
    name: 'أحمد علي',
    phone: '0502223344',
    specialty: 'محركات',
    activeJobs: 2,
    completedJobs: 45,
    rating: 4.8
  },
  {
    id: '2',
    name: 'عمر حسن',
    phone: '0555556666',
    specialty: 'فرامل وتعليق',
    activeJobs: 1,
    completedJobs: 38,
    rating: 4.6
  },
  {
    id: '3',
    name: 'سعد الدوسري',
    phone: '0507778888',
    specialty: 'كهرباء',
    activeJobs: 0,
    completedJobs: 52,
    rating: 4.9
  },
  {
    id: '4',
    name: 'يوسف القحطاني',
    phone: '0509998877',
    specialty: 'تكييف',
    activeJobs: 1,
    completedJobs: 41,
    rating: 4.7
  }
];

export const services = [
  {
    id: '1',
    name: 'فحص شامل',
    category: 'تشخيص',
    price: 150,
    duration: 60
  },
  {
    id: '2',
    name: 'تغيير زيت',
    category: 'صيانة دورية',
    price: 120,
    duration: 30
  },
  {
    id: '3',
    name: 'تبديل فرامل',
    category: 'فرامل',
    price: 400,
    duration: 120
  },
  {
    id: '4',
    name: 'إصلاح تكييف',
    category: 'تكييف',
    price: 350,
    duration: 90
  },
  {
    id: '5',
    name: 'تبديل بطارية',
    category: 'كهرباء',
    price: 300,
    duration: 45
  },
  {
    id: '6',
    name: 'ضبط عجلات',
    category: 'إطارات',
    price: 100,
    duration: 40
  }
];

export const statusSteps = [
  { key: 'diagnosis', label: 'تشخيص', color: 'bg-blue-500' },
  { key: 'quotation', label: 'تعميد', color: 'bg-yellow-500' },
  { key: 'approved', label: 'معتمد', color: 'bg-emerald-500' },
  { key: 'repair', label: 'تحت الإصلاح', color: 'bg-orange-500' },
  { key: 'ready', label: 'جاهز للتسليم', color: 'bg-green-500' },
  { key: 'delivered', label: 'تم التسليم', color: 'bg-slate-500' }
];

export const getStatusLabel = (status) => {
  const step = statusSteps.find(s => s.key === status);
  return step ? step.label : status;
};

export const getStatusColor = (status) => {
  const step = statusSteps.find(s => s.key === status);
  return step ? step.color : 'bg-gray-500';
};