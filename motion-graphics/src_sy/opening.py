# Sonyu opening: mist swirls -> through the grass -> bamboo forest -> slashed and shattered
import numpy as np, cv2, math, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import FW,FH,clamp,eio,eout,_yy,_xx
from fx import R2,ob,mix
SH=4; SC=16
TEAL=(0.20,0.78,0.72); TEAL_L=(0.62,0.98,0.90); TEAL_D=(0.03,0.22,0.24); TEAL_DD=(0.01,0.09,0.11)
RED=(0.92,0.10,0.16); RED_L=(1.0,0.45,0.42); RED_D=(0.38,0.02,0.06)
INK=(0.015,0.04,0.05)
def c8(c): return tuple(int(max(0,min(1,v))*255) for v in c)
class Cv:
    def __init__(s,w=FW,h=FH): s.rgb=np.zeros((h,w,3),np.uint8); s.a=np.zeros((h,w),np.uint8)
    def poly(s,pts,col,a=255):
        p=(np.asarray(pts)*SC).astype(np.int32)
        cv2.fillPoly(s.rgb,[p],c8(col),cv2.LINE_AA,SH); cv2.fillPoly(s.a,[p],a,cv2.LINE_AA,SH)
    def lines(s,pts,col,th,closed=False):
        p=(np.asarray(pts)*SC).astype(np.int32); th=max(1,int(th))
        cv2.polylines(s.rgb,[p],closed,c8(col),th,cv2.LINE_AA,SH); cv2.polylines(s.a,[p],closed,255,th,cv2.LINE_AA,SH)
    def circle(s,c,r,col,th=-1):
        cc=(int(c[0]*SC),int(c[1]*SC)); rr=max(1,int(r*SC)); th=th if th<0 else max(1,int(th))
        cv2.circle(s.rgb,cc,rr,c8(col),th,cv2.LINE_AA,SH); cv2.circle(s.a,cc,rr,255,th,cv2.LINE_AA,SH)
    def f(s): return s.rgb.astype(np.float32)/255, s.a.astype(np.float32)/255
def over(img,rgb,a,op=1.0):
    img[...]=rgb*op+img*(1-a[...,None]*op); return img

# ---------------- stylised wind ribbons (curled tips, light outline, inner highlight) ----------------
rng=np.random.default_rng(71)
RIB_TONES=[((0.04,0.30,0.30),(0.40,0.95,0.88),(0.10,0.45,0.42)),
           ((0.10,0.50,0.46),(0.55,1.0,0.92),(0.30,0.72,0.64)),
           ((0.30,0.72,0.64),(0.70,1.0,0.94),(0.60,0.92,0.80)),
           ((0.55,0.88,0.78),(0.80,1.0,0.96),(0.86,0.99,0.86)),
           ((0.03,0.24,0.24),(0.30,0.90,0.86),(0.06,0.36,0.34))]
def curl_spine(base,curl_len,turns,sgn,n=26):
    """append a tightening curl to the end of a spine"""
    p=base[-1].copy(); d=base[-1]-base[-2]; h=math.atan2(d[1],d[0])
    ds=curl_len/n; out=[]
    for i in range(n):
        f=i/(n-1); h+=sgn*(turns*2*math.pi/n)*(0.4+1.6*f); ds_=ds*(1-0.6*f)
        p=p+np.array([math.cos(h),math.sin(h)])*ds_; out.append(p.copy())
    return np.vstack([base,np.array(out)])
def ribbon(cv,spine,wmax,tone,outline=4,taper_start=0.18,side=1.0):
    n=len(spine); u=np.linspace(0,1,n)
    w=wmax*np.clip(u/taper_start,0,1)**0.7*(1-u)**1.1
    tg=np.gradient(spine,axis=0); tg/=np.linalg.norm(tg,axis=1,keepdims=True)+1e-9; nr=np.stack([-tg[:,1],tg[:,0]],1)*side
    A=spine+nr*w[:,None]; B=spine-nr*(w*0.55)[:,None]
    poly=np.vstack([A,B[::-1]])
    dark,edge,hi=tone
    cv.lines(poly,edge,outline,True)
    cv.poly(poly,dark)
    # inner highlight band hugging the outer edge
    H1=spine+nr*(w*0.92)[:,None]; H2=spine+nr*(w*0.45)[:,None]
    m=(u>0.12)&(u<0.80)
    if m.sum()>3: cv.poly(np.vstack([H1[m],H2[m][::-1]]),hi)
    # thin flow line
    L=spine+nr*(w*0.15)[:,None]; m2=(u>0.2)&(u<0.7)
    if m2.sum()>3: cv.lines(L[m2],edge,max(1,outline*0.5))
