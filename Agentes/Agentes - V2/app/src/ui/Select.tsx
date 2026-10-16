'use client';

import { useEffect, useId, useRef, useState } from 'react';
import * as Radix from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

export function Select({ label, value, onChange, options, disabled = false, hint }: {
  label: string; value: string; onChange: (value: string) => void;
  options: { value: string; label: string }[]; disabled?: boolean; hint?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined);
  useEffect(() => {
    if (!open || !content) return;
    const host = Array.from(document.body.children).find(node => node.contains(content));
    const nodes = Array.from(document.body.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node !== host && !['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName) && !node.inert);
    nodes.forEach(node => { node.inert = true; });
    return () => { nodes.forEach(node => { node.inert = false; }); };
  }, [open, content]);
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <Radix.Root value={value} onValueChange={onChange} disabled={disabled} open={open} onOpenChange={next => { setPortalContainer(trigger.current?.closest('dialog') ?? undefined); setOpen(next); }}>
      <Radix.Trigger ref={trigger} className="select-trigger" id={id} aria-describedby={hint ? `${id}-hint` : undefined}>
        <Radix.Value placeholder="Escolha uma opção" /><Radix.Icon><ChevronDown size={16} /></Radix.Icon>
      </Radix.Trigger>
      <Radix.Portal container={portalContainer}><Radix.Content className="select-content" position="popper" sideOffset={4} ref={setContent}>
        <Radix.ScrollUpButton className="select-scroll"><ChevronUp size={16} /></Radix.ScrollUpButton>
        <Radix.Viewport>{options.map(option => <Radix.Item key={option.value} value={option.value} className="select-option">
          <Radix.ItemText>{option.label}</Radix.ItemText><Radix.ItemIndicator><Check size={16} /></Radix.ItemIndicator>
        </Radix.Item>)}</Radix.Viewport>
        <Radix.ScrollDownButton className="select-scroll"><ChevronDown size={16} /></Radix.ScrollDownButton>
      </Radix.Content></Radix.Portal>
    </Radix.Root>
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </div>;
}
