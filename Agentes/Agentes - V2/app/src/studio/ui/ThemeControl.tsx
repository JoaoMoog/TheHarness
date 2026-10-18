'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {IconButton} from './ui';

type Preferences={mode:'light'|'dark';preset:'slate'};
export function ThemeControl(){
 const [prefs,setPrefs]=useState<Preferences>({mode:'light',preset:'slate'});
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('clara:appearance:v1')||'{}');const next:Preferences={mode:saved.mode==='dark'?'dark':'light',preset:'slate'};setPrefs(next);apply(next)}catch{}},[]);
 function apply(value:Preferences){document.documentElement.classList.toggle('dark',value.mode==='dark');document.documentElement.dataset.themePreset=value.preset}
 function change(value:Preferences){setPrefs(value);apply(value);try{localStorage.setItem('clara:appearance:v1',JSON.stringify(value))}catch{}}
 return <div className="theme-control"><IconButton icon={prefs.mode==='dark'?Sun:Moon} label={prefs.mode==='dark'?'Usar tema claro':'Usar tema escuro'} onClick={()=>change({...prefs,mode:prefs.mode==='dark'?'light':'dark'})}/></div>;
}
