import { NotificationTemplate, Order, Customer } from '../types';

export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'sms-ready',
    name: 'SMS - Gotowe do odbioru',
    type: 'SMS',
    body: 'Dzień dobry. Twój sprzęt {{device}} jest gotowy do odbioru w serwisie Flewer. Koszt: {{cost}} PLN. Zapraszamy pn-pt 8-16.'
  },
  {
    id: 'sms-diagnosis',
    name: 'SMS - Wynik diagnozy',
    type: 'SMS',
    body: 'Dzień dobry. Diagnoza sprzętu {{device}}: {{diagnosis}}. Szacowany koszt: {{cost}} PLN. Prosimy o decyzję. Serwis Flewer.'
  },
  {
    id: 'email-invoice',
    name: 'Email - Faktura/Odbiór',
    type: 'EMAIL',
    subject: 'Naprawa zakończona - Serwis Flewer',
    body: 'Szanowny Kliencie {{customer}},\n\nInformujemy, że naprawa urządzenia {{device}} została zakończona.\n\nZakres prac: {{diagnosis}}\nCałkowity koszt: {{cost}} PLN.\n\nZapraszamy po odbiór.\nPozdrawiamy,\nZespół Flewer'
  },
  {
    id: 'email-received',
    name: 'Email - Potwierdzenie przyjęcia',
    type: 'EMAIL',
    subject: 'Przyjęcie sprzętu - Serwis Flewer',
    body: 'Dzień dobry {{customer}},\n\nPotwierdzamy przyjęcie urządzenia {{device}} do serwisu.\nZgłoszona usterka: {{issue}}.\n\nBędziemy informować o postępach prac.\n\nZespół Flewer'
  }
];

export const processTemplate = (templateBody: string, order: Order, customer: Customer): string => {
  let text = templateBody;
  const replacements: Record<string, string> = {
    '{{customer}}': customer.name,
    '{{device}}': order.deviceName,
    '{{issue}}': order.issueDescription,
    '{{diagnosis}}': order.diagnosis || 'Brak diagnozy',
    '{{cost}}': (order.finalCost || order.estimatedCost || '?').toString(),
    '{{status}}': order.status,
    '{{notes}}': order.technicianNotes || ''
  };

  Object.entries(replacements).forEach(([key, value]) => {
    // Create a global regex for replacement
    const regex = new RegExp(key, 'g');
    text = text.replace(regex, value);
  });
  
  return text;
};