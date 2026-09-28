// Newton's laws: ideal, one-dimensional models. Artwork and controls are native Construct objects.
// The script evaluates continuous motion and updates the three parameter-dependent graph traces.
const GRAPH_SEGMENTS = [[1029, 1030, 1031, 1032, 1033, 1034, 1035, 1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043, 1044, 1045, 1046, 1047, 1048, 1049, 1050, 1051, 1052, 1053, 1054, 1055, 1056, 1057, 1058, 1059, 1060, 1061, 1062, 1063, 1064, 1065, 1066, 1067, 1068, 1069, 1070, 1071, 1072, 1073, 1074, 1075, 1076, 1077, 1078], [1079, 1080, 1081, 1082, 1083, 1084, 1085, 1086, 1087, 1088, 1089, 1090, 1091, 1092, 1093, 1094, 1095, 1096, 1097, 1098, 1099, 1100, 1101, 1102, 1103, 1104, 1105, 1106, 1107, 1108, 1109, 1110, 1111, 1112, 1113, 1114, 1115, 1116, 1117, 1118, 1119, 1120, 1121, 1122, 1123, 1124, 1125, 1126, 1127, 1128], [1129, 1130, 1131, 1132, 1133, 1134, 1135, 1136, 1137, 1138, 1139, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147, 1148, 1149, 1150, 1151, 1152, 1153, 1154, 1155, 1156, 1157, 1158, 1159, 1160, 1161, 1162, 1163, 1164, 1165, 1166, 1167, 1168, 1169, 1170, 1171, 1172, 1173, 1174, 1175, 1176, 1177, 1178]];
const TRACK_Y0 = 478;
const TRACK_Y1 = 843;
const X0 = 30;
const G = 9.81;
// Ideal inelastic contact: the rigid cart stops at the wall. The displayed
// reading is the measured mean impact force, retained until reset:
// F_mean = m Δv / Δt for the assumed 0.25 s measurement interval.
const IMPACT_SPEED = 3;
const IMPACT_DURATION = 0.25;
const IMPACT_GAP = 3;
const IMPACT_CART_X = 691;
const IMPACT_PIXELS_PER_METER = 70;
const ROAD_WIDTH = 1920;
// Keep the physics clock in seconds; this scale only controls how quickly the scene moves on screen.
const METERS_TO_PIXELS = 46;

const sliderSpecs = {
  1: [
    {key: 'time', min: 2, max: 20, step: 1, unit: 's'},
    {key: 'v0', min: 0, max: 12, step: 0.5, unit: 'm/s'},
    {key: 'force', min: 0, max: 30, step: 1, unit: 'N'}
  ],
  2: [
    {key: 'time', min: 2, max: 20, step: 1, unit: 's'},
    {key: 'mass', min: 2, max: 20, step: 1, unit: 'kg'},
    {key: 'f1', min: -20, max: 20, step: 1, unit: 'N'},
    {key: 'f2', min: -20, max: 20, step: 1, unit: 'N'}
  ],
  3: [
    {key: 'thirdValue', min: 1, max: 20, step: 1, unit: 'kg'}
  ]
};

const defaults = {
  1: {time: 10, v0: 3, force: 0},
  2: {time: 10, mass: 10, f1: 15, f2: -5},
  3: {time: IMPACT_GAP/IMPACT_SPEED+IMPACT_DURATION, thirdValue: 5}
};

function collisionMotion(t, mass) {
  const hit=IMPACT_GAP/IMPACT_SPEED;
  const measuredForce=mass*IMPACT_SPEED/IMPACT_DURATION;
  if(t<hit)return {x:IMPACT_GAP-IMPACT_SPEED*t,v:-IMPACT_SPEED,force:0,hit:false};
  return {x:0,v:0,force:measuredForce,hit:true};
}

runOnStartup(async runtime => {
  runtime.addEventListener('afteranylayoutstart', () => {
    if (runtime.layout.name === 'game') setup(runtime);
  });
});

