import React, { useEffect, useState } from 'react';
import { Menu, PanelRightOpen, RefreshCw } from 'lucide-react';
import { WorkshopBotSidebar } from './workshop-bot/WorkshopBotSidebar';
import { WorkshopBotMessages } from './workshop-bot/WorkshopBotMessages';
import { WorkshopBotComposer } from './workshop-bot/WorkshopBotComposer';
import { WorkshopBotSkillRail } from './workshop-bot/WorkshopBotSkillRail';
import { workshopBotAPI } from '../services/workshopBotAPI';

const MAX_SELECTED_SKILLS = 4;
const DEFAULT_DEVELOPER_PROMPT = 'ادمج المهارات المختارة مع سؤال المستخدم، وقلّل التكرار، وركّز على خطوات عملية واضحة.';

const createSessionId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `workshop-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const normalizeMessages = (rows = []) => rows.map((row) => ({
  role: row.role === 'assistant' || row.type === 'bot' ? 'assistant' : 'user',
  content: row.content || row.text || '',
  model: row.model || row.model_used || '',
  created_at: row.created_at || row.timestamp || new Date().toISOString(),
}));

export default function WorkshopAIBot() {
  const [currentMode, setCurrentMode] = useState('unified');
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [composerValue, setComposerValue] = useState('');
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('gpt-5.1');
  const [engines, setEngines] = useState([]);
  const [engine, setEngine] = useState('');
  const [summary, setSummary] = useState({ total_skills: 0, total_prompts: 0, total_agents: 0 });
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [skillSearch, setSkillSearch] = useState('agent');
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerPrompt, setDeveloperPrompt] = useState(DEFAULT_DEVELOPER_PROMPT);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showRail, setShowRail] = useState(false);

  const loadConversations = async (preferredSessionId = '') => {
    const { data } = await workshopBotAPI.getConversations({ limit: 30 });
    const rows = data?.conversations || [];
    setConversations(rows);

    if (preferredSessionId) return;
    const nextSession = rows[0]?.id;
    if (nextSession && !currentSessionId) {
      setCurrentSessionId(nextSession);
      const conversationResponse = await workshopBotAPI.getConversation(nextSession);
      setMessages(normalizeMessages(conversationResponse.data?.messages || []));
    }
  };

  const loadSkills = async (query) => {
    const { data } = await workshopBotAPI.getSkills({ query, limit: 24 });
    setSkills(data?.skills || []);
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const [modelsResponse, enginesResponse, summaryResponse] = await Promise.all([
          workshopBotAPI.getModels(),
          workshopBotAPI.getEngines(),
          workshopBotAPI.getSummary(),
        ]);

        if (!mounted) return;
        const modelRows = modelsResponse.data?.models || [];
        setModels(modelRows);
        setSelectedModel(modelRows.find((item) => item.id === 'gpt-5.1')?.id || modelRows[0]?.id || 'gpt-5.1');
        setEngines(enginesResponse.data?.engines || []);
        setSummary(summaryResponse.data?.summary || { total_skills: 0, total_prompts: 0, total_agents: 0 });
        const freshSessionId = createSessionId();
        setCurrentSessionId(freshSessionId);
        await Promise.all([loadConversations(freshSessionId), loadSkills('agent')]);
      } catch (error) {
        console.error('Workshop bot bootstrap failed', error);
      } finally {
        if (mounted) setBootLoading(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadSkills(skillSearch).catch((error) => console.error('Workshop skill search failed', error));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [skillSearch]);

  const handleSelectConversation = async (sessionId) => {
    try {
      setCurrentSessionId(sessionId);
      const response = await workshopBotAPI.getConversation(sessionId);
      setMessages(normalizeMessages(response.data?.messages || []));
      setShowSidebar(false);
    } catch (error) {
      console.error('Workshop conversation load failed', error);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(createSessionId());
    setMessages([]);
    setComposerValue('');
    setShowSidebar(false);
  };

  const handleDeleteConversation = async (sessionId) => {
    try {
      await workshopBotAPI.deleteConversation(sessionId);
      const nextRows = conversations.filter((conversation) => conversation.id !== sessionId);
      setConversations(nextRows);
      if (sessionId === currentSessionId) {
        if (nextRows[0]?.id) {
          await handleSelectConversation(nextRows[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (error) {
      console.error('Workshop conversation delete failed', error);
    }
  };

  const handleToggleSkill = (skillId) => {
    setSelectedSkills((previous) => {
      if (previous.includes(skillId)) {
        return previous.filter((item) => item !== skillId);
      }
      if (previous.length >= MAX_SELECTED_SKILLS) {
        return [...previous.slice(1), skillId];
      }
      return [...previous, skillId];
    });
  };

  const handleSend = async () => {
    const outgoing = String(composerValue || '').trim();
    if (!outgoing || loading) return;

    const userMessage = {
      role: 'user',
      content: outgoing,
      created_at: new Date().toISOString(),
    };
    setMessages((previous) => [...previous, userMessage]);
    setComposerValue('');
    setLoading(true);

    try {
      const response = await workshopBotAPI.respond({
        mode: currentMode,
        message: outgoing,
        engine: engine || undefined,
        model: selectedModel,
        developer_mode: developerMode,
        developer_prompt: developerMode ? developerPrompt : undefined,
        session_id: currentSessionId,
        skill_ids: selectedSkills,
      });

      const nextSessionId = response.data?.session_id || currentSessionId;
      setCurrentSessionId(nextSessionId);
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: response.data?.reply || 'لم يصل رد واضح.',
        model: response.data?.model_used || selectedModel,
        created_at: new Date().toISOString(),
      }]);
      await loadConversations(nextSessionId);
    } catch (error) {
      console.error('Workshop message send failed', error);
      setMessages((previous) => [...previous, {
        role: 'assistant',
        content: 'تعذر إكمال الرد الآن. حاول مرة أخرى بعد قليل.',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (bootLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-300" data-testid="workshop-bot-loading-state">
        جاري تجهيز واجهة ذكاء الورشة...
      </div>
    );
  }

  return (
    <div className="h-full bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]" data-testid="workshop-bot-webui">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden" data-testid="workshop-bot-mobile-toolbar">
        <button type="button" onClick={() => setShowSidebar((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-100" data-testid="workshop-bot-mobile-sidebar-toggle">
          <Menu size={16} />
        </button>
        <p className="text-sm font-semibold text-white" data-testid="workshop-bot-mobile-title">ورشة الذكاء</p>
        <button type="button" onClick={() => setShowRail((value) => !value)} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-100" data-testid="workshop-bot-mobile-rail-toggle">
          <PanelRightOpen size={16} />
        </button>
      </div>

      <div className="grid h-[calc(100%-57px)] md:h-full md:grid-cols-[280px,minmax(0,1fr),320px]">
        <div className={`${showSidebar ? 'block' : 'hidden'} md:block`}>
          <WorkshopBotSidebar
            summary={summary}
            currentMode={currentMode}
            onModeChange={setCurrentMode}
            conversations={conversations}
            currentSessionId={currentSessionId}
            onNewChat={handleNewChat}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
          />
        </div>

        <section className="flex min-h-0 flex-col border-x border-white/10" data-testid="workshop-bot-main-panel">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div>
              <p className="text-lg font-semibold text-white" data-testid="workshop-bot-main-title">Claude-style WebUI لذكاء الورشة</p>
              <p className="mt-1 text-xs text-slate-400" data-testid="workshop-bot-main-subtitle">واجهة محادثات مع جلسات جانبية، مهارات قابلة للتفعيل، وربط مباشر ببوت الورشة الحالي.</p>
            </div>
            <button type="button" onClick={() => loadConversations(currentSessionId)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10" data-testid="workshop-bot-refresh-button">
              <RefreshCw size={14} /> تحديث
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <WorkshopBotMessages
              messages={messages}
              loading={loading}
              onQuickPrompt={setComposerValue}
              currentMode={currentMode}
              selectedSkillsCount={selectedSkills.length}
            />
          </div>
          <WorkshopBotComposer value={composerValue} onChange={setComposerValue} onSend={handleSend} loading={loading} />
        </section>

        <div className={`${showRail ? 'block' : 'hidden'} md:block`}>
          <WorkshopBotSkillRail
            summary={summary}
            skillSearch={skillSearch}
            onSkillSearchChange={setSkillSearch}
            skills={skills}
            selectedSkills={selectedSkills}
            onToggleSkill={handleToggleSkill}
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            engines={engines}
            engine={engine}
            onEngineChange={setEngine}
            developerMode={developerMode}
            onDeveloperModeChange={setDeveloperMode}
            developerPrompt={developerPrompt}
            onDeveloperPromptChange={setDeveloperPrompt}
          />
        </div>
      </div>
    </div>
  );
}