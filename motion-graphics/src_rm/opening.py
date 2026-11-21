# Ramune opening: glitch + rock-stage beats, card back -> silhouette card (navy/neon pink/green)
import numpy as np, cv2, math, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import FW,FH,clamp,eio,eout,_yy,_xx,SPR
from fx import Cam,R2,ob,mix
SH=4; SC=16
PINK=(1.0,0.14,0.62); GREEN=(0.20,1.0,0.62); PINK_D=(0.42,0.03,0.30); GRN_D=(0.03,0.34,0.24)
BG=(0.03,0.01,0.07); VIOLET=(0.17,0.04,0.30); WHT=(0.97,0.97,1.0); CARD_BG=(0.07,0.02,0.12)
def c8(c): return tuple(int(max(0,min(1,v))*255) for v in c)

class Cv:
    """sized uint8 premultiplied canvas"""
    def __init__(s,w=FW,h=FH): s.w,s.h=w,h; s.rgb=np.zeros((h,w,3),np.uint8); s.a=np.zeros((h,w),np.uint8)
    def poly(s,pts,col,a=255):
        p=(np.asarray(pts)*SC).astype(np.int32)
        cv2.fillPoly(s.rgb,[p],c8(col),cv2.LINE_AA,SH); cv2.fillPoly(s.a,[p],a,cv2.LINE_AA,SH)
    def lines(s,pts,col,th,closed=False):
        p=(np.asarray(pts)*SC).astype(np.int32)
        cv2.polylines(s.rgb,[p],closed,c8(col),max(1,int(th)),cv2.LINE_AA,SH); cv2.polylines(s.a,[p],closed,255,max(1,int(th)),cv2.LINE_AA,SH)
    def circle(s,c,r,col,th=-1):
        cc=(int(c[0]*SC),int(c[1]*SC)); rr=max(1,int(r*SC))
        cv2.circle(s.rgb,cc,rr,c8(col),th if th<0 else max(1,int(th)),cv2.LINE_AA,SH); cv2.circle(s.a,cc,rr,255,th if th<0 else max(1,int(th)),cv2.LINE_AA,SH)
    def arc(s,c,r,a0,a1,col,th):
        if a1-a0<0.5 or r<1: return
        cc=(int(c[0]*SC),int(c[1]*SC)); rr=(int(r*SC),int(r*SC))
        cv2.ellipse(s.rgb,cc,rr,0,a0,a1,c8(col),max(1,int(th)),cv2.LINE_AA,SH); cv2.ellipse(s.a,cc,rr,0,a0,a1,255,max(1,int(th)),cv2.LINE_AA,SH)
    def f(s): return s.rgb.astype(np.float32)/255, s.a.astype(np.float32)/255

def over(img,rgb,a,op=1.0):
    img[...]=rgb*op+img*(1-a[...,None]*op); return img

# ---------------- glitch post-process ----------------
def glitch(img,k,seed):
    if k<=0.02: return img
    rng=np.random.default_rng(seed); H,W=img.shape[:2]
    out=img.copy(); dx=int(4+34*k)
    out[...,0]=np.roll(img[...,0],dx,axis=1); out[...,2]=np.roll(img[...,2],-dx,axis=1)
    for _ in range(int(3+14*k)):
        y0=int(rng.integers(0,H-10)); h=int(rng.integers(4,int(14+130*k)))
        sh=int(rng.choice([-1,1])*rng.uniform(15,160)*k)
        out[y0:y0+h]=np.roll(out[y0:y0+h],sh,axis=1)
    for _ in range(int(7*k)):
        x0=int(rng.integers(0,W-60)); y0=int(rng.integers(0,H-30)); w=int(rng.integers(30,int(60+260*k))); h=int(rng.integers(8,int(16+60*k)))
        if rng.random()<0.5: out[y0:y0+h,x0:x0+w]=1-out[y0:y0+h,x0:x0+w]
        else: out[y0:y0+h,x0:x0+w]=out[y0:y0+h,x0:x0+w]*0.3+np.array(PINK if rng.random()<0.5 else GREEN,np.float32)*0.7
    out[::3]*=1-0.22*k
    return out