function setup(runtime) {
  const state = {law: 0, mode: 'horizontal', params: {}, time: 0, running: false, paused: false,
    dragging: -1, sound: false, lastReadout: -1};
  const one = name => runtime.objects[name]?.getFirstInstance() || null;
  const visible = (name, value = true) => {const i = one(name); if (i) i.isVisible = value;};
  const show = (...names) => names.forEach(n => visible(n, true));
  const label = (name, value) => {const i=one(name); if(i) i.text=String(value);};
  const graphLines = GRAPH_SEGMENTS.map(row => row.map(uid => runtime.getInstanceByUid(uid)));
  const roadTiles = runtime.objects.newtonRoad.getAllInstances().sort((a,b)=>a.uid-b.uid);
  const pane = runtime.layout.getLayer('selection');
  const inputLayer = runtime.layout.getLayer('dashboard');

  function hideScene() {
    for (const cls of Object.values(runtime.objects)) {
      if (!cls.getAllInstances) continue;
      for (const inst of cls.getAllInstances()) {
        if ('isVisible' in inst && inst.layer && !['background','selection'].includes(inst.layer.name)) inst.isVisible=false;
      }
    }
  }
  function menu() {
    state.law=0;state.running=false;state.paused=false;state.dragging=-1;
    hideScene();pane.isVisible=true;pane.isInteractive=true;
  }
  function sliderDef(index) {
    if (state.law===3 && state.mode==='vertical' && index===0)
      return {key:'thirdValue',min:G,max:20*G,step:G,unit:'N'};
    return sliderSpecs[state.law][index];
  }
  function netForce() {
    return state.law===1 ? state.params.force : state.law===2 ? state.params.f1+state.params.f2 : 0;
  }
  function acceleration() {
    if(state.law===1) return state.params.force/7.5;
    if(state.law===2) return netForce()/state.params.mass;
    return 0;
  }
  function velocity(t) {
    const initial=state.law===1 ? state.params.v0 : 0;
    return initial+acceleration()*t;
  }
  function position(t) {
    const initial=state.law===1 ? state.params.v0 : 0;
    return X0+initial*t+0.5*acceleration()*t*t;
  }
  function updateSlider(index) {
    const def=sliderDef(index), value=state.params[def.key];
    const knob=one(`knob${state.law}_${index}`);
    if(knob) knob.y=TRACK_Y1-(value-def.min)/(def.max-def.min)*(TRACK_Y1-TRACK_Y0)-35;
    label(`sliderValue${state.law}_${index}`, `${Number.isInteger(value)?value:value.toFixed(1)} ${def.unit}`);
  }
  function updateAllSliders() {sliderSpecs[state.law].forEach((_,i)=>updateSlider(i));}
  function fitPanelButtons(law) {
    const panel=one(law===1?'panelOne':law===2?'panelTwo':'panelThreeH');
    const width=law===3?254:304;
    // The panel sprite includes a 20 px shadow at its left edge.
    const x=Math.round(panel.x+20+(panel.width-20-width)/2);
    for(const name of ['btnStart','btnReset','startText','resetText']) {
      const control=one(name);
      if(control){control.x=x;control.width=width;}
    }
  }
  function selectLaw(n) {
    hideScene();pane.isVisible=false;pane.isInteractive=false;
    state.law=n;state.mode='horizontal';state.params={...defaults[n]};state.time=0;state.running=false;state.paused=false;
    show('refreshBtn','audioBtn','shareBtn','fullScreenBtn','menuButton',
      'btnStart','btnReset','startText','resetText');
    fitPanelButtons(n);
    one('audioBtn').animationFrame=state.sound?1:0;
    if(n===1 || n===2) {
      show('newtonRoad','newtonShadow','newtonCart','wheelLeft','wheelRight',
        'graphSidebar','bottomRuler',`panel${n===1?'One':'Two'}`);
      roadTiles.forEach(tile=>tile.isVisible=true);
      for(let g=0;g<3;g++) {
        show(`graphPanel${g}`,`graphArea${g}`,`graphYMax${g}`,`graphYMid${g}`,`graphXMax${g}`);
        graphLines[g].forEach(s => {if(s) s.isVisible=false;});
      }
      const count=n===1?3:4;
      for(let i=0;i<count;i++) show(`track${n}_${i}`,`knob${n}_${i}`,`sliderValue${n}_${i}`);
      const heads=n===1?3:4;
      for(let i=0;i<heads;i++) show(`headValue${n}_${i}`);
      if(n===1) show('headPosition1','headSpeed1','headForce1');
      else show('headSpeed2','headPosition2','headAcceleration2','headNetForce2',
        'forceArrow1','forceArrow2');
    } else {
      one('headForce3').x=950;
      one('headForce3').animationFrame=0;
      one('headValue3_1').x=973;
      one('btnReset').y=278;
      one('resetText').y=289;
      show('newtonRoad','newtonShadow','newtonCart','newtonWall','wheelLeft','wheelRight',
        'headSpeed3','headForce3','headValue3_0','headValue3_1',
        'modeHorizontalOn','modeVerticalOff','panelThreeH');
      roadTiles.forEach(tile=>tile.isVisible=true);
      show('track3_0','knob3_0','sliderValue3_0');
    }
    updateAllSliders();updateScene();updateGraphs();
  }
  function setMode(mode) {
    if(state.law!==3 || mode===state.mode) return;
    state.mode=mode;state.time=0;state.running=false;state.paused=false;
    ['newtonShadow','newtonCart','newtonWall','wheelLeft','wheelRight','newtonTable','verticalBox',
      'modeHorizontalOn','modeHorizontalOff','modeVerticalOn','modeVerticalOff','panelThreeH','panelThreeV']
      .forEach(n=>visible(n,false));
    if(mode==='horizontal') {
      state.params.thirdValue=defaults[3].thirdValue;
      show('newtonShadow','newtonCart','newtonWall','wheelLeft','wheelRight',
        'modeHorizontalOn','modeVerticalOff','panelThreeH');
    } else {
      state.params.thirdValue=5*G;
      show('newtonTable','verticalBox','modeHorizontalOff','modeVerticalOn','panelThreeV');
    }
    visible('wallReaction',false);
    visible('tableReaction',mode==='vertical');
    visible('headSpeed3',mode==='horizontal');
    visible('headValue3_0',mode==='horizontal');
    visible('btnStart',mode==='horizontal');
    visible('startText',mode==='horizontal');
    const resetButton=one('btnReset'),resetLabel=one('resetText');
    if(resetButton)resetButton.y=mode==='vertical'?235:278;
    if(resetLabel)resetLabel.y=mode==='vertical'?246:289;
    const forceHead=one('headForce3'),forceValue=one('headValue3_1');
    if(forceHead){forceHead.x=mode==='vertical'?850:950;forceHead.animationFrame=mode==='vertical'?1:0;}
    if(forceValue)forceValue.x=mode==='vertical'?873:973;
    updateAllSliders();updateScene();
  }
  function reset() {
    state.time=0;state.running=false;state.paused=false;
    state.params={...defaults[state.law]};
    if(state.law===3 && state.mode==='vertical')state.params.thirdValue=5*G;
    updateAllSliders();updateScene();updateGraphs();
  }
  function updateScene() {
    if(!state.law)return;
    const p=state.params,t=state.time,a=acceleration(),f=netForce();
    const impact=state.law===3 && state.mode==='horizontal'?collisionMotion(t,p.thirdValue):null;
    const v=impact?impact.v:velocity(t),x=impact?impact.x:position(t);
    label('startText',state.running?'Ⅱ  Durdur':state.paused?'▷  Devam Et':'▷  Başlat');
    one('btnStart').animationFrame=state.running?1:0;
    if(state.law===1) {
      label('headValue1_0',`${x.toFixed(1)} m`);
      label('headValue1_1',`${v.toFixed(1)} m/s`);
      label('headValue1_2',`${f.toFixed(1)} N`);
    } else if(state.law===2) {
      label('headValue2_0',`${v.toFixed(1)} m/s`);
      label('headValue2_1',`${x.toFixed(1)} m`);
      label('headValue2_2',`${a.toFixed(1)} m/s²`);
      label('headValue2_3',`${f.toFixed(1)} N`);
      const cargo=Math.max(1,Math.min(4,Math.ceil(p.mass/5)));
      for(let i=1;i<=4;i++)visible(`cargo${i}`,i===cargo);
      const arrow=(force,name)=>{
        const magnitude=Math.abs(force);
        label(name,force>0?`→ F${name==='forceArrow1'?'₁':'₂'} +${magnitude} N`:
          force<0?`← F${name==='forceArrow1'?'₁':'₂'} −${magnitude} N`:
          `F${name==='forceArrow1'?'₁':'₂'} = 0 N`);
      };
      arrow(p.f1,'forceArrow1');arrow(p.f2,'forceArrow2');
    } else if(state.mode==='horizontal') {
      label('headValue3_0',`${Math.abs(v).toFixed(1)} m/s`);
      label('headValue3_1',`${impact.force.toFixed(1)} N`);
      visible('wallReaction',impact.hit);
      label('wallReaction',`→ Duvar: ${impact.force.toFixed(1)} N`);
    } else {
      const weight=p.thirdValue;
      label('headValue3_0','0.0 m/s');
      label('headValue3_1',`${weight.toFixed(1)} N`);
      label('tableReaction',`↑ N = ${weight.toFixed(1)} N`);
      const box=one('verticalBox');if(box)box.animationFrame=Math.round((weight/G-1)/19*60);
    }
    const travel=impact?(x-IMPACT_GAP)*IMPACT_PIXELS_PER_METER:
      state.law===3?0:(x-X0)*METERS_TO_PIXELS;
    // Move the cart across the scene first, then follow it with the camera.
    const dx=impact?x*IMPACT_PIXELS_PER_METER:Math.max(-160,Math.min(300,travel));
    const roadTravel=impact?x*IMPACT_PIXELS_PER_METER-dx:travel;
    const cameraTravel=impact?roadTravel:travel-dx;
    const roadOffset=((cameraTravel%ROAD_WIDTH)+ROAD_WIDTH)%ROAD_WIDTH;
    roadTiles.forEach((tile,i)=>{tile.x=i*ROAD_WIDTH-roadOffset;});
    if(impact)one('newtonWall').x=558-cameraTravel;
    if(state.law!==3 || state.mode==='horizontal') {
      const cart=one('newtonCart'),wl=one('wheelLeft'),wr=one('wheelRight'),shadow=one('newtonShadow');
      const cartShift=impact?IMPACT_CART_X-678+dx:dx;
      if(cart)cart.x=678+cartShift;
      if(wl){wl.x=785+cartShift;wl.angle=travel/80;}
      if(wr){wr.x=1111+cartShift;wr.angle=travel/80;}
      if(shadow)shadow.x=594+cartShift;
      if(state.law===2)for(let i=1;i<=4;i++){const c=one(`cargo${i}`);if(c)c.x=700+dx;}
      if(state.law===2) {
        const arrow1=one('forceArrow1'),arrow2=one('forceArrow2');
        if(arrow1)arrow1.x=680+dx;
        if(arrow2)arrow2.x=940+dx;
      }
    }
  }
  function updateGraphs() {
    if(state.law!==1 && state.law!==2)return;
    const T=state.params.time,a=acceleration();
    const graphFns=[()=>a,t=>velocity(t),t=>position(t)];
    const colors=[[0.04,0.65,0.44,1],[0.00,0.62,0.98,1],[0.28,0.24,0.94,1]];
    const progress=Math.max(0,Math.min(50,state.time/T*50));
    for(let g=0;g<3;g++) {
      const values=Array.from({length:51},(_,i)=>graphFns[g](T*i/50));
      let min=Math.min(0,...values),max=Math.max(0,...values);
      if(max-min<0.01){max=min+1;}
      const title=g===0?`a = ${a.toFixed(2)} m/s²`:g===1?`Alan = ${(position(state.time)-X0).toFixed(1)} m (yer değiştirme)`:`x(0) = ${X0} m`;
      label(`graphArea${g}`,title);
      label(`graphYMax${g}`,max.toFixed(1));
      label(`graphYMid${g}`,((max+min)/2).toFixed(1));
      label(`graphXMax${g}`,T);
      for(let i=0;i<50;i++) {
        const s=graphLines[g][i];if(!s)continue;
        const fraction=Math.max(0,Math.min(1,progress-i));
        s.isVisible=fraction>0;
        if(fraction===0)continue;
        const x1=112+i*178/50,x2=112+(i+fraction)*178/50;
        const y1=8+g*369+288-(values[i]-min)/(max-min)*200;
        const currentValue=values[i]+(values[i+1]-values[i])*fraction;
        const y2=8+g*369+288-(currentValue-min)/(max-min)*200;
        const dx=x2-x1,dy=y2-y1;
        s.x=x1;s.y=y1;s.width=Math.hypot(dx,dy)+1;s.height=3;s.angle=Math.atan2(dy,dx);
        s.colorRgb=colors[g].slice(0,3);
      }
    }
  }
  function updateFromPointer(index,y) {
    const def=sliderDef(index);
    const ratio=Math.max(0,Math.min(1,(TRACK_Y1-y)/(TRACK_Y1-TRACK_Y0)));
    const raw=def.min+ratio*(def.max-def.min);
    const value=Math.round(raw/def.step)*def.step;
    if(state.params[def.key]!==value) {
      state.params[def.key]=value;state.time=0;state.running=false;state.paused=false;
      updateAllSliders();updateScene();updateGraphs();
    }
  }
  function beep() {
    if(!state.sound || !globalThis.AudioContext)return;
    try {
      const ctx=new AudioContext();const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.frequency.value=620;gain.gain.setValueAtTime(.07,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.08);
      osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.08);
      osc.onended=()=>ctx.close();
    }catch(_){}
  }
  function click(e) {
    if(runtime.layout.name!=='game')return;
    const [x,y]=inputLayer.cssPxToLayer(e.clientX,e.clientY);
    if(state.law===0) {
      if(y>=310 && y<=750) {
        const card=x>=182&&x<=668?1:x>=717&&x<=1203?2:x>=1252&&x<=1738?3:0;
        if(card){selectLaw(card);beep();}
      }
      return;
    }
    if(y>=20&&y<=120) {
      if(x>=1371&&x<=1470){reset();beep();return;}
      if(x>=1480&&x<=1579){state.sound=!state.sound;one('audioBtn').animationFrame=state.sound?1:0;beep();return;}
      if(x>=1587&&x<=1686){menu();beep();return;}
      if(x>=1695&&x<=1794){
        if(globalThis.navigator?.share)void navigator.share({title:"Newton'un Yasaları",text:'Newton yasaları etkileşimli simülasyonu',url:location.href}).catch(()=>{});
        else console.info('Bu tarayıcıda paylaşım desteklenmiyor.');
        return;
      }
      if(x>=1803&&x<=1902){
        if(document.fullscreenElement)void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(err=>{
          console.warn('Fullscreen request rejected:',err);
        });
        return;
      }
    }
    const panelButton=one('btnStart'),resetButton=one('btnReset');
    const insideButton=x>=panelButton.x&&x<=panelButton.x+panelButton.width;
    if(panelButton.isVisible&&insideButton&&y>=panelButton.y&&y<=panelButton.y+panelButton.height){
      if(state.running){state.running=false;state.paused=true;}
      else {
        if(state.time>=state.params.time){state.time=0;state.paused=false;}
        state.running=true;state.paused=false;
      }
      updateScene();beep();return;
    }
    if(x>=resetButton.x&&x<=resetButton.x+resetButton.width&&
      y>=resetButton.y&&y<=resetButton.y+resetButton.height){reset();beep();return;}
    if(state.law===3 && x>=33&&x<=143){
      if(y>=420&&y<=530){setMode('horizontal');beep();return;}
      if(y>=550&&y<=660){setMode('vertical');beep();return;}
    }
    const xs=[[1607,1732,1856],[1582,1673,1764,1855],[1764]][state.law-1];
    if(y>=443&&y<=879){
      const index=xs.findIndex(cx=>Math.abs(x-cx)<=40);
      if(index!==-1){state.dragging=index;updateFromPointer(index,y);beep();}
    }
  }
  runtime.addEventListener('pointerdown',click);
  runtime.addEventListener('pointermove',e=>{
    if(state.dragging<0||!state.law||runtime.layout.name!=='game')return;
    const [,y]=inputLayer.cssPxToLayer(e.clientX,e.clientY);
    updateFromPointer(state.dragging,y);
  });
  runtime.addEventListener('pointerup',()=>{state.dragging=-1;});
  runtime.addEventListener('pointercancel',()=>{state.dragging=-1;});
  runtime.addEventListener('tick',()=>{
    if(!state.running||!state.law)return;
    state.time=Math.min(state.params.time,state.time+runtime.dt);
    if(state.time>=state.params.time){state.running=false;state.paused=false;}
    updateScene();
    updateGraphs();
  });
  menu();
}
