const $ = (id) => document.getElementById(id);
const initialSSP = Array.from({length:11},(_,i)=>{
  const z=i*500,eta=2*(z-1300)/1300,c=1500*(1+.00737*(eta+Math.exp(-Math.max(-8,Math.min(8,eta)))-1));
  return [z,Math.max(1450,Math.min(1600,Math.round(c*2)/2))];
});
const state = { data: null, animation: 0, raf: null, request: 0, lossImage: null, eigen: null, eigenRequest: 0, customSSP: initialSSP, customInitialized: false, sspDrag: -1, receiverDragging: false, receiverPreview: null, introRaf: null, introStart: 0, introIndex: 0, introHold: 0 };
const controls = {
  profile: $('profile'), axisDepth: $('axisDepth'), gradient: $('gradient'),
  sourceDepth: $('sourceDepth'), frequency: $('frequency'), bottomSpeed: $('bottomSpeed'),
  bottomDensity: $('bottomDensity'), bottomAbsorption: $('bottomAbsorption')
};
const canvases = { intro: $('introRayCanvas'), ssp: $('sspCanvas'), ray: $('rayCanvas'), loss: $('lossCanvas'), eigen: $('eigenCanvas'), arrival: $('arrivalCanvas') };

function fitCanvas(canvas) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * ratio));
  const h = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w: rect.width, h: rect.height, ratio };
}

function params() {
  const result = {
    profile: controls.profile.value,
    axis_depth: Number(controls.axisDepth.value),
    gradient: Number(controls.gradient.value) / 100,
    source_depth: Math.max(50, Math.min(4800, Number(controls.sourceDepth.value) || 1000)),
    frequency: Math.max(50, Math.min(5000, Number(controls.frequency.value) || 500)),
    bottom_speed: Number(controls.bottomSpeed.value),
    bottom_density: Number(controls.bottomDensity.value),
    bottom_absorption: Number(controls.bottomAbsorption.value)
  };
  if(result.profile==='custom')result.ssp_points=state.customSSP.map(point=>[point[0],point[1]]);
  return result;
}

function syncLabels() {
  const p = params();
  $('axisDepthOut').textContent = p.axis_depth.toLocaleString('zh-CN') + ' m';
  $('gradientOut').textContent = p.gradient.toFixed(2) + '×';
  $('bottomSpeedOut').textContent=p.bottom_speed.toLocaleString('zh-CN')+' m/s';
  $('bottomDensityOut').textContent=p.bottom_density.toLocaleString('zh-CN')+' kg/m³';
  $('bottomAbsorptionOut').textContent=p.bottom_absorption.toFixed(2)+' dB/λ';
  $('axisDepth').disabled = p.profile === 'constant' || p.profile === 'custom';
  $('gradient').disabled = p.profile === 'constant' || p.profile === 'custom';
  $('channelSummary').textContent = p.profile === 'constant' ? '无明显声道轴' : p.profile==='custom' ? '由 11 个自定义节点共同决定' : `${p.axis_depth.toLocaleString('zh-CN')} m 附近`;
  const names = { munk: 'MUNK / DEEP CHANNEL', surface: 'THERMOCLINE / SURFACE', constant: 'ISOVELOCITY / CONTROL', custom:'CUSTOM / 500 M NODES' };
  $('hero-profile').textContent = names[p.profile];
}

function axes(ctx, w, h, opts = {}) {
  const pad = opts.pad || { l: 39, r: 12, t: 19, b: 28 };
  const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
  ctx.strokeStyle = 'rgba(92,151,169,.14)'; ctx.lineWidth = 1;
  ctx.fillStyle = '#5f7f89'; ctx.font = '10px ui-monospace, monospace';
  for (let i = 0; i <= 5; i++) {
    const x = pad.l + pw * i / 5;
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
    if (!opts.noLabels) { ctx.textAlign = 'center'; ctx.fillText(String(i * 20), x, h - 12); }
  }
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + ph * i / 5;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
    if (!opts.noLabels) { ctx.textAlign = 'right'; ctx.fillText(String(i * 1000), pad.l - 6, y + 3); }
  }
  return { ...pad, pw, ph };
}