MIST=[dict(r0=rng.uniform(260,820),r1=rng.uniform(180,950),th0=rng.uniform(0,6.28),span=rng.uniform(1.4,2.6),
           w=rng.uniform(40,120),sp=rng.uniform(0.25,0.55)*(1 if i%3 else -1),tone=RIB_TONES[i%5],
           curl=rng.uniform(140,300),turns=rng.uniform(0.9,1.5),wob=rng.uniform(20,80),ph=rng.uniform(0,6.3)) for i in range(18)]
def mist_band(cv,cx,cy,m,t,grow,zoom=1.0,spread=0.0):
    p=clamp(grow)
    if p<=0.02: return
    n=40; u=np.linspace(0,1,n); th=m['th0']+m['sp']*t+u*m['span']*p
    r=(m['r0']+(m['r1']-m['r0'])*u+m['wob']*np.sin(u*5+t*0.8+m['ph']))*zoom*(1+spread)
    sp=np.stack([cx+np.cos(th)*r,cy+np.sin(th)*r*0.66],1)
    sgn=1 if m['sp']>0 else -1
    sp=curl_spine(sp,m['curl']*zoom*p,m['turns'],sgn)
    ribbon(cv,sp,m['w']*zoom*(0.5+0.5*p),m['tone'],outline=max(2,4*zoom**0.5),side=sgn)
DOTS=[dict(x=rng.uniform(40,FW-40),y=rng.uniform(80,FH-80),r=rng.uniform(4,9),ph=rng.uniform(0,6.3),v=rng.uniform(10,30)) for _ in range(26)]
def dots(cv,t,k=1.0):
    for d in DOTS:
        y=(d['y']-d['v']*t)%FH; x=d['x']+12*math.sin(t+d['ph'])
        cv.circle((x,y),d['r']+1.5,(0.55,1.0,0.92)); cv.circle((x,y),d['r'],(0.06,0.30,0.30))
def mist_layer(t,cx,cy,grow,zoom,spread,k,idx):
    cv=Cv()
    for m in [MIST[i] for i in idx]: mist_band(cv,cx,cy*1.0,m,t,grow,zoom,spread)
    r,a=cv.f(); return r,a*k

# ---------------- grass (foreground blades the camera pushes through) ----------------
GRASS=[]
for layer in range(4):
    for i in range(16):
        GRASS.append(dict(L=layer,x=rng.uniform(-200,FW+200),h=rng.uniform(500,1300)*(0.7+0.15*layer),w=rng.uniform(26,70)*(1+0.2*layer),
                          lean=rng.uniform(-0.35,0.35),col=[TEAL_DD,TEAL_D,(0.05,0.30,0.28),(0.10,0.45,0.40)][layer],ph=rng.uniform(0,6.3)))
def blade(cv,base,h,w,lean,sway,col,hi):
    u=np.linspace(0,1,18)
    spine=np.stack([base[0]+(lean+sway)*h*u**1.8,base[1]-h*u],1)
    ww=w*(1-u)**0.9
    tg=np.gradient(spine,axis=0); tg/=np.linalg.norm(tg,axis=1,keepdims=True)+1e-9; nr=np.stack([-tg[:,1],tg[:,0]],1)
    P=np.vstack([spine+nr*ww[:,None],(spine-nr*ww[:,None])[::-1]])
    cv.lines(P,mix(hi,(0.6,1,0.92),0.5),max(2,w*0.06),True); cv.poly(P,col)
    cv.lines(spine[:-2]+nr[:-2]*(ww[:-2,None]*0.35),hi,max(1,w*0.08))
def grass_layer(t,push):
    """push 0..1: camera moves through, layers part outward & scale up"""
    cv=Cv()
    for g in sorted(GRASS,key=lambda g:g['L']):
        L=g['L']; z=1+push*(1.2+L*1.6)
        x=FW/2+(g['x']-FW/2)*z; y=FH+80+push*L*120
        sway=0.12*math.sin(t*1.6+g['ph'])-0.18*push*np.sign(g['x']-FW/2)
        blade(cv,(x,y),g['h']*z**0.8,g['w']*z,g['lean']+(g['x']-FW/2)/FW*0.4*push,sway,g['col'],mix(g['col'],TEAL_L,0.35))
    return cv.f()

