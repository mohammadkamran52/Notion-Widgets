const q = new URLSearchParams(location.search);
const W = (q.get('w')||'clock').toLowerCase();
const R = document.documentElement.style;
const app = document.getElementById('app'),$=id=>document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const C = 565.49;
const H = new Date().getHours();

/* accent follows the time of day: dawn, day, evening, night */

const pal=H>=5&&H<9?['#ffb36b','#ff7a59']:H>=9&&H<16?['#7cc4ff','#5b8cff']:H>=16&&H<20?['#ff8fa3','#ffb36b']:['#a78bfa','#5b6cff'];

R.setProperty('--ac',pal[0]);
R.setProperty('--ac2',pal[1]);

if(q.get('a')){
    R.setProperty('--ac','#'+q.get('a'));
}
if(q.get('bg')){
    R.setProperty('--bg','#'+q.get('bg'));
}

const greet=h=>h<5?'Burning the midnight oil':h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Late-night session';
let ax;
const beep=(n=3)=>{
    if(!ax){
        return;
    }
    for(let i=0;i<n;i++){
        const o=ax.createOscillator();
        const g=ax.createGain();
        const t=ax.currentTime+i*.28;
        
        o.frequency.value=i==n-1?1175:880;
        o.connect(g);
        g.connect(ax.destination);
        g.gain.setValueAtTime(.18,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.22);
        o.start(t);
        o.stop(t+.25)
    }
};
const unlock=()=>{
    try{
        ax=ax||new(window.AudioContext||window.webkitAudioContext)();
        ax.resume()
    }catch(e){}
};

const fmt=ms=>{
    const t=Math.ceil(Math.max(0,ms)/1000);
    const h=Math.floor(t/3600);
    const m=Math.floor(t%3600/60);
    const s=t%60;
    return(h?h+':'+pad(m):pad(m))+':'+pad(s)
};

/* countdown engine: uses timestamps, so it stays accurate even if the tab is throttled */

const Cd=t=>{
    let end=0;
    let left=t*1e3;
    let run=false;
    return{
        get run(){return run},
        get total(){return t},
        get left(){return run?Math.max(0,end-Date.now()):left},
        start(){
            end=Date.now()+left;run=true
        },
        pause(){
            left=Math.max(0,end-Date.now());
            run=false
        },
        set(n){
            t=n;
            left=n*1e3;
            run=false
        }
    }
};

const ring=(lab,btns)=>{
    app.innerHTML=`<div class="card">
        <div class="ringw">
            <svg viewBox="0 0 200 200">
                <circle class="trk" cx="100" cy="100" r="90"/>
                <circle class="arc" id="arc" cx="100" cy="100" r="90"/>
            </svg>
            <div class="time" id="time"></div>
        </div>
        <div class="side">
            <div class="lab" id="lab">
                ${lab}
            </div>
            <div class="dots" id="dots"></div>
            <div class="row">
                ${btns}
            </div>
        </div>
    </div>`;

    return document.querySelector('.card')
};
const draw=c=>{
    const l=c.left;
    $('time').textContent=fmt(l);
    $('time').classList.toggle('long',l>=3.6e6);
    $('arc').style.strokeDashoffset=C*(1-l/(c.total*1e3))
};


function timer(){
    const s=+q.get('s')||(+q.get('m')*60)||60;
    const card=ring(q.get('label')||'Timer','<button class="pri" id="go">Start</button><button id="rs">Reset</button>');
    const c=Cd(s);
    const go=$('go');

    go.onclick=()=>{
        unlock();
        if(card.classList.contains('fin')){
            card.classList.remove('fin');
            c.set(s)
        }
        if(c.run){
            c.pause();
            go.textContent='Resume'
        }else{
            c.start();
            go.textContent='Pause'
        }
        draw(c)
    };
    $('rs').onclick=()=>{
        c.set(s);
        card.classList.remove('fin');
        go.textContent='Start';
        draw(c)
    };
    setInterval(()=>{
        if(c.run&&c.left<=0){
            c.pause();
            beep();
            card.classList.add('fin');
            go.textContent='Again'
        }
        draw(c)
    },200);
    draw(c);
}