function drawSSP() {
  const { ctx, w, h } = fitCanvas(canvases.ssp);
  ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#061720'; ctx.fillRect(0, 0, w, h);
  const p = axes(ctx, w, h, { pad: { l: 31, r: 12, t: 28, b: 34 }, noLabels: true });
  const ssp = state.data?.ssp || [];
  if (!ssp.length && !state.customSSP.length) return;
  const min=1450,max=1600,displaySSP=ssp.length?ssp:state.customSSP;
  ctx.beginPath();
  displaySSP.forEach(([z,c], i) => { const x = p.l + (c-min)/(max-min)*p.pw; const y = p.t + z/5000*p.ph; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); });
  ctx.strokeStyle = '#62d8e7'; ctx.lineWidth = 2; ctx.shadowColor = '#42c8db'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
  const axis = params().axis_depth; const ay = p.t + axis/5000*p.ph;
  if (['munk','surface'].includes(params().profile)) { ctx.setLineDash([3,3]); ctx.strokeStyle = 'rgba(197,241,107,.65)'; ctx.beginPath(); ctx.moveTo(p.l,ay);ctx.lineTo(p.l+p.pw,ay);ctx.stroke();ctx.setLineDash([]); }
  const nodes=sspNodes();nodes.forEach(([z,c],i)=>{const nx=p.l+(c-min)/(max-min)*p.pw,ny=p.t+z/5000*p.ph;ctx.fillStyle=i===state.sspDrag?'#f8b44c':'#071923';ctx.strokeStyle=i===state.sspDrag?'#f8b44c':'#62d8e7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(nx,ny,i===state.sspDrag?4.5:3.2,0,Math.PI*2);ctx.fill();ctx.stroke();});
  ctx.fillStyle = '#688a94'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign='left'; ctx.fillText(`${min} m/s`, p.l, h-20); ctx.textAlign='right'; ctx.fillText(`${max} m/s`, w-p.r, h-20);
  ctx.save();ctx.translate(9,h/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('DEPTH',0,0);ctx.restore();
}

function sspNodes(){
  if(controls.profile.value==='custom')return state.customSSP;
  const ssp=state.data?.ssp;if(!ssp?.length)return state.customSSP;
  return Array.from({length:11},(_,i)=>{const z=i*500,point=ssp.find(item=>item[0]===z)||ssp[Math.min(ssp.length-1,i*10)];return [z,point[1]];});
}

function sspPointer(event,commit=false){
  const canvas=canvases.ssp,rect=canvas.getBoundingClientRect(),layout={l:31,r:12,t:28,b:34,pw:rect.width-43,ph:rect.height-62,min:1450,max:1600};
  const px=event.clientX-rect.left,py=event.clientY-rect.top;
  if(state.sspDrag<0){
    let nearest=-1,distance=Infinity;sspNodes().forEach(([z,c],i)=>{const x=layout.l+(c-layout.min)/(layout.max-layout.min)*layout.pw,y=layout.t+z/5000*layout.ph,d=Math.hypot(px-x,py-y);if(d<distance){nearest=i;distance=d;}});
    if(distance>18)return;state.customSSP=sspNodes().map(point=>[point[0],point[1]]);state.customInitialized=true;state.sspDrag=nearest;controls.profile.value='custom';canvas.setPointerCapture?.(event.pointerId);
  }
  const speed=Math.round(Math.max(layout.min,Math.min(layout.max,layout.min+(px-layout.l)/layout.pw*(layout.max-layout.min)))*2)/2;state.customSSP[state.sspDrag][1]=speed;$('sspReadout').textContent=`${state.customSSP[state.sspDrag][0].toLocaleString('zh-CN')} m · ${speed.toFixed(1)} m/s`;syncLabels();drawSSP();markEigenStale();clearTimeout(debounce);debounce=setTimeout(run,commit?10:240);
}

function drawRay(progress = 1) {
  const { ctx, w, h } = fitCanvas(canvases.ray);
  ctx.clearRect(0,0,w,h); ctx.fillStyle='#06161f';ctx.fillRect(0,0,w,h);
  const a = axes(ctx,w,h); if (!state.data) return;
  const y = z => a.t + z/5000*a.ph, x = r => a.l + r/100*a.pw;
  const grad = ctx.createLinearGradient(0,a.t,0,a.t+a.ph); grad.addColorStop(0,'rgba(20,72,89,.16)');grad.addColorStop(.5,'rgba(18,91,108,.08)');grad.addColorStop(1,'rgba(4,10,16,.25)');ctx.fillStyle=grad;ctx.fillRect(a.l,a.t,a.pw,a.ph);
  ctx.strokeStyle='rgba(197,241,107,.28)';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(a.l,y(params().axis_depth));ctx.lineTo(a.l+a.pw,y(params().axis_depth));ctx.stroke();ctx.setLineDash([]);
  const maxRange = progress*100;
  state.data.rays.forEach((ray, idx) => {
    ctx.beginPath(); let started=false;
    ray.forEach(pt => { if(pt[0]>maxRange)return; const px=x(pt[0]),py=y(pt[1]); if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py); });
    const alpha=.32+.58*(1-Math.abs(idx-(state.data.rays.length-1)/2)/(state.data.rays.length/2));
    ctx.strokeStyle=`rgba(98,216,231,${alpha})`;ctx.lineWidth=idx%3===0?1.15:.75;ctx.stroke();
  });
  const sx=x(0), sy=y(params().source_depth); ctx.shadowColor='#f8b44c';ctx.shadowBlur=12;ctx.fillStyle='#f8b44c';ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(248,180,76,.35)';ctx.beginPath();ctx.arc(sx,sy,8,0,Math.PI*2);ctx.stroke();
  if(progress<1){const fx=x(maxRange);ctx.strokeStyle='rgba(98,216,231,.2)';ctx.beginPath();ctx.moveTo(fx,a.t);ctx.lineTo(fx,a.t+a.ph);ctx.stroke();}
}

const stops = [[9,16,34],[36,40,92],[41,97,145],[25,145,178],[56,207,202],[203,239,119]];
function tlColor(tl) {
  const u = Math.max(0,Math.min(1,(120-tl)/60))*(stops.length-1), i=Math.min(stops.length-2,Math.floor(u)), f=u-i;
  return stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f));
}