# ---------------- stage background ----------------
def stage(t,env,k=1.0,horizon=0.64):
    img=np.zeros((FH,FW,3),np.float32)
    r=np.hypot((_xx-FW/2)/FW,(_yy-FH*0.45)/FH)
    img+=np.array(BG,np.float32)+(np.array(VIOLET,np.float32)-np.array(BG,np.float32))*np.clip(1-r*1.5,0,1)[...,None]*(0.8+0.4*env)
    # lasers
    lz=Cv()
    for i,(ox,col,sp,ph) in enumerate(((0,PINK,0.9,0.0),(FW,GREEN,-0.8,1.0),(FW*0.25,GREEN,0.6,2.0),(FW*0.75,PINK,-0.7,3.0))):
        a=math.radians(90+35*math.sin(t*sp+ph)); L=2600
        oy=FH*1.05; w=math.radians(0.9)
        lz.poly([(ox,oy),(ox+math.cos(-a-w)*L,oy+math.sin(-a-w)*L),(ox+math.cos(-a+w)*L,oy+math.sin(-a+w)*L)],col)
    lr,la=lz.f(); img+=lr*(0.16+0.35*env)*k+cv2.GaussianBlur(lr,(0,0),10)*(0.25+0.4*env)*k
    # perspective grid floor
    gl=Cv(); hy=FH*horizon; vx=FW/2
    for i in range(-12,13):
        gl.lines([(vx+i*12,hy),(vx+i*230,FH+40)],PINK,1.5)
    ph=(t/0.5)%1.0
    for j in range(14):
        f=((j+ph)/14)**2.2; y=hy+(FH-hy)*f
        gl.lines([(0,y),(FW,y)],PINK,1+2*f)
    gr,ga=gl.f(); fade=np.clip((_yy-hy)/(FH-hy),0,1)[...,None]
    img+=(gr*0.55+cv2.GaussianBlur(gr,(0,0),5)*0.8)*fade*(0.7+0.6*env)*k
    # horizon glow
    img+=np.exp(-np.abs(_yy-hy)/40)[...,None]*np.array(PINK,np.float32)*0.25*k
    return img

def eq_bars(t,env,y_base=FH,k=1.0,n=28,hmax=260):
    cv=Cv(); w=FW/n
    for i in range(n):
        v=0.35+0.65*abs(math.sin(t*3.1+i*1.7)*math.cos(t*1.7+i*0.6))
        h=hmax*(0.25+0.75*v)*(0.55+0.45*env)
        col=mix(GREEN,PINK,i/(n-1))
        segs=int(h/14)
        for s_ in range(segs):
            y=y_base-8-s_*14
            cv.poly([(i*w+4,y-10),(i*w+w-4,y-10),(i*w+w-4,y),(i*w+4,y)],col)
    r,a=cv.f(); return r*k,a*k

