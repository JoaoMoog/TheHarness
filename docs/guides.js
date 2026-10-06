(() => {
  const scenes=[...document.querySelectorAll('.scene')], rail=document.getElementById('rail');
  const prev=document.getElementById('prev'), next=document.getElementById('next'), play=document.getElementById('play'), count=document.getElementById('count');
  let at=0, timer=null;
  const chips=scenes.map((scene,i)=>{
    const button=document.createElement('button');button.type='button';
    button.textContent=String(i+1).padStart(2,'0')+' · '+scene.dataset.title;
    button.addEventListener('click',()=>{stop();show(i);});
    rail.append(button);return button;
  });
  function stop(){if(timer!==null)clearInterval(timer);timer=null;play.textContent='Reproduzir';play.setAttribute('aria-pressed','false');}
  function show(index){
    at=Math.max(0,Math.min(scenes.length-1,index));
    scenes.forEach((s,i)=>{s.hidden=i!==at;});
    chips.forEach((b,i)=>{if(i===at)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    count.textContent='Cena '+(at+1)+' de '+scenes.length;
    prev.disabled=at===0;next.disabled=at===scenes.length-1;
    if(at===scenes.length-1)stop();
  }
  function start(){
    if(at===scenes.length-1)show(0);
    play.textContent='Pausar';play.setAttribute('aria-pressed','true');
    timer=setInterval(()=>show(at+1),12000);
  }
  prev.addEventListener('click',()=>{stop();show(at-1);});
  next.addEventListener('click',()=>{stop();show(at+1);});
  play.addEventListener('click',()=>timer===null?start():stop());
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]'))return;
    const moves={ArrowRight:at+1,PageDown:at+1,ArrowLeft:at-1,PageUp:at-1,Home:0,End:scenes.length-1};
    if(!(event.key in moves))return;
    event.preventDefault();stop();show(moves[event.key]);
  });
  function followHash(){const index=scenes.findIndex(s=>'#'+s.id===location.hash);if(index>=0){stop();show(index);}}
  addEventListener('hashchange',followHash);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  show(0);followHash();
})();