function buildLossImage() {
  if (!state.data) return;
  const cols=state.data.loss.cols, rows=state.data.loss.rows, values=state.data.loss.values;
  const off=document.createElement('canvas');off.width=cols;off.height=rows;const o=off.getContext('2d');const img=o.createImageData(cols,rows);
  for(let i=0;i<values.length;i++){const c=tlColor(values[i]);img.data[i*4]=c[0];img.data[i*4+1]=c[1];img.data[i*4+2]=c[2];img.data[i*4+3]=225;}
  o.putImageData(img,0,0);state.lossImage=off;
}

function drawLoss(progress=1) {
  const {ctx,w,h}=fitCanvas(canvases.loss);ctx.clearRect(0,0,w,h);ctx.fillStyle='#06161f';ctx.fillRect(0,0,w,h);const a=axes(ctx,w,h);
  if(!state.lossImage)return;
  ctx.imageSmoothingEnabled=true;ctx.globalAlpha=.88;ctx.drawImage(state.lossImage,0,0,state.lossImage.width*progress,state.lossImage.height,a.l,a.t,a.pw*progress,a.ph);ctx.globalAlpha=1;
  axes(ctx,w,h);
  if(progress<1){const fx=a.l+a.pw*progress;const g=ctx.createLinearGradient(fx-18,0,fx+8,0);g.addColorStop(0,'rgba(98,216,231,0)');g.addColorStop(1,'rgba(98,216,231,.42)');ctx.fillStyle=g;ctx.fillRect(fx-18,a.t,26,a.ph);}
}

const introRayOrder=[1,3,5,7,9,11,13,15,17];
function introPath(ctx,ray,fraction,x,y,color,width){
  if(!ray?.length)return null;const position=Math.max(0,Math.min(ray.length-1,(ray.length-1)*fraction)),whole=Math.floor(position),mix=position-whole;ctx.beginPath();ctx.moveTo(x(ray[0][0]),y(ray[0][1]));
  for(let i=1;i<=whole;i++)ctx.lineTo(x(ray[i][0]),y(ray[i][1]));
  let front=ray[Math.min(whole,ray.length-1)],previous=ray[Math.max(0,whole-1)];
  if(whole<ray.length-1){const next=ray[whole+1];front=[front[0]+(next[0]-front[0])*mix,front[1]+(next[1]-front[1])*mix];ctx.lineTo(x(front[0]),y(front[1]));previous=ray[whole];}
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();return {front,previous};
}

