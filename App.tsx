
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Users,
  User, 
  Wrench, 
  PlusCircle, 
  Search, 
  Phone, 
  Mail, 
  MessageSquare, 
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Printer,
  FileText,
  Trash2,
  Edit2,
  ClipboardList,
  Send,
  Bot,
  LogOut,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  XCircle
} from 'lucide-react';
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { 
  Customer, 
  Order, 
  OrderStatus, 
  ViewState,
  NotificationTemplate,
  StatusHistoryEntry
} from './types';
import * as Storage from './services/storageService';
import * as Gemini from './services/geminiService';
import * as TemplateService from './services/templateService';
import * as NotificationService from './services/notificationService';

const statusColors: Record<OrderStatus, string> = {
  [OrderStatus.RECEIVED]: 'bg-slate-100 text-slate-700 border-slate-200',
  [OrderStatus.DIAGNOSIS]: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  [OrderStatus.WAITING_PARTS]: 'bg-orange-50 text-orange-700 border-orange-200',
  [OrderStatus.IN_PROGRESS]: 'bg-blue-50 text-blue-700 border-blue-200',
  [OrderStatus.READY]: 'bg-green-50 text-green-700 border-green-200',
  [OrderStatus.COMPLETED]: 'bg-gray-100 text-gray-500 border-gray-200 decoration-slice',
};

type SortDirection = 'asc' | 'desc';

interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