# ---------------- bamboo ----------------
def bamboo_stalk(cv,x,w,top,bot,col,node_col,hi,lean=0.0):
    seg=w*5.5; y=bot
    def X(yv): return x+lean*(bot-yv)
    while y>top:
        y2=max(top,y-seg)
        cv.poly([(X(y)-w/2,y),(X(y2)-w/2,y2),(X(y2)+w/2,y2),(X(y)+w/2,y)],col)
        cv.lines([(X(y)-w*0.18,y-4),(X(y2)-w*0.18,y2+4)],hi,max(1,w*0.10))
        cv.poly([(X(y2)-w*0.62,y2-w*0.10),(X(y2)+w*0.62,y2-w*0.10),(X(y2)+w*0.55,y2+w*0.10),(X(y2)-w*0.55,y2+w*0.10)],node_col)
        y=y2
def bamboo_leaves(cv,x,y,s,col,ang0,t,ph):
    for k in range(4):
        a=ang0+k*0.5-0.75+0.08*math.sin(t*1.3+ph+k)
        L=s*(1-0.15*abs(k-1.5)); W=L*0.16
        u=np.linspace(0,1,12); sp=np.stack([u*L,np.zeros_like(u)],1); ww=W*np.sin(np.pi*u)**0.8
        poly=np.vstack([sp+np.stack([np.zeros_like(u),ww],1),(sp-np.stack([np.zeros_like(u),ww],1))[::-1]])
        cv.poly(poly@R2(a).T+[x,y],col)
STALKS=[]
for layer in range(3):
    n=[11,8,5][layer]
    for i in range(n):
        x=(i+rng.uniform(-0.3,0.3))*FW/(n-1)
        STALKS.append(dict(L=layer,x=x,w=[16,30,52][layer]*rng.uniform(0.85,1.15),lean=rng.uniform(-0.04,0.04),
                           top=-200,bot=FH+200,ph=rng.uniform(0,6.3),leaf=[(rng.uniform(0.05,0.75),rng.uniform(-1,1)) for _ in range(3)]))
LCOL=[((0.10,0.38,0.38),(0.05,0.24,0.26),(0.25,0.60,0.56),(0.10,0.44,0.42)),
      ((0.12,0.52,0.48),(0.04,0.28,0.28),(0.45,0.88,0.80),(0.10,0.58,0.52)),
      ((0.04,0.22,0.24),(0.01,0.10,0.12),(0.22,0.55,0.52),(0.03,0.28,0.28))]
def bamboo_layer(layer,t,zoom,cx,cy,sway_k=1.0):
    cv=Cv(); col,node,hi,leaf=LCOL[layer]
    for s_ in STALKS:
        if s_['L']!=layer: continue
        x=cx+(s_['x']-FW/2)*zoom; w=s_['w']*zoom
        lean=s_['lean']+0.012*sway_k*math.sin(t*0.9+s_['ph'])
        bamboo_stalk(cv,x,w,-300,FH+300,col,node,hi,lean)
        for (fy,side) in s_['leaf']:
            y=FH*fy; xx=x+lean*(FH+300-y)
            bamboo_leaves(cv,xx,y,w*[4.0,3.2,1.9][layer],leaf,math.pi*(0.15 if side>0 else 0.85),t,s_['ph'])
    return cv.f()

# ---------------- slash + shatter ----------------
SLASHES=[dict(t=2.15,a=math.radians(-28),off=-120,col=RED),dict(t=2.33,a=math.radians(22),off=140,col=TEAL_L),
         dict(t=2.50,a=math.radians(-62),off=20,col=RED_L),dict(t=2.62,a=math.radians(8),off=-260,col=TEAL)]
def cut_masks(t):
    lab=np.zeros((FH,FW),np.int32)
    for i,s_ in enumerate(SLASHES):
        if t<s_['t']: continue
        nx,ny=-math.sin(s_['a']),math.cos(s_['a'])
        side=((_xx-FW/2)*nx+(_yy-FH*0.5-s_['off'])*ny)>0
        lab|=side.astype(np.int32)<<i
    return lab
def shatter(rgb,a,t):
    done=[i for i,s_ in enumerate(SLASHES) if t>=s_['t']]
    if not done: return rgb,a
    lab=cut_masks(t)
    out=np.zeros_like(rgb); oa=np.zeros_like(a)
    for v in np.unique(lab):
        m=(lab==v).astype(np.float32)
        if m.sum()<40: continue
        disp=np.zeros(2); rot=0.0
        for i in done:
            s_=SLASHES[i]; u=t-s_['t']
            nx,ny=-math.sin(s_['a']),math.cos(s_['a']); tx,ty=math.cos(s_['a']),math.sin(s_['a'])
            sg=1 if (v>>i)&1 else -1
            disp+=np.array([nx,ny])*sg*(18+140*eout(u/0.5)+220*u*u)+np.array([tx,ty])*sg*(60*eout(u/0.3)+300*u*u)
            rot+=sg*(4+20*u)*(1 if i%2 else -1)
        disp[1]+=260*max(0,t-2.6)**2
        ys,xs=np.nonzero(m[::16,::16]); c=(float(xs.mean()*16),float(ys.mean()*16))
        M=cv2.getRotationMatrix2D(c,rot,1.0); M[0,2]+=disp[0]; M[1,2]+=disp[1]
        r=cv2.warpAffine(rgb*m[...,None],M,(FW,FH)); aa=cv2.warpAffine(a*m,M,(FW,FH))
        out=r+out*(1-aa[...,None]); oa=aa+oa*(1-aa)
    return out,oa
