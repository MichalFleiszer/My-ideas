
import { Customer, Order, OrderStatus, NotificationTemplate } from '../types';
import { DEFAULT_TEMPLATES } from './templateService';

const CUSTOMERS_KEY = 'flewer_customers';
const ORDERS_KEY = 'flewer_orders';
const TEMPLATES_KEY = 'flewer_templates';

// --- Data Generation Helpers ---

const FIRST_NAMES = ["Jan", "Anna", "Piotr", "Maria", "Krzysztof", "Agnieszka", "Tomasz", "Barbara", "Paweł", "Ewa", "Michał", "Krystyna", "Marcin", "Elżbieta", "Andrzej", "Małgorzata", "Grzegorz", "Zofia", "Adam", "Jadwiga"];
const LAST_NAMES = ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Kwiatkowski", "Krawczyk"];
const COMPANY_PREFIXES = ["Bud", "Rem", "Elektro", "Tech", "Auto", "Dom", "Ogród", "Serwis", "Inwest", "Pro"];
const COMPANY_SUFFIXES = ["Max", "Pol", "Bud", "System", "Trans", "Serwis", "Dom", "Ex", "Lux", "Mix"];
const TOOLS = ["Wiertarka", "Wkrętarka", "Szlifierka kątowa", "Młot udarowy", "Pilarka tarczowa", "Strug", "Polerka", "Wyrzynarka", "Bruzdownica", "Mieszadło"];
const BRANDS = ["Bosch", "Makita", "DeWalt", "Hilti", "Metabo", "Milwaukee", "Ryobi", "Festool", "Hitachi", "Black&Decker"];
const ISSUES = [
  "Nie włącza się", "Iskrzy na szczotkach", "Uszkodzony kabel zasilający", "Bicie na uchwycie", "Spalony wirnik", 
  "Słaby udar", "Głośna praca przekładni", "Wymiana szczotek", "Przegląd okresowy", "Dymi z silnika", 
  "Nie trzyma obrotów", "Uszkodzony wyłącznik"
];
const TOWNS = ["Poznań", "Warszawa", "Kraków", "Wrocław", "Gdańsk", "Szczecin", "Lublin", "Bydgoszcz"];

const getRandomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate 100 Customers
const generateMockCustomers = (): Customer[] => {
  const customers: Customer[] = [];
  
  // Generate ~40 Companies
  for (let i = 0; i < 40; i++) {
    const name = `${getRandomElement(COMPANY_PREFIXES)}-${getRandomElement(COMPANY_SUFFIXES)} Sp. z o.o.`;
    customers.push({
      id: '', // Assign later
      name: name,
      phone: `60${getRandomInt(0, 9)}${getRandomInt(100000, 999999)}`,
      email: `biuro@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.pl`,
      type: 'COMPANY',
      nip: `${getRandomInt(100, 999)}${getRandomInt(100, 999)}${getRandomInt(10, 99)}${getRandomInt(10, 99)}`,
      createdAt: Date.now() - getRandomInt(10000000, 500000000)
    });
  }

  // Generate ~60 Individuals
  for (let i = 0; i < 60; i++) {
    const firstName = getRandomElement(FIRST_NAMES);
    const lastName = getRandomElement(LAST_NAMES);
    customers.push({
      id: '', // Assign later
      name: `${lastName} ${firstName}`, // Lastname First for better sorting
      phone: `50${getRandomInt(0, 9)}${getRandomInt(100000, 999999)}`,
      type: 'INDIVIDUAL',
      createdAt: Date.now() - getRandomInt(10000000, 500000000)
    });
  }

  // Sort alphabetically by Name
  customers.sort((a, b) => a.name.localeCompare(b.name));

  // Assign IDs 0001 - 0100
  return customers.map((c, index) => ({
    ...c,
    // If it's an individual, swap back to "FirstName LastName" for display if desired, 
    // but the prompt asked to sort by Last Name for individuals. 
    // We kept "LastName FirstName" in the name field to make sorting easy, 
    // but let's flip it back for nicer display, assuming the sort order is preserved by index.
    name: c.type === 'INDIVIDUAL' ? c.name.split(' ').reverse().join(' ') : c.name,
    id: (index + 1).toString().padStart(4, '0')
  }));
};

