import React, { useState, useEffect, useRef } from 'react';
import { X, Save, RefreshCw, Loader2, Check, ChevronDown } from 'lucide-react';
import { AppSettings, AiProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const PROVIDERS: { id: AiProvider; name: string }[] = [
  { id: 'google', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic Claude' },
];

const DEFAULT_MODELS_MAP: Record<AiProvider, string> = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3-haiku-20240307',
};

const FALLBACK_MODELS: Record<AiProvider, string[]> = {
  google: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
};

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentSettings, onSave }) => {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);
  
  // Model List State
  const [availableModels, setAvailableModels] = useState<string[]>(FALLBACK_MODELS[currentSettings.provider]);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      setAvailableModels(FALLBACK_MODELS[currentSettings.provider]);
    }
  }, [isOpen, currentSettings]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelListOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as AiProvider;
    setSettings(prev => ({
      ...prev,
      provider: newProvider,
      modelId: DEFAULT_MODELS_MAP[newProvider],
      baseUrl: newProvider === 'openai' ? 'https://api.openai.com/v1' : '',
      apiKey: prev.provider === newProvider ? prev.apiKey : '', // Clear key if switching provider
    }));
    setAvailableModels(FALLBACK_MODELS[newProvider]);
  };

  const fetchModels = async () => {
    if (!settings.apiKey) return;
    
    setIsLoadingModels(true);
    let fetched: string[] = [];

    try {
        if (settings.provider === 'google') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`);
            const data = await response.json();
            if (data.models) {
                fetched = data.models.map((m: any) => m.name.replace('models/', ''));
            }
        } else if (settings.provider === 'openai') {
            const baseUrl = settings.baseUrl || 'https://api.openai.com/v1';
            const response = await fetch(`${baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${settings.apiKey}` }
            });
            const data = await response.json();
            if (data.data) {
                fetched = data.data.map((m: any) => m.id);
            }
        } else if (settings.provider === 'anthropic') {
             const response = await fetch('https://api.anthropic.com/v1/models', {
                headers: { 
                    'x-api-key': settings.apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                }
            });
            const data = await response.json();
            if (data.data) {
                fetched = data.data.map((m: any) => m.id);
            }
        }
    } catch (error) {
        console.error("Error fetching models:", error);
    }

    if (fetched.length > 0) {
        // Sort specifically to put exact matches or shorter names first often helps, 
        // but alphabetical is fine. Let's just keep them as returned but unique.
        setAvailableModels(Array.from(new Set(fetched)));
        setIsModelListOpen(true);
    } 
    
    setIsLoadingModels(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
    onClose();
  };

  // Filter models based on input
  const filteredModels = availableModels.filter(m => 
    m.toLowerCase().includes(settings.modelId.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Model Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {/* Provider Select */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              AI Provider
            </label>
            <div className="relative">
              <select
                value={settings.provider}
                onChange={handleProviderChange}
                className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder={`Enter your ${PROVIDERS.find(p => p.id === settings.provider)?.name} API Key`}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Keys are stored locally in your browser.
            </p>
          </div>

          {/* Model Name (Searchable Combobox) */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Model Name
            </label>
            <div className="relative">
                <input
                  type="text"
                  value={settings.modelId}
                  onChange={(e) => {
                      setSettings({ ...settings, modelId: e.target.value });
                      setIsModelListOpen(true);
                  }}
                  onFocus={() => setIsModelListOpen(true)}
                  placeholder="e.g. gpt-4o, gemini-1.5-flash"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                    type="button"
                    onClick={fetchModels}
                    disabled={!settings.apiKey || isLoadingModels}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-slate-400 transition-colors"
                    title="Fetch models from provider"
                >
                    {isLoadingModels ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                </button>
            </div>
            
            {/* Dropdown List */}
            {isModelListOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                    {filteredModels.length > 0 ? (
                        filteredModels.map((model) => (
                            <button
                                key={model}
                                type="button"
                                onClick={() => {
                                    setSettings({ ...settings, modelId: model });
                                    setIsModelListOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                            >
                                <span>{model}</span>
                                {settings.modelId === model && <Check size={14} className="text-blue-500" />}
                            </button>
                        ))
                    ) : (
                        <div className="px-4 py-3 text-xs text-slate-500 text-center">
                            No matching models found.
                        </div>
                    )}
                </div>
            )}
          </div>

          {/* Base URL (Optional for OpenAI) */}
          {settings.provider === 'openai' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Base URL <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={settings.baseUrl || ''}
                onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Save Settings
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default SettingsModal;