# ---------------- emblem: Flying-V guitar in a diamond ----------------
def emblem(cv,C,S,p,col1=PINK,col2=GREEN,th=3,fill=False):
    """C centre, S half-size. p 0..1 build progress"""
    x,y=C
    def seg(a,b,q,col,t_):
        if q<=0: return
        a=np.array(a); b=np.array(b); cv.lines([a,a+(b-a)*clamp(q)],col,t_)
    D=[(x,y-S),(x+S,y),(x,y+S),(x-S,y)]
    for i in range(4): seg(D[i],D[(i+1)%4],p*5-i*0.9,col1,th)
    d=S*0.86; D2=[(x,y-d),(x+d,y),(x,y+d),(x-d,y)]
    for i in range(4): seg(D2[i],D2[(i+1)%4],p*5-1-i*0.7,col2,max(1,th*0.6))
    q=clamp((p-0.35)/0.4)
    if q>0:
        g=S*0.78*ob(q)
        # flying-V body (pointing down-left), neck up-right
        R=R2(math.radians(-35))
        body=np.array([(-0.10,0.05),(0.95,-0.38),(0.55,-0.05),(0.95,0.30),(-0.10,0.05)])*[g,g]
        body=body*[-1,1]+[g*0.35,g*0.25]
        neck=np.array([(0.25,0.05),(-0.95,0.05)])*g
        P=lambda pts: np.asarray(pts)@R.T+[x,y]
        cv.poly(P(body),mix(col1,(0,0,0),0.25) if fill else mix(col1,(0.05,0.0,0.1),0.55))
        cv.lines(P(body),col1,th,True)
        cv.lines(P(neck),col2,th)
        hs=np.array([(-0.95,-0.02),(-1.18,-0.10),(-1.22,0.12),(-0.95,0.12)])*g
        cv.lines(P(hs),col2,th,True)
        for k in range(3): cv.circle(P([(0.40+k*0.10,0.05)])[0],max(1,g*0.03),col2)
    q2=clamp((p-0.6)/0.4)
    if q2>0:
        for sgn,col in ((-1,col2),(1,col1)):
            for k in range(3):
                r=S*(0.30+0.14*k)*eout(q2)
                cv.arc((x+sgn*S*0.12,y),r,(180-40 if sgn<0 else -40),(180+40 if sgn<0 else 40),col,max(1,th*0.7))
        for sgn in (-1,1):   # lightning bolts at the side corners
            bx=x+sgn*S*1.18; L=S*0.35*ob(q2)
            bolt=[(bx,y-L),(bx+sgn*L*0.25,y-L*0.1),(bx-sgn*L*0.10,y),(bx+sgn*L*0.20,y+L)]
            cv.lines(bolt,WHT,max(1,th*0.8))

# ---------------- card faces (offscreen) ----------------
CW,CH=992,1616            # 1.6x of 620x1010
def rrect(w,h,r,n=8):
    pts=[]
    for cx,cy,a0 in ((w-r,r,-90),(w-r,h-r,0),(r,h-r,90),(r,r,180)):
        for a in np.linspace(a0,a0+90,n): pts.append((cx+math.cos(math.radians(a))*r,cy+math.sin(math.radians(a))*r))
    return np.array(pts)
CARD_POLY=rrect(CW,CH,60)
_mask=np.zeros((CH,CW),np.uint8); cv2.fillPoly(_mask,[(CARD_POLY*SC).astype(np.int32)],255,cv2.LINE_AA,SH); CARD_MASK=_mask.astype(np.float32)/255
_sa=SPR[...,3].astype(np.float32)/255
_sil=cv2.resize(_sa,(int(CH*0.86*_sa.shape[1]/_sa.shape[0]),int(CH*0.86)),interpolation=cv2.INTER_AREA)
def card_border(cv,glow,t,p=1.0,env=0.0):
    w,h=CW,CH
    for inset,col,th in ((22,PINK,6),(42,GREEN,3)):
        pts=rrect(w-2*inset,h-2*inset,48)+inset
        n=int(len(pts)*clamp(p))
        if n>1:
            cv.lines(pts[:n],col,th,n==len(pts)); glow.lines(pts[:n],col,th*3,n==len(pts))
    if p>0.6:
        k=clamp((p-0.6)/0.4)
        for (x,y,sx,sy) in ((70,70,1,1),(w-70,70,-1,1),(70,h-70,1,-1),(w-70,h-70,-1,1*-1)):
            d=26*k; cv.poly([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],PINK); glow.poly([(x,y-d),(x+d,y),(x,y+d),(x-d,y)],PINK)
            cv.lines([(x+sx*40,y),(x+sx*(40+140*k),y)],GREEN,3); cv.lines([(x,y+sy*40),(x,y+sy*(40+140*k))],GREEN,3)
        for (x,y) in ((w/2,40),(w/2,h-40)):
            d=18*k; cv.poly([(x,y-d),(x+d*1.6,y),(x,y+d),(x-d*1.6,y)],GREEN); glow.poly([(x,y-d),(x+d*1.6,y),(x,y+d),(x-d*1.6,y)],GREEN)
