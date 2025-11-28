import { GoogleGenAI } from "@google/genai";
import { Order, Customer, OrderStatus } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateCustomerNotification = async (order: Order, customer: Customer, type: 'SMS' | 'EMAIL'): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Błąd konfiguracji API.";

  const prompt = `
    Jesteś asystentem w serwisie elektronarzędzi 'Flewer' (www.flewer.pl).
    Wygeneruj krótką, uprzejmą wiadomość ${type} do klienta.
    
    Dane klienta: ${customer.name}
    Sprzęt: ${order.deviceName}
    Status: ${order.status}
    Opis usterki: ${order.issueDescription}
    Koszt: ${order.finalCost ? order.finalCost + ' PLN' : 'Do ustalenia'}
    Diagnoza: ${order.diagnosis || 'W trakcie weryfikacji'}

    Wiadomość ma informować o zmianie statusu.
    Jeśli status to "GOTOWE DO ODBIORU", poproś o odbiór i podaj cenę.
    Jeśli status to "DIAGNOZA", poinformuj, że sprawdzamy sprzęt.
    
    Tylko treść wiadomości, bez zbędnych wstępów. Podpisz się jako "Zespół Flewer".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Nie udało się wygenerować wiadomości.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Wystąpił błąd podczas generowania wiadomości.";
  }
};

export const generateDiagnosisSuggestion = async (deviceName: string, issue: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Błąd API.";

  const prompt = `
    Jesteś ekspertem serwisowym elektronarzędzi. 
    Sprzęt: ${deviceName}
    Objawy: ${issue}
    
    Podaj listę 3 najbardziej prawdopodobnych przyczyn usterki oraz sugerowane kroki naprawcze. 
    Formatuj odpowiedź jako zwięzłą listę punktowaną.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Brak sugestii.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Błąd generowania diagnozy.";
  }
};

export const generateClientStatusResponse = async (order: Order, customer: Customer): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Przepraszamy, asystent jest chwilowo niedostępny.";

  const prompt = `
    Jesteś wirtualnym asystentem na stronie internetowej serwisu Flewer.
    Klient ${customer.name} pyta o status swojego zlecenia.
    
    Dane zlecenia:
    Urządzenie: ${order.deviceName}
    Status: ${order.status}
    Opis usterki zgłoszonej: ${order.issueDescription}
    Diagnoza serwisu: ${order.diagnosis || 'Brak wpisu'}
    Koszt: ${order.finalCost ? order.finalCost + ' PLN' : (order.estimatedCost ? 'Szacowany: ' + order.estimatedCost + ' PLN' : 'W trakcie wyceny')}
    Notatki dla klienta: ${order.technicianNotes || 'Brak'}
    
    Udziel uprzejmej, konkretnej odpowiedzi.
    Jeśli status to 'GOTOWE DO ODBIORU', zachęć do wizyty.
    Jeśli 'DIAGNOZA' lub 'W TRAKCIE', poproś o cierpliwość.
    Nie używaj technicznego żargonu jeśli to nie konieczne.
    Odpowiedź powinna być krótka i pomocna (max 3 zdania).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Status twojego zlecenia to: " + order.status;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Wystąpił błąd podczas pobierania statusu.";
  }
};