function pomo(){
    const F=+q.get('focus')||25;
    const B=+q.get('brk')||5;
    const L=+q.get('long')||15;
    let ph='focus';
    let n=0;
    const dur=()=>(ph=='focus'?F:ph=='brk'?B:L)*60;
    const names={focus:'Focus',brk:'Short break',long:'Long break'};
    const card=ring('Focus','<button class="pri" id="go">Start</button><button id="sk">Skip</button><button id="rs">Reset</button>');
    const c=Cd(dur());
    const go=$('go');
    const apply=()=>{
        c.set(dur());
        $('lab').textContent=names[ph];
        card.classList.toggle('brk',ph!='focus');
        const k=ph=='long'?4:n%4;
        $('dots').innerHTML=[0,1,2,3].map(i=>`<i class="${i<k?'on':''}"></i>`).join('');
        go.textContent='Start';
        draw(c)
    };
    const next=()=>{
        if(ph=='focus'){
            n++;
            ph=n%4?'brk':'long'
        }else ph='focus';
        apply()
    };
    go.onclick=()=>{
        unlock();
        if(c.run){
            c.pause();
            go.textContent='Resume'
        }else{
            c.start();
            go.textContent='Pause'
        }
    };
    $('sk').onclick=next;
    $('rs').onclick=()=>{
        ph='focus';
        n=0;
        apply()
    };
    setInterval(()=>{
        if(c.run&&c.left<=0){
            c.pause();
            beep();
            next();
            if(q.get('auto')){
                c.start();
                go.textContent='Pause'
            }
        }
        draw(c)
    },200);
    apply();
}


function stopwatch(){
    const card=ring(q.get('label')||'Stopwatch','<button class="pri" id="go">Start</button><button id="lp">Lap</button><button id="rs">Reset</button>');
    const go=$('go');
    let acc=0;
    let st=0;
    let run=false;
    let laps=[];
    let last=0;
    const el=()=>acc+(run?Date.now()-st:0);
    let f=ms=>{
        const t=Math.floor(ms/10);
        return pad(Math.floor(t/6000))+':'+pad(Math.floor(t/100)%60)+'.'+pad(t%100)
    };
    $('time').classList.add('long');
    $('dots').className='dots laps';
    go.onclick=()=>{
        unlock();
        if(run){
            acc+=Date.now()-st;
            run=false;
            go.textContent='Resume'
        }else{
            st=Date.now();
            run=true;
            go.textContent='Stop'
        }
    };
    $('lp').onclick=()=>{
        if(!run)return;
        const e=el();
        laps.push(e-last);
        last=e;
        $('dots').innerHTML=laps.slice(-3).map((t,i,a)=>`<span>Lap ${laps.length-a.length+i+1}  ${f(t)}</span>`).join('')
    };
    $('rs').onclick=()=>{
        acc=0;run=false;
        laps=[];
        last=0;
        $('dots').innerHTML='';
        go.textContent='Start'
    };
    setInterval(()=>{
        const e=el();
        $('time').textContent=f(e);
        $('arc').style.strokeDashoffset=C*(1-(e%6e4)/6e4)
    },50);
}


function clock(){
    app.innerHTML=`<div class="clk">
        <div class="lab" id="gr"></div>
        <div class="big">
            <span id="hm"></span>
            <small id="sc"></small>
        </div>
        <div class="lab" id="dt"></div>
        <div class="bar">
            <i id="dp"></i>
        </div>
        <div class="lab" id="pc"></div>
    </div>`;
    const tick=()=>{
        const d=new Date();
        const h=d.getHours();
        const p=(h*3600+d.getMinutes()*60+d.getSeconds())/864;
        $('hm').textContent=pad(h)+':'+pad(d.getMinutes());
        $('sc').textContent=pad(d.getSeconds());
        $('gr').textContent=greet(h);
        $('dt').textContent=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
        $('dp').style.width=p+'%';
        $('pc').textContent=Math.floor(p)+'% of today has passed'
    };
    tick();
    setInterval(tick,1000);
}


function banner(){
    app.innerHTML='<div class="ban"><i></i><i></i><i></i><div class="bt"><h1 id="bh"></h1><p id="bp"></p></div></div>';
    const t=()=>{
        const d=new Date();
        $('bh').textContent=q.get('text')||greet(d.getHours());
        $('bp').textContent=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})+', '+pad(d.getHours())+':'+pad(d.getMinutes())
    };
    t();setInterval(t,15000);
}

({
    clock,timer,pomo,pomodoro:pomo,stopwatch,sw:stopwatch,banner
}[W]||clock)();


addEventListener('keydown', e => {
    if (e.code === 'Space') {
        const b = $('go');
        if (b) {
            e.preventDefault();
            b.click();
        }
    }
});