def slash_fx(t,cv,gl):
    for s_ in SLASHES:
        u=t-s_['t']
        if u<0 or u>0.45: continue
        nx,ny=-math.sin(s_['a']),math.cos(s_['a']); tx,ty=math.cos(s_['a']),math.sin(s_['a'])
        c=np.array([FW/2,FH*0.5+s_['off']/ny if abs(ny)>0.2 else FH*0.5])
        L=1600; p=eout(u/0.08,2); fade=1-clamp((u-0.08)/0.37)
        a_=c-np.array([tx,ty])*L; b_=a_+np.array([tx,ty])*2*L*p
        w=26*fade
        poly=[a_+np.array([nx,ny])*0.5,b_+np.array([nx,ny])*w,b_-np.array([nx,ny])*w*0.2]
        cv.poly(poly,mix(s_['col'],(1,1,1),0.35)); gl.lines([a_,b_],s_['col'],w*1.6+4)
        cv.lines([a_,b_],(1,1,1),max(1,4*fade))
CHIPS=[dict(a=rng.uniform(0,6.28),v=rng.uniform(300,1300),s=rng.uniform(8,30),t0=SLASHES[i%4]['t'],spin=rng.uniform(-8,8),
            col=[(0.10,0.40,0.38),(0.20,0.60,0.55),RED,TEAL_L,(0.05,0.28,0.28)][i%5],leaf=i%3==0) for i in range(120)]
def chips(t,cv):
    for c_ in CHIPS:
        u=t-c_['t0']
        if u<=0 or u>1.6: continue
        d=c_['v']*eout(u,2)*0.9; x=FW/2+math.cos(c_['a'])*d; y=FH*0.5+math.sin(c_['a'])*d*0.8+300*u*u
        R=R2(c_['spin']*u); s=c_['s']
        if c_['leaf']: pts=np.array([(-s*1.4,0),(0,-s*0.28),(s*1.4,0),(0,s*0.28)])
        else: pts=np.array([(-s*0.35,-s),(s*0.35,-s*0.8),(s*0.3,s),(-s*0.3,s*0.9)])
        cv.poly(pts@R.T+[x,y],c_['col'])

# ---------------- full opening ----------------
def background(t,moon_k=1.0,zoom=1.0):
    img=np.zeros((FH,FW,3),np.float32)
    g=np.clip(_yy/FH,0,1)[...,None]
    img+=np.array(TEAL_DD,np.float32)*(1-g)+np.array((0.02,0.15,0.16),np.float32)*g
    # radial speed lines (card style)
    ang=np.arctan2(_yy-FH*0.42,_xx-FW/2); rad=np.hypot(_xx-FW/2,_yy-FH*0.42)
    lines=(np.sin(ang*60)>0.92).astype(np.float32)*np.clip((rad-260)/600,0,1)*0.06
    img+=lines[...,None]*np.array(TEAL_L,np.float32)
    # red moon
    if moon_k>0:
        mc=np.array([FW/2,FH*0.34]); r=230*zoom**0.5
        d=np.hypot(_xx-mc[0],_yy-mc[1])
        disc=np.clip((r-d)/2.5,0,1)
        img=img*(1-disc[...,None]*moon_k)+disc[...,None]*np.array((0.80,0.10,0.14),np.float32)*moon_k
        img+=np.exp(-np.maximum(d-r,0)/140)[...,None]*np.array(RED,np.float32)*0.45*moon_k*(1-disc[...,None])
        inner=np.clip((r*0.82-d)/2,0,1); img+=inner[...,None]*np.array((0.12,0.02,0.03),np.float32)*moon_k
    return img