def card_back(t,p_build,env):
    cv=Cv(CW,CH); gl=Cv(CW,CH)
    cv.poly(CARD_POLY,CARD_BG)
    # swirling flat bands (card-back pattern)
    for i in range(7):
        r=180+i*95; a0=t*25*(1 if i%2 else -1)+i*40
        col=PINK_D if i%2 else GRN_D
        cv.arc((CW/2,CH/2),r,a0,a0+250,col,34)
    for j in range(-6,7):     # diagonal stripes, top/bottom bands
        x=CW/2+j*120; cv.lines([(x-300,0),(x+300,330)],(0.12,0.03,0.20),20); cv.lines([(x-300,CH),(x+300,CH-330)],(0.12,0.03,0.20),20)
    card_border(cv,gl,t,p_build*1.4,env)
    em=Cv(CW,CH); emblem(em,(CW/2,CH/2),300,p_build,th=7,fill=True); emblem(gl,(CW/2,CH/2),300,p_build,th=18)
    r,a=cv.f(); er,ea=em.f(); over(r,er,ea); a=np.maximum(a,ea)
    gr,_=gl.f()
    return r*CARD_MASK[...,None],a*CARD_MASK,gr*(0.8+1.2*env)
def card_front(t,env,p):
    cv=Cv(CW,CH); gl=Cv(CW,CH)
    rgb=np.zeros((CH,CW,3),np.float32)
    g=np.linspace(0,1,CH)[:,None,None]
    rgb[:]=np.array(PINK_D,np.float32)*(1-g)+np.array(GRN_D,np.float32)*g
    # radial rays behind the silhouette
    ang=np.arctan2(np.mgrid[0:CH,0:CW][0]-CH*0.40,np.mgrid[0:CH,0:CW][1]-CW/2)
    rays=(np.sin(ang*16+t*1.5)>0.55).astype(np.float32)
    rgb+=rays[...,None]*0.07
    # silhouette with halftone stripes
    sh,sw=_sil.shape; y0=CH-sh-40; x0=(CW-sw)//2
    sil=np.zeros((CH,CW),np.float32)
    xs0,xs1=max(0,x0),min(CW,x0+sw); sil[y0:y0+sh,xs0:xs1]=_sil[:,xs0-x0:xs1-x0]
    stripes=0.85+0.15*(np.sin((np.mgrid[0:CH,0:CW][0])*0.35)>0)
    silcol=np.array((0.05,0.01,0.10),np.float32)
    rgb=rgb*(1-sil[...,None])+silcol*sil[...,None]*stripes[...,None]
    rim=np.clip(cv2.GaussianBlur(sil,(0,0),6)-sil,0,1)
    rgb+=rim[...,None]*np.array(GREEN,np.float32)*1.6
    # speaker stacks along the bottom
    for i,(x,w_,h_) in enumerate(((120,170,240),(300,150,170),(700,150,170),(870,170,240))):
        cv.poly([(x-w_/2,CH),(x-w_/2,CH-h_),(x+w_/2,CH-h_),(x+w_/2,CH)],(0.04,0.01,0.07))
        for k in range(int(h_/90)):
            cv.circle((x,CH-h_+55+k*90),32*(1+0.12*env),(0.20,0.05,0.25)); cv.circle((x,CH-h_+55+k*90),12,PINK if i%2 else GREEN)
    card_border(cv,gl,t,1.0,env)
    emblem(cv,(CW/2,CH*0.46),250,p,th=7); emblem(gl,(CW/2,CH*0.46),250,p,th=20)
    cr,ca=cv.f(); over(rgb,cr,ca)
    gr,_=gl.f()
    return rgb*CARD_MASK[...,None],CARD_MASK,gr*(0.8+1.2*env)
