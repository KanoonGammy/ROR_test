/* ============================================================
   Realm of Rolls — Balance Simulator (Phase 1, v3)
   รัน: node sim_play.js [จำนวนรอบ]
   *** แก้ค่าตรงนี้ ต้อง sync กับ BAL/GEAR ใน phase1_loop.html ด้วยเสมอ ***
   v3: เลเวลอัพ +3HP/lv, atk/def +1 สลับทุก 2 เลเวล · ของบวกเตี้ยลง (def โดยเฉพาะ) · Elite/Boss โหดขึ้น · Speed(reroll/initiative)
   ============================================================ */
const sB=r=>r>=5?30:r===4?20:r>=3?10:0;
function poker(nums){const c={};nums.forEach(n=>c[n]=(c[n]||0)+1);const cn=Object.values(c);const pr=cn.filter(x=>x>=2).length;const d=[...new Set(nums)].sort((a,b)=>a-b);let run=1,mr=1;for(let i=1;i<d.length;i++){run=d[i]===d[i-1]+1?run+1:1;mr=Math.max(mr,run);}const has=k=>cn.includes(k);let b=0;if(has(5))b=60;else if(has(4))b=40;else if(has(3)&&has(2))b=30;else{if(has(3))b=15;if(pr>=2)b=Math.max(b,10);else if(pr>=1)b=Math.max(b,5);}if(mr>=3)b=Math.max(b,sB(mr));return b;}
function colorB(cols){const c={};cols.forEach(x=>c[x]=(c[x]||0)+1);const m=Math.max(...Object.values(c));return({2:5,3:15,4:30,5:50})[m]||0;}
function score(d){return d.reduce((a,x)=>a+x.n,0)+poker(d.map(x=>x.n))+colorB(d.map(x=>x.c));}
const r5=x=>Math.round(x/5)*5;const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;const SKT=[0,4,9,18];
function skillTier(d){const n=d.length;if(!n)return 0;const s=d.reduce((a,x)=>a+x.n,0);return Math.min(3,Math.ceil(s/(2*n)));}
const genHP=L=>16+L*4, eliteHP=L=>Math.round((16+L*4)*1.45), bossHP=L=>Math.round((16+L*4)*2.0);
const genInt=L=>Math.round(3+L*0.8), eliteInt=L=>Math.round((3+L*0.8)*1.3), bossInt=L=>Math.round((3+L*0.8)*1.55);
const refDmg=[0,10,13,17,23,30],xpNeed=lv=>4+lv*3,tierSpd={G:4,E:7,B:6};
const ZONES=[{lv:[1,4],bl:6},{lv:[4,8],bl:10},{lv:[8,14],bl:16},{lv:[14,22],bl:24}];
function rollDice(n){const d=[];for(let i=0;i<n;i++)d.push({n:rnd(1,6),c:rnd(0,5)});return d;}
function bestOut(dice,atk){return Math.max(score(dice)+atk,SKT[skillTier(dice)]);}
function fight(P,L,kind){
  const dr=refDmg[Math.min(5,P.dice)];const HP=kind==="B"?bossHP(L):kind==="E"?eliteHP(L):genHP(L);
  let hp=r5(HP);const grace=Math.ceil(hp/dr)+4;const mspd=tierSpd[kind]+Math.floor(L/5);let wt=0;
  while(true){wt++;const en=Math.max(0,(wt-grace))*3;const intent=(kind==="B"?bossInt(L):kind==="E"?eliteInt(L):genInt(L))+en;
    let dice=rollDice(P.dice);const rr=Math.max(5,Math.min(60,10+(P.spd-mspd)*5));
    if(Math.random()*100<rr){const d2=rollDice(P.dice);if(bestOut(d2,P.atk)>bestOut(dice,P.atk))dice=d2;}
    if(P.potions>0&&P.hp<P.maxhp*0.4){P.hp=Math.min(P.maxhp,P.hp+25);P.potions--;}
    const off=bestOut(dice,P.atk);let sp=null;
    if(P.dice>=2){const h=Math.ceil(P.dice/2),A=dice.slice(0,h),D=dice.slice(h);sp={dmg:bestOut(A,P.atk),bl:score(D)};}
    const slower=mspd>P.spd;let dealt=0,inc=0,killed=false;
    if(off>=hp){killed=true;dealt=off;}else{const pf=Math.max(0,intent-P.def);if(pf>=P.hp&&sp){dealt=sp.dmg;inc=Math.max(0,intent-sp.bl-P.def);}else if(pf>=P.hp){inc=Math.max(0,intent-score(dice)-P.def);}else{dealt=off;inc=pf;}}
    hp-=dealt;if(killed&&!slower)return true;P.hp-=inc;if(P.hp<=0)return false;if(killed)return true;if(wt>300)return false;}
}
const GP=[["w:atk4","s:def2","h:def1,hp3","l:def1,spd2"],["b:hp18,def1","s:def2","h:def1,hp3","l:def1,spd2"],["w:atk6","s:def4","h:def2,hp6","l:def2,spd3,hp4"],["w:atk9","s:def6","b:hp30,def2","h:def2,hp6"]];
const BD=[["b:hp18,def1","w:atk6"],["w:atk6","s:def4"],["b:hp30,def2","w:atk9"],["w:atk12","s:def6"]];
function parse(s){const[sl,st]=s.split(":");const o={slot:sl,atk:0,def:0,hp:0,spd:0};st.split(",").forEach(p=>{const m=p.match(/([a-z]+)(\d+)/);o[m[1]]=+m[2];});return o;}
function run(){
  const P={dice:1,lvl:1,xp:0,atk:0,def:0,spd:0,maxhp:0,hp:0,potions:0,gold:0};
  const slots={w:{atk:2},s:{def:1},h:{def:1},b:{hp:10},l:{def:1,spd:1}};
  function rec(){let a=0,d=0,h=0,sp=0;for(const k in slots){a+=slots[k].atk||0;d+=slots[k].def||0;h+=slots[k].hp||0;sp+=slots[k].spd||0;}
    P.atk=a+Math.ceil((P.lvl-1)/2);P.def=d+Math.floor((P.lvl-1)/2);P.spd=5+sp;P.maxhp=30+h+(P.lvl-1)*3;}
  rec();P.hp=P.maxhp;let deaths=0,walks=0;
  for(let zi=0;zi<4;zi++){const Z=ZONES[zi];let boss=5;
    while(true){walks++;if(walks>1500)return{done:false,deaths};
      let kind,L;if(Math.random()*100<boss){kind="B";L=Z.bl;}else if(Math.random()<0.12){kind="E";L=Z.lv[1]+1;}else{kind="G";L=rnd(Z.lv[0],Z.lv[1]);boss=Math.min(60,boss+5);}
      if(!fight(P,L,kind)){deaths++;P.hp=Math.max(1,Math.round(P.maxhp*.3));continue;}
      P.xp+=L;while(P.xp>=xpNeed(P.lvl)){P.xp-=xpNeed(P.lvl);P.lvl++;rec();P.hp=Math.min(P.maxhp,P.hp+12);}
      P.gold+=rnd(4,9)*L;const pool=kind==="B"?BD[zi]:GP[zi];const dr=kind==="B"?1:(kind==="E"?0.9:0.6);
      if(Math.random()<dr){const g=parse(pool[rnd(0,pool.length-1)]);const cur=slots[g.slot]||{};const ns=g.atk+g.def+g.hp+g.spd;const cs=(cur.atk||0)+(cur.def||0)+(cur.hp||0)+(cur.spd||0);if(ns>cs){slots[g.slot]={atk:g.atk,def:g.def,hp:g.hp,spd:g.spd};rec();}}
      if(P.gold>=15&&P.potions<3){P.gold-=15;P.potions++;}
      rec();P.hp=Math.min(P.maxhp,P.hp+Math.round(P.maxhp*0.15));
      if(kind==="B"){if(P.dice<5)P.dice++;break;}
    }
  }
  return{done:true,deaths,lvl:P.lvl};
}
const N=+process.argv[2]||3000;let done=0,Ds=0,Ls=0,dl=0;
for(let i=0;i<N;i++){const r=run();if(r.done){done++;Ds+=r.deaths;Ls+=r.lvl;if(r.deaths===0)dl++;}}
console.log(`จบเกม ${(done/N*100).toFixed(1)}% · ตายเฉลี่ย ${(Ds/Math.max(1,done)).toFixed(2)} · ไม่ตายเลย ${(dl/Math.max(1,done)*100).toFixed(0)}% · เลเวลจบ ~${(Ls/Math.max(1,done)).toFixed(0)}`);