T_SLASH=2.15
def opening(t,T_dive,T_cut):
    cx,cy=FW/2,FH*0.5
    # phase: mist (0-0.9), grass push (0.4-1.4), forest reveal (1.1-2.1), slash (2.15-2.7), shatter/out
    forest_k=eout((t-1.05)/0.7)
    img=background(t,moon_k=eout((t-0.9)/0.8),zoom=1+0.15*t)
    zf=1.0+0.08*t
    shake=np.array([math.sin(t*97)*12,math.cos(t*83)*10])*max([math.exp(-max(0,t-s['t'])*14) if t>=s['t'] else 0 for s in SLASHES]+[0])
    # bamboo forest (3 layers), rendered into one layer for shattering
    fr=np.zeros((FH,FW,3),np.float32); fa=np.zeros((FH,FW),np.float32)
    if forest_k>0:
        for L,(z,par) in enumerate(((zf*0.9,0.6),(zf,1.0),(zf*1.25,1.4))):
            r,a=bamboo_layer(L,t,z*(1+0.10*(1-forest_k)*par),cx+shake[0]*par,cy)
            # rise in from below
            dy=int((1-forest_k)*FH*0.6*par)
            if dy: r=np.roll(r,dy,0); a=np.roll(a,dy,0); r[:dy]=0; a[:dy]=0
            if L==0:   # mist between far and mid layer
                mr,ma=mist_layer(t,cx,cy,1.0,1.2,0,0.55,range(0,6)); over(r,mr,ma); a=np.maximum(a,ma)
            fr=r+fr*(1-a[...,None]); fa=a+fa*(1-a)
        fa*=forest_k; fr*=forest_k
        if t>=T_SLASH: fr,fa=shatter(fr,fa,t)
        if t>T_SLASH: fa*=1-clamp((t-2.95)/0.45); fr*=1-clamp((t-2.95)/0.45)
    over(img,fr,fa,1.0) if False else None
    img=fr+img*(1-fa[...,None])
    # mist in front of the forest; swirls, then blasts outward on the slashes
    spread=1.5*eio(clamp((t-1.15)/0.6))+(eout((t-T_SLASH)/0.6)*1.6 if t>T_SLASH else 0.0)
    mr,ma=mist_layer(t,cx,cy,eout(t/1.0),1.0+0.25*t,spread,0.95*(1-clamp((t-3.0)/0.6)),range(6,18))
    over(img,mr,ma)
    dc=Cv(); dots(dc,t); dr,da=dc.f(); over(img,dr,da*clamp(t/0.6)*(1-clamp((t-3.1)/0.4)))
    # grass we push through
    if t<1.6:
        gr,ga=grass_layer(t,eio(clamp((t-0.35)/1.15)))
        k=1-clamp((t-1.25)/0.35)
        img*=1-0.4*cv2.GaussianBlur(ga,(0,0),18)[...,None]*k
        over(img,gr,ga,k)
    # slashes + chips
    sc=Cv(); gl=Cv(); slash_fx(t,sc,gl); chips(t,sc)
    sr,sa=sc.f(); gr_,_=gl.f()
    img+=cv2.GaussianBlur(gr_,(0,0),14)*1.4+cv2.GaussianBlur(gr_,(0,0),4)*0.8; over(img,sr,sa)
    # flash per slash
    fl=sum(math.exp(-((t-s['t'])/0.03)**2) for s in SLASHES)*0.45
    img+=fl*np.array([1.0,0.85,0.85],np.float32)
    # after the cuts: crimson + teal energy vortex at the centre, pulls into the cut
    if t>2.85:
        k=clamp((t-2.85)/(T_cut-2.85))
        ang=np.arctan2(_yy-cy,_xx-cx); rad=np.hypot(_xx-cx,_yy-cy)
        vc=Cv()
        for i in range(8):
            th0=i*math.pi/4+t*2.2*(1+k); n=34; u=np.linspace(0,1,n)
            rr=(900-700*u)*(1.0-0.55*k)+40
            th=th0+u*2.4
            sp=np.stack([cx+np.cos(th)*rr,cy+np.sin(th)*rr],1)
            tone=RIB_TONES[i%5] if i%3 else ((0.45,0.03,0.08),(1.0,0.45,0.42),(0.85,0.15,0.20))
            ribbon(vc,curl_spine(sp,140,1.2,1),70*(1-0.3*k),tone,outline=4,side=1)
        vr,va=vc.f(); over(img,vr,va*clamp(k*3))
        img+=np.exp(-rad/(80+700*k**2))[...,None]*np.array((1.0,0.85,0.85),np.float32)*(0.4+2.2*k**2)
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.15,0.3,1)[...,None]; img*=vig
    img+=(clamp((t-(T_cut-0.18))/0.18)**2*1.3)*np.array([1.0,0.92,0.92],np.float32)
    return img