def place_card(img,face,cx,cy,scale,rot_deg,flip_c):
    rgb,a,gl=face
    hw,hh=CW/2,CH/2
    src=np.float32([[0,0],[CW,0],[CW,CH],[0,CH]])
    sx=scale*760/CW; sxf=sx*flip_c
    persp=0.10*(1-abs(flip_c))
    pts=[]
    for (u,v) in ((-hw,-hh),(hw,-hh),(hw,hh),(-hw,hh)):
        x=u*sxf; y=v*sx*(1+persp*(1 if u*flip_c>0 else -1)*0.5)
        x,y=R2(math.radians(rot_deg))@[x,y]; pts.append((cx+x,cy+y))
    M=cv2.getPerspectiveTransform(src,np.float32(pts))
    W=lambda m: cv2.warpPerspective(m,M,(FW,FH),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
    r=W(rgb); aa=W(a); g=W(gl)
    img*=1-0.55*cv2.GaussianBlur(aa,(0,0),30)[...,None]
    img+=cv2.GaussianBlur(g,(0,0),14)*0.9
    over(img,r,aa); img+=g*0.15
    return img

# ---------------- particles ----------------
rng=np.random.default_rng(61)
HITS=[0.5,1.0,1.5,2.0,2.5,3.0,3.25,3.5,3.75]
def hit_env(t,hits=HITS,decay=8.0):
    v=0.0
    for h in hits:
        if t>=h: v=max(v,math.exp(-(t-h)*decay))
    return v
PIX=[dict(a=rng.uniform(0,6.283),v=rng.uniform(300,1100),s=rng.uniform(6,18),c=[PINK,GREEN,WHT][i%3],h=HITS[i%len(HITS)],spin=rng.uniform(-6,6)) for i in range(140)]
NOTES=[dict(x=rng.uniform(60,FW-60),y=rng.uniform(FH*0.3,FH*1.1),v=rng.uniform(60,140),s=rng.uniform(18,34),c=[PINK,GREEN][i%2],ph=rng.uniform(0,6.3)) for i in range(14)]
def note(cv,x,y,s,col,ang=0.0):
    R=R2(ang); P=lambda pts: np.asarray(pts)@R.T+[x,y]
    ang_=np.linspace(0,2*math.pi,20); head=np.stack([np.cos(ang_)*s*0.42,np.sin(ang_)*s*0.30],1)@R2(-0.4).T
    cv.poly(P(head),col); cv.lines(P([(s*0.38,0),(s*0.38,-s*1.4)]),col,max(1,s*0.12)); cv.poly(P([(s*0.38,-s*1.4),(s*0.85,-s*1.05),(s*0.80,-s*0.85),(s*0.38,-s*1.15)]),col)
def burst_shape(cv,C,r,col,n=12,rot=0.0):
    pts=[]
    for i in range(n*2):
        a=rot+i*math.pi/n; rr=r if i%2==0 else r*0.55
        pts.append((C[0]+math.cos(a)*rr,C[1]+math.sin(a)*rr))
    cv.poly(pts,col)

def opening(t,T_dive,T_cut):
    env=hit_env(t)
    shake=np.array([math.sin(t*93)*14,math.cos(t*71)*12])*env
    img=stage(t,env,clamp(t/0.5))
    cx,cy=FW/2+shake[0],FH*0.46+shake[1]
    # comic POW bursts behind the card on big hits
    bc=Cv()
    for i,h in enumerate(HITS[:6]):
        u=t-h
        if 0<=u<0.35:
            r=520*eout(u/0.2)*(1-0.3*u); bc.poly([],PINK) if False else None
            burst_shape(bc,(cx+(-220 if i%2 else 230),cy+(-380 if i%3 else 360)),r*0.55,PINK if i%2 else GREEN,12,i)
    br,ba=bc.f(); over(img,br*0.9,ba*0.9*(1-clamp((t-T_dive)/0.3)))
    # shockwave rings
    rl=Cv()
    for h in HITS:
        u=t-h
        if 0<=u<0.6: rl.circle((cx,cy),120+1500*eout(u/0.6),PINK if int(h*4)%2 else GREEN,max(1,10*(1-u/0.6)))
    rr,_=rl.f(); img+=rr*0.8+cv2.GaussianBlur(rr,(0,0),8)*1.2
    # the card
    if t>=0.5:
        slam=eout((t-0.5)/0.18,3)
        sc=2.3-1.3*slam; rot=-10*(1-slam)
        if t<1.5: flip=1.0
        else: flip=math.cos(math.pi*eio((t-1.5)/0.32))
        zoom=1.0+0.14*eio((t-1.8)/1.2)+ (1.8*eio((t-3.0)/(T_cut-3.0)) if t>3.0 else 0)
        punch=1+0.05*env
        sc*=zoom*punch
        if flip>=0: face=card_back(t,eout((t-0.55)/0.8),env)
        else: face=card_front(t,env,eout((t-1.85)/0.6))
        if t>=1.5 and flip<0: flip=-flip
        ccy=cy+(FH*0.06 if t>3.0 else 0)*eio((t-3.0)/(T_cut-3.0))
        place_card(img,face,cx,ccy,sc,rot+math.sin(t*1.3)*1.5,max(0.04,flip))
    # pixel confetti + notes
    pc=Cv()
    for p_ in PIX:
        u=t-p_['h']
        if 0<u<1.0:
            d=p_['v']*eout(u,2); x=cx+math.cos(p_['a'])*d; y=cy+math.sin(p_['a'])*d+200*u*u
            s=p_['s']*(1-u); R=R2(p_['spin']*u)
            sq=np.array([(-s,-s),(s,-s),(s,s),(-s,s)])@R.T+[x,y]; pc.poly(sq,p_['c'])
    for n_ in NOTES:
        if t<1.0: break
        y=(n_['y']-n_['v']*t)%(FH*1.2)-60; x=n_['x']+30*math.sin(t*1.4+n_['ph'])
        note(pc,x,y,n_['s']*(1+0.25*env),n_['c'],0.2*math.sin(t*2+n_['ph']))
    prr,pa=pc.f(); img+=cv2.GaussianBlur(prr,(0,0),6)*0.8; over(img,prr,pa)
    # equalizer
    er,ea=eq_bars(t,env,FH,clamp((t-0.9)/0.4)); img+=cv2.GaussianBlur(er,(0,0),8)*0.6; over(img,er,ea)
    # intro static
    if t<0.55:
        nz=np.random.default_rng(int(t*30)).random((FH//4,FW//4)).astype(np.float32)
        nz=cv2.resize(nz,(FW,FH),interpolation=cv2.INTER_NEAREST)[...,None]
        img=img*(0.4+0.6*clamp(t/0.5))+nz*0.35*(1-clamp(t/0.55))
    # invert flash on the big downbeats
    for h in (0.5,1.5,2.5):
        if 0<=t-h<1/30+1e-6: img=1-np.clip(img,0,1)
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.1,0.35,1)[...,None]
    img*=vig
    gk=0.0
    if t<0.5: gk=0.6
    gk=max(gk,max(0,env-0.35)*0.9)
    if t>T_cut-0.3: gk=max(gk,clamp((t-(T_cut-0.3))/0.3)*1.2)
    img=glitch(img,gk,int(t*30)*7+1)
    img+=(clamp((t-(T_cut-0.12))/0.12)**2*0.9)*np.array([1.0,0.55,0.85],np.float32)
    return img