function drawIntroRay(progress=0){
  const {ctx,w,h}=fitCanvas(canvases.intro);ctx.clearRect(0,0,w,h);const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#08212c');bg.addColorStop(1,'#05141c');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  const a={l:46,r:15,t:20,b:34};a.pw=w-a.l-a.r;a.ph=h-a.t-a.b;ctx.strokeStyle='rgba(92,151,169,.13)';ctx.lineWidth=1;ctx.fillStyle='#64848e';ctx.font='10px ui-monospace, monospace';
  for(let i=0;i<=5;i++){const px=a.l+a.pw*i/5;ctx.beginPath();ctx.moveTo(px,a.t);ctx.lineTo(px,a.t+a.ph);ctx.stroke();ctx.textAlign='center';ctx.fillText(String(i*20),px,h-12);const py=a.t+a.ph*i/5;ctx.beginPath();ctx.moveTo(a.l,py);ctx.lineTo(a.l+a.pw,py);ctx.stroke();ctx.textAlign='right';ctx.fillText(String(i*1000),a.l-6,py+3);}
  ctx.fillStyle='#496d78';ctx.textAlign='center';ctx.fillText('距离 / km',a.l+a.pw/2,h-3);ctx.save();ctx.translate(10,a.t+a.ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('深度 / m',0,0);ctx.restore();
  const x=r=>a.l+r/100*a.pw,y=z=>a.t+z/5000*a.ph,p=params();ctx.setLineDash([4,5]);ctx.strokeStyle='rgba(197,241,107,.22)';ctx.beginPath();ctx.moveTo(a.l,y(p.axis_depth));ctx.lineTo(a.l+a.pw,y(p.axis_depth));ctx.stroke();ctx.setLineDash([]);
  if(!state.data?.rays?.length){ctx.fillStyle='#65848e';ctx.textAlign='center';ctx.fillText('WAITING FOR RAY SOLVER…',a.l+a.pw/2,a.t+a.ph/2);return;}
  const count=Math.min(introRayOrder.length,state.data.rays.length),current=Math.min(state.introIndex,count-1);
  for(let i=0;i<current;i++){const ray=state.data.rays[introRayOrder[i]];ctx.globalAlpha=.38;introPath(ctx,ray,1,x,y,'#62d8e7',1.1);}ctx.globalAlpha=1;
  const ray=state.data.rays[introRayOrder[current]],result=introPath(ctx,ray,progress,x,y,'#71e4ef',2);
  if(result){const fx=x(result.front[0]),fy=y(result.front[1]),px=x(result.previous[0]),py=y(result.previous[1]),dx=fx-px,dy=fy-py,length=Math.max(1,Math.hypot(dx,dy)),ux=dx/length,uy=dy/length;ctx.strokeStyle='#f8b44c';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(fx-ux*23,fy-uy*23);ctx.lineTo(fx+ux*18,fy+uy*18);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f8b44c';ctx.shadowColor='#f8b44c';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(fx,fy,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.save();ctx.translate(fx+ux*18,fy+uy*18);ctx.rotate(Math.atan2(uy,ux));ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-7,-4);ctx.lineTo(-7,4);ctx.closePath();ctx.fill();ctx.restore();}
  const sx=x(0),sy=y(p.source_depth);ctx.fillStyle='#f8b44c';ctx.shadowColor='#f8b44c';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(248,180,76,.45)';ctx.beginPath();ctx.arc(sx,sy,10,0,Math.PI*2);ctx.stroke();
  const nativeAngle=state.data.ray_angles_deg?.[introRayOrder[current]]??0;$('intro-source-label').style.top=Math.max(24,Math.min(h-45,sy-19))+'px';$('introRayNumber').textContent=`${String(current+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;$('introAngle').textContent=`${nativeAngle.toFixed(1).replace('-','−')}°`;$('introProgressBar').style.width=(progress*100).toFixed(1)+'%';$('introProgressText').textContent=Math.round(progress*100)+'%';
}

function startIntroAnimation(){
  cancelAnimationFrame(state.introRaf);state.introIndex=0;state.introStart=performance.now();state.introHold=0;
  const duration=2800,pause=260;
  function frame(now){
    if(!state.data?.rays?.length){drawIntroRay(0);state.introRaf=requestAnimationFrame(frame);return;}
    const elapsed=now-state.introStart,progress=Math.min(1,elapsed/duration);drawIntroRay(progress);
    if(elapsed>=duration+pause){if(state.introIndex<introRayOrder.length-1){state.introIndex++;state.introStart=now;}else if(!state.introHold){state.introHold=now;}else if(now-state.introHold>2200){state.introIndex=0;state.introStart=now;state.introHold=0;}}
    state.introRaf=requestAnimationFrame(frame);
  }
  state.introRaf=requestAnimationFrame(frame);
}

function animate() {
  cancelAnimationFrame(state.raf); const start=performance.now(), duration=1800;
  function frame(now){const t=Math.min(1,(now-start)/duration), eased=1-Math.pow(1-t,3);state.animation=eased;drawRay(eased);drawLoss(eased);if(t<1)state.raf=requestAnimationFrame(frame);}
  state.raf=requestAnimationFrame(frame);
}

function eigenColor(ray) {
  if (ray.top_bounces && ray.bottom_bounces) return '#ad85f7';
  if (ray.top_bounces) return '#66db91';
  if (ray.bottom_bounces) return '#59a9ff';
  return '#f8b44c';
}

function eigenAxes(ctx,w,h,maxRange) {
  const a={l:46,r:16,t:18,b:34};a.pw=w-a.l-a.r;a.ph=h-a.t-a.b;
  ctx.strokeStyle='rgba(92,151,169,.14)';ctx.lineWidth=1;ctx.fillStyle='#5f7f89';ctx.font='10px ui-monospace, monospace';
  for(let i=0;i<=5;i++){const x=a.l+a.pw*i/5;ctx.beginPath();ctx.moveTo(x,a.t);ctx.lineTo(x,a.t+a.ph);ctx.stroke();ctx.textAlign='center';ctx.fillText((maxRange*i/5).toFixed(0),x,h-12);}
  for(let i=0;i<=5;i++){const y=a.t+a.ph*i/5;ctx.beginPath();ctx.moveTo(a.l,y);ctx.lineTo(a.l+a.pw,y);ctx.stroke();ctx.textAlign='right';ctx.fillText(String(i*1000),a.l-6,y+3);}
  ctx.fillStyle='#486b76';ctx.textAlign='center';ctx.fillText('距离 / km',a.l+a.pw/2,h-3);ctx.save();ctx.translate(10,a.t+a.ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('深度 / m',0,0);ctx.restore();
  return a;
}

function drawEigen() {
  const {ctx,w,h}=fitCanvas(canvases.eigen);ctx.clearRect(0,0,w,h);ctx.fillStyle='#06161f';ctx.fillRect(0,0,w,h);
  const data=state.eigen,maxRange=100,a=eigenAxes(ctx,w,h,maxRange);if(!data)return;
  const receiver=state.receiverPreview||data.receiver,x=r=>a.l+r/maxRange*a.pw,y=z=>a.t+z/5000*a.ph;
  ctx.lineWidth=.65;ctx.strokeStyle='rgba(139,157,161,.22)';
  data.coarse_rays.forEach(ray=>{ctx.beginPath();ray.path.forEach((pt,i)=>i?ctx.lineTo(x(pt[0]),y(pt[1])):ctx.moveTo(x(pt[0]),y(pt[1])));ctx.stroke();});
  ctx.setLineDash([5,4]);data.equal_angle_eigenrays.forEach(ray=>{ctx.beginPath();ray.path.forEach((pt,i)=>i?ctx.lineTo(x(pt[0]),y(pt[1])):ctx.moveTo(x(pt[0]),y(pt[1])));ctx.strokeStyle='rgba(91,157,255,.75)';ctx.lineWidth=1.15;ctx.stroke();});ctx.setLineDash([]);
  data.eigenrays.forEach(ray=>{ctx.beginPath();ray.path.forEach((pt,i)=>i?ctx.lineTo(x(pt[0]),y(pt[1])):ctx.moveTo(x(pt[0]),y(pt[1])));ctx.strokeStyle=eigenColor(ray);ctx.lineWidth=1.65;ctx.shadowColor=eigenColor(ray);ctx.shadowBlur=5;ctx.stroke();ctx.shadowBlur=0;});
  const rx=x(receiver.range_km),ry=y(receiver.depth_m),boxLeft=Math.max(0,receiver.range_km-1),boxRight=Math.min(100,receiver.range_km+1),boxTop=Math.max(0,receiver.depth_m-180),boxBottom=Math.min(5000,receiver.depth_m+180);
  if(state.receiverDragging){ctx.setLineDash([3,4]);ctx.strokeStyle='rgba(248,180,76,.36)';ctx.beginPath();ctx.moveTo(a.l,ry);ctx.lineTo(a.l+a.pw,ry);ctx.moveTo(rx,a.t);ctx.lineTo(rx,a.t+a.ph);ctx.stroke();ctx.setLineDash([]);}
  ctx.fillStyle='#f8b44c';ctx.shadowColor='#f8b44c';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(rx,ry,state.receiverDragging?7:5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#f8b44c';ctx.strokeRect(x(boxLeft),y(boxTop),x(boxRight)-x(boxLeft),y(boxBottom)-y(boxTop));
  ctx.fillStyle='#e2be78';ctx.font='10px ui-monospace, monospace';ctx.textAlign=rx>w-165?'right':'left';ctx.fillText(`${receiver.range_km.toFixed(1)} km · ${receiver.depth_m.toFixed(0)} m`,rx+(rx>w-165?-10:10),ry-10);

  const zw=Math.min(230,w*.34),zh=Math.min(150,h*.36),zx=w-zw-24,zy=32;ctx.fillStyle='rgba(5,19,27,.96)';ctx.fillRect(zx,zy,zw,zh);ctx.strokeStyle='#285365';ctx.strokeRect(zx,zy,zw,zh);
  ctx.save();ctx.beginPath();ctx.rect(zx+8,zy+18,zw-16,zh-27);ctx.clip();
  const zxmin=boxLeft,zxmax=boxRight,zymin=boxTop,zymax=boxBottom;const xx=r=>zx+8+(r-zxmin)/Math.max(.1,zxmax-zxmin)*(zw-16),yy=z=>zy+18+(z-zymin)/Math.max(1,zymax-zymin)*(zh-27);
  data.coarse_rays.forEach(ray=>{ctx.beginPath();let active=false;ray.path.forEach(pt=>{if(pt[0]<zxmin||pt[0]>zxmax)return;active?ctx.lineTo(xx(pt[0]),yy(pt[1])):(ctx.moveTo(xx(pt[0]),yy(pt[1])),active=true);});ctx.strokeStyle='rgba(145,157,160,.3)';ctx.lineWidth=.7;ctx.stroke();});
  ctx.setLineDash([4,3]);data.equal_angle_eigenrays.forEach(ray=>{ctx.beginPath();let active=false;ray.path.forEach(pt=>{if(pt[0]<zxmin||pt[0]>zxmax)return;active?ctx.lineTo(xx(pt[0]),yy(pt[1])):(ctx.moveTo(xx(pt[0]),yy(pt[1])),active=true);});ctx.strokeStyle='rgba(91,157,255,.8)';ctx.lineWidth=1;ctx.stroke();});ctx.setLineDash([]);
  data.eigenrays.forEach(ray=>{ctx.beginPath();let active=false;ray.path.forEach(pt=>{if(pt[0]<zxmin||pt[0]>zxmax)return;active?ctx.lineTo(xx(pt[0]),yy(pt[1])):(ctx.moveTo(xx(pt[0]),yy(pt[1])),active=true);});ctx.strokeStyle=eigenColor(ray);ctx.lineWidth=1.25;ctx.stroke();});
  ctx.fillStyle='#f8b44c';ctx.beginPath();ctx.arc(xx(receiver.range_km),yy(receiver.depth_m),3.5,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.fillStyle='#688a94';ctx.font='10px ui-monospace, monospace';ctx.textAlign='left';ctx.fillText('LOCAL CONVERGENCE',zx+8,zy+12);
}

function receiverFromPointer(event){
  const rect=canvases.eigen.getBoundingClientRect(),a={l:46,r:16,t:18,b:34},pw=rect.width-62,ph=rect.height-52,px=event.clientX-rect.left,py=event.clientY-rect.top;
  return {range_km:Math.round(Math.max(5,Math.min(95,(px-a.l)/pw*100))*2)/2,depth_m:Math.round(Math.max(20,Math.min(4980,(py-a.t)/ph*5000))/10)*10,px,py,a,pw,ph};
}

function startReceiverDrag(event){
  if(!state.eigen||$('eigenRun').disabled)return;const point=receiverFromPointer(event),receiver=state.receiverPreview||state.eigen.receiver,rx=point.a.l+receiver.range_km/100*point.pw,ry=point.a.t+receiver.depth_m/5000*point.ph;
  if(Math.hypot(point.px-rx,point.py-ry)>18)return;state.receiverDragging=true;state.receiverPreview={range_km:receiver.range_km,depth_m:receiver.depth_m};canvases.eigen.classList.add('dragging');canvases.eigen.setPointerCapture?.(event.pointerId);moveReceiver(event);
}

function moveReceiver(event){
  if(!state.receiverDragging)return;const point=receiverFromPointer(event);state.receiverPreview={range_km:point.range_km,depth_m:point.depth_m};$('receiverRange').value=point.range_km.toFixed(1);$('receiverDepth').value=String(point.depth_m);$('eigenStatus').classList.add('eigen-running');$('eigenStatus').querySelector('span').textContent='拖动接收器 · 松开后重新求解';drawEigen();
}

function finishReceiverDrag(event){
  if(!state.receiverDragging)return;moveReceiver(event);state.receiverDragging=false;canvases.eigen.classList.remove('dragging');runEigen();
}

function drawArrivals() {
  const {ctx,w,h}=fitCanvas(canvases.arrival);ctx.clearRect(0,0,w,h);ctx.fillStyle='#06161f';ctx.fillRect(0,0,w,h);const rays=(state.eigen?.eigenrays||[]).filter(r=>r.arrival_valid&&Number.isFinite(r.travel_time_s)&&Number.isFinite(r.amplitude)),equal=(state.eigen?.equal_angle_eigenrays||[]).filter(r=>r.arrival_valid&&Number.isFinite(r.travel_time_s)&&Number.isFinite(r.amplitude)),all=[...rays,...equal],a={l:43,r:14,t:18,b:30};a.pw=w-a.l-a.r;a.ph=h-a.t-a.b;
  ctx.strokeStyle='rgba(92,151,169,.14)';ctx.fillStyle='#5f7f89';ctx.font='10px ui-monospace, monospace';
  for(let i=0;i<=4;i++){const y=a.t+a.ph*i/4;ctx.beginPath();ctx.moveTo(a.l,y);ctx.lineTo(a.l+a.pw,y);ctx.stroke();ctx.textAlign='right';ctx.fillText((1-i/4).toFixed(2),a.l-6,y+3);}
  if(!all.length){ctx.textAlign='center';ctx.fillText('NO EIGENRAYS FOUND',a.l+a.pw/2,a.t+a.ph/2);return;}
  const times=all.map(r=>r.travel_time_s),min=Math.min(...times),max=Math.max(...times),span=Math.max(.08,max-min),lo=min-span*.08,hi=max+span*.08,maxAmp=Math.max(1e-30,...all.map(r=>r.amplitude));
  equal.forEach(ray=>{const x=a.l+(ray.travel_time_s-lo)/(hi-lo)*a.pw,amp=ray.amplitude/maxAmp,y=a.t+(1-amp)*a.ph;ctx.strokeStyle='rgba(91,157,255,.72)';ctx.lineWidth=1;ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(x,a.t+a.ph);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#5b9dff';ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.stroke();});
  rays.forEach(ray=>{const x=a.l+(ray.travel_time_s-lo)/(hi-lo)*a.pw,amp=ray.amplitude/maxAmp,y=a.t+(1-amp)*a.ph;ctx.strokeStyle=eigenColor(ray);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,a.t+a.ph);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle=eigenColor(ray);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill();});
  for(let i=0;i<=4;i++){const x=a.l+a.pw*i/4;ctx.fillStyle='#486b76';ctx.textAlign='center';ctx.fillText((lo+(hi-lo)*i/4).toFixed(2),x,h-12);}
  ctx.fillText('到达时间 / s',a.l+a.pw/2,h-3);ctx.save();ctx.translate(10,a.t+a.ph/2);ctx.rotate(-Math.PI/2);ctx.fillText('归一化幅度',0,0);ctx.restore();ctx.textAlign='right';ctx.fillStyle='#5b9dff';ctx.fillText('○ 1000 等角度',w-72,11);ctx.fillStyle='#c5f16b';ctx.fillText('● 精确本征',w-12,11);
}

function renderEigenSummary() {
  const data=state.eigen;if(!data)return;const rays=data.eigenrays,equal=data.equal_angle_eigenrays;
  $('coarseMiss').textContent=data.equal_angle_residual_rmse_m.toFixed(2)+' m';$('exactResidual').textContent=data.precise_residual_rmse_m.toFixed(3)+' m';$('eigenCount').textContent=`${equal.length} / ${rays.length} paths`;$('eigenIterations').textContent=data.iterations==null?'MODE_E_PC':data.iterations+' iter';$('coherentTl').textContent=data.coherent_tl_db.toFixed(2)+' dB';$('incoherentTl').textContent=data.incoherent_tl_db.toFixed(2)+' dB';
  const timeText=ray=>ray.arrival_valid&&Number.isFinite(ray.travel_time_s)?ray.travel_time_s.toFixed(4)+' s':'—',phaseText=ray=>ray.arrival_valid&&Number.isFinite(ray.phase_deg)?ray.phase_deg.toFixed(1)+'°':'—';
  const exactRows=rays.map(ray=>`<tr><td class="method-precise">精确</td><td>E${String(ray.id).padStart(2,'0')}</td><td style="color:${eigenColor(ray)}">${ray.kind}</td><td>${ray.launch_angle.toFixed(4)}°</td><td>${timeText(ray)}</td><td>${phaseText(ray)}</td><td>${Math.abs(ray.residual_m).toFixed(3)} m</td></tr>`),equalRows=equal.map(ray=>`<tr><td class="method-equal">等角度</td><td>A${String(ray.id).padStart(2,'0')}</td><td>${ray.kind}</td><td>${ray.launch_angle.toFixed(4)}°</td><td>${timeText(ray)}</td><td>${phaseText(ray)}</td><td>${Math.abs(ray.residual_m).toFixed(2)} m</td></tr>`);
  $('arrivalRows').innerHTML=exactRows.length||equalRows.length?[...exactRows,...equalRows].join(''):'<tr><td colspan="7">当前角度范围内未发现本征声线，请调整接收点。</td></tr>';
}

async function runEigen() {
  const token=++state.eigenRequest,p=params();p.receiver_range=Math.max(5,Math.min(95,Number($('receiverRange').value)||50));p.receiver_depth=Math.max(20,Math.min(4980,Number($('receiverDepth').value)||1000));p.tolerance=Number($('eigenTolerance').value);
  const names={munk:'Munk 深海声道',surface:'表层跃变',constant:'等声速水体',custom:'自定义 500 m 节点'};$('eigenEnv').textContent=`${names[p.profile]} · 声源 ${p.source_depth.toLocaleString('zh-CN')} m · ${p.frequency} Hz`;$('eigenStatus').classList.add('eigen-running');$('eigenStatus').querySelector('span').textContent='正在追踪 1000 条等角度粗划分声线';$('eigenRun').disabled=true;
  try{const res=await fetch('/api/eigenrays',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();if(token!==state.eigenRequest)return;state.eigen=data;state.receiverPreview=null;state.receiverDragging=false;canvases.eigen.classList.remove('dragging');drawEigen();drawArrivals();renderEigenSummary();$('eigenStatus').querySelector('span').textContent=`${data.coarse_angle_count} 条粗划分完成 · ${data.compute_ms.toFixed(1)} ms`;$('eigenStatus').classList.remove('eigen-running');}
  catch(e){$('eigenStatus').querySelector('span').textContent='求解失败 · 请确认 Python 服务已启动';$('eigenStatus').classList.remove('eigen-running');console.error(e);}finally{if(token===state.eigenRequest)$('eigenRun').disabled=false;}
}

async function run() {
  const token=++state.request;syncLabels();$('simStatus').textContent='CALCULATING';$('simTime').textContent='PLEASE WAIT';$('simPulse').parentElement.classList.add('loading');
  const started=performance.now();
  try {
    const res=await fetch('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params())});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);const data=await res.json();if(token!==state.request)return;state.data=data;state.animation=1;$('bottomReflectionLoss').textContent=data.bottom.absorption_db_per_wavelength.toFixed(2)+' dB/λ';$('fieldRayCount').textContent=data.field_ray_count.toLocaleString('zh-CN')+' RAYS';buildLossImage();drawSSP();drawRay(1);drawLoss(1);startIntroAnimation();
    $('simStatus').textContent='SIMULATION COMPLETE';$('simTime').textContent=`${(performance.now()-started).toFixed(1)} ms`;
  } catch(e) {
    $('simStatus').textContent='OFFLINE';$('simTime').textContent='START server.py';console.error(e);
  } finally { if(token===state.request)$('simPulse').parentElement.classList.remove('loading'); }
}

let debounce;
function markEigenStale(){if(!$('eigenStatus')||$('eigenRun').disabled)return;$('eigenStatus').querySelector('span').textContent='环境已更新 · 点击重新搜索';}
function schedule(){syncLabels();markEigenStale();clearTimeout(debounce);debounce=setTimeout(run,280);}
Object.values(controls).forEach(el=>el.addEventListener(el.type==='number'?'change':'input',schedule));
$('sspCanvas').addEventListener('pointerdown',e=>sspPointer(e));
$('sspCanvas').addEventListener('pointermove',e=>{if(state.sspDrag>=0)sspPointer(e);});
function finishSSPDrag(e){if(state.sspDrag<0)return;sspPointer(e,true);state.sspDrag=-1;drawSSP();}
$('sspCanvas').addEventListener('pointerup',finishSSPDrag);$('sspCanvas').addEventListener('pointercancel',finishSSPDrag);
$('runButton').addEventListener('click',run);$('replayButton').addEventListener('click',()=>{drawRay(1);drawLoss(1);});
$('introReplay').addEventListener('click',startIntroAnimation);
canvases.loss.addEventListener('mousemove',e=>{if(!state.data)return;const rect=e.target.getBoundingClientRect(),a={l:39,r:12,t:19,b:28};const px=Math.max(0,Math.min(1,(e.clientX-rect.left-a.l)/(rect.width-a.l-a.r))),py=Math.max(0,Math.min(1,(e.clientY-rect.top-a.t)/(rect.height-a.t-a.b)));const {cols,rows,values}=state.data.loss;const v=values[Math.min(rows-1,Math.floor(py*rows))*cols+Math.min(cols-1,Math.floor(px*cols))];$('tlReadout').textContent=v.toFixed(1)+' dB';});
window.addEventListener('resize',()=>{drawSSP();drawRay(state.animation||1);drawLoss(state.animation||1);});
document.querySelectorAll('nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('nav a').forEach(x=>x.classList.remove('active'));a.classList.add('active');}));
$('eigenRun').addEventListener('click',runEigen);$('receiverRange').addEventListener('change',runEigen);$('receiverDepth').addEventListener('change',runEigen);$('eigenTolerance').addEventListener('change',runEigen);
canvases.eigen.addEventListener('pointerdown',startReceiverDrag);canvases.eigen.addEventListener('pointermove',moveReceiver);canvases.eigen.addEventListener('pointerup',finishReceiverDrag);canvases.eigen.addEventListener('pointercancel',finishReceiverDrag);
window.addEventListener('resize',()=>{drawEigen();drawArrivals();});
syncLabels();drawIntroRay();drawSSP();drawRay();drawLoss();drawEigen();drawArrivals();startIntroAnimation();run();runEigen();
