import React, { useEffect, useState } from 'react';
import { Copy, GripVertical, Link2, Trash2 } from 'lucide-react';
import { K_ResolveResponsive, M_DragEngine, N_ResizeEngine, P_Toolbar, R_Validate } from '../lib/moltbot_full_responsive_engine';

export function A_CanvasApp({ initialState, onStateChange, onSelectElement }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const dragEngine = M_DragEngine(state, setState, onStateChange);
  const resizeEngine = N_ResizeEngine(state, setState, onStateChange);

  useEffect(() => {
    if (!R_Validate(state)) {
      console.warn('Invalid canvas state detected');
    }
  }, [state]);

  return (
    <div className="moltbot-canvas-root h-full w-full">
      <B_DeviceFrame state={state} setState={setState} onStateChange={onStateChange}>
        <C_RenderCanvas state={state} setState={setState} dragEngine={dragEngine} resizeEngine={resizeEngine} onSelectElement={onSelectElement} />
      </B_DeviceFrame>
    </div>
  );
}

export function B_DeviceFrame({ state, setState, onStateChange, children }) {
  function switchDevice(device) {
    setState((prev) => {
      const next = { ...prev, page: { ...prev.page, device } };
      onStateChange?.(next);
      return next;
    });
  }

  return (
    <div className={`device-${state.page.device} relative h-full w-full`}>
      <div className="absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full bg-black/70 px-3 py-2 text-xs text-white">
        <button onClick={() => switchDevice('desktop')}>Desktop</button>
        <button onClick={() => switchDevice('tablet')}>Tablet</button>
        <button onClick={() => switchDevice('mobile')}>Mobile</button>
      </div>
      {children}
    </div>
  );
}

export function C_RenderCanvas({ state, setState, dragEngine, resizeEngine, onSelectElement }) {
  return (
    <div className="canvas-area relative h-full w-full overflow-auto rounded-[28px] bg-[#0f172a] p-6">
      {state.sections.map((section) => section.elements.map((element) => (
        <D_ElementRenderer key={element.id} element={element} state={state} setState={setState} dragEngine={dragEngine} resizeEngine={resizeEngine} onSelectElement={onSelectElement} />
      )))}
    </div>
  );
}

export function D_ElementRenderer({ element, state, setState, dragEngine, resizeEngine, onSelectElement }) {
  const device = state.page.device;
  const resolved = K_ResolveResponsive(element, device);
  const toolbar = P_Toolbar(element, state.selectedId);

  return (
    <div
      className={`absolute overflow-visible rounded-[22px] border ${state.selectedId === element.id ? 'border-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.15)]' : 'border-white/10'} ${element.type}`}
      style={{
        left: resolved.position.x,
        top: resolved.position.y,
        width: resolved.styles.width,
        height: resolved.styles.height,
        color: resolved.styles.color,
        background: resolved.styles.background,
        fontSize: resolved.styles.fontSize,
        fontWeight: resolved.styles.fontWeight,
        opacity: resolved.styles.opacity,
        borderRadius: resolved.styles.borderRadius,
        boxShadow: resolved.styles.boxShadow,
        textAlign: resolved.styles.textAlign,
        padding: resolved.styles.padding,
        margin: resolved.styles.margin,
        backdropFilter: resolved.styles.backdropFilter,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        setState((prev) => ({ ...prev, selectedId: element.id }));
        onSelectElement?.(element.id);
      }}
      data-testid={`moltbot-react-canvas-element-${element.id}`}
    >
      <div className="absolute -top-4 left-3 z-20 flex items-center gap-2 rounded-full bg-black/80 px-3 py-1 text-[11px] text-white">
        <button onMouseDown={(e) => { e.stopPropagation(); dragEngine.onDrag(element.id, e.clientX, e.clientY); }}><GripVertical size={12} /></button>
        <span>{element.name || element.content?.text || element.id}</span>
      </div>

      {element.type === 'text' && <div className="h-full w-full whitespace-pre-wrap">{element.content.text}</div>}
      {element.type === 'image' && <img src={element.content.src} alt={element.content.alt} className="h-full w-full rounded-[inherit] object-cover" />}
      {element.type === 'button' && <button className="h-full w-full rounded-[inherit]" onClick={() => window.open(element.content.href, '_blank')}>{element.content.text}</button>}

      <E_FloatingToolbar element={element} toolbar={toolbar} />
      <F_ResizeHandles element={element} resizeEngine={resizeEngine} />
    </div>
  );
}

export function E_FloatingToolbar({ element, toolbar }) {
  if (!toolbar) return null;
  const iconMap = {
    copy: <Copy size={12} />,
    hide: <Trash2 size={12} />,
    bind: <Link2 size={12} />,
  };
  return (
    <div className="absolute -bottom-4 right-3 z-20 flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[11px] text-white">
      {toolbar.map((action) => <span key={action} className="inline-flex items-center gap-1 px-2">{iconMap[action]} {action}</span>)}
    </div>
  );
}

export function F_ResizeHandles({ element, resizeEngine }) {
  return (
    <>
      <div className="absolute right-0 top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-cyan-400/80" onMouseDown={(e) => { e.stopPropagation(); resizeEngine.onResize(element.id, element.width, element.height, e.clientX, e.clientY); }} />
      <div className="absolute bottom-0 right-1/2 h-2 w-10 translate-x-1/2 cursor-ns-resize rounded-full bg-cyan-400/80" onMouseDown={(e) => { e.stopPropagation(); resizeEngine.onResize(element.id, element.width, element.height, e.clientX, e.clientY); }} />
      <div className="absolute -bottom-2 -left-2 h-5 w-5 cursor-se-resize rounded-full border border-cyan-300 bg-cyan-400 shadow" onMouseDown={(e) => { e.stopPropagation(); resizeEngine.onResize(element.id, element.width, element.height, e.clientX, e.clientY); }} />
    </>
  );
}

export const MOLTBOT_UI_SYSTEM = {
  renderer: 'React Canvas System',
  binding: 'JSON → UI LIVE SYNC',
  responsive: 'DEVICE BASED RESOLUTION',
  interaction: 'DRAG + RESIZE + TOOLBAR',
  safety: 'VALIDATED STATE ONLY',
};