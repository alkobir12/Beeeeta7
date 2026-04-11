import React from 'react';
import { BrainCircuit, Search, Settings2 } from 'lucide-react';

export const WorkshopBotSkillRail = ({ summary, skillSearch, onSkillSearchChange, skills, selectedSkills, onToggleSkill, models, selectedModel, onModelChange, engines, engine, onEngineChange, developerMode, onDeveloperModeChange, developerPrompt, onDeveloperPromptChange }) => {
  return (
    <aside className="flex h-full flex-col border-r border-white/10 bg-slate-950/80" data-testid="workshop-bot-skill-rail">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-2 text-white">
          <BrainCircuit size={18} />
          <p className="text-sm font-semibold" data-testid="workshop-bot-skill-rail-title">المهارات والسياق</p>
        </div>
        <p className="mt-1 text-xs text-slate-400" data-testid="workshop-bot-skill-rail-summary">{summary?.total_agents || 0} وكلاء • {summary?.total_skills || 0} مهارة</p>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3" data-testid="workshop-bot-settings-card">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white"><Settings2 size={15} /> إعدادات الجلسة</div>
          <label className="mb-2 block text-[11px] text-slate-400">النموذج</label>
          <select value={selectedModel} onChange={(event) => onModelChange(event.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" data-testid="workshop-bot-rail-model-select">
            {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>

          <label className="mb-2 block text-[11px] text-slate-400">المحرك</label>
          <select value={engine} onChange={(event) => onEngineChange(event.target.value)} className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none" data-testid="workshop-bot-rail-engine-select">
            <option value="">غير محدد</option>
            {engines.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}
          </select>

          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200" data-testid="workshop-bot-rail-developer-toggle-row">
            <span>وضع المطور</span>
            <input type="checkbox" checked={developerMode} onChange={(event) => onDeveloperModeChange(event.target.checked)} data-testid="workshop-bot-rail-developer-toggle" />
          </label>

          {developerMode ? (
            <textarea value={developerPrompt} onChange={(event) => onDeveloperPromptChange(event.target.value)} className="mt-3 min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none" placeholder="اكتب توجيه المطور هنا" data-testid="workshop-bot-rail-developer-prompt" />
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3" data-testid="workshop-bot-skills-card">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-3 text-slate-500" />
            <input value={skillSearch} onChange={(event) => onSkillSearchChange(event.target.value)} placeholder="ابحث في 536 مهارة..." className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pr-9 pl-3 text-sm text-white outline-none placeholder:text-slate-500" data-testid="workshop-bot-skill-search-input" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2" data-testid="workshop-bot-selected-skills">
            {selectedSkills.length === 0 ? <span className="text-xs text-slate-500" data-testid="workshop-bot-selected-skills-empty">اختر حتى 4 مهارات لإثراء الجواب.</span> : selectedSkills.map((skillId) => <span key={skillId} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100" data-testid={`workshop-bot-selected-skill-${skillId}`}>{skillId}</span>)}
          </div>

          <div className="mt-3 space-y-2" data-testid="workshop-bot-skill-results">
            {skills.map((skill, index) => {
              const active = selectedSkills.includes(skill.id);
              return (
                <button key={skill.id} type="button" onClick={() => onToggleSkill(skill.id)} className={`w-full rounded-2xl border p-3 text-right transition ${active ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/10 bg-slate-900/80 hover:border-white/20'}`} data-testid={`workshop-bot-skill-toggle-${index}`}>
                  <p className="text-sm font-medium text-white" data-testid={`workshop-bot-skill-title-${index}`}>{skill.title}</p>
                  <p className="mt-1 text-[11px] text-slate-400" data-testid={`workshop-bot-skill-category-${index}`}>{skill.category}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-300" data-testid={`workshop-bot-skill-preview-${index}`}>{skill.description || skill.preview}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};