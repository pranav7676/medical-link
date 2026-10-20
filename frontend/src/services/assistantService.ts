import { AssistantMessage, AssistantHealthStatus, QuickPrompt, VitalsContext } from '../types/assistant';
import { Language, SehatLinkRole } from '../types';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8002' : '')
).replace(/\/+$/, '');

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error(
      'The AI Assistant backend is not configured. Set VITE_API_BASE_URL in the Vercel project environment.'
    );
  }
  return API_BASE;
}

export async function fetchAssistantHealth(): Promise<AssistantHealthStatus> {
  try {
    const res = await fetch(`${requireApiBase()}/api/assistant/health`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    return {
      status: 'fallback_mode',
      groq_api_configured: false,
      model: 'offline-local-mode',
      app_name: 'SehatLink Telemedicine',
      environment: 'offline'
    };
  }
}

export async function fetchQuickPrompts(
  role: SehatLinkRole = 'patient',
  language: Language = 'pa',
  page?: string
): Promise<QuickPrompt[]> {
  try {
    const url = new URL(`${API_BASE}/api/assistant/prompts`);
    url.searchParams.append('role', role);
    url.searchParams.append('language', language);
    if (page) {
      url.searchParams.append('page', page);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    // Local fallback prompts if backend is unreachable
    if (language === 'ta') {
      return [
        {
          id: 'fb1_ta',
          label: 'காய்ச்சல் & அறிகுறி உதவி',
          prompt: 'எனக்கு 2 நாட்களாக காய்ச்சல் உள்ளது. நான் என்ன செய்ய வேண்டும்?',
          category: 'symptoms',
          language: 'ta'
        },
        {
          id: 'fb2_ta',
          label: 'மக்கள் மருந்தகம் (Jan Aushadhi)',
          prompt: 'மக்கள் மருந்தகத்தில் கிடைக்கும் குறைந்த விலை மருந்துகள் பற்றி கூறுக.',
          category: 'dosage',
          language: 'ta'
        },
        {
          id: 'fb3_ta',
          label: '108 அவசர ஆம்புலன்ஸ்',
          prompt: 'அவசர நிலையில் 108 ஆம்புலன்ஸை எவ்வாறு அழைப்பது?',
          category: 'emergency',
          language: 'ta'
        }
      ];
    }
    if (language === 'pa') {
      return [
        {
          id: 'fb1',
          label: 'ਬੁਖਾਰ ਅਤੇ ਲੱਛਣ ਮਦਦ',
          prompt: 'ਮੈਨੂੰ 2 ਦਿਨਾਂ ਤੋਂ ਬੁਖਾਰ ਹੈ। ਮੈਨੂੰ ਕੀ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ?',
          category: 'symptoms',
          language: 'pa'
        },
        {
          id: 'fb2',
          label: 'ਜਨ ਔਸ਼ਧੀ ਕੇਂਦਰ ਨਾਭਾ',
          prompt: 'ਨਾਭਾ ਵਿੱਚ ਜਨ ਔਸ਼ਧੀ ਕੇਂਦਰ ਤੋਂ ਜੈਨਰਿਕ ਦਵਾਈਆਂ ਦੀ ਜਾਣਕਾਰੀ ਦਿਓ।',
          category: 'dosage',
          language: 'pa'
        },
        {
          id: 'fb3',
          label: 'ਐਮਰਜੈਂਸੀ 108 ਐਂਬੂਲੈਂਸ',
          prompt: 'ਐਮਰਜੈਂਸੀ ਵਿੱਚ 108 ਐਂਬੂਲੈਂਸ ਕਿਵੇਂ ਬੁਲਾਈਏ?',
          category: 'emergency',
          language: 'pa'
        }
      ];
    }
    return [
      {
        id: 'fb1_en',
        label: 'Fever & Symptom Care',
        prompt: 'I have fever for 2 days. What home precautions should I take?',
        category: 'symptoms',
        language: 'en'
      },
      {
        id: 'fb2_en',
        label: 'Jan Aushadhi Generic Meds',
        prompt: 'What essential medicines are in stock at Jan Aushadhi Kendra?',
        category: 'dosage',
        language: 'en'
      },
      {
        id: 'fb3_en',
        label: '108 Emergency',
        prompt: 'How to request urgent 108 ambulance dispatch?',
        category: 'emergency',
        language: 'en'
      }
    ];
  }
}

export interface StreamChatParams {
  messages: AssistantMessage[];
  role: SehatLinkRole;
  language: Language;
  currentPage?: string;
  vitalsContext?: VitalsContext;
  authToken?: string | null;
  onChunk: (textChunk: string) => void;
  onEmergencyDetected?: (notice?: string) => void;
  onDone?: (info: { model?: string; executionTimeMs?: number }) => void;
  onError?: (errMessage: string) => void;
}

export interface ChatConversation {
  id: string;
  title: string;
  preferred_language: Language;
  created_at: string;
  updated_at: string;
}

export interface PersistedChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  language: Language;
  created_at: string;
}

async function assistantApiRequest<T>(
  path: string,
  authToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${requireApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + authToken,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Assistant API returned HTTP ${response.status}: ${detail}`);
  }

  return response.json();
}

export function upsertAssistantProfile(
  authToken: string,
  displayName: string,
  language: Language
): Promise<void> {
  return assistantApiRequest('/api/assistant/profile', authToken, {
    method: 'PUT',
    body: JSON.stringify({
      display_name: displayName,
      preferred_language: language
    })
  }).then(() => undefined);
}

export function fetchChatConversations(authToken: string): Promise<ChatConversation[]> {
  return assistantApiRequest<ChatConversation[]>('/api/assistant/conversations', authToken);
}

export function createChatConversation(
  authToken: string,
  title: string,
  language: Language
): Promise<ChatConversation> {
  return assistantApiRequest<ChatConversation>('/api/assistant/conversations', authToken, {
    method: 'POST',
    body: JSON.stringify({ title, preferred_language: language })
  });
}

export function fetchChatMessages(
  authToken: string,
  conversationId: string
): Promise<PersistedChatMessage[]> {
  return assistantApiRequest<PersistedChatMessage[]>(
    `/api/assistant/conversations/${encodeURIComponent(conversationId)}/messages`,
    authToken
  );
}

export function persistChatMessage(
  authToken: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  language: Language
): Promise<PersistedChatMessage> {
  return assistantApiRequest<PersistedChatMessage>(
    `/api/assistant/conversations/${encodeURIComponent(conversationId)}/messages`,
    authToken,
    {
      method: 'POST',
      body: JSON.stringify({ role, content, language })
    }
  );
}

export async function streamAssistantChat(params: StreamChatParams): Promise<void> {
  const {
    messages,
    role,
    language,
    currentPage,
    vitalsContext,
    authToken,
    onChunk,
    onEmergencyDetected,
    onDone,
    onError
  } = params;

  const payload = {
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      id: m.id
    })),
    user_role: role,
    language: language,
    current_page: currentPage,
    stream: true,
    vitals_context: vitalsContext
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (authToken) {
    headers['Authorization'] = 'Bearer ' + authToken;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 45_000);
  let completed = false;

  try {
    const response = await fetch(`${requireApiBase()}/api/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned HTTP ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported or empty body received');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processEvent = (rawEvent: string) => {
      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data:'));
      if (!dataLine) return;

      const jsonStr = dataLine.slice(5).trim();
      const data = JSON.parse(jsonStr);

      if (data.type === 'emergency_flag' && data.emergency_detected) {
        onEmergencyDetected?.(data.notice);
      }
      if (data.error) {
        throw new Error(data.error_message || 'The AI provider could not complete the request.');
      }
      if (data.content) onChunk(data.content);
      if (data.done) {
        completed = true;
        onDone?.({
          model: data.model,
          executionTimeMs: data.execution_time_ms
        });
      }
    };

    while (!completed) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) processEvent(buffer);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // keep remaining partial line in buffer

      for (const line of lines) {
        processEvent(line.trim());
      }
    }
  } catch (error: any) {
    console.error('Stream Assistant Chat Error:', error);
    const message = error?.name === 'AbortError'
      ? 'The AI response timed out. Please try again.'
      : error.message || 'Failed to communicate with AI Assistant backend.';
    if (!completed) onError?.(message);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