// Generate 200 Orders
const generateMockOrders = (customers: Customer[]): Order[] => {
  const orders: Order[] = [];
  const statusWeights = [
    OrderStatus.COMPLETED, OrderStatus.COMPLETED, OrderStatus.COMPLETED, // More history
    OrderStatus.READY, OrderStatus.READY,
    OrderStatus.IN_PROGRESS, OrderStatus.IN_PROGRESS,
    OrderStatus.WAITING_PARTS,
    OrderStatus.DIAGNOSIS,
    OrderStatus.RECEIVED
  ];

  const now = new Date();
  const currentYear = now.getFullYear().toString().slice(-2);
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');

  for (let i = 1; i <= 200; i++) {
    const customer = getRandomElement(customers);
    const status = getRandomElement(statusWeights);
    const brand = getRandomElement(BRANDS);
    const tool = getRandomElement(TOOLS);
    const createdAt = Date.now() - getRandomInt(86400000, 1500000000); // Up to ~6 months ago
    
    // Determine cost based on status
    let estimatedCost = getRandomInt(100, 800);
    let finalCost = undefined;
    if (status === OrderStatus.READY || status === OrderStatus.COMPLETED) {
      finalCost = estimatedCost + getRandomInt(0, 100);
    }

    orders.push({
      id: `${i.toString().padStart(4, '0')}/${currentMonth}/${currentYear}`,
      customerId: customer.id,
      deviceName: `${brand} ${tool}`,
      serialNumber: Math.random() > 0.7 ? `SN${getRandomInt(10000, 999999)}` : undefined,
      issueDescription: getRandomElement(ISSUES),
      status: status,
      diagnosis: (status !== OrderStatus.RECEIVED && status !== OrderStatus.DIAGNOSIS) 
        ? `Wymagana wymiana podzespołów: ${getRandomElement(['wirnik', 'szczotki', 'łożyska', 'kabel'])}.` 
        : undefined,
      estimatedCost: estimatedCost,
      finalCost: finalCost,
      createdAt: createdAt,
      updatedAt: createdAt + getRandomInt(3600000, 864000000),
      technicianNotes: Math.random() > 0.8 ? "Klient prosi o zwrot starych części." : undefined,
      history: [
        { status: OrderStatus.RECEIVED, timestamp: createdAt },
        ...(status !== OrderStatus.RECEIVED ? [{ status: OrderStatus.DIAGNOSIS, timestamp: createdAt + 3600000 }] : []),
        ...(status === OrderStatus.WAITING_PARTS ? [{ status: OrderStatus.WAITING_PARTS, timestamp: createdAt + 7200000 }] : []),
        ...(status === OrderStatus.READY || status === OrderStatus.COMPLETED ? [{ status: OrderStatus.READY, timestamp: createdAt + 100000000 }] : [])
      ]
    });
  }
  return orders;
};

// Initialize Mock Data
const INITIAL_CUSTOMERS = generateMockCustomers();
const INITIAL_ORDERS = generateMockOrders(INITIAL_CUSTOMERS);

// --- Storage Functions ---

export const getCustomers = (): Customer[] => {
  const data = localStorage.getItem(CUSTOMERS_KEY);
  if (!data) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(INITIAL_CUSTOMERS));
    return INITIAL_CUSTOMERS;
  }
  return JSON.parse(data);
};

export const getNextCustomerId = (): string => {
  const customers = getCustomers();
  if (customers.length === 0) return '0001';

  // Extract numeric part of IDs, ensuring we only parse valid numbers
  const ids = customers
    .map(c => parseInt(c.id, 10))
    .filter(id => !isNaN(id));

  if (ids.length === 0) return '0001';

  const maxId = Math.max(...ids);
  const nextId = maxId + 1;

  // Pad with zeros to ensure 4 digits
  return nextId.toString().padStart(4, '0');
};

export const saveCustomer = (customer: Customer): void => {
  const customers = getCustomers();
  const existingIndex = customers.findIndex(c => c.id === customer.id);
  if (existingIndex >= 0) {
    customers[existingIndex] = customer;
  } else {
    customers.push(customer);
  }
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
};

export const getOrders = (): Order[] => {
  const data = localStorage.getItem(ORDERS_KEY);
  if (!data) {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(INITIAL_ORDERS));
    return INITIAL_ORDERS;
  }
  return JSON.parse(data);
};

export const getNextOrderId = (): string => {
  const orders = getOrders();
  
  // Extract sequence numbers from IDs (format: 0001/MM/YY)
  const sequenceNumbers = orders.map(o => {
    // Match the first 4 digits before a slash
    const match = o.id.match(/^(\d{4})\//);
    return match ? parseInt(match[1], 10) : 0;
  });

  const maxSeq = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0;
  const nextSeq = maxSeq + 1;
  const nextSeqString = nextSeq.toString().padStart(4, '0');

  // Get current date for MM/YY
  const now = new Date();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year

  return `${nextSeqString}/${month}/${year}`;
};

export const saveOrder = (order: Order): void => {
  const orders = getOrders();
  const existingIndex = orders.findIndex(o => o.id === order.id);
  if (existingIndex >= 0) {
    orders[existingIndex] = order;
  } else {
    orders.push(order);
  }
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

export const deleteOrder = (orderId: string): void => {
  const orders = getOrders().filter(o => o.id !== orderId);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

// --- Templates ---

export const getTemplates = (): NotificationTemplate[] => {
  const data = localStorage.getItem(TEMPLATES_KEY);
  if (!data) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(DEFAULT_TEMPLATES));
    return DEFAULT_TEMPLATES;
  }
  return JSON.parse(data);
};

export const saveTemplate = (template: NotificationTemplate): void => {
  const templates = getTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};

export const deleteTemplate = (templateId: string): void => {
  const templates = getTemplates().filter(t => t.id !== templateId);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
};