function App() {
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  
  // Filters & Sorting State
  const [customerFilterId, setCustomerFilterId] = useState<string | null>(null);
  
  // Advanced Filtering & Sorting
  const [customerSort, setCustomerSort] = useState<SortConfig<Customer>>({ key: 'id', direction: 'desc' });
  const [customerFilters, setCustomerFilters] = useState<Record<string, string>>({});
  
  const [orderSort, setOrderSort] = useState<SortConfig<Order>>({ key: 'updatedAt', direction: 'desc' });
  const [orderFilters, setOrderFilters] = useState<Record<string, string>>({});

  // Modal States
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  // Selection States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [generatedSubject, setGeneratedSubject] = useState<string>(''); // For emails
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Form States
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({ type: 'INDIVIDUAL' });
  const [newOrder, setNewOrder] = useState<Partial<Order>>({ status: OrderStatus.RECEIVED });
  const [newTemplate, setNewTemplate] = useState<Partial<NotificationTemplate>>({ type: 'SMS' });
  const [diagnosisSuggestion, setDiagnosisSuggestion] = useState<string>('');
  
  // Notification Modal specific states
  const [notificationMode, setNotificationMode] = useState<'AI' | 'TEMPLATE'>('TEMPLATE');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [notificationType, setNotificationType] = useState<'SMS' | 'EMAIL'>('SMS');

  // Client Portal State
  const [clientPortalQuery, setClientPortalQuery] = useState({ orderId: '', phone: '' });
  const [clientPortalResponse, setClientPortalResponse] = useState<string>('');
  const [isClientChecking, setIsClientChecking] = useState(false);

  // --- Effects ---
  useEffect(() => {
    setCustomers(Storage.getCustomers());
    setOrders(Storage.getOrders());
    setTemplates(Storage.getTemplates());
  }, []);

  // --- Handlers ---

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    
    // Generate new ID (4 digits)
    const newId = Storage.getNextCustomerId();

    const customer: Customer = {
      id: newId,
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || '',
      type: newCustomer.type as 'INDIVIDUAL' | 'COMPANY',
      nip: newCustomer.nip || '',
      notes: newCustomer.notes || '',
      createdAt: Date.now(),
    };
    
    Storage.saveCustomer(customer);
    setCustomers(Storage.getCustomers());
    setNewCustomer({ type: 'INDIVIDUAL' });
    setIsCustomerModalOpen(false);
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.customerId || !newOrder.deviceName || !newOrder.issueDescription) return;

    // Check for status change to READY before saving
    const previousStatus = selectedOrder ? selectedOrder.status : null;
    const nextStatus = newOrder.status as OrderStatus;
    const isStatusChangedToReady = nextStatus === OrderStatus.READY && previousStatus !== OrderStatus.READY;
    const isStatusChanged = nextStatus !== previousStatus;

    // Handle History Logic
    let history: StatusHistoryEntry[] = selectedOrder?.history ? [...selectedOrder.history] : [];
    
    // If it's a new order or status has changed, add to history
    if (!selectedOrder || isStatusChanged) {
      history.push({
        status: nextStatus,
        timestamp: Date.now()
      });
    }

    const order: Order = {
      id: selectedOrder ? selectedOrder.id : Storage.getNextOrderId(),
      customerId: newOrder.customerId,
      deviceName: newOrder.deviceName,
      serialNumber: newOrder.serialNumber || '',
      issueDescription: newOrder.issueDescription,
      status: nextStatus,
      diagnosis: newOrder.diagnosis || '',
      estimatedCost: newOrder.estimatedCost ? Number(newOrder.estimatedCost) : undefined,
      finalCost: newOrder.finalCost ? Number(newOrder.finalCost) : undefined,
      createdAt: selectedOrder ? selectedOrder.createdAt : Date.now(),
      updatedAt: Date.now(),
      technicianNotes: newOrder.technicianNotes || '',
      history: history
    };

    Storage.saveOrder(order);
    setOrders(Storage.getOrders());
    setIsOrderModalOpen(false);

    // Prompt for notification if status changed to READY
    if (isStatusChangedToReady) {
       setSelectedOrder(order); // Set the active order for the notification context
       // Use a timeout to allow the modal to close and UI to update
       setTimeout(() => {
          if (window.confirm("Status zlecenia zmieniony na 'GOTOWE DO ODBIORU'. Czy chcesz wysłać powiadomienie do klienta?")) {
              setIsNotificationModalOpen(true);
              // Try to find a 'Ready' template and pre-select it
              const readyTemplate = templates.find(t => t.id.includes('ready') || t.name.toLowerCase().includes('gotowe'));
              if (readyTemplate) {
                  setNotificationMode('TEMPLATE');
                  // We need to trigger the logic that handleApplyTemplate does, but we can't call it directly easily due to state async.
                  // Instead we setup the state so the Modal renders correctly.
                  setSelectedTemplateId(readyTemplate.id);
                  const customer = customers.find(c => c.id === order.customerId);
                  if (customer) {
                      const processedBody = TemplateService.processTemplate(readyTemplate.body, order, customer);
                      setGeneratedMessage(processedBody);
                      setGeneratedSubject(readyTemplate.subject || '');
                      setNotificationType(readyTemplate.type);
                  }
              }
          } else {
              // Reset if they say no
              setSelectedOrder(null);
              setNewOrder({ status: OrderStatus.RECEIVED });
          }
       }, 200);
    } else {
       // Cleanup if not prompting
       setNewOrder({ status: OrderStatus.RECEIVED });
       setSelectedOrder(null);
    }
  };

  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setNewOrder(order);
    setIsOrderModalOpen(true);
    setDiagnosisSuggestion('');
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if(!newTemplate.name || !newTemplate.body) return;

    const template: NotificationTemplate = {
      id: newTemplate.id || crypto.randomUUID(),
      name: newTemplate.name,
      body: newTemplate.body,
      type: newTemplate.type as 'SMS' | 'EMAIL',
      subject: newTemplate.subject || ''
    };

    Storage.saveTemplate(template);
    setTemplates(Storage.getTemplates());
    setIsTemplateModalOpen(false);
    setNewTemplate({ type: 'SMS' });
  };

  const handleGenerateMessage = async (type: 'SMS' | 'EMAIL') => {
    if (!selectedOrder) return;
    const customer = customers.find(c => c.id === selectedOrder.customerId);
    if (!customer) return;

    setNotificationType(type);
    setIsGenerating(true);
    const msg = await Gemini.generateCustomerNotification(selectedOrder, customer, type);
    setGeneratedMessage(msg);
    setGeneratedSubject(type === 'EMAIL' ? `Informacja o zleceniu ${selectedOrder.deviceName}` : '');
    setIsGenerating(false);
  };

  const handleApplyTemplate = (templateId: string) => {
    if (!selectedOrder) return;
    const customer = customers.find(c => c.id === selectedOrder.customerId);
    if (!customer) return;
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const processedBody = TemplateService.processTemplate(template.body, selectedOrder, customer);
    setGeneratedMessage(processedBody);
    setNotificationType(template.type);
    
    if (template.type === 'EMAIL' && template.subject) {
      setGeneratedSubject(template.subject);
    } else {
      setGeneratedSubject('');
    }
    
    setSelectedTemplateId(templateId);
  };

  const handleSendNotification = async () => {
    if (!selectedOrder || !generatedMessage) return;
    const customer = customers.find(c => c.id === selectedOrder.customerId);
    
    if (!customer) {
      alert("Nie znaleziono danych klienta.");
      return;
    }

    setIsSending(true);
    
    try {
      let success = false;
      
      if (notificationType === 'SMS') {
        if (!customer.phone) {
          throw new Error("Brak numeru telefonu klienta.");
        }
        success = await NotificationService.sendSms(customer.phone, generatedMessage);
      } else {
        if (!customer.email) {
          throw new Error("Brak adresu email klienta.");
        }
        success = await NotificationService.sendEmail(customer.email, generatedSubject || 'Powiadomienie Serwisowe', generatedMessage);
      }

      if (success) {
        alert(`${notificationType === 'SMS' ? 'SMS został wysłany' : 'Email został wysłany'} pomyślnie.`);
        setIsNotificationModalOpen(false);
        setGeneratedMessage('');
        setGeneratedSubject('');
      } else {
        throw new Error("Serwis powiadomień nie potwierdził wysyłki.");
      }
    } catch (error: any) {
      console.error("Błąd wysyłania powiadomienia:", error);
      alert(`Nie udało się wysłać powiadomienia.\nBłąd: ${error.message || 'Nieznany błąd'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleAiDiagnosis = async () => {
    if (!newOrder.deviceName || !newOrder.issueDescription) return;
    setIsGenerating(true);
    const suggestion = await Gemini.generateDiagnosisSuggestion(newOrder.deviceName, newOrder.issueDescription);
    setDiagnosisSuggestion(suggestion);
    setIsGenerating(false);
  };

  const handleClientPortalCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsClientChecking(true);
    setClientPortalResponse('');

    // Simulate search delay
    await new Promise(r => setTimeout(r, 800));

    // Simple auth check: Order ID matches Customer Phone? 
    // For demo purposes, we will match Order ID (or part of it) and verify if the customer linked to it has that phone number.
    
    const order = orders.find(o => o.id === clientPortalQuery.orderId || o.id.startsWith(clientPortalQuery.orderId));
    
    if (!order) {
      setClientPortalResponse("Nie znaleziono zlecenia o podanym numerze. Sprawdź poprawność danych.");
      setIsClientChecking(false);
      return;
    }

    const customer = customers.find(c => c.id === order.customerId);
    
    // Very basic 'auth' - check if entered phone is contained in customer phone
    if (!customer || !customer.phone.replace(/\D/g,'').includes(clientPortalQuery.phone.replace(/\D/g,''))) {
       setClientPortalResponse("Numer telefonu nie pasuje do tego zlecenia.");
       setIsClientChecking(false);
       return;
    }

    // Generate AI response
    const response = await Gemini.generateClientStatusResponse(order, customer);
    setClientPortalResponse(response);
    setIsClientChecking(false);
  };

  // --- Sorting & Filtering Helpers ---

  const handleSort = <T,>(
    key: keyof T | string,
    currentSort: SortConfig<T>,
    setSort: React.Dispatch<React.SetStateAction<SortConfig<T>>>
  ) => {
    let direction: SortDirection = 'asc';
    if (currentSort.key === key && currentSort.direction === 'asc') {
      direction = 'desc';
    }
    setSort({ key, direction });
  };

  const getSortedAndFilteredData = <T extends Record<string, any>>(
    data: T[],
    filters: Record<string, string>,
    sortConfig: SortConfig<T>,
    searchFields: (keyof T)[] // For the generic text matching
  ) => {
    return data.filter(item => {
      // 1. Column specific filters
      for (const key in filters) {
        if (filters[key]) {
          const itemValue = String(item[key] || '').toLowerCase();
          const filterValue = filters[key].toLowerCase();
          
          // Special case for timestamp dates
          if ((key === 'createdAt' || key === 'updatedAt') && typeof item[key] === 'number') {
             const date = new Date(item[key]);
             // If filterValue matches YYYY-MM-DD (Date Input Format)
             if (/^\d{4}-\d{2}-\d{2}$/.test(filterValue)) {
                 const isoDate = date.toISOString().split('T')[0];
                 if (isoDate !== filterValue) return false;
             } else {
                 // Fallback to text string match (DD.MM.YYYY)
                 const dateStr = date.toLocaleDateString('pl-PL');
                 if (!dateStr.includes(filterValue)) return false;
             }
          } 
          // Default string match
          else if (!itemValue.includes(filterValue)) {
            return false;
          }
        }
      }
      return true;
    }).sort((a, b) => {
      // 2. Sorting
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];

      if (aValue === bValue) return 0;
      
      const modifier = sortConfig.direction === 'asc' ? 1 : -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * modifier;
      }
      // Handle nulls/undefined
      return ((aValue || 0) > (bValue || 0) ? 1 : -1) * modifier;
    });
  };

  // --- Sub-components ---

  const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-colors ${
        active 
          ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  const StatusBadge = ({ status }: { status: OrderStatus }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[status]}`}>
      {status}
    </span>
  );

  const SortIcon = ({ active, direction }: { active: boolean, direction: SortDirection }) => {
    if (!active) return <ArrowUpDown size={14} className="ml-1 text-slate-300" />;
    return direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-blue-600" /> 
      : <ArrowDown size={14} className="ml-1 text-blue-600" />;
  };

  const TableHeader = ({ label, sortKey, currentSort, onSort, className = "" }: any) => (
    <th 
      className={`px-6 py-3 font-medium cursor-pointer hover:bg-slate-100 transition-colors select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon active={currentSort.key === sortKey} direction={currentSort.direction} />
      </div>
    </th>
  );

  const FilterInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder?: string }) => (
    <div className="relative">
      <input 
        type="text"
        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        placeholder={placeholder || "Filtruj..."}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button 
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <XCircle size={10} />
        </button>
      )}
    </div>
  );

  // --- Views ---

  const renderDashboard = () => {
    const activeOrders = orders.filter(o => o.status !== OrderStatus.COMPLETED);
    const readyOrders = orders.filter(o => o.status === OrderStatus.READY);
    const revenue = orders
      .filter(o => o.status === OrderStatus.COMPLETED && o.updatedAt > Date.now() - 2592000000) // Last 30 days approx
      .reduce((acc, curr) => acc + (curr.finalCost || 0), 0);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Pulpit Serwisu</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Aktywne naprawy</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{activeOrders.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <Wrench size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Gotowe do odbioru</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{readyOrders.length}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-green-600">
                <CheckCircle size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Przychód (30 dni)</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{revenue} PLN</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-slate-600">
                <Users size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-800">Ostatnie zlecenia</h2>
            <Button variant="ghost" size="sm" onClick={() => { setView('ORDERS'); setCustomerFilterId(null); }}>Zobacz wszystkie</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Klient</th>
                  <th className="px-6 py-3 font-medium">Urządzenie</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Data przyjęcia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.slice(0, 5).map(order => {
                  const cust = customers.find(c => c.id === order.customerId);
                  return (
                    <tr key={order.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleEditOrder(order)}>
                      <td className="px-6 py-3 font-medium text-slate-900">
                        {cust ? (
                          <>
                             <span className="text-xs text-slate-400 font-mono mr-2">[{cust.id}]</span>
                             {cust.name}
                          </>
                        ) : 'Nieznany'}
                      </td>
                      <td className="px-6 py-3 text-slate-600">{order.deviceName}</td>
                      <td className="px-6 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-6 py-3 text-slate-500">{new Date(order.createdAt).toLocaleDateString('pl-PL')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderClientPortal = () => {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">
           <div className="bg-blue-600 p-6 text-center text-white">
             <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
               <Bot size={24} />
             </div>
             <h2 className="text-xl font-bold">Strefa Klienta Flewer</h2>
             <p className="text-blue-100 text-sm mt-1">Sprawdź status swojej naprawy z AI Asystentem</p>
           </div>
           
           <div className="p-6">
             <form onSubmit={handleClientPortalCheck} className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Numer Zlecenia (ID)</label>
                 <input 
                   required
                   placeholder="np. 0001/05/25"
                   className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                   value={clientPortalQuery.orderId}
                   onChange={e => setClientPortalQuery({...clientPortalQuery, orderId: e.target.value})}
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Numer Telefonu (Weryfikacja)</label>
                 <input 
                   required
                   placeholder="np. 500123456"
                   className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                   value={clientPortalQuery.phone}
                   onChange={e => setClientPortalQuery({...clientPortalQuery, phone: e.target.value})}
                 />
               </div>
               <Button 
                  className="w-full h-12 text-lg" 
                  disabled={isClientChecking}
                >
                  {isClientChecking ? 'Sprawdzanie...' : 'Zapytaj Asystenta'}
               </Button>
             </form>

             {clientPortalResponse && (
               <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 relative">
                   <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-blue-600 flex items-center border border-blue-100 rounded-full">
                     <Sparkles size={12} className="mr-1" /> Asystent AI
                   </div>
                   <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                     {clientPortalResponse}
                   </p>
                 </div>
               </div>
             )}
           </div>
           <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
             <button onClick={() => setView('DASHBOARD')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center w-full">
               <LogOut size={12} className="mr-1" /> Powrót do panelu pracownika
             </button>
           </div>
        </div>
      </div>
    );
  };

  const renderCustomers = () => {
    const sortedCustomers = getSortedAndFilteredData(customers, customerFilters, customerSort, []);

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Baza Klientów</h1>
          <Button onClick={() => setIsCustomerModalOpen(true)}><PlusCircle size={18} className="mr-2" /> Dodaj klienta</Button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                {/* Header Row with Sort */}
                <tr>
                  <TableHeader label="ID" sortKey="id" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <TableHeader label="Nazwa Klienta" sortKey="name" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <TableHeader label="Telefon" sortKey="phone" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <TableHeader label="Email" sortKey="email" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <TableHeader label="Typ" sortKey="type" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <TableHeader label="NIP" sortKey="nip" currentSort={customerSort} onSort={(k: any) => handleSort(k, customerSort, setCustomerSort)} />
                  <th className="px-6 py-3 font-medium text-right">Akcje</th>
                </tr>
                {/* Filter Row */}
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-2"><FilterInput value={customerFilters.id} onChange={(v) => setCustomerFilters({...customerFilters, id: v})} placeholder="ID" /></th>
                  <th className="px-6 py-2"><FilterInput value={customerFilters.name} onChange={(v) => setCustomerFilters({...customerFilters, name: v})} placeholder="Nazwisko/Firma" /></th>
                  <th className="px-6 py-2"><FilterInput value={customerFilters.phone} onChange={(v) => setCustomerFilters({...customerFilters, phone: v})} placeholder="Telefon" /></th>
                  <th className="px-6 py-2"><FilterInput value={customerFilters.email} onChange={(v) => setCustomerFilters({...customerFilters, email: v})} placeholder="Email" /></th>
                  <th className="px-6 py-2">
                    <select 
                       className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                       value={customerFilters.type || ''}
                       onChange={e => setCustomerFilters({...customerFilters, type: e.target.value})}
                    >
                      <option value="">Wszystkie</option>
                      <option value="INDIVIDUAL">Prywatna</option>
                      <option value="COMPANY">Firma</option>
                    </select>
                  </th>
                  <th className="px-6 py-2"><FilterInput value={customerFilters.nip} onChange={(v) => setCustomerFilters({...customerFilters, nip: v})} placeholder="NIP" /></th>
                  <th className="px-6 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCustomers.length > 0 ? sortedCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono text-slate-500">{customer.id}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{customer.name}</td>
                    <td className="px-6 py-3 text-slate-600">{customer.phone}</td>
                    <td className="px-6 py-3 text-slate-600">{customer.email || '-'}</td>
                    <td className="px-6 py-3">
                       <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${customer.type === 'COMPANY' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                         {customer.type === 'COMPANY' ? 'Firma' : 'Prywatny'}
                       </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-mono text-xs">{customer.nip || '-'}</td>
                    <td className="px-6 py-3 text-right">
                       <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-slate-600"
                            onClick={() => {
                               setCustomerFilterId(customer.id);
                               setView('ORDERS');
                            }}
                          >
                            <ClipboardList size={16} />
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => {
                              setNewOrder({ customerId: customer.id, status: OrderStatus.RECEIVED });
                              setIsOrderModalOpen(true);
                            }}
                          >
                            <PlusCircle size={16} />
                          </Button>
                       </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      Brak klientów spełniających kryteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTemplates = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Szablony Powiadomień</h1>
        <Button onClick={() => {
          setNewTemplate({ type: 'SMS' });
          setIsTemplateModalOpen(true);
        }}>
          <PlusCircle size={18} className="mr-2" /> Dodaj Szablon
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
        <strong className="font-semibold">Dostępne zmienne:</strong> {' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{'{{customer}}'}</span> (Klient), {' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{'{{device}}'}</span> (Sprzęt), {' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{'{{cost}}'}</span> (Koszt), {' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{'{{diagnosis}}'}</span> (Diagnoza), {' '}
        <span className="font-mono bg-blue-100 px-1 rounded">{'{{issue}}'}</span> (Usterka)
      </div>

      <div className="grid grid-cols-1 gap-4">
        {templates.map(template => (
          <div key={template.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                 <div className={`p-2 rounded-lg ${template.type === 'SMS' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                    {template.type === 'SMS' ? <MessageSquare size={18} /> : <Mail size={18} />}
                 </div>
                 <div>
                    <h3 className="font-semibold text-slate-900">{template.name}</h3>
                    {template.subject && <p className="text-xs text-slate-500">Temat: {template.subject}</p>}
                 </div>
              </div>
              <div className="flex space-x-2">
                 <button onClick={() => { setNewTemplate(template); setIsTemplateModalOpen(true); }} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                   <Edit2 size={16} />
                 </button>
                 <button onClick={() => {
                   if(confirm('Usunąć ten szablon?')) {
                     Storage.deleteTemplate(template.id);
                     setTemplates(Storage.getTemplates());
                   }
                 }} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>
            <div className="mt-3 p-3 bg-slate-50 rounded text-sm text-slate-600 font-mono whitespace-pre-wrap border border-slate-100">
               {template.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderOrders = () => {
    // 1. Enrich orders with flattened customer data for sorting/filtering
    const enrichedOrders = orders.map(o => {
      const c = customers.find(cust => cust.id === o.customerId);
      return {
        ...o,
        customerName: c ? c.name : '',
        customerContact: c ? `${c.phone} ${c.email || ''}` : '',
        customerPhone: c ? c.phone : '',
        customerEmail: c ? c.email : ''
      };
    });

    // 2. Pre-filter by customer if selected from sidebar/list
    let activeData = enrichedOrders;
    if (customerFilterId) {
      activeData = activeData.filter(o => o.customerId === customerFilterId);
    }

    // 3. Apply Column Filters & Sorting
    const processedOrders = getSortedAndFilteredData(activeData, orderFilters, orderSort, []);

    const activeCustomer = customerFilterId ? customers.find(c => c.id === customerFilterId) : null;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-800">Zlecenia Serwisowe</h1>
          <Button onClick={() => {
            setSelectedOrder(null);
            setNewOrder({ status: OrderStatus.RECEIVED });
            setIsOrderModalOpen(true);
          }}>
            <PlusCircle size={18} className="mr-2" /> Przyjmij sprzęt
          </Button>
        </div>

        {activeCustomer && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <ClipboardList size={20} className="text-blue-600" />
              <span className="text-blue-800 font-medium">
                Przeglądasz zlecenia klienta: <strong>[{activeCustomer.id}] {activeCustomer.name}</strong>
              </span>
            </div>
            <button 
              onClick={() => setCustomerFilterId(null)} 
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold hover:underline"
            >
              Pokaż wszystkie zlecenia
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                {/* Headers with Sorting */}
                <tr>
                  <TableHeader label="ID Zlecenia" sortKey="id" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Data Przyjęcia" sortKey="createdAt" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Klient" sortKey="customerName" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Kontakt" sortKey="customerContact" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Urządzenie" sortKey="deviceName" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Status" sortKey="status" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <TableHeader label="Koszt" sortKey="finalCost" currentSort={orderSort} onSort={(k: any) => handleSort(k, orderSort, setOrderSort)} />
                  <th className="px-6 py-3 font-medium text-right">Akcje</th>
                </tr>
                {/* Column Filters */}
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-2"><FilterInput value={orderFilters.id} onChange={(v) => setOrderFilters({...orderFilters, id: v})} placeholder="ID" /></th>
                  <th className="px-6 py-2">
                     <div className="relative">
                       <input 
                         type="date"
                         className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                         value={orderFilters.createdAt || ''}
                         onChange={e => setOrderFilters({...orderFilters, createdAt: e.target.value})}
                       />
                       {orderFilters.createdAt && (
                         <button 
                           onClick={() => setOrderFilters({...orderFilters, createdAt: ''})}
                           className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-white"
                         >
                           <XCircle size={12} />
                         </button>
                       )}
                     </div>
                  </th>
                  <th className="px-6 py-2"><FilterInput value={orderFilters.customerName} onChange={(v) => setOrderFilters({...orderFilters, customerName: v})} placeholder="Klient" /></th>
                  <th className="px-6 py-2"><FilterInput value={orderFilters.customerContact} onChange={(v) => setOrderFilters({...orderFilters, customerContact: v})} placeholder="Tel / Email" /></th>
                  <th className="px-6 py-2"><FilterInput value={orderFilters.deviceName} onChange={(v) => setOrderFilters({...orderFilters, deviceName: v})} placeholder="Urządzenie" /></th>
                  <th className="px-6 py-2">
                    <select 
                       className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                       value={orderFilters.status || ''}
                       onChange={e => setOrderFilters({...orderFilters, status: e.target.value})}
                    >
                      <option value="">Wszystkie</option>
                      {Object.values(OrderStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </th>
                  <th className="px-6 py-2"><FilterInput value={orderFilters.finalCost} onChange={(v) => setOrderFilters({...orderFilters, finalCost: v})} placeholder="Koszt" /></th>
                  <th className="px-6 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedOrders.length > 0 ? (
                  processedOrders.map(order => {
                    const cust = customers.find(c => c.id === order.customerId);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 group">
                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{order.id}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(order.createdAt).toLocaleDateString('pl-PL')}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {cust?.name} 
                          {cust && <span className="text-xs text-slate-400 font-mono ml-1">[{cust.id}]</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900">{cust?.phone}</div>
                          {cust?.email && <div className="text-xs text-slate-500">{cust.email}</div>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">{order.deviceName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[200px]">{order.issueDescription}</div>
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={order.status} /></td>
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {order.finalCost ? `${order.finalCost} PLN` : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handleEditOrder(order)}>Edytuj</Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => {
                                setSelectedOrder(order);
                                setIsNotificationModalOpen(true);
                                setGeneratedMessage('');
                                setGeneratedSubject('');
                                setNotificationMode('TEMPLATE'); 
                              }}
                            >
                              <MessageSquare size={16} className="mr-2" />
                              Powiadom
                            </Button>
                           </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                     <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                       Brak zleceń spełniających kryteria.
                     </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'CLIENT_PORTAL') {
    return renderClientPortal();
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-blue-700">
            <Wrench size={28} strokeWidth={2.5} />
            <span className="text-xl font-bold tracking-tight">FLEWER<span className="text-slate-400 font-normal">.pl</span></span>
          </div>
          <p className="text-xs text-slate-400 mt-1 pl-9">System Serwisowy</p>
        </div>
        
        <nav className="flex-1 py-6 space-y-1">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Pulpit" 
            active={view === 'DASHBOARD'} 
            onClick={() => setView('DASHBOARD')} 
          />
          <SidebarItem 
            icon={Users} 
            label="Klienci" 
            active={view === 'CUSTOMERS'} 
            onClick={() => setView('CUSTOMERS')} 
          />
          <SidebarItem 
            icon={Wrench} 
            label="Zlecenia" 
            active={view === 'ORDERS' && !customerFilterId} 
            onClick={() => { setView('ORDERS'); setCustomerFilterId(null); }} 
          />
          <SidebarItem 
            icon={FileText} 
            label="Szablony" 
            active={view === 'TEMPLATES'} 
            onClick={() => setView('TEMPLATES')} 
          />
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setView('CLIENT_PORTAL')}
            className="w-full flex items-center justify-center p-3 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium"
          >
             <Bot size={18} className="mr-2" /> Strefa Klienta (Symulacja)
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center">
             <div className="flex items-center space-x-2 text-blue-700">
              <Wrench size={24} />
              <span className="font-bold">FLEWER</span>
            </div>
            <div className="flex space-x-2">
               <button onClick={() => setView('DASHBOARD')}><LayoutDashboard /></button>
               <button onClick={() => { setView('ORDERS'); setCustomerFilterId(null); }}><Wrench /></button>
            </div>
        </header>
        
        <div className="p-6 max-w-7xl mx-auto">
          {view === 'DASHBOARD' && renderDashboard()}
          {view === 'CUSTOMERS' && renderCustomers()}
          {view === 'ORDERS' && renderOrders()}
          {view === 'TEMPLATES' && renderTemplates()}
        </div>
      </main>

      {/* --- Modals --- */}

      {/* Customer Modal */}
      <Modal 
        isOpen={isCustomerModalOpen} 
        onClose={() => setIsCustomerModalOpen(false)} 
        title="Dodaj Nowego Klienta"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa / Imię i Nazwisko</label>
            <input 
              required
              className="w-full border border-slate-300 rounded-md p-2" 
              value={newCustomer.name || ''} 
              onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
              <input 
                required
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newCustomer.phone || ''} 
                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newCustomer.email || ''} 
                onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Typ Klienta</label>
            <select 
              className="w-full border border-slate-300 rounded-md p-2"
              value={newCustomer.type}
              onChange={e => setNewCustomer({...newCustomer, type: e.target.value as any})}
            >
              <option value="INDIVIDUAL">Osoba Prywatna</option>
              <option value="COMPANY">Firma</option>
            </select>
          </div>
          {newCustomer.type === 'COMPANY' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIP</label>
              <input 
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newCustomer.nip || ''} 
                onChange={e => setNewCustomer({...newCustomer, nip: e.target.value})} 
              />
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button type="submit">Zapisz Klienta</Button>
          </div>
        </form>
      </Modal>

      {/* Order Modal */}
      <Modal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        title={selectedOrder ? `Edycja Zlecenia #${selectedOrder.id}` : "Nowe Zlecenie"}
      >
        <form onSubmit={handleCreateOrder} className="space-y-4">
          {!selectedOrder && (
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Wybierz Klienta</label>
              <select 
                required
                className="w-full border border-slate-300 rounded-md p-2"
                value={newOrder.customerId || ''}
                onChange={e => setNewOrder({...newOrder, customerId: e.target.value})}
              >
                <option value="">-- Wybierz --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>[{c.id}] {c.name} ({c.phone})</option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Urządzenie</label>
            <input 
              required
              placeholder="np. Wiertarka Bosch..."
              className="w-full border border-slate-300 rounded-md p-2" 
              value={newOrder.deviceName || ''} 
              onChange={e => setNewOrder({...newOrder, deviceName: e.target.value})} 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Opis Usterki</label>
            <textarea 
              required
              rows={3}
              className="w-full border border-slate-300 rounded-md p-2" 
              value={newOrder.issueDescription || ''} 
              onChange={e => setNewOrder({...newOrder, issueDescription: e.target.value})} 
            />
            {/* AI Diagnosis Helper */}
            <button 
              type="button"
              onClick={handleAiDiagnosis}
              disabled={isGenerating || !newOrder.deviceName || !newOrder.issueDescription}
              className="mt-2 text-xs flex items-center text-purple-600 hover:text-purple-700 disabled:opacity-50"
            >
              <Sparkles size={14} className="mr-1" /> 
              {isGenerating ? 'Analizuję...' : 'Zasugeruj diagnozę (AI)'}
            </button>
          </div>

          {diagnosisSuggestion && (
            <div className="bg-purple-50 p-3 rounded-md border border-purple-100 text-sm text-slate-700">
               <strong className="text-purple-800 block mb-1">Sugestia AI:</strong>
               <div className="whitespace-pre-line">{diagnosisSuggestion}</div>
               <button 
                 type="button" 
                 className="text-xs text-purple-600 underline mt-2"
                 onClick={() => setNewOrder({...newOrder, diagnosis: (newOrder.diagnosis ? newOrder.diagnosis + '\n' : '') + diagnosisSuggestion})}
               >
                 Kopiuj do diagnozy
               </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select 
                className="w-full border border-slate-300 rounded-md p-2"
                value={newOrder.status}
                onChange={e => setNewOrder({...newOrder, status: e.target.value as OrderStatus})}
              >
                {Object.values(OrderStatus).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Koszt (PLN)</label>
              <input 
                type="number"
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newOrder.finalCost || ''} 
                onChange={e => setNewOrder({...newOrder, finalCost: Number(e.target.value)})} 
              />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Diagnoza Serwisanta</label>
             <textarea 
                rows={2}
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newOrder.diagnosis || ''} 
                onChange={e => setNewOrder({...newOrder, diagnosis: e.target.value})} 
              />
          </div>

          {selectedOrder && selectedOrder.history && selectedOrder.history.length > 0 && (
            <div className="border-t border-slate-100 pt-4 mt-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                 <History size={16} className="mr-2" /> Historia Statusów
              </h3>
              <div className="space-y-4 pl-2">
                {selectedOrder.history.map((entry, index) => (
                   <div key={index} className="relative flex gap-4">
                     {/* Timeline line */}
                     {index !== selectedOrder.history!.length - 1 && (
                       <div className="absolute left-[5px] top-2 bottom-[-16px] w-[2px] bg-slate-200"></div>
                     )}
                     <div className="relative z-10 w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                     <div className="flex-1">
                       <p className="text-sm font-medium text-slate-800">{entry.status}</p>
                       <p className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString('pl-PL')}</p>
                     </div>
                   </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100 mt-4">
             {selectedOrder && (
               <Button 
                 type="button" 
                 variant="danger" 
                 size="sm"
                 onClick={() => {
                   if(confirm('Czy na pewno chcesz usunąć to zlecenie?')) {
                     Storage.deleteOrder(selectedOrder.id);
                     setOrders(Storage.getOrders());
                     setIsOrderModalOpen(false);
                   }
                 }}
               >
                 Usuń
               </Button>
             )}
            <Button type="submit">Zapisz Zlecenie</Button>
          </div>
        </form>
      </Modal>

      {/* Template Edit Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={newTemplate.id ? "Edytuj Szablon" : "Nowe Szablon"}
      >
         <form onSubmit={handleSaveTemplate} className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Nazwa szablonu</label>
             <input 
                required
                className="w-full border border-slate-300 rounded-md p-2" 
                value={newTemplate.name || ''} 
                onChange={e => setNewTemplate({...newTemplate, name: e.target.value})} 
              />
           </div>
           
           <div className="flex space-x-4">
             <label className="flex items-center space-x-2">
               <input 
                 type="radio" 
                 name="type" 
                 checked={newTemplate.type === 'SMS'} 
                 onChange={() => setNewTemplate({...newTemplate, type: 'SMS'})}
               />
               <span className="text-sm">SMS</span>
             </label>
             <label className="flex items-center space-x-2">
               <input 
                 type="radio" 
                 name="type" 
                 checked={newTemplate.type === 'EMAIL'} 
                 onChange={() => setNewTemplate({...newTemplate, type: 'EMAIL'})}
               />
               <span className="text-sm">Email</span>
             </label>
           </div>

           {newTemplate.type === 'EMAIL' && (
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Temat wiadomości</label>
              <input 
                  className="w-full border border-slate-300 rounded-md p-2" 
                  value={newTemplate.subject || ''} 
                  onChange={e => setNewTemplate({...newTemplate, subject: e.target.value})} 
              />
            </div>
           )}

           <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Treść</label>
              <textarea 
                required
                rows={6}
                className="w-full border border-slate-300 rounded-md p-2 font-mono text-sm" 
                value={newTemplate.body || ''} 
                onChange={e => setNewTemplate({...newTemplate, body: e.target.value})} 
              />
              <p className="text-xs text-slate-500 mt-1">
                Zmienne: {'{{customer}}'}, {'{{device}}'}, {'{{status}}'}, {'{{cost}}'}, {'{{diagnosis}}'}
              </p>
           </div>

           <div className="flex justify-end pt-4">
             <Button type="submit">Zapisz Szablon</Button>
           </div>
         </form>
      </Modal>

      {/* Notification Modal */}
      <Modal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        title="Powiadom Klienta"
      >
        <div className="space-y-4">
          <div className="flex border-b border-slate-200">
             <button 
               className={`flex-1 py-2 text-sm font-medium border-b-2 ${notificationMode === 'TEMPLATE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
               onClick={() => setNotificationMode('TEMPLATE')}
             >
               Wybierz Szablon
             </button>
             <button 
               className={`flex-1 py-2 text-sm font-medium border-b-2 ${notificationMode === 'AI' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500'}`}
               onClick={() => setNotificationMode('AI')}
             >
               Generator AI
             </button>
          </div>
          
          {notificationMode === 'AI' && (
            <div className="flex space-x-2 bg-purple-50 p-4 rounded-lg">
              <Button 
                variant="secondary" 
                className="flex-1 bg-white"
                onClick={() => handleGenerateMessage('SMS')}
                disabled={isGenerating}
              >
                <MessageSquare size={16} className="mr-2" /> 
                {isGenerating ? 'Generowanie...' : 'Generuj SMS'}
              </Button>
              <Button 
                variant="secondary" 
                className="flex-1 bg-white"
                onClick={() => handleGenerateMessage('EMAIL')}
                disabled={isGenerating}
              >
                <Mail size={16} className="mr-2" /> 
                {isGenerating ? 'Generowanie...' : 'Generuj Email'}
              </Button>
            </div>
          )}

          {notificationMode === 'TEMPLATE' && (
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Wybierz gotowy szablon</label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-md bg-white text-sm"
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  value={selectedTemplateId}
                >
                  <option value="">-- Wybierz z listy --</option>
                  <optgroup label="SMS">
                    {templates.filter(t => t.type === 'SMS').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Email">
                    {templates.filter(t => t.type === 'EMAIL').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          )}

          {(generatedMessage || generatedSubject) && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              {generatedSubject && (
                <div className="mb-2">
                   <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Temat</label>
                   <input 
                     className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm text-slate-800"
                     value={generatedSubject}
                     onChange={e => setGeneratedSubject(e.target.value)}
                   />
                </div>
              )}
              
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Treść wiadomości</label>
              <textarea 
                className="w-full p-3 bg-white border border-slate-200 rounded-md text-sm text-slate-800 min-h-[150px] font-mono"
                value={generatedMessage}
                onChange={e => setGeneratedMessage(e.target.value)}
              />
              <div className="mt-4 flex justify-between items-center">
                <Button 
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const fullText = generatedSubject ? `Temat: ${generatedSubject}\n\n${generatedMessage}` : generatedMessage;
                    navigator.clipboard.writeText(fullText);
                    alert("Skopiowano do schowka!");
                  }}
                >
                  Kopiuj do schowka
                </Button>
                <Button 
                  size="sm"
                  variant="primary"
                  className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
                  onClick={handleSendNotification}
                  disabled={isSending}
                >
                  <Send size={16} className="mr-2" />
                  {isSending ? 'Wysyłanie...' : `Wyślij ${notificationType}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default